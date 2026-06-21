/**
 * routes/inventory.js — CRUD de inventario de insumos
 *
 * Gestiona los productos/insumos del inventario del negocio.
 * Los cajeros no tienen permiso para crear, editar ni eliminar ítems.
 *
 * Cada ítem de inventario tiene: nombre, unidad, stock, costo,
 * categoría, stock mínimo (para alertas) y fecha de creación.
 *
 * Rutas:
 *   GET    /api/:businessId/inventory              → listar todos los ítems
 *   POST   /api/:businessId/inventory              → crear nuevo ítem (admin+)
 *   PUT    /api/:businessId/inventory/:id          → actualizar ítem (admin+)
 *   DELETE /api/:businessId/inventory/:id          → eliminar ítem (admin+)
 *   PATCH  /api/:businessId/inventory/:id/adjust   → ajustar stock manualmente (admin+)
 */

const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams: true es CRÍTICO para recibir :businessId del router padre
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, getBusinessPath } = require('../services/fileStorage');
const { authenticate } = require('../middleware/auth');
const { adjustStock } = require('../services/inventoryService');
const { logAudit } = require('../services/audit');

const inventoryPath = (id) => path.join(getBusinessPath(id), 'inventory.json');

/** GET — Retorna todos los ítems de inventario del negocio */
router.get('/inventory', authenticate, async (req, res) => {
  try {
    const items = await readJSON(inventoryPath(req.params.businessId)) || [];
    res.json(items);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST — Crea un nuevo ítem en el inventario. Solo admin y superadmin.
 *
 * Body esperado:
 *   { name, unit?, stock?, cost?, category?, minStock?, supplierId?, salePrice? }
 *
 * supplierId: vincula el producto a un proveedor específico para que aparezca
 *   pre-filtrado en el modal de compras cuando se selecciona ese proveedor.
 *   Es opcional (null si no se especifica).
 *
 * salePrice: campo ignorado aquí; solo lo usa el frontend para crear la receta
 *   de menú automáticamente cuando la categoría tiene autoRecipe = true.
 */
router.post('/inventory', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const items = await readJSON(inventoryPath(req.params.businessId)) || [];
    const newItem = {
      id: uuidv4(),
      name: req.body.name,
      unit: req.body.unit || 'unidad',
      stock: Number(req.body.stock) || 0,
      cost: Number(req.body.cost) || 0,
      category: req.body.category || 'general',
      area: req.body.area === 'restaurante' ? 'restaurante' : 'bar', // Bolsillo del insumo: bar | restaurante
      minStock: Number(req.body.minStock) || 0,
      supplierId: req.body.supplierId || null,  // Vinculación proveedor-producto para filtros en compras
      salePrice: Number(req.body.salePrice) || 0,
      createdAt: new Date().toISOString()
    };
    items.push(newItem);
    await writeJSON(inventoryPath(req.params.businessId), items);
    res.status(201).json(newItem);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/** PUT — Actualiza todos los campos de un ítem de inventario por ID */
router.put('/inventory/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const items = await readJSON(inventoryPath(req.params.businessId)) || [];
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Item not found' });
    items[idx] = { ...items[idx], ...req.body, id: req.params.id }; // Preserva el ID original
    await writeJSON(inventoryPath(req.params.businessId), items);
    res.json(items[idx]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/** DELETE — Elimina un ítem de inventario por ID */
router.delete('/inventory/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    let items = await readJSON(inventoryPath(req.params.businessId)) || [];
    items = items.filter(i => i.id !== req.params.id);
    await writeJSON(inventoryPath(req.params.businessId), items);
    res.json({ success: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /inventory/:id/adjust — Ajuste manual de stock.
 * Body: { adjustment: number, reason: string }
 * `adjustment` positivo = entrada de stock, negativo = merma/salida.
 * Delega la lógica al servicio inventoryService.
 */
router.patch('/inventory/:id/adjust', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const { adjustment, reason } = req.body;
    const updated = await adjustStock(req.params.businessId, req.params.id, Number(adjustment), reason);
    if (!updated) return res.status(404).json({ error: 'Item not found' });
    res.json(updated);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /inventory/count — Conteo físico de inventario.
 * Body: { items: [{ id, counted }] }
 * Para cada ítem con conteo, fija el stock al valor contado y registra la
 * diferencia (merma/sobrante) en lastAdjustment. Devuelve el detalle de cambios.
 * Solo admin/superadmin.
 */
router.post('/inventory/count', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const counts = Array.isArray(req.body.items) ? req.body.items : [];
    const inventory = await readJSON(inventoryPath(req.params.businessId)) || [];

    const changes = [];
    for (const c of counts) {
      if (c.counted === undefined || c.counted === null || c.counted === '') continue;
      const counted = Number(c.counted);
      if (isNaN(counted) || counted < 0) continue;
      const idx = inventory.findIndex(i => i.id === c.id);
      if (idx === -1) continue;
      const before = inventory[idx].stock || 0;
      const diff = counted - before;
      if (diff === 0) continue;
      inventory[idx].stock = counted;
      inventory[idx].lastAdjustment = { amount: diff, reason: 'Conteo físico', date: new Date().toISOString() };
      changes.push({ id: inventory[idx].id, name: inventory[idx].name, before, after: counted, diff });
    }

    if (changes.length > 0) {
      await writeJSON(inventoryPath(req.params.businessId), inventory);
      await logAudit(req.params.businessId, {
        user: req.user.name || req.user.username, role: req.user.role, action: 'inventory_count',
        summary: `Hizo conteo físico: ${changes.length} ítem(s) ajustados`
      });
    }
    res.json({ ajustados: changes.length, changes, inventory });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

// Image upload for multer - configured in server.js and passed via router
// POST /inventory/:id/image — upload product image
router.post('/inventory/:id/image', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });

    const inventory = await readJSON(inventoryPath(req.params.businessId)) || [];
    const idx = inventory.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Producto no encontrado' });

    const imageUrl = `/uploads/${req.params.businessId}/${req.file.filename}`;
    inventory[idx].imageUrl = imageUrl;
    await writeJSON(inventoryPath(req.params.businessId), inventory);
    res.json({ imageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
