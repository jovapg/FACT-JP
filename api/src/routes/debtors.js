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
 *   - CADA abono genera una factura (venta) con un ítem "Abono a deuda", el cliente
 *     y el valor, en efectivo o banco. Así el dinero entra por el mismo camino que
 *     una venta (turno de caja, Finanzas, reportes) y se sabe de quién fue.
 *   - Cuando el saldo llega a 0, los cargos quedan marcados settled=true (ya no se
 *     pueden editar ni borrar). No se genera otra factura: sería contar la plata dos veces.
 *
 * Rutas:
 *   GET    /api/:businessId/debtors              → listar todos los deudores
 *   POST   /api/:businessId/debtors              → crear deudor
 *   PUT    /api/:businessId/debtors/:id          → editar datos del deudor (no cajero)
 *   DELETE /api/:businessId/debtors/:id          → eliminar deudor (no cajero)
 *   POST   /api/:businessId/debtors/:id/charge   → registrar fiado (descuenta stock)
 *   PUT    /api/:businessId/debtors/:id/charge/:txId → editar fiado, ajusta stock (no cajero)
 *   DELETE /api/:businessId/debtors/:id/charge/:txId → eliminar fiado, devuelve stock (no cajero)
 *   POST   /api/:businessId/debtors/:id/payment  → registrar abono (genera factura si salda)
 *   PUT    /api/:businessId/debtors/:id/payment/:txId → editar abono, reabre fiados si reabre deuda (no cajero)
 *   DELETE /api/:businessId/debtors/:id/payment/:txId → eliminar abono, reabre fiados si reabre deuda (no cajero)
 *   DELETE /api/:businessId/debtors/transactions → borrar historial completo (no cajero)
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, getBusinessPath } = require('../services/fileStorage');
const { authenticate } = require('../middleware/auth');
const { deductFromSale, restoreFromSale, findOutOfStockItems } = require('../services/inventoryService');
const { logAudit, cop } = require('../services/audit');
const { updateActiveShift, adjustShiftForSaleEdit, removeSaleFromShift } = require('../services/shiftSales');

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

/**
 * Genera la factura (venta) de un abono: un solo ítem "Abono a deuda" con el cliente
 * y el valor, pagada en efectivo o banco. Se guarda en sales.json, consume un número
 * de factura y suma al turno abierto (si lo hay), igual que cualquier venta.
 */
async function createAbonoSale(businessId, debtor, transaction, user) {
  const profile = await readJSON(profilePath(businessId)) || {};
  const invoiceNumber = generateInvoiceNumber(profile);
  const amount = transaction.amount;
  const split = transaction.areaSplit || { bar: amount, restaurante: 0 };
  const extra = transaction.description && transaction.description !== 'Abono' ? ` — ${transaction.description}` : '';

  const sale = {
    id: uuidv4(),
    invoiceNumber,
    type: 'abono_deuda',           // distingue estas facturas de las ventas de productos
    tableId: null,
    tableNumber: null,
    items: [{ name: 'Abono a deuda', kind: 'abono_deuda', price: amount, qty: 1, discount: 0, area: 'bar' }],
    subtotal: amount,
    discount: 0,
    total: amount,
    totalsByArea: { bar: split.bar || 0, restaurante: split.restaurante || 0 },
    paymentMethod: transaction.paidWith === 'banco' ? 'transferencia' : 'efectivo',
    cashier: user.name || user.username,
    client: debtor.name,
    debtorId: debtor.id,
    debtorTxId: transaction.id,
    notes: `Abono a deuda de ${debtor.name}${extra}`,
    createdAt: transaction.date
  };

  const sales = await readJSON(salesPath(businessId)) || [];
  sales.push(sale);
  await writeJSON(salesPath(businessId), sales);

  profile.invoiceCounter = (profile.invoiceCounter || 0) + 1;
  await writeJSON(profilePath(businessId), profile);

  await updateActiveShift(businessId, sale);
  return sale;
}

/**
 * Actualiza la factura de un abono cuando el abono se edita (monto o nota) y
 * ajusta el turno al que pertenece. Re-escala el reparto por área del abono.
 */
