/**
 * routes/debtors.js — Panel de deudas / cuentas por cobrar
 *
 * Gestiona clientes que compran fiado. Cada cliente tiene un saldo
 * acumulado de cargos (fiados) y un historial de abonos (pagos parciales).
 *
 * balance = suma de cargos - suma de abonos
 *
 * Flujo integrado con inventario y facturas:
 *   - Al registrar un fiado con items, se descuenta el inventario inmediatamente
 *     (los productos salieron físicamente del negocio).
 *   - Los items quedan guardados en la transacción con settled=false.
 *   - Al abonar, si el saldo del deudor llega a 0, se generan una factura
 *     automática con paymentMethod='pago_fiado', agregando los items de todos
 *     los cargos no liquidados; esos cargos quedan marcados settled=true.
 *
 * Rutas:
 *   GET    /api/:businessId/debtors              → listar todos los deudores
 *   POST   /api/:businessId/debtors              → crear deudor
 *   PUT    /api/:businessId/debtors/:id          → editar datos del deudor (no cajero)
 *   DELETE /api/:businessId/debtors/:id          → eliminar deudor (no cajero)
 *   POST   /api/:businessId/debtors/:id/charge   → registrar fiado (descuenta stock)
 *   POST   /api/:businessId/debtors/:id/payment  → registrar abono (genera factura si salda)
 *   DELETE /api/:businessId/debtors/transactions → borrar historial completo (no cajero)
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, getBusinessPath } = require('../services/fileStorage');
const { authenticate } = require('../middleware/auth');
const { deductFromSale } = require('../services/inventoryService');

const debtorsPath = (id) => path.join(getBusinessPath(id), 'debtors.json');
const salesPath = (id) => path.join(getBusinessPath(id), 'sales.json');
const profilePath = (id) => path.join(getBusinessPath(id), 'profile.json');
const shiftsPath = (id) => path.join(getBusinessPath(id), 'shifts.json');

/** Genera número de factura consecutivo a partir del contador del perfil */
function generateInvoiceNumber(profile) {
  const prefix = profile.invoicePrefix || 'FAC';
  const counter = String((profile.invoiceCounter || 0) + 1).padStart(4, '0');
  const year = new Date().getFullYear();
  return `${prefix}-${counter}-${year}`;
}

/** Si hay un turno abierto, registra la venta de pago_fiado en él */
async function updateActiveShift(businessId, sale) {
  try {
    const shifts = await readJSON(shiftsPath(businessId)) || [];
    const idx = shifts.findIndex(s => s.status === 'open');
    if (idx === -1) return;
    const isEfectivo = (sale.paymentMethod || '').toLowerCase() === 'efectivo';
    shifts[idx].salesCount     = (shifts[idx].salesCount || 0) + 1;
    shifts[idx].totalSales     = (shifts[idx].totalSales || 0) + sale.total;
    shifts[idx].totalCashSales = (shifts[idx].totalCashSales || 0) + (isEfectivo ? sale.total : 0);
    shifts[idx].totalOtherSales= (shifts[idx].totalOtherSales || 0) + (isEfectivo ? 0 : sale.total);
    await writeJSON(shiftsPath(businessId), shifts);
  } catch (err) {
    console.error('[shifts] Error actualizando turno activo:', err);
  }
}

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

/**
 * DELETE /debtors/transactions — Borra historial de movimientos de TODOS
 * los deudores y resetea los saldos a 0. Conserva los clientes registrados.
 * Las facturas ya generadas (pago_fiado) NO se borran.
 * Solo admin/superadmin.
 */
