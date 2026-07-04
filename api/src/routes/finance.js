/**
 * routes/finance.js — Módulo de Finanzas / flujo de caja
 *
 * Unifica TODO el movimiento de dinero del negocio en un solo libro y calcula
 * los saldos de efectivo y banco, partidos por área (Bar / Restaurante).
 *
 * El libro NO se almacena: se deriva en tiempo real de las fuentes existentes,
 * así nunca se desincroniza. Fuentes:
 *   - Ingresos  → turnos CERRADOS (incomeByAreaBucket), por área × efectivo/banco
 *   - Egresos   → compras/gastos/arriendo (purchases.json)
 *   - Egresos   → pagos a proveedores/empleados/créditos (suppliers.json payments)
 *   - Egresos   → retiros y gastos de caja menor de los turnos (efectivo, general)
 *   - Manuales  → ingresos/egresos/traslados sueltos (finance.json)
 *   - Saldo inicial (finance.json) → punto de partida por área × bucket
 *
 * Saldo = saldo inicial + Σ(movimientos desde la fecha de inicio).
 * Solo movimientos con fecha >= openingDate cuentan (lo anterior ya está
 * reflejado en el saldo inicial).
 *
 * Rutas (solo admin/superadmin):
 *   GET    /api/:businessId/finance            → saldos + movimientos del periodo
 *   PUT    /api/:businessId/finance/opening    → fijar saldo inicial + fecha
 *   POST   /api/:businessId/finance/manual     → agregar movimiento manual
 *   DELETE /api/:businessId/finance/manual/:id → eliminar movimiento manual
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, getBusinessPath } = require('../services/fileStorage');
const { authenticate } = require('../middleware/auth');

const financePath   = (id) => path.join(getBusinessPath(id), 'finance.json');
const shiftsPath    = (id) => path.join(getBusinessPath(id), 'shifts.json');
const purchasesPath = (id) => path.join(getBusinessPath(id), 'purchases.json');
const suppliersPath = (id) => path.join(getBusinessPath(id), 'suppliers.json');
const salesPath     = (id) => path.join(getBusinessPath(id), 'sales.json');
const debtorsPath   = (id) => path.join(getBusinessPath(id), 'debtors.json');

/** Bucket de Finanzas según forma de pago: 💵 efectivo o 🏦 banco */
function bucketOfMethod(m) {
  const v = (m || '').toLowerCase();
  return (v === 'banco' || v === 'transferencia' || v === 'tarjeta') ? 'banco' : 'efectivo';
}

const emptyArea = () => ({ efectivo: 0, banco: 0 });
const emptyBalances = () => ({ bar: emptyArea(), restaurante: emptyArea(), general: emptyArea() });

/** Solo admin/superadmin pueden ver/editar Finanzas */
function adminOnly(req, res, next) {
  if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
  next();
}

/** Lee la config de Finanzas (saldo inicial, fecha de inicio y movimientos manuales) */
async function loadConfig(id) {
  const cfg = await readJSON(financePath(id)) || {};
  return {
    opening: cfg.opening || { bar: emptyArea(), restaurante: emptyArea() },
    openingDate: cfg.openingDate || null,
    manual: Array.isArray(cfg.manual) ? cfg.manual : [],
    // Resumen del mes solo de referencia (NO afecta los saldos)
    reference: cfg.reference || { bar: { ventas: 0, salidas: 0 }, restaurante: { ventas: 0, salidas: 0 } },
    // Meta de costo (food cost %) configurable
    costTarget: cfg.costTarget || { min: 30, max: 40 }
  };
}
async function saveConfig(id, cfg) { await writeJSON(financePath(id), cfg); }

function bucketOfPayment(pay) {
  const v = pay.paidWith || pay.method;
  return (v === 'banco' || v === 'transferencia' || v === 'tarjeta') ? 'banco' : 'efectivo';
}
function kindOfTipo(tipo) {
  return tipo === 'empleado' ? 'nomina' : tipo === 'credito' ? 'credito' : 'proveedor';
}
const KIND_LABEL = {
  reponer: 'Compra', gasto: 'Gasto', arriendo: 'Arriendo',
  nomina: 'Nómina', credito: 'Crédito', proveedor: 'Proveedor'
};