async function syncAbonoSale(businessId, debtor, tx, oldAmount) {
  const sales = await readJSON(salesPath(businessId)) || [];
  const idx = sales.findIndex(x => x.id === tx.abonoSaleId);
  if (idx === -1) return;
  const oldSale = sales[idx];

  const oldSplit = tx.areaSplit || { bar: oldAmount, restaurante: 0 };
  const bar = oldAmount > 0 ? Math.round(tx.amount * ((oldSplit.bar || 0) / oldAmount)) : tx.amount;
  tx.areaSplit = { bar, restaurante: tx.amount - bar };

  const extra = tx.description && tx.description !== 'Abono' ? ` — ${tx.description}` : '';
  const newSale = {
    ...oldSale,
    items: [{ ...(oldSale.items?.[0] || { name: 'Abono a deuda', kind: 'abono_deuda', qty: 1, discount: 0, area: 'bar' }), price: tx.amount }],
    subtotal: tx.amount,
    total: tx.amount,
    totalsByArea: { bar: tx.areaSplit.bar, restaurante: tx.areaSplit.restaurante },
    notes: `Abono a deuda de ${debtor.name}${extra}`
  };
  sales[idx] = newSale;
  await writeJSON(salesPath(businessId), sales);
  await adjustShiftForSaleEdit(businessId, oldSale, newSale);
}

/** Borra la factura de un abono (cuando el abono se elimina) y la quita del turno */
async function removeAbonoSale(businessId, tx) {
  const sales = await readJSON(salesPath(businessId)) || [];
  const sale = sales.find(x => x.id === tx.abonoSaleId);
  if (!sale) return;
  await writeJSON(salesPath(businessId), sales.filter(x => x.id !== tx.abonoSaleId));
  await removeSaleFromShift(businessId, sale);
}

/** Recalcula el saldo del deudor a partir de sus transacciones: Σcargos − Σabonos */
function recomputeBalance(debtor) {
  const txs = debtor.transactions || [];
  const charges  = txs.filter(t => t.type === 'charge').reduce((s, t) => s + (t.amount || 0), 0);
  const payments = txs.filter(t => t.type === 'payment').reduce((s, t) => s + (t.amount || 0), 0);
  debtor.balance = Math.max(0, charges - payments);
}

/**
 * Revierte la liquidación que provocó un abono: reabre los fiados marcados
 * como facturados y borra la factura automática 'pago_fiado' generada.
 *
 * Para abonos nuevos usa el enlace guardado (settledChargeIds, generatedSaleId).
 * Para abonos antiguos (sin enlace) reabre todos los fiados facturados del
 * deudor y borra todas sus facturas 'pago_fiado'. Solo debe llamarse cuando
 * la deuda realmente se reabre (Σabonos < Σcargos).
 */
