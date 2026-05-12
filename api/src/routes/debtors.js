/**
 * routes/debtors.js — Panel de deudas / cuentas por cobrar
 *
 * Gestiona clientes que compran fiado. Cada cliente tiene un saldo
 * acumulado de cargos (fiados) y un historial de abonos (pagos parciales).
 *
 * balance = suma de cargos - suma de abonos
 *
 * Rutas:
 *   GET    /api/:businessId/debtors              → listar todos los deudores
 *   POST   /api/:businessId/debtors              → crear deudor
 *   PUT    /api/:businessId/debtors/:id          → editar datos del deudor
 *   DELETE /api/:businessId/debtors/:id          → eliminar deudor
 *   POST   /api/:businessId/debtors/:id/charge   → registrar fiado (aumenta saldo)
 *   POST   /api/:businessId/debtors/:id/payment  → registrar abono (reduce saldo)
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, getBusinessPath } = require('../services/fileStorage');
const { authenticate } = require('../middleware/auth');

const debtorsPath = (id) => path.join(getBusinessPath(id), 'debtors.json');

/** GET — Lista todos los deudores del negocio */
router.get('/debtors', authenticate, async (req, res) => {
  try {
    const debtors = await readJSON(debtorsPath(req.params.businessId)) || [];
    res.json(debtors);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST — Crea un nuevo deudor */
router.post('/debtors', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    if (!req.body.name?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const debtors = await readJSON(debtorsPath(req.params.businessId)) || [];
    const newDebtor = {
      id: uuidv4(),
      name: req.body.name.trim(),
      phone: req.body.phone || '',
      notes: req.body.notes || '',
      balance: 0,
      transactions: [],
      createdAt: new Date().toISOString()
    };
    debtors.push(newDebtor);
    await writeJSON(debtorsPath(req.params.businessId), debtors);
    res.status(201).json(newDebtor);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** PUT — Actualiza nombre, teléfono y notas del deudor */
router.put('/debtors/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const debtors = await readJSON(debtorsPath(req.params.businessId)) || [];
    const idx = debtors.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Deudor no encontrado' });
    debtors[idx] = {
      ...debtors[idx],
      name: req.body.name?.trim() || debtors[idx].name,
      phone: req.body.phone ?? debtors[idx].phone,
      notes: req.body.notes ?? debtors[idx].notes
    };
    await writeJSON(debtorsPath(req.params.businessId), debtors);
    res.json(debtors[idx]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** DELETE — Elimina un deudor */
router.delete('/debtors/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    let debtors = await readJSON(debtorsPath(req.params.businessId)) || [];
    debtors = debtors.filter(d => d.id !== req.params.id);
    await writeJSON(debtorsPath(req.params.businessId), debtors);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /debtors/:id/charge — Registra un fiado (aumenta el saldo).
 * Body: { amount: number, description: string }
 */
router.post('/debtors/:id/charge', authenticate, async (req, res) => {
  try {
    const debtors = await readJSON(debtorsPath(req.params.businessId)) || [];
    const idx = debtors.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Deudor no encontrado' });

    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'El monto debe ser positivo' });

    const transaction = {
      id: uuidv4(),
      type: 'charge',
      amount,
      description: req.body.description || '',
      date: new Date().toISOString(),
      registeredBy: req.user.name || req.user.username
    };

    debtors[idx].transactions = [...(debtors[idx].transactions || []), transaction];
    debtors[idx].balance = (debtors[idx].balance || 0) + amount;

    await writeJSON(debtorsPath(req.params.businessId), debtors);
    res.json(debtors[idx]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /debtors/:id/payment — Registra un abono (reduce el saldo).
 * Body: { amount: number, description?: string }
 */
router.post('/debtors/:id/payment', authenticate, async (req, res) => {
  try {
    const debtors = await readJSON(debtorsPath(req.params.businessId)) || [];
    const idx = debtors.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Deudor no encontrado' });

    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'El monto debe ser positivo' });

    // Capear el abono al saldo actual para que historial y saldo sean consistentes
    const currentBalance = debtors[idx].balance || 0;
    const actualAmount = Math.min(amount, currentBalance);

    const transaction = {
      id: uuidv4(),
      type: 'payment',
      amount: actualAmount,
      description: req.body.description || 'Abono',
      date: new Date().toISOString(),
      registeredBy: req.user.name || req.user.username
    };

    debtors[idx].transactions = [...(debtors[idx].transactions || []), transaction];
    debtors[idx].balance = Math.max(0, currentBalance - actualAmount);

    await writeJSON(debtorsPath(req.params.businessId), debtors);
    res.json(debtors[idx]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