/**
 * Arma la lista unificada y normalizada de TODOS los movimientos del negocio.
 * Cada movimiento: { id, date, type, area, bucket, amount, label, kind, source, locked, [from,to] }
 */
async function buildMovements(id) {
  const moves = [];

  // 1. Ingresos de turnos cerrados + retiros/caja menor
  const shifts = await readJSON(shiftsPath(id)) || [];
  for (const s of shifts) {
    if (s.status !== 'closed') continue;
    const when = s.closedAt || s.openedAt;
    const ib = s.incomeByAreaBucket;
    if (ib) {
      for (const area of ['bar', 'restaurante']) {
        for (const bucket of ['efectivo', 'banco']) {
          const amt = (ib[area] && ib[area][bucket]) || 0;
          if (amt > 0) moves.push({
            id: `shift-${s.id}-${area}-${bucket}`, date: when, type: 'ingreso',
            area, bucket, amount: amt, label: 'Cierre de turno', kind: 'shift',
            source: 'shift', locked: true
          });
        }
      }
    }
    for (const w of (s.withdrawals || [])) moves.push({
      id: `wd-${w.id}`, date: w.date || when, type: 'egreso', area: 'general',
      bucket: 'efectivo', amount: w.amount || 0, label: `Retiro de caja${w.reason ? ': ' + w.reason : ''}`,
      kind: 'retiro', source: 'shift', locked: true
    });
    for (const e of (s.expenses || [])) moves.push({
      id: `ex-${e.id}`, date: e.date || when, type: 'egreso', area: 'general',
      bucket: 'efectivo', amount: e.amount || 0, label: `Caja menor${e.description ? ': ' + e.description : ''}`,
      kind: 'cajamenor', source: 'shift', locked: true
    });
  }

  // 2. Compras / gastos / arriendo
  const purchases = await readJSON(purchasesPath(id)) || [];
  for (const p of purchases) {
    const k = p.type || 'reponer';
    moves.push({
      id: `pur-${p.id}`, date: p.date, type: 'egreso',
      area: p.area === 'restaurante' ? 'restaurante' : 'bar',
      bucket: p.paidWith === 'banco' ? 'banco' : 'efectivo',
      amount: p.total || 0,
      label: (KIND_LABEL[k] || 'Compra') + (p.description ? ': ' + p.description : ''),
      kind: k, source: 'purchase', locked: true
    });
  }

  // 3. Pagos a proveedores / empleados / créditos
  const suppliers = await readJSON(suppliersPath(id)) || [];
  for (const sup of suppliers) {
    for (const pay of (sup.payments || [])) {
      const k = kindOfTipo(sup.tipo);
      moves.push({
        id: `pay-${pay.id}`, date: pay.date, type: 'egreso',
        area: pay.area === 'restaurante' ? 'restaurante' : 'bar',
        bucket: bucketOfPayment(pay), amount: pay.amount || 0,
        label: `${KIND_LABEL[k]}: ${sup.name}`, kind: k, source: 'payment', locked: true
      });
    }
  }

  // NOTA: los abonos de fiado NO se listan aquí por separado. Se consolidan dentro
  // del ingreso del turno al cerrar caja (incomeByAreaBucket), para que en Finanzas
  // aparezcan sumados a la venta del día y no como líneas sueltas.

  // 4. Movimientos manuales
  const cfg = await loadConfig(id);
  for (const m of cfg.manual) {
    moves.push({
      id: m.id, date: m.date, type: m.type, area: m.area || 'general',
      bucket: m.bucket || 'efectivo', amount: m.amount || 0, from: m.from, to: m.to,
      label: m.description || 'Movimiento manual',
      kind: m.type === 'traslado' ? 'traslado' : 'manual', source: 'manual', locked: false
    });
  }

  return moves;
}