async function reversePaymentSettlement(businessId, debtor, payment) {
  const chargeIds = Array.isArray(payment.settledChargeIds) ? payment.settledChargeIds : null;

  // Reabrir los fiados (volver a 'pendiente')
  for (const t of (debtor.transactions || [])) {
    if (t.type === 'charge' && t.settled) {
      if (!chargeIds || chargeIds.includes(t.id)) t.settled = false;
    }
  }

  // Borrar la(s) factura(s) automática(s) de pago_fiado asociadas
  const sales = await readJSON(salesPath(businessId)) || [];
  let saleIds;
  if (payment.generatedSaleId) {
    saleIds = new Set([payment.generatedSaleId]);
  } else if (payment.abonoSaleId) {
    saleIds = new Set(); // abono nuevo: su factura de abono se maneja aparte, no hay 'pago_fiado'
  } else {
    saleIds = new Set(
      sales.filter(s => s.paymentMethod === 'pago_fiado' && s.debtorId === debtor.id).map(s => s.id)
    );
  }
  if (saleIds.size > 0) {
    const filtered = sales.filter(s => !saleIds.has(s.id));
    if (filtered.length !== sales.length) await writeJSON(salesPath(businessId), filtered);
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

    // Bloquear el fiado si algún producto está agotado (stock en cero)
    if (items.length > 0) {
      const outOfStock = await findOutOfStockItems(req.params.businessId, items);
      if (outOfStock.length > 0) {
        return res.status(400).json({
          error: `Producto agotado, stock en ceros: ${outOfStock.join(', ')}. No se puede registrar el fiado.`
        });
      }
    }

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
 * PUT /debtors/:id/charge/:txId — Edita un fiado (corrección del admin).
 *
 * Solo admin/superadmin y solo fiados NO liquidados (settled=false).
 * Ajusta el inventario por la diferencia: devuelve los productos viejos y
 * descuenta los nuevos. Recalcula el saldo del deudor.
 *
 * Body: { items?: [...], amount?, description? }
 *   - Si vienen items, el monto se recalcula a partir de ellos.
 */
router.put('/debtors/:id/charge/:txId', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });

    const debtors = await readJSON(debtorsPath(req.params.businessId)) || [];
    const idx = debtors.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Deudor no encontrado' });

    const tx = (debtors[idx].transactions || []).find(t => t.id === req.params.txId);
    if (!tx || tx.type !== 'charge') return res.status(404).json({ error: 'Fiado no encontrado' });
    if (tx.settled) {
      return res.status(400).json({ error: 'Este fiado ya fue facturado (el cliente saldó). No se puede editar.' });
    }

    const oldItems  = Array.isArray(tx.items) ? tx.items : [];
    const oldAmount = tx.amount || 0;

    const newItems = Array.isArray(req.body.items) ? req.body.items : oldItems;
    const newAmount = newItems.length > 0
      ? newItems.reduce((s, i) => s + Math.max(0, (Number(i.price) || 0) * (i.qty || 1) - (Number(i.discount) || 0)), 0)
      : Number(req.body.amount);

    if (!newAmount || newAmount <= 0) return res.status(400).json({ error: 'El monto debe ser positivo' });

    // Ajustar inventario: devolver lo viejo y descontar lo nuevo
    let inventoryAlerts = [];
    try {
      if (oldItems.length > 0) await restoreFromSale(req.params.businessId, oldItems);
      if (newItems.length > 0) {
        const result = await deductFromSale(req.params.businessId, newItems);
        inventoryAlerts = result.alerts || [];
      }
    } catch (invErr) {
      console.error('Inventory adjust on fiado edit:', invErr);
    }

    // Actualizar la transacción
    tx.items = newItems;
    tx.amount = newAmount;
    if (req.body.description !== undefined) tx.description = req.body.description;
    tx.editedAt = new Date().toISOString();
    tx.editedBy = req.user.name || req.user.username;

    // Recalcular saldo: quitar el monto viejo, sumar el nuevo
    debtors[idx].balance = Math.max(0, (debtors[idx].balance || 0) - oldAmount + newAmount);

    await writeJSON(debtorsPath(req.params.businessId), debtors);

    await logAudit(req.params.businessId, {
      user: req.user.name || req.user.username, role: req.user.role, action: 'edit_charge',
      summary: `Editó un fiado de ${debtors[idx].name} (${cop(oldAmount)} → ${cop(newAmount)})`
    });

    res.json({ debtor: debtors[idx], inventoryAlerts });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /debtors/:id/charge/:txId — Elimina un fiado registrado por error.
 *
 * Solo admin/superadmin y solo fiados NO liquidados. Devuelve los productos
 * al inventario y reduce el saldo del deudor.
 */
router.delete('/debtors/:id/charge/:txId', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });

    const debtors = await readJSON(debtorsPath(req.params.businessId)) || [];
    const idx = debtors.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Deudor no encontrado' });

    const tx = (debtors[idx].transactions || []).find(t => t.id === req.params.txId);
    if (!tx || tx.type !== 'charge') return res.status(404).json({ error: 'Fiado no encontrado' });
    if (tx.settled) {
      return res.status(400).json({ error: 'Este fiado ya fue facturado (el cliente saldó). No se puede eliminar.' });
    }

    // Devolver los productos al inventario
    if (Array.isArray(tx.items) && tx.items.length > 0) {
      try {
        await restoreFromSale(req.params.businessId, tx.items);
      } catch (invErr) {
        console.error('Inventory restore on fiado delete:', invErr);
      }
    }

    // Quitar la transacción y ajustar el saldo
    debtors[idx].transactions = debtors[idx].transactions.filter(t => t.id !== req.params.txId);
    debtors[idx].balance = Math.max(0, (debtors[idx].balance || 0) - (tx.amount || 0));

    await writeJSON(debtorsPath(req.params.businessId), debtors);

    await logAudit(req.params.businessId, {
      user: req.user.name || req.user.username, role: req.user.role, action: 'delete_charge',
      summary: `Eliminó un fiado de ${debtors[idx].name} por ${cop(tx.amount)}`
    });

    res.json({ debtor: debtors[idx] });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /debtors/:id/payment — Registra un abono (reduce el saldo).
 * Genera una factura (venta) con el ítem "Abono a deuda", el cliente y el valor, en
 * efectivo o banco; esa venta es la que suma al turno y a Finanzas. Si el saldo
 * queda en 0, los cargos quedan marcados settled=true (ya no se editan).
 *
 * Requiere un turno de caja abierto (si no, responde 400).
 *
 * Body: { amount, description?, paidWith? }
 * Respuesta: { debtor, generatedSale }   (generatedSale = la factura del abono)
 */