router.delete('/debtors/transactions', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const debtors = await readJSON(debtorsPath(req.params.businessId)) || [];
    for (const d of debtors) {
      d.transactions = [];
      d.balance = 0;
    }
    await writeJSON(debtorsPath(req.params.businessId), debtors);
    res.json({ success: true, message: 'Historial borrado' });
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
 * POST /debtors/:id/charge — Registra un fiado (aumenta saldo).
 * Body: { amount, description, items?: [{ recipeId|inventoryId, name, price, qty }] }
 * Si vienen items, descuenta el stock del inventario inmediatamente.
 */
router.post('/debtors/:id/charge', authenticate, async (req, res) => {
  try {
    const debtors = await readJSON(debtorsPath(req.params.businessId)) || [];
    const idx = debtors.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Deudor no encontrado' });

    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'El monto debe ser positivo' });

    const items = Array.isArray(req.body.items) ? req.body.items : [];

    const transaction = {
      id: uuidv4(),
      type: 'charge',
      amount,
      description: req.body.description || '',
      items,                                  // Productos del fiado (para generar la factura al saldar)
      settled: false,                         // true cuando se incluyó en una factura de pago_fiado
      date: new Date().toISOString(),
      registeredBy: req.user.name || req.user.username
    };

    debtors[idx].transactions = [...(debtors[idx].transactions || []), transaction];
    debtors[idx].balance = (debtors[idx].balance || 0) + amount;

    await writeJSON(debtorsPath(req.params.businessId), debtors);

    // Descontar stock si vinieron items (los productos físicamente salieron)
    let inventoryAlerts = [];
    if (items.length > 0) {
      try {
        const result = await deductFromSale(req.params.businessId, items);
        inventoryAlerts = result.alerts || [];
      } catch (invErr) {
        console.error('Inventory deduction error in fiado:', invErr);
      }
    }

    res.json({ debtor: debtors[idx], inventoryAlerts });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /debtors/:id/payment — Registra un abono (reduce el saldo).
 * Si el saldo queda en 0, agrega los items de los cargos no liquidados y
 * genera una factura con paymentMethod='pago_fiado' (sin tocar inventario,
 * que ya se descontó al registrar el fiado). Los cargos quedan marcados
 * settled=true para no volver a facturarlos.
 *
 * Body: { amount, description? }
 * Respuesta: { debtor, generatedSale? }
 */
router.post('/debtors/:id/payment', authenticate, async (req, res) => {
  try {
    const debtors = await readJSON(debtorsPath(req.params.businessId)) || [];
    const idx = debtors.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Deudor no encontrado' });

    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'El monto debe ser positivo' });

    // Capear al saldo actual para mantener consistencia entre saldo e historial
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

    let generatedSale = null;

    // Si el saldo queda en 0, generar factura por los cargos no liquidados
    if (debtors[idx].balance === 0) {
      const unsettled = debtors[idx].transactions.filter(t => t.type === 'charge' && !t.settled);

      if (unsettled.length > 0) {
        // Agregar items de todos los cargos. Si algún cargo no tenía items
        // (formato viejo o monto suelto), incluir una línea genérica por su monto.
        const allItems = [];
        for (const charge of unsettled) {
          if (Array.isArray(charge.items) && charge.items.length > 0) {
            allItems.push(...charge.items);
          } else {
            allItems.push({
              name: charge.description || 'Pago de fiado',
              price: charge.amount,
              qty: 1
            });
          }
        }
        const saleTotal = unsettled.reduce((s, c) => s + c.amount, 0);

        const profile = await readJSON(profilePath(req.params.businessId)) || {};
        const invoiceNumber = generateInvoiceNumber(profile);

        const sale = {
          id: uuidv4(),
          invoiceNumber,
          tableId: null,
          tableNumber: null,
          items: allItems,
          subtotal: saleTotal,
          discount: 0,
          total: saleTotal,
          paymentMethod: 'pago_fiado',
          cashier: req.user.name || req.user.username,
          client: debtors[idx].name,
          debtorId: debtors[idx].id,
          notes: `Pago de fiado de ${debtors[idx].name}`,
          createdAt: new Date().toISOString()
        };

        const sales = await readJSON(salesPath(req.params.businessId)) || [];
        sales.push(sale);
        await writeJSON(salesPath(req.params.businessId), sales);

        profile.invoiceCounter = (profile.invoiceCounter || 0) + 1;
        await writeJSON(profilePath(req.params.businessId), profile);

        await updateActiveShift(req.params.businessId, sale);

        // Marcar cargos como liquidados para no volver a facturarlos
        for (const t of debtors[idx].transactions) {
          if (t.type === 'charge' && !t.settled) t.settled = true;
        }

        generatedSale = sale;
      }
    }

    await writeJSON(debtorsPath(req.params.businessId), debtors);
    res.json({ debtor: debtors[idx], generatedSale });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