/** Aplica un movimiento sobre el objeto de saldos */
function applyMovement(bal, m) {
  const area = bal[m.area] ? m.area : 'general';
  if (m.type === 'ingreso') bal[area][m.bucket] += m.amount;
  else if (m.type === 'egreso') bal[area][m.bucket] -= m.amount;
  else if (m.type === 'traslado') {
    const from = m.from || 'efectivo', to = m.to || 'banco';
    bal[area][from] -= m.amount;
    bal[area][to] += m.amount;
  }
}

/**
 * GET /finance — Saldos actuales + movimientos del periodo.
 * Query: from, to (yyyy-mm-dd). Los saldos son acumulados (desde openingDate);
 * la lista de movimientos y los totales del periodo se filtran por [from, to].
 */
router.get('/finance', authenticate, adminOnly, async (req, res) => {
  try {
    const id = req.params.businessId;
    const cfg = await loadConfig(id);
    const all = await buildMovements(id);

    // Colombia es UTC-5 (sin horario de verano). El inicio de un día calendario
    // colombiano (00:00 COT) equivale a las 05:00 UTC de esa fecha. Así, fijar la
    // fecha de inicio en "mañana" excluye TODO lo de hoy aunque se cierre de noche.
    const cotStart = (s) => new Date(String(s).slice(0, 10) + 'T05:00:00.000Z').getTime();

    const openingTime = cfg.openingDate ? cotStart(cfg.openingDate) : -Infinity;

    // Saldos acumulados: saldo inicial + todos los movimientos desde openingDate
    const balances = emptyBalances();
    balances.bar = { ...emptyArea(), ...(cfg.opening.bar || {}) };
    balances.restaurante = { ...emptyArea(), ...(cfg.opening.restaurante || {}) };
    for (const m of all) {
      const t = new Date(m.date).getTime();
      if (isNaN(t) || t < openingTime) continue;
      applyMovement(balances, m);
    }

    const totals = {
      efectivo: balances.bar.efectivo + balances.restaurante.efectivo + balances.general.efectivo,
      banco: balances.bar.banco + balances.restaurante.banco + balances.general.banco
    };

    // Movimientos a mostrar: dentro del periodo [from, to] y nunca antes de la
    // fecha de inicio (lo anterior ya está dentro del saldo inicial).
    const { from, to } = req.query;
    const fromTime = from ? cotStart(from) : -Infinity;
    const toTime = to ? cotStart(to) + 86400000 - 1 : Infinity; // incluye todo el día 'to' (COT)
    const lowerBound = Math.max(openingTime, fromTime);
    const movements = all
      .filter(m => {
        const t = new Date(m.date).getTime();
        return !isNaN(t) && t >= lowerBound && t <= toTime;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const periodTotals = { ingresos: 0, egresos: 0 };
    for (const m of movements) {
      if (m.type === 'ingreso') periodTotals.ingresos += m.amount;
      else if (m.type === 'egreso') periodTotals.egresos += m.amount;
    }
    periodTotals.neto = periodTotals.ingresos - periodTotals.egresos;

    res.json({ opening: cfg.opening, openingDate: cfg.openingDate, reference: cfg.reference, costTarget: cfg.costTarget, balances, totals, movements, periodTotals });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/** PUT /finance/opening — Fija el saldo inicial (por área × bucket) y la fecha de inicio */
router.put('/finance/opening', authenticate, adminOnly, async (req, res) => {
  try {
    const cfg = await loadConfig(req.params.businessId);
    const o = req.body.opening || {};
    cfg.opening = {
      bar: { efectivo: Number(o.bar?.efectivo) || 0, banco: Number(o.bar?.banco) || 0 },
      restaurante: { efectivo: Number(o.restaurante?.efectivo) || 0, banco: Number(o.restaurante?.banco) || 0 }
    };
    cfg.openingDate = req.body.openingDate
      ? new Date(req.body.openingDate).toISOString()
      : (cfg.openingDate || new Date().toISOString());
    await saveConfig(req.params.businessId, cfg);
    res.json({ opening: cfg.opening, openingDate: cfg.openingDate });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/** PUT /finance/reference — Guarda el resumen del mes de referencia (no afecta saldos) */
router.put('/finance/reference', authenticate, adminOnly, async (req, res) => {
  try {
    const cfg = await loadConfig(req.params.businessId);
    const r = req.body.reference || {};
    cfg.reference = {
      bar: { ventas: Number(r.bar?.ventas) || 0, salidas: Number(r.bar?.salidas) || 0 },
      restaurante: { ventas: Number(r.restaurante?.ventas) || 0, salidas: Number(r.restaurante?.salidas) || 0 }
    };
    await saveConfig(req.params.businessId, cfg);
    res.json({ reference: cfg.reference });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/** PUT /finance/cost-target — Fija la meta de costo (food cost %) */
router.put('/finance/cost-target', authenticate, adminOnly, async (req, res) => {
  try {
    const cfg = await loadConfig(req.params.businessId);
    const t = req.body.target || {};
    let min = Number(t.min), max = Number(t.max);
    if (isNaN(min)) min = 30;
    if (isNaN(max)) max = 40;
    min = Math.max(0, Math.min(100, min));
    max = Math.max(0, Math.min(100, max));
    if (min > max) { const tmp = min; min = max; max = tmp; }
    cfg.costTarget = { min, max };
    await saveConfig(req.params.businessId, cfg);
    res.json({ costTarget: cfg.costTarget });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /finance/manual — Agrega un movimiento manual (ingreso/egreso/traslado) */
router.post('/finance/manual', authenticate, adminOnly, async (req, res) => {
  try {
    const { type, area, bucket, amount, description, date, from, to } = req.body;
    if (!['ingreso', 'egreso', 'traslado'].includes(type)) {
      return res.status(400).json({ error: 'Tipo inválido' });
    }
    const value = Number(amount) || 0;
    if (value <= 0) return res.status(400).json({ error: 'El monto debe ser positivo' });

    const cfg = await loadConfig(req.params.businessId);
    const mov = {
      id: uuidv4(),
      type,
      area: ['bar', 'restaurante', 'general'].includes(area) ? area : 'general',
      bucket: bucket === 'banco' ? 'banco' : 'efectivo',
      amount: value,
      description: description || '',
      date: (date && !isNaN(new Date(date).getTime())) ? new Date(date).toISOString() : new Date().toISOString(),
      registeredBy: req.user.name || req.user.username
    };
    if (type === 'traslado') {
      mov.from = from === 'banco' ? 'banco' : 'efectivo';
      mov.to = mov.from === 'banco' ? 'efectivo' : 'banco';
    }
    cfg.manual.push(mov);
    await saveConfig(req.params.businessId, cfg);
    res.status(201).json(mov);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/** DELETE /finance/manual/:id — Elimina un movimiento manual */
router.delete('/finance/manual/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const cfg = await loadConfig(req.params.businessId);
    const before = cfg.manual.length;
    cfg.manual = cfg.manual.filter(m => m.id !== req.params.id);
    if (cfg.manual.length === before) return res.status(404).json({ error: 'Movimiento no encontrado' });
    await saveConfig(req.params.businessId, cfg);
    res.json({ success: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /finance/daily — Reporte del día para el dueño.
 * Resume ventas (por área × efectivo/banco), fiados nuevos, abonos, salidas
 * del día, y los saldos actuales (lo que debería tener). Día en hora Colombia.
 * Query: ?date=YYYY-MM-DD (por defecto hoy).
 */
router.get('/finance/daily', authenticate, adminOnly, async (req, res) => {
  try {
    const id = req.params.businessId;
    const cotStart = (s) => new Date(String(s).slice(0, 10) + 'T05:00:00.000Z').getTime();
    // Fecha de hoy en hora Colombia (UTC-5)
    const todayCot = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
    const dateStr = (req.query.date && !isNaN(new Date(req.query.date).getTime()))
      ? String(req.query.date).slice(0, 10) : todayCot;
    const dayStart = cotStart(dateStr);
    const dayEnd = dayStart + 86400000;
    const inDay = (iso) => { const t = new Date(iso).getTime(); return !isNaN(t) && t >= dayStart && t < dayEnd; };

    // Ventas del día (todas, por área × bucket)
    const sales = await readJSON(salesPath(id)) || [];
    const ventas = { bar: emptyArea(), restaurante: emptyArea(), total: 0, count: 0 };
    for (const s of sales) {
      if (!inDay(s.createdAt)) continue;
      if (s.paymentMethod === 'pago_fiado') continue; // el fiado cobrado se ve en "abonos"
      ventas.count++;
      ventas.total += s.total || 0;
      const bucket = bucketOfMethod(s.paymentMethod);
      const tba = s.totalsByArea;
      if (tba && ((tba.bar || 0) + (tba.restaurante || 0)) > 0) {
        ventas.bar[bucket] += tba.bar || 0;
        ventas.restaurante[bucket] += tba.restaurante || 0;
      } else {
        ventas.bar[bucket] += s.total || 0;
      }
    }

    // Fiados nuevos y abonos del día. Los abonos se SUMAN a las ventas del día,
    // repartidos por área (areaSplit) y en su forma de pago (efectivo/banco).
    const debtors = await readJSON(debtorsPath(id)) || [];
    let fiadosNuevos = 0, abonos = 0;
    for (const d of debtors) {
      for (const t of (d.transactions || [])) {
        if (!inDay(t.date)) continue;
        if (t.type === 'charge') { fiadosNuevos += t.amount || 0; continue; }
        if (t.type !== 'payment') continue;
        abonos += t.amount || 0;
        const bucket = t.paidWith === 'banco' ? 'banco' : 'efectivo';
        const split = t.areaSplit || { bar: t.amount || 0, restaurante: 0 };
        ventas.bar[bucket] += split.bar || 0;
        ventas.restaurante[bucket] += split.restaurante || 0;
        ventas.total += t.amount || 0;
      }
    }

    // Salidas del día (compras/gastos/arriendo + pagos del directorio)
    const salidas = { total: 0, efectivo: 0, banco: 0, compras: 0, gastos: 0, arriendo: 0, nomina: 0, credito: 0, proveedor: 0 };
    const purchases = await readJSON(purchasesPath(id)) || [];
    for (const p of purchases) {
      if (!inDay(p.date)) continue;
      const amt = p.total || 0;
      salidas.total += amt;
      salidas[p.paidWith === 'banco' ? 'banco' : 'efectivo'] += amt;
      const k = p.type || 'reponer';
      if (k === 'reponer') salidas.compras += amt;
      else if (k === 'gasto') salidas.gastos += amt;
      else if (k === 'arriendo') salidas.arriendo += amt;
    }
    const suppliers = await readJSON(suppliersPath(id)) || [];
    for (const sup of suppliers) {
      for (const pay of (sup.payments || [])) {
        if (!inDay(pay.date)) continue;
        const amt = pay.amount || 0;
        salidas.total += amt;
        salidas[bucketOfMethod(pay.paidWith || pay.method)] += amt;
        const k = sup.tipo === 'empleado' ? 'nomina' : sup.tipo === 'credito' ? 'credito' : 'proveedor';
        salidas[k] += amt;
      }
    }

    // Saldos actuales (lo que debería tener) — saldo inicial + movimientos desde openingDate
    const cfg = await loadConfig(id);
    const all = await buildMovements(id);
    const openingTime = cfg.openingDate ? cotStart(cfg.openingDate) : -Infinity;
    const balances = emptyBalances();
    balances.bar = { ...emptyArea(), ...(cfg.opening.bar || {}) };
    balances.restaurante = { ...emptyArea(), ...(cfg.opening.restaurante || {}) };
    for (const m of all) {
      const t = new Date(m.date).getTime();
      if (isNaN(t) || t < openingTime) continue;
      applyMovement(balances, m);
    }
    const saldos = {
      efectivo: balances.bar.efectivo + balances.restaurante.efectivo + balances.general.efectivo,
      banco: balances.bar.banco + balances.restaurante.banco + balances.general.banco
    };

    res.json({ date: dateStr, ventas, fiados: { nuevos: fiadosNuevos, abonos }, salidas, saldos });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