router.post('/debtors/:id/payment', authenticate, async (req, res) => {
  try {
    const debtors = await readJSON(debtorsPath(req.params.businessId)) || [];
    const idx = debtors.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Deudor no encontrado' });

    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'El monto debe ser positivo' });

    // Un abono es plata que entra: debe quedar dentro de un turno de caja abierto
    const openShifts = await readJSON(shiftsPath(req.params.businessId)) || [];
    if (!openShifts.some(s => s.status === 'open')) {
      return res.status(400).json({ error: 'No hay un turno de caja abierto. Abre un turno para registrar abonos.' });
    }

    // Capear al saldo actual para mantener consistencia entre saldo e historial
    const currentBalance = debtors[idx].balance || 0;
    const actualAmount = Math.min(amount, currentBalance);

    // Repartir el abono entre Bar/Restaurante según la composición de la deuda
    // (cargos no liquidados). Se calcula AHORA y se guarda, para que sea exacto.
    let barDebt = 0, restDebt = 0;
    for (const t of (debtors[idx].transactions || [])) {
      if (t.type !== 'charge' || t.settled) continue;
      if (Array.isArray(t.items) && t.items.length > 0) {
        for (const it of t.items) {
          const val = Math.max(0, (Number(it.price) || 0) * (it.qty || 1) - (Number(it.discount) || 0));
          if (it.area === 'restaurante') restDebt += val; else barDebt += val;
        }
      } else {
        barDebt += t.amount || 0; // cargo sin items → se asume Bar
      }
    }
    const debtTotal = barDebt + restDebt;
    const barPart = debtTotal > 0 ? Math.round(actualAmount * (barDebt / debtTotal)) : actualAmount;
    const restPart = actualAmount - barPart;

    const transaction = {
      id: uuidv4(),
      type: 'payment',
      amount: actualAmount,
      description: req.body.description || 'Abono',
      // Forma de pago del abono (efectivo/banco) y reparto por área para Finanzas
      paidWith: req.body.paidWith === 'banco' ? 'banco' : 'efectivo',
      areaSplit: { bar: barPart, restaurante: restPart },
      date: new Date().toISOString(),
      registeredBy: req.user.name || req.user.username
    };

    debtors[idx].transactions = [...(debtors[idx].transactions || []), transaction];
    debtors[idx].balance = Math.max(0, currentBalance - actualAmount);

    // Si el saldo queda en 0, los cargos quedan liquidados (ya no se pueden editar ni borrar).
    // No se genera otra factura: el dinero ya entra con la factura de cada abono.
    if (debtors[idx].balance === 0) {
      const settledIds = [];
      for (const t of debtors[idx].transactions) {
        if (t.type === 'charge' && !t.settled) { t.settled = true; settledIds.push(t.id); }
      }
      if (settledIds.length > 0) transaction.settledChargeIds = settledIds;
    }

    // Factura del abono: así el dinero entra como una venta (turno, Finanzas, reportes)
    const generatedSale = await createAbonoSale(req.params.businessId, debtors[idx], transaction, req.user);
    transaction.abonoSaleId = generatedSale.id;
    transaction.invoiceNumber = generatedSale.invoiceNumber;

    await writeJSON(debtorsPath(req.params.businessId), debtors);

    res.json({ debtor: debtors[idx], generatedSale });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /debtors/:id/payment/:txId — Edita un abono (corrección del admin).
 *
 * Solo admin/superadmin. Cambia el monto del abono y recalcula el saldo.
 * Si tras el cambio la deuda vuelve a quedar pendiente (Σabonos < Σcargos),
 * reabre los fiados que se habían facturado y borra la factura 'pago_fiado'
 * automática. No vuelve a liquidar aunque el nuevo monto cubra la deuda
 * (para eso se registra un nuevo abono).
 *
 * Body: { amount, description? }
 */
router.put('/debtors/:id/payment/:txId', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });

    const debtors = await readJSON(debtorsPath(req.params.businessId)) || [];
    const idx = debtors.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Deudor no encontrado' });

    const debtor = debtors[idx];
    const tx = (debtor.transactions || []).find(t => t.id === req.params.txId);
    if (!tx || tx.type !== 'payment') return res.status(404).json({ error: 'Abono no encontrado' });

    const newAmount = Number(req.body.amount);
    if (!newAmount || newAmount <= 0) return res.status(400).json({ error: 'El monto debe ser positivo' });

    const oldPayAmount = tx.amount;
    // Aplicar el nuevo monto
    tx.amount = newAmount;
    if (req.body.description !== undefined) tx.description = req.body.description;
    tx.editedAt = new Date().toISOString();
    tx.editedBy = req.user.name || req.user.username;

    // Si la deuda vuelve a quedar pendiente, revertir la liquidación previa
    const totalCharges  = debtor.transactions.filter(t => t.type === 'charge').reduce((s, t) => s + (t.amount || 0), 0);
    const totalPayments = debtor.transactions.filter(t => t.type === 'payment').reduce((s, t) => s + (t.amount || 0), 0);
    const hasSettled = debtor.transactions.some(t => t.type === 'charge' && t.settled);
    if (totalPayments < totalCharges && hasSettled) {
      await reversePaymentSettlement(req.params.businessId, debtor, tx);
      // El enlace de liquidación ya no aplica a este abono
      delete tx.generatedSaleId;
      delete tx.settledChargeIds;
    }

    // La factura del abono (y el turno al que pertenece) quedan con el nuevo monto
    if (tx.abonoSaleId) await syncAbonoSale(req.params.businessId, debtor, tx, oldPayAmount);

    recomputeBalance(debtor);
    await writeJSON(debtorsPath(req.params.businessId), debtors);

    await logAudit(req.params.businessId, {
      user: req.user.name || req.user.username, role: req.user.role, action: 'edit_payment',
      summary: `Editó un abono de ${debtor.name} (${cop(oldPayAmount)} → ${cop(newAmount)})`
    });

    res.json({ debtor });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /debtors/:id/payment/:txId — Elimina un abono (corrección del admin).
 *
 * Solo admin/superadmin. Quita el abono y recalcula el saldo. Si la deuda
 * vuelve a quedar pendiente, reabre los fiados facturados y borra la factura
 * 'pago_fiado' automática asociada.
 */
