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

      // Sumar los abonos de fiado hechos durante el turno, repartidos por área (areaSplit)
      const debtors = await readJSON(debtorsPath(req.params.businessId)) || [];
      const fromT = new Date(shift.openedAt).getTime();
      const toT = new Date(closedAt).getTime();
      for (const d of debtors) {
        for (const t of (d.transactions || [])) {
          if (t.type !== 'payment') continue;
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
