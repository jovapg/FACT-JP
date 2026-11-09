/**
 * routes/shifts.js — Módulo de turnos de caja
 *
 * Un turno representa el período en que un cajero maneja la caja.
 * Registra cuánto efectivo había al abrir, cuánto al cerrar,
 * y calcula si hubo sobrante o faltante.
 *
 * Flujo:
 *   1. Cajero abre turno → declara el efectivo inicial en caja
 *   2. Durante el turno → las ventas se acumulan automáticamente
 *   3. Admin puede registrar retiros de caja (sacar plata para gastos)
 *   4. Cajero cierra turno → cuenta el efectivo final
 *   5. Sistema calcula diferencia = contado - esperado
 *
 * efectivoEsperado = apertura + ventas en efectivo - retiros
 * diferencia       = efectivoContado - efectivoEsperado
 *
 * Solo puede haber UN turno abierto por negocio a la vez.
 *
 * Rutas:
 *   GET  /api/:businessId/shifts           → historial de turnos
 *   GET  /api/:businessId/shifts/current   → turno activo (o null)
 *   POST /api/:businessId/shifts/open      → abrir nuevo turno (admin+)
 *   POST /api/:businessId/shifts/:id/close → cerrar turno (admin+)
 *   POST /api/:businessId/shifts/:id/withdrawal → registrar retiro (admin+)
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, getBusinessPath } = require('../services/fileStorage');
const { authenticate } = require('../middleware/auth');

const shiftsPath = (id) => path.join(getBusinessPath(id), 'shifts.json');
const salesPath  = (id) => path.join(getBusinessPath(id), 'sales.json');
const debtorsPath = (id) => path.join(getBusinessPath(id), 'debtors.json');

/** Clasifica una forma de pago en su bucket de Finanzas: 💵 efectivo o 🏦 banco */
function bucketOf(method) {
  const m = (method || '').toLowerCase();
  if (m === 'transferencia' || m === 'tarjeta' || m === 'banco') return 'banco';
  return 'efectivo'; // efectivo, pago_fiado y otros se tratan como efectivo
}

/**
 * Calcula el ingreso del turno desglosado por área (Bar/Restaurante) y
 * por bucket (efectivo/banco), leyendo las ventas creadas dentro del turno.
 * Devuelve { bar:{efectivo,banco}, restaurante:{efectivo,banco} }.
 */
function incomeByAreaBucket(sales, fromISO, toISO) {
  const res = { bar: { efectivo: 0, banco: 0 }, restaurante: { efectivo: 0, banco: 0 } };
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  for (const s of sales) {
    const t = new Date(s.createdAt).getTime();
    if (isNaN(t) || t < from || t > to) continue;
    // El ingreso del fiado se cuenta como abono (con su forma de pago real), no aquí
    if (s.paymentMethod === 'pago_fiado') continue;
    const bucket = bucketOf(s.paymentMethod);
    const tba = s.totalsByArea;
    if (tba && ((tba.bar || 0) + (tba.restaurante || 0)) > 0) {
      res.bar[bucket] += tba.bar || 0;
      res.restaurante[bucket] += tba.restaurante || 0;
    } else {
      // Ventas viejas sin desglose por área → todo al Bar
      res.bar[bucket] += s.total || 0;
    }
  }
  for (const a of ['bar', 'restaurante']) {
    res[a].efectivo = Math.round(res[a].efectivo);
    res[a].banco = Math.round(res[a].banco);
  }
  return res;
}

