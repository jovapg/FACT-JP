/**
 * routes/payroll.js — Nómina / asistencia del personal
 *
 * La trabajadora (cajero) registra sus días trabajados; el admin los corrige,
 * aprueba y genera el pago. El pago se refleja como egresos de tipo `nomina`
 * en Finanzas (leídos desde payroll.json por finance.js).
 *
 * Cada día reportado tiene:
 *   - date (YYYY-MM-DD), type (completo | medio | rato)
 *   - from/to + hours (solo para "rato")
 *   - area (bar | restaurante | ambos)  → "ambos" reparte 50/50
 *   - amount y su reparto amountBar / amountRest (a qué bolsillo pertenece)
 *   - status (pendiente → aprobado → pagado)
 *
 * Tarifas (editables por el admin): día completo, medio día y valor por hora.
 * El monto se calcula SIEMPRE en el servidor (el cliente no puede falsearlo).
 *
 * Rutas:
 *   GET    /payroll                → listar días (cajero: solo los suyos)
 *   GET    /payroll/rates          → tarifas vigentes
 *   PUT    /payroll/rates          → editar tarifas (admin)
 *   POST   /payroll                → registrar un día (cajero: para sí mismo)
 *   PUT    /payroll/:id            → editar un día (cajero: propio y pendiente)
 *   DELETE /payroll/:id            → eliminar un día (no si está pagado)
 *   POST   /payroll/approve        → aprobar días { ids } (admin)
 *   POST   /payroll/pay            → generar pago { employeeId, ids, method } (admin)
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, getBusinessPath } = require('../services/fileStorage');
const { authenticate } = require('../middleware/auth');

const payrollPath = (id) => path.join(getBusinessPath(id), 'payroll.json');

/** Tarifas por defecto (COP). Editables por el admin. */
const DEFAULT_RATES = { dia: 50000, medio: 25000, hora: 6250 };

const isAdmin = (req) => req.user.role === 'superadmin' || req.user.role === 'admin';

/** Carga payroll.json normalizado: { rates, employeeRates, entries, payments }. */
async function loadPayroll(id) {
  const data = await readJSON(payrollPath(id));
  if (!data || Array.isArray(data)) {
    // Formato viejo (array suelto) o inexistente → normalizar
    return { rates: { ...DEFAULT_RATES }, employeeRates: {}, entries: Array.isArray(data) ? data : [], payments: [] };
  }
  return {
    rates: { ...DEFAULT_RATES, ...(data.rates || {}) },
    employeeRates: (data.employeeRates && typeof data.employeeRates === 'object') ? data.employeeRates : {},
    entries: Array.isArray(data.entries) ? data.entries : [],
    payments: Array.isArray(data.payments) ? data.payments : []
  };
}

async function savePayroll(id, data) { await writeJSON(payrollPath(id), data); }

/**
 * Saldo de un empleado por bolsillo: lo que se le debe (días APROBADOS) menos lo
 * que ya se le abonó (payments). Los días viejos con status 'pagado' (modelo
 * anterior) ya están saldados y no cuentan aquí.
 * @returns { owedBar, owedRest, paidBar, paidRest, balanceBar, balanceRest }
 */
function employeeBalance(data, employeeId) {
  let owedBar = 0, owedRest = 0, paidBar = 0, paidRest = 0;
  for (const e of data.entries) {
    if (e.employeeId !== employeeId || e.status !== 'aprobado') continue;
    owedBar += e.amountBar || 0;
    owedRest += e.amountRest || 0;
  }
  for (const p of data.payments) {
    if (p.employeeId !== employeeId) continue;
    paidBar += p.amountBar || 0;
    paidRest += p.amountRest || 0;
  }
  return {
    owedBar, owedRest, paidBar, paidRest,
    balanceBar: owedBar - paidBar,
    balanceRest: owedRest - paidRest
  };
}

/** Tarifa efectiva de un empleado: su tarifa propia si existe, si no la general. */
function ratesFor(data, employeeId) {
  const o = data.employeeRates[employeeId];
  return o ? { ...data.rates, ...o } : data.rates;
}