router.delete('/debtors/:id/payment/:txId', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });

    const debtors = await readJSON(debtorsPath(req.params.businessId)) || [];
    const idx = debtors.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Deudor no encontrado' });

    const debtor = debtors[idx];
    const tx = (debtor.transactions || []).find(t => t.id === req.params.txId);
    if (!tx || tx.type !== 'payment') return res.status(404).json({ error: 'Abono no encontrado' });

    // Quitar el abono y su factura (se descuenta del turno)
    debtor.transactions = debtor.transactions.filter(t => t.id !== req.params.txId);
    if (tx.abonoSaleId) await removeAbonoSale(req.params.businessId, tx);

    // Si la deuda vuelve a quedar pendiente, revertir la liquidación previa
    const totalCharges  = debtor.transactions.filter(t => t.type === 'charge').reduce((s, t) => s + (t.amount || 0), 0);
    const totalPayments = debtor.transactions.filter(t => t.type === 'payment').reduce((s, t) => s + (t.amount || 0), 0);
    const hasSettled = debtor.transactions.some(t => t.type === 'charge' && t.settled);
    if (totalPayments < totalCharges && hasSettled) {
      await reversePaymentSettlement(req.params.businessId, debtor, tx);
    }

    recomputeBalance(debtor);
    await writeJSON(debtorsPath(req.params.businessId), debtors);

    await logAudit(req.params.businessId, {
      user: req.user.name || req.user.username, role: req.user.role, action: 'delete_payment',
      summary: `Eliminó un abono de ${debtor.name} por ${cop(tx.amount)}`
    });

    res.json({ debtor });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
