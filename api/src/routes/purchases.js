/**
 * routes/purchases.js — Registro de compras a proveedores
 *
 * Una compra registra los insumos que entraron al inventario y
 * opcionalmente genera deuda con el proveedor correspondiente.
 *
 * Al crear una compra:
 *   1. Se guarda el registro de la compra con sus ítems y total
 *   2. Se aumenta el stock de cada ítem comprado (addFromPurchase)
 *   3. Si se indicó un proveedor, se aumenta su deuda total
 *
 * Solo admin y superadmin pueden registrar compras.
 *
 * Rutas:
 *   GET  /api/:businessId/purchases        → listar todas las compras
 *   POST /api/:businessId/purchases        → registrar nueva compra (admin+)
 *   PUT  /api/:businessId/purchases/:id    → editar compra (admin+)
 */

const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams: true necesario para :businessId
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, getBusinessPath } = require('../services/fileStorage');
const { authenticate } = require('../middleware/auth');
const { addFromPurchase } = require('../services/inventoryService');

const purchasesPath = (id) => path.join(getBusinessPath(id), 'purchases.json');
const suppliersPath = (id) => path.join(getBusinessPath(id), 'suppliers.json');

/** GET — Lista todas las compras registradas del negocio */
router.get('/purchases', authenticate, async (req, res) => {
  try {
    const purchases = await readJSON(purchasesPath(req.params.businessId)) || [];
    res.json(purchases);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /purchases — Registra una nueva compra.
 *
 * Body esperado:
 *   { supplierId, items: [{ inventoryId, quantity, unitCost }], notes }
 *
 * El total se calcula automáticamente (suma de quantity × unitCost).
 * Si se especifica supplierId, la deuda del proveedor aumenta en ese total.
 */
router.post('/purchases', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const { supplierId, items, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items in purchase' });
    }

    // Calcular total de la compra
    const total = items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

    const purchase = {
      id: uuidv4(),
      supplierId: supplierId || null,
      items,
      total,
      date: new Date().toISOString(),
      notes: notes || '',
      createdBy: req.user.name || req.user.username
    };

    const purchases = await readJSON(purchasesPath(req.params.businessId)) || [];
    purchases.push(purchase);
    await writeJSON(purchasesPath(req.params.businessId), purchases);

    // Aumentar el stock de los ítems comprados en el inventario
    await addFromPurchase(req.params.businessId, items);

    // Si hay proveedor, aumentar su deuda pendiente
    if (supplierId) {
      const suppliers = await readJSON(suppliersPath(req.params.businessId)) || [];
      const sIdx = suppliers.findIndex(s => s.id === supplierId);
      if (sIdx !== -1) {
        suppliers[sIdx].totalDebt = (suppliers[sIdx].totalDebt || 0) + total;
        await writeJSON(suppliersPath(req.params.businessId), suppliers);
      }
    }

    res.status(201).json(purchase);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /purchases/:id — Edita una compra existente con recálculo completo de stock.
 *
 * El proceso se ejecuta en 4 pasos atómicos (todos o ninguno debería fallar):
 *
 *   1. Revertir el stock que aportó la compra original:
 *      Sustrae de cada ítem de inventario la cantidad que se había sumado
 *      al registrar la compra. Math.max(0,...) evita stock negativo.
 *
 *   2. Aplicar el nuevo stock con los nuevos ítems y cantidades.
 *      También actualiza el costo unitario del insumo si se proporcionó.
 *
 *   3. Ajustar la deuda del proveedor si cambió (o si cambió el proveedor):
 *      - Resta la deuda generada por la compra original al proveedor anterior
 *      - Suma la nueva deuda al proveedor nuevo (puede ser el mismo)
 *
 *   4. Sobrescribe el registro de la compra con los nuevos datos y
 *      agrega updatedAt para auditoría.
 *
 * Limitación: no hay transacción; si el proceso falla a mitad de los pasos,
 * el inventario puede quedar en estado inconsistente. Mitigado con validación
 * previa en el frontend antes de llamar este endpoint.
 */
router.put('/purchases/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const { supplierId, items, notes } = req.body;
    const bid = req.params.businessId;

    const purchases = await readJSON(purchasesPath(bid)) || [];
    const idx = purchases.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Purchase not found' });

    const original = purchases[idx];

    // 1. Revertir el stock aportado por la compra original
    // Se construye el path de inventario inline ya que no está importado como variable
    const inventoryPath = require('path').join(require('../services/fileStorage').getBusinessPath(bid), 'inventory.json');
    const inventory = await readJSON(inventoryPath) || [];
    for (const item of (original.items || [])) {
      const inv = inventory.findIndex(i => i.id === item.inventoryId);
      // Math.max(0,...) evita que el stock quede negativo por ediciones parciales
      if (inv !== -1) inventory[inv].stock = Math.max(0, (inventory[inv].stock || 0) - item.quantity);
    }

    // 2. Aplicar el nuevo stock con los ítems actualizados
    for (const item of (items || [])) {
      const inv = inventory.findIndex(i => i.id === item.inventoryId);
      if (inv !== -1) {
        inventory[inv].stock = (inventory[inv].stock || 0) + item.quantity;
        // Actualizar el costo de referencia del insumo con el último precio de compra
        if (item.unitCost) inventory[inv].cost = item.unitCost;
      }
    }
    await writeJSON(inventoryPath, inventory);

    // 3. Ajustar deuda del proveedor si hay proveedor involucrado (anterior o nuevo)
    const newTotal = (items || []).reduce((s, i) => s + i.quantity * i.unitCost, 0);
    if (original.supplierId || supplierId) {
      const suppliers = await readJSON(suppliersPath(bid)) || [];

      // Revertir la deuda que generó la compra original al proveedor anterior
      if (original.supplierId) {
        const sOld = suppliers.findIndex(s => s.id === original.supplierId);
        if (sOld !== -1) suppliers[sOld].totalDebt = Math.max(0, (suppliers[sOld].totalDebt || 0) - original.total);
      }

      // Agregar la nueva deuda al proveedor de la compra actualizada
      if (supplierId) {
        const sNew = suppliers.findIndex(s => s.id === supplierId);
        if (sNew !== -1) suppliers[sNew].totalDebt = (suppliers[sNew].totalDebt || 0) + newTotal;
      }

      await writeJSON(suppliersPath(bid), suppliers);
    }

    // 4. Guardar la compra actualizada conservando id, fecha original y createdBy
    purchases[idx] = {
      ...original,
      supplierId: supplierId || null,
      items,
      notes: notes || '',
      total: newTotal,
      updatedAt: new Date().toISOString()   // Marca de auditoría: cuándo fue editada
    };
    await writeJSON(purchasesPath(bid), purchases);
    res.json(purchases[idx]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