/** GET — Lista todos los turnos del negocio, más recientes primero */
router.get('/shifts', authenticate, async (req, res) => {
  try {
    const shifts = await readJSON(shiftsPath(req.params.businessId)) || [];
    res.json([...shifts].reverse()); // Más reciente primero
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /shifts/current — Retorna el turno actualmente abierto.
 * Si no hay ninguno abierto, retorna null (no es un error).
 * IMPORTANTE: esta ruta debe ir ANTES de /shifts/:id para que
 * "current" no sea interpretado como un ID.
 */
router.get('/shifts/current', authenticate, async (req, res) => {
  try {
    const shifts = await readJSON(shiftsPath(req.params.businessId)) || [];
    const current = shifts.find(s => s.status === 'open') || null;
    res.json(current);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /shifts/open — Abre un nuevo turno de caja.
 *
 * Body: { openingCash: number, notes?: string }
 *
 * Valida que no haya otro turno abierto antes de crear uno nuevo.
 */
// ── Regularización: ventas hechas SIN turno abierto ──────────────────────────────────────────
// Antes de la regla "sin turno no se factura", se podía facturar sin turno: esas ventas están en el historial pero ningún
// cierre de caja las cuenta, así que no llegan a Finanzas. Aquí se agrupan y se cubren con turnos cerrados "de regularización".
const COL_MS = 5 * 3600 * 1000; // hora de Colombia (UTC-5)
const colDay = (t) => new Date(t - COL_MS).toISOString().slice(0, 10);

/** Grupos de ventas que no caen dentro de ningún turno. Un grupo nunca cruza un día ni salta por encima de un turno real. */
function unassignedGroups(sales, shifts) {
  const ranges = shifts.map(s => [new Date(s.openedAt).getTime(), s.closedAt ? new Date(s.closedAt).getTime() : Infinity]).filter(r => !isNaN(r[0]));
  const loose = sales.map(s => ({ s, t: new Date(s.createdAt).getTime() }))
    .filter(x => !isNaN(x.t) && (Number(x.s.total) || 0) > 0 && !ranges.some(([a, b]) => x.t >= a && x.t <= b))
    .sort((p, q) => p.t - q.t);
  const groups = [];
  for (const x of loose) {
    const g = groups[groups.length - 1];
    const cut = !g || colDay(x.t) !== g.day || ranges.some(([a]) => a > g.to && a < x.t);
    if (cut) groups.push({ day: colDay(x.t), from: x.t, to: x.t, sales: [x.s] });
    else { g.to = x.t; g.sales.push(x.s); }
  }
  return groups;
}
const sum = (list, f) => list.reduce((a, s) => a + f(s), 0);
const summarizeGroup = (g) => ({
  day: g.day, from: new Date(g.from).toISOString(), to: new Date(g.to).toISOString(), count: g.sales.length,
  total: sum(g.sales, s => s.total || 0),
  cash: sum(g.sales, s => (bucketOf(s.paymentMethod) === 'efectivo' ? s.total || 0 : 0)),
  other: sum(g.sales, s => (bucketOf(s.paymentMethod) === 'banco' ? s.total || 0 : 0))
});
// Corrige cifras de Finanzas: solo el superadmin (dueño de la plataforma), no el admin de la franquicia
const canRegularize = (req) => req.user.role === 'superadmin';

router.get('/shifts/unassigned', authenticate, async (req, res) => {
  try {
    if (!canRegularize(req)) return res.status(403).json({ error: 'Solo el superadmin puede regularizar ventas sin turno' });
    const groups = unassignedGroups(await readJSON(salesPath(req.params.businessId)) || [], await readJSON(shiftsPath(req.params.businessId)) || []).map(summarizeGroup);
    res.json({ count: sum(groups, g => g.count), total: sum(groups, g => g.total), groups });
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/shifts/regularize', authenticate, async (req, res) => {
  try {
    if (!canRegularize(req)) return res.status(403).json({ error: 'Solo el superadmin puede regularizar ventas sin turno' });
    const bid = req.params.businessId;
    const sales = await readJSON(salesPath(bid)) || [];
    const shifts = await readJSON(shiftsPath(bid)) || [];
    const onlyDays = Array.isArray(req.body?.days) ? req.body.days : null; // sin lista: todos los días
    const groups = unassignedGroups(sales, shifts).filter(g => !onlyDays || onlyDays.includes(g.day));
    const created = [];
    for (const g of groups) {
      const openedAt = new Date(g.from).toISOString(), closedAt = new Date(g.to).toISOString();
      const sm = summarizeGroup(g);
      const byArea = g.sales.reduce((a, s) => { const t = s.totalsByArea; if (t && ((t.bar || 0) + (t.restaurante || 0)) > 0) { a.bar += t.bar || 0; a.restaurante += t.restaurante || 0; } else a.bar += s.total || 0; return a; }, { bar: 0, restaurante: 0 });
      const shift = {
        id: uuidv4(), cashierId: req.user.id, cashierName: 'Regularización', openedAt, closedAt,
        openingCash: 0, closingCash: sm.cash, expectedCash: sm.cash, difference: 0,
        totalCashSales: sm.cash, totalOtherSales: sm.other, totalSales: sm.total, salesCount: sm.count,
        totalDomicilios: sum(g.sales, s => Number(s.deliveryFee) || 0), salesByArea: byArea,
        withdrawals: [], totalWithdrawals: 0, expenses: [], totalExpenses: 0,
        incomeByAreaBucket: incomeByAreaBucket(g.sales, openedAt, closedAt),
        fiadoAbonos: sum(g.sales.filter(s => s.type === 'abono_deuda'), s => s.total || 0),
        notes: `Regularización: ventas del ${g.day} facturadas sin turno abierto (hecha por ${req.user.name || req.user.username}).`,
        regularizacion: true, status: 'closed'
      };
      shifts.push(shift); created.push({ ...sm, shiftId: shift.id });
    }
    if (created.length) {
      await writeJSON(shiftsPath(bid), shifts);
      try { await require('../services/audit').logAudit(bid, { user: req.user.name || req.user.username, role: req.user.role, action: 'regularizacion', summary: `Se regularizaron ${sum(created, c => c.count)} ventas sin turno (${created.length} turno(s) de regularización).` }); } catch { /* la bitácora no frena el proceso */ }
    }
    res.json({ created, count: sum(created, c => c.count), total: sum(created, c => c.total) });
  } catch (e) { console.error('[shifts] regularizar:', e); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/shifts/open', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero' && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      // Los cajeros también pueden abrir turno — no bloqueamos
    }

    const shifts = await readJSON(shiftsPath(req.params.businessId)) || [];

    // Verificar que no haya un turno ya abierto
    const existing = shifts.find(s => s.status === 'open');
    if (existing) {
      return res.status(400).json({ error: 'Ya hay un turno abierto. Ciérralo antes de abrir uno nuevo.' });
    }

    const newShift = {
      id: uuidv4(),
      cashierId: req.user.id,
      cashierName: req.user.name || req.user.username,
      openedAt: new Date().toISOString(),
      closedAt: null,
      openingCash: Number(req.body.openingCash) || 0,
      closingCash: null,
      expectedCash: null,        // Se calcula al cerrar
      difference: null,          // Se calcula al cerrar
      totalCashSales: 0,         // Ventas pagadas en efectivo
      totalOtherSales: 0,        // Ventas por transferencia/tarjeta
      totalSales: 0,             // Total de todas las ventas
      salesCount: 0,             // Número de ventas
      withdrawals: [],           // Retiros registrados durante el turno
      totalWithdrawals: 0,       // Suma de todos los retiros
      expenses: [],              // Gastos de caja menor durante el turno
      totalExpenses: 0,          // Suma de todos los gastos
      notes: req.body.notes || '',
      status: 'open'
    };

    shifts.push(newShift);
    await writeJSON(shiftsPath(req.params.businessId), shifts);
    res.status(201).json(newShift);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /shifts/:id/close — Cierra el turno activo.
 *
 * Body: { closingCash: number }
 *
 * Calcula:
 *   expectedCash = openingCash + totalCashSales - totalWithdrawals
 *   difference   = closingCash - expectedCash
 * Diferencia positiva = sobrante, negativa = faltante.
 */
router.post('/shifts/:id/close', authenticate, async (req, res) => {
  try {
    const shifts = await readJSON(shiftsPath(req.params.businessId)) || [];
    const idx = shifts.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Turno no encontrado' });
    if (shifts[idx].status !== 'open') return res.status(400).json({ error: 'El turno ya está cerrado' });

    const closingCash = Number(req.body.closingCash) || 0;
    const shift = shifts[idx];
    const closedAt = new Date().toISOString();

    // Cálculo del cierre: gastos también reducen el efectivo esperado
    const expectedCash = shift.openingCash + shift.totalCashSales - shift.totalWithdrawals - (shift.totalExpenses || 0);
    const difference = closingCash - expectedCash;

    // Desglose del ingreso del turno por área × efectivo/banco (para Finanzas).
    // Es la "foto" del ingreso del día que queda registrada al cerrar.
    let incomeBreakdown = { bar: { efectivo: 0, banco: 0 }, restaurante: { efectivo: 0, banco: 0 } };
    let fiadoAbonos = 0; // cuánto del ingreso del turno vino de abonos de fiado
    try {
      const sales = await readJSON(salesPath(req.params.businessId)) || [];
      incomeBreakdown = incomeByAreaBucket(sales, shift.openedAt, closedAt);

      // Los abonos de deuda nuevos son ventas (type 'abono_deuda'): ya están en el desglose
      // de arriba; aquí solo se cuenta cuánto del ingreso del turno fueron abonos.
      {
        const f0 = new Date(shift.openedAt).getTime(), t0 = new Date(closedAt).getTime();
        for (const sa of sales) {
          if (sa.type !== 'abono_deuda') continue;
          const tt = new Date(sa.createdAt).getTime();
          if (!isNaN(tt) && tt >= f0 && tt <= t0) fiadoAbonos += sa.total || 0;
        }
      }

      // Abonos ANTIGUOS (sin factura propia): se suman aquí, repartidos por área (areaSplit)
      const debtors = await readJSON(debtorsPath(req.params.businessId)) || [];
      const fromT = new Date(shift.openedAt).getTime();
      const toT = new Date(closedAt).getTime();
      for (const d of debtors) {
        for (const t of (d.transactions || [])) {
          if (t.type !== 'payment') continue;
          if (t.abonoSaleId) continue; // ya cuenta como venta
          const tt = new Date(t.date).getTime();
          if (isNaN(tt) || tt < fromT || tt > toT) continue;
          const bucket = t.paidWith === 'banco' ? 'banco' : 'efectivo';
          const split = t.areaSplit || { bar: t.amount || 0, restaurante: 0 };
          incomeBreakdown.bar[bucket] += split.bar || 0;
          incomeBreakdown.restaurante[bucket] += split.restaurante || 0;
          fiadoAbonos += t.amount || 0;
        }
      }
    } catch (e) {
      console.error('[shifts] Error calculando desglose de ingresos:', e);
    }

    shifts[idx] = {
      ...shift,
      closedAt,
      closingCash,
      expectedCash,
      difference,
      incomeByAreaBucket: incomeBreakdown,   // { bar:{efectivo,banco}, restaurante:{efectivo,banco} } — incluye abonos de fiado
      fiadoAbonos,                           // cuánto de ese ingreso fueron abonos de fiado
      status: 'closed'
    };

    await writeJSON(shiftsPath(req.params.businessId), shifts);
    res.json(shifts[idx]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /shifts/:id/withdrawal — Registra un retiro de efectivo de la caja.
 *
 * Body: { amount: number, reason: string }
 *
 * El retiro descuenta del efectivo esperado al cierre.
 * Ejemplo: el dueño saca $50.000 para pagar un proveedor en efectivo.
 */
router.post('/shifts/:id/withdrawal', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });

    const shifts = await readJSON(shiftsPath(req.params.businessId)) || [];
    const idx = shifts.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Turno no encontrado' });
    if (shifts[idx].status !== 'open') return res.status(400).json({ error: 'El turno ya está cerrado' });

    const amount = Number(req.body.amount) || 0;
    if (amount <= 0) return res.status(400).json({ error: 'El monto del retiro debe ser positivo' });

    const withdrawal = {
      id: uuidv4(),
      amount,
      reason: req.body.reason || 'Retiro de caja',
      date: new Date().toISOString(),
      registeredBy: req.user.name || req.user.username
    };

    shifts[idx].withdrawals = [...(shifts[idx].withdrawals || []), withdrawal];
    shifts[idx].totalWithdrawals = (shifts[idx].totalWithdrawals || 0) + amount;

    await writeJSON(shiftsPath(req.params.businessId), shifts);
    res.json(shifts[idx]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /shifts/:id/expense — Registra un gasto de caja menor durante el turno.
 *
 * Body: { amount: number, category: string, description: string }
 * Categorías: insumos | servicios | domicilio | otros
 *
 * El gasto reduce el efectivo esperado al cierre.
 */
router.post('/shifts/:id/expense', authenticate, async (req, res) => {
  try {
    const shifts = await readJSON(shiftsPath(req.params.businessId)) || [];
    const idx = shifts.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Turno no encontrado' });
    if (shifts[idx].status !== 'open') return res.status(400).json({ error: 'El turno ya está cerrado' });

    const amount = Number(req.body.amount) || 0;
    if (amount <= 0) return res.status(400).json({ error: 'El monto debe ser positivo' });

    const expense = {
      id: uuidv4(),
      amount,
      category: req.body.category || 'otros',
      description: req.body.description || '',
      date: new Date().toISOString(),
      registeredBy: req.user.name || req.user.username
    };

    shifts[idx].expenses = [...(shifts[idx].expenses || []), expense];
    shifts[idx].totalExpenses = (shifts[idx].totalExpenses || 0) + amount;

    await writeJSON(shiftsPath(req.params.businessId), shifts);
    res.json(shifts[idx]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