/** Horas decimales entre dos "HH:MM" (soporta cruce de medianoche). */
function hoursBetween(from, to) {
  if (!from || !to) return 0;
  const [fh, fm] = String(from).split(':').map(Number);
  const [th, tm] = String(to).split(':').map(Number);
  if ([fh, fm, th, tm].some(isNaN)) return 0;
  let mins = (th * 60 + tm) - (fh * 60 + fm);
  if (mins < 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

/** Monto del día según tipo y tarifas. */
function calcAmount(type, hours, rates) {
  if (type === 'completo') return rates.dia;
  if (type === 'medio') return rates.medio;
  if (type === 'rato') return Math.round((hours || 0) * rates.hora);
  return 0;
}

/** Reparte el monto entre Bar y Restaurante. "ambos" → 50/50 (el resto va a bar). */
function splitByArea(amount, area) {
  if (area === 'restaurante') return { bar: 0, rest: amount };
  if (area === 'bar') return { bar: amount, rest: 0 };
  const bar = Math.round(amount / 2); // ambos
  return { bar, rest: amount - bar };
}

/**
 * Construye un día normalizado a partir del body, calculando monto y reparto
 * en el servidor. `base` permite conservar campos al editar.
 */
function buildEntry(body, rates, base = {}) {
  const type = ['completo', 'medio', 'rato'].includes(body.type) ? body.type : (base.type || 'completo');
  const area = ['bar', 'restaurante', 'ambos'].includes(body.area) ? body.area : (base.area || 'ambos');
  const from = type === 'rato' ? (body.from ?? base.from ?? null) : null;
  const to = type === 'rato' ? (body.to ?? base.to ?? null) : null;
  const hours = type === 'rato' ? hoursBetween(from, to) : null;
  const amount = calcAmount(type, hours, rates);
  const split = splitByArea(amount, area);
  return {
    ...base,
    date: (body.date || base.date || new Date().toISOString().slice(0, 10)).slice(0, 10),
    type, area, from, to, hours,
    amount,
    amountBar: split.bar,
    amountRest: split.rest,
    note: body.note !== undefined ? body.note : (base.note || '')
  };
}

/** GET /payroll — cajero ve solo lo suyo; admin ve todo. Filtros opcionales. */
router.get('/payroll', authenticate, async (req, res) => {
  try {
    const data = await loadPayroll(req.params.businessId);
    let list = data.entries;
    if (!isAdmin(req)) {
      list = list.filter(e => e.employeeId === req.user.id);
    } else if (req.query.employeeId) {
      list = list.filter(e => e.employeeId === req.query.employeeId);
    }
    const { from, to } = req.query;
    if (from) list = list.filter(e => e.date >= from);
    if (to) list = list.filter(e => e.date <= to);
    list = [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Pagos (abonos): admin ve todos; cajero solo los suyos
    const payments = isAdmin(req) ? data.payments : data.payments.filter(p => p.employeeId === req.user.id);

    if (isAdmin(req)) {
      // El admin recibe la tarifa general + el mapa de tarifas por persona
      res.json({ entries: list, payments, rates: data.rates, employeeRates: data.employeeRates });
    } else {
      // El cajero solo recibe SU tarifa efectiva (para la vista previa), sin ver las demás
      res.json({ entries: list, payments, rates: ratesFor(data, req.user.id), employeeRates: {} });
    }
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /payroll/rates — tarifas vigentes */
router.get('/payroll/rates', authenticate, async (req, res) => {
  try {
    const { rates } = await loadPayroll(req.params.businessId);
    res.json(rates);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/** PUT /payroll/rates — editar tarifas (admin) */
router.put('/payroll/rates', authenticate, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const data = await loadPayroll(req.params.businessId);
    const r = req.body || {};
    data.rates = {
      dia: Math.max(0, Number(r.dia) || 0),
      medio: Math.max(0, Number(r.medio) || 0),
      hora: Math.max(0, Number(r.hora) || 0)
    };
    await savePayroll(req.params.businessId, data);
    res.json(data.rates);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /payroll/employee-rate — fija (o quita) la tarifa propia de un empleado (admin).
 * Body: { employeeId, dia, medio, hora }  → fija la tarifa personalizada
 *       { employeeId, clear: true }        → la quita (vuelve a usar la general)
 */
router.put('/payroll/employee-rate', authenticate, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const { employeeId } = req.body;
    if (!employeeId) return res.status(400).json({ error: 'Falta el empleado' });
    const data = await loadPayroll(req.params.businessId);
    if (req.body.clear) {
      delete data.employeeRates[employeeId];
    } else {
      const r = req.body;
      data.employeeRates[employeeId] = {
        dia: Math.max(0, Number(r.dia) || 0),
        medio: Math.max(0, Number(r.medio) || 0),
        hora: Math.max(0, Number(r.hora) || 0)
      };
    }
    await savePayroll(req.params.businessId, data);
    res.json(data.employeeRates);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /payroll — registrar un día. Cajero lo registra para sí mismo. */
router.post('/payroll', authenticate, async (req, res) => {
  try {
    const data = await loadPayroll(req.params.businessId);
    const admin = isAdmin(req);

    // Cajero: siempre para sí mismo. Admin: para sí, para un usuario existente
    // (employeeId) o para un trabajador ocasional sin cuenta (solo employeeName).
    let employeeId = req.user.id;
    let employeeName = req.user.name || req.user.username;
    if (admin) {
      if (req.body.employeeId) {
        employeeId = req.body.employeeId;
        employeeName = req.body.employeeName || employeeName;
      } else if (req.body.employeeName && req.body.employeeName.trim()) {
        // Trabajador por días sin usuario: id estable derivado del nombre
        employeeName = req.body.employeeName.trim();
        employeeId = 'manual:' + employeeName.toLowerCase().replace(/\s+/g, '-');
      }
    }

    const now = new Date().toISOString();
    const author = req.user.name || req.user.username;
    const entry = {
      id: uuidv4(),
      employeeId,
      employeeName,
      // Lo que registra el admin queda aprobado al instante (él es quien aprueba);
      // lo que reporta el cajero entra pendiente de revisión.
      status: admin ? 'aprobado' : 'pendiente',
      createdAt: now,
      createdBy: author,
      ...(admin ? { approvedBy: author, approvedAt: now } : {}),
      ...buildEntry(req.body, ratesFor(data, employeeId))
    };
    data.entries.push(entry);
    await savePayroll(req.params.businessId, data);
    res.status(201).json(entry);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/** PUT /payroll/:id — editar un día */
router.put('/payroll/:id', authenticate, async (req, res) => {
  try {
    const data = await loadPayroll(req.params.businessId);
    const idx = data.entries.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Registro no encontrado' });
    const entry = data.entries[idx];

    // Un día ya pagado no se puede editar (ya generó egresos en Finanzas)
    if (entry.status === 'pagado') {
      return res.status(400).json({ error: 'Este día ya fue pagado y no se puede editar.' });
    }
    // El cajero solo edita lo suyo y solo mientras esté pendiente
    if (!isAdmin(req)) {
      if (entry.employeeId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
      if (entry.status !== 'pendiente') {
        return res.status(400).json({ error: 'No puedes editar un día que ya fue aprobado.' });
      }
    }

    data.entries[idx] = {
      ...buildEntry(req.body, ratesFor(data, entry.employeeId), entry),
      editedAt: new Date().toISOString(),
      editedBy: req.user.name || req.user.username
    };
    await savePayroll(req.params.businessId, data);
    res.json(data.entries[idx]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/** DELETE /payroll/:id — eliminar un día (no si está pagado) */
router.delete('/payroll/:id', authenticate, async (req, res) => {
  try {
    const data = await loadPayroll(req.params.businessId);
    const entry = data.entries.find(e => e.id === req.params.id);
    if (!entry) return res.status(404).json({ error: 'Registro no encontrado' });
    if (entry.status === 'pagado') {
      return res.status(400).json({ error: 'Este día ya fue pagado y no se puede eliminar.' });
    }
    if (!isAdmin(req)) {
      if (entry.employeeId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
      if (entry.status !== 'pendiente') {
        return res.status(400).json({ error: 'No puedes eliminar un día que ya fue aprobado.' });
      }
    }
    data.entries = data.entries.filter(e => e.id !== req.params.id);
    await savePayroll(req.params.businessId, data);
    res.json({ success: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /payroll/approve — aprobar días { ids: [...] } (admin) */
router.post('/payroll/approve', authenticate, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ error: 'Sin días para aprobar' });
    const data = await loadPayroll(req.params.businessId);
    let count = 0;
    for (const e of data.entries) {
      if (ids.includes(e.id) && e.status === 'pendiente') {
        e.status = 'aprobado';
        e.approvedBy = req.user.name || req.user.username;
        e.approvedAt = new Date().toISOString();
        count++;
      }
    }
    await savePayroll(req.params.businessId, data);
    res.json({ success: true, approved: count });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /payroll/pay — registrar un abono/pago al empleado (admin).
 * Body: { employeeId, employeeName?, amountBar, amountRest, method, date?, note? }
 *
 * Es un abono por MONTOS (parcial permitido): se digita cuánto se paga de Bar y
 * cuánto de Restaurante. No puede pasar del saldo que se le debe en cada bolsillo.
 * Baja el saldo del empleado; los egresos en Finanzas se derivan de estos pagos.
 */
router.post('/payroll/pay', authenticate, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const { employeeId, method } = req.body;
    if (!employeeId) return res.status(400).json({ error: 'Falta el empleado' });

    const amountBar = Math.max(0, Math.round(Number(req.body.amountBar) || 0));
    const amountRest = Math.max(0, Math.round(Number(req.body.amountRest) || 0));
    if (amountBar + amountRest <= 0) return res.status(400).json({ error: 'El pago debe ser mayor a 0' });

    const data = await loadPayroll(req.params.businessId);
    const bal = employeeBalance(data, employeeId);

    // Tope: no se puede pagar más de lo que se le debe en cada bolsillo
    if (amountBar > bal.balanceBar) {
      return res.status(400).json({ error: `El abono de Bar (${amountBar}) supera lo que se debe (${bal.balanceBar}).` });
    }
    if (amountRest > bal.balanceRest) {
      return res.status(400).json({ error: `El abono de Restaurante (${amountRest}) supera lo que se debe (${bal.balanceRest}).` });
    }

    const paidAt = (req.body.date && !isNaN(new Date(req.body.date).getTime()))
      ? new Date(req.body.date).toISOString() : new Date().toISOString();

    const payment = {
      id: uuidv4(),
      employeeId,
      employeeName: req.body.employeeName || '',
      amountBar, amountRest,
      method: method === 'banco' ? 'banco' : 'efectivo',
      date: paidAt,
      note: req.body.note || '',
      paidBy: req.user.name || req.user.username
    };
    data.payments.push(payment);
    await savePayroll(req.params.businessId, data);

    const after = employeeBalance(data, employeeId);
    res.json({
      success: true, payment,
      total: amountBar + amountRest,
      balanceBar: after.balanceBar, balanceRest: after.balanceRest
    });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
