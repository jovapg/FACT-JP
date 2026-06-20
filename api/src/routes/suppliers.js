/**
 * routes/suppliers.js — CRUD de proveedores, empleados, arriendos y créditos
 *
 * Gestiona todas las entidades externas a las que el negocio les paga.
 * Cada proveedor tiene un `tipo` que define su categoría:
 *   - proveedor: empresa que vende insumos (afecta compras)
 *   - empleado:  trabajador (pago semanal de nómina)
 *   - arriendo:  pago mensual de arriendo del local
 *   - credito:   deuda/cuota a un banco o persona
 *
 * El `tipo` se usa en el reporte de Rentabilidad para clasificar los egresos.
 *
 * Cada proveedor tiene un historial de pagos y un totalDebt (deuda acumulada).
 * La deuda aumenta al registrar compras y disminuye al registrar pagos.
 *
 * Rutas:
 *   GET    /api/:businessId/suppliers                     → listar proveedores
 *   POST   /api/:businessId/suppliers                     → crear proveedor (admin+)
 *   PUT    /api/:businessId/suppliers/:id                 → editar proveedor (admin+)
 *   POST   /api/:businessId/suppliers/:id/payment         → registrar pago (admin+)
 *   DELETE /api/:businessId/suppliers/:id                 → eliminar proveedor (admin+)
 */

const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams: true necesario para :businessId
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, getBusinessPath } = require('../services/fileStorage');
const { authenticate } = require('../middleware/auth');

const suppliersPath = (id) => path.join(getBusinessPath(id), 'suppliers.json');

/** GET — Lista todos los proveedores/empleados/arriendos/créditos del negocio */
router.get('/suppliers', authenticate, async (req, res) => {
  try {
    const suppliers = await readJSON(suppliersPath(req.params.businessId)) || [];
    res.json(suppliers);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /suppliers — Crea un nuevo proveedor/empleado/arriendo/crédito.
 * El campo `tipo` clasifica el proveedor para el reporte de rentabilidad.
 * Los cajeros no pueden crear proveedores.
 */
router.post('/suppliers', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const suppliers = await readJSON(suppliersPath(req.params.businessId)) || [];
    const newSupplier = {
      id: uuidv4(),
      name: req.body.name,
      tipo: req.body.tipo || 'proveedor',
      contact: req.body.contact || '',
      phone: req.body.phone || '',
      nit: req.body.nit || '',
      email: req.body.email || '',
      address: req.body.address || '',
      // Campos empleado
      cedula: req.body.cedula || '',
      cargo: req.body.cargo || '',
      salarioBase: Number(req.body.salarioBase) || 0,
      periodoPago: req.body.periodoPago || 'mensual',
      fechaIngreso: req.body.fechaIngreso || '',
      // Campos arriendo
      montoMensual: Number(req.body.montoMensual) || 0,
      // Campos crédito
      montoTotal: Number(req.body.montoTotal) || 0,
      cuotaMensual: Number(req.body.cuotaMensual) || 0,
      payments: [],
      nominaHistory: [],
      totalDebt: Number(req.body.totalDebt) || 0,  // crédito inicia con montoTotal como deuda
      createdAt: new Date().toISOString()
    };
    suppliers.push(newSupplier);
    await writeJSON(suppliersPath(req.params.businessId), suppliers);
    res.status(201).json(newSupplier);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/** PUT /suppliers/:id — Actualiza los datos de un proveedor existente */
router.put('/suppliers/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const suppliers = await readJSON(suppliersPath(req.params.businessId)) || [];
    const idx = suppliers.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Supplier not found' });
    suppliers[idx] = { ...suppliers[idx], ...req.body, id: req.params.id };
    await writeJSON(suppliersPath(req.params.businessId), suppliers);
    res.json(suppliers[idx]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /suppliers/:id/payment — Registra un pago al proveedor.
 *
 * El pago se agrega al historial de pagos del proveedor y
 * se descuenta del totalDebt (la deuda no puede quedar negativa).
 * El reporte de Rentabilidad usa estos pagos clasificados por `tipo`
 * del proveedor para calcular nómina, arriendo y créditos.
 */
router.post('/suppliers/:id/payment', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const suppliers = await readJSON(suppliersPath(req.params.businessId)) || [];
    const idx = suppliers.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Supplier not found' });

    // ¿Con qué se pagó? Efectivo o banco (para Finanzas). 'transferencia'/'tarjeta' = banco.
    const paidWith = ['banco', 'transferencia', 'tarjeta'].includes(req.body.paidWith || req.body.method)
      ? 'banco' : 'efectivo';
    // Área a la que se carga este pago (Bar / Restaurante), elegida al pagar
    const area = req.body.area === 'restaurante' ? 'restaurante' : 'bar';
    // Permite agendar el pago con fecha; si no, hoy
    const when = (req.body.date && !isNaN(new Date(req.body.date).getTime()))
      ? new Date(req.body.date).toISOString() : new Date().toISOString();

    const payment = {
      id: uuidv4(),
      amount: Number(req.body.amount) || 0,
      date: when,
      method: req.body.method || paidWith,
      paidWith,
      area,
      notes: req.body.notes || ''
    };

    suppliers[idx].payments = suppliers[idx].payments || [];
    suppliers[idx].payments.push(payment);
    // La deuda no puede quedar en negativo
    suppliers[idx].totalDebt = Math.max(0, (suppliers[idx].totalDebt || 0) - payment.amount);

    await writeJSON(suppliersPath(req.params.businessId), suppliers);
    res.json(suppliers[idx]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /suppliers/:id/nomina — Genera una deuda de nómina para un empleado.
 * Añade el salario base (o un monto custom) a totalDebt y lo registra en nominaHistory.
 */
router.post('/suppliers/:id/nomina', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const suppliers = await readJSON(suppliersPath(req.params.businessId)) || [];
    const idx = suppliers.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Supplier not found' });

    const amount = Number(req.body.amount) || suppliers[idx].salarioBase || 0;
    if (!amount) return res.status(400).json({ error: 'Sin salario base configurado' });

    suppliers[idx].nominaHistory = suppliers[idx].nominaHistory || [];
    suppliers[idx].nominaHistory.push({
      id: uuidv4(),
      amount,
      period: req.body.period || new Date().toISOString().slice(0, 7),
      date: new Date().toISOString(),
      notes: req.body.notes || ''
    });
    suppliers[idx].totalDebt = (suppliers[idx].totalDebt || 0) + amount;

    await writeJSON(suppliersPath(req.params.businessId), suppliers);
    res.json(suppliers[idx]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/** DELETE /suppliers/:id — Elimina un proveedor por ID */
router.delete('/suppliers/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    let suppliers = await readJSON(suppliersPath(req.params.businessId)) || [];
    suppliers = suppliers.filter(s => s.id !== req.params.id);
    await writeJSON(suppliersPath(req.params.businessId), suppliers);
    res.json({ success: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
