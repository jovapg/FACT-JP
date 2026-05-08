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

    // Cálculo del cierre
    const expectedCash = shift.openingCash + shift.totalCashSales - shift.totalWithdrawals;
    const difference = closingCash - expectedCash;

    shifts[idx] = {
      ...shift,
      closedAt: new Date().toISOString(),
      closingCash,
      expectedCash,
      difference,
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

module.exports = router;
