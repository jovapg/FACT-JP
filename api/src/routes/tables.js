/**
 * routes/tables.js — Gestión de mesas y pedidos en curso
 *
 * Controla el estado de las mesas del negocio y sus pedidos activos.
 * Una mesa puede estar 'libre' (sin pedido) u 'ocupada' (con pedido abierto).
 *
 * El pedido de una mesa guarda: items, mesero, cliente, fecha de apertura
 * y fecha de última actualización. Al cobrar la factura, la ruta de ventas
 * limpia automáticamente el pedido de la mesa.
 *
 * Rutas:
 *   GET    /api/:businessId/tables                 → listar todas las mesas
 *   POST   /api/:businessId/tables/init            → reinicializar mesas (admin+)
 *   PUT    /api/:businessId/tables/:id/order       → actualizar pedido de una mesa
 *   DELETE /api/:businessId/tables/:id/order       → limpiar pedido (liberar mesa)
 *
 * Modo "varias ventas" (profile.multiOrders): cada espacio (mesa/campo) guarda una
 * lista de ventas abiertas en table.orders:
 *   POST   /api/:businessId/tables/:id/orders             → nueva venta guardada
 *   PUT    /api/:businessId/tables/:id/orders/:orderId    → editar la venta (items, cliente)
 *   DELETE /api/:businessId/tables/:id/orders/:orderId    → eliminar la venta
 * Al facturar, la ruta de ventas quita la venta facturada (orderId) del espacio.
 */

const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams: true necesario para :businessId
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, getBusinessPath } = require('../services/fileStorage');
const { authenticate } = require('../middleware/auth');
const spaces = require('../services/spaces');

const profilePath = (id) => path.join(getBusinessPath(id), 'profile.json');

const tablesPath = (id) => path.join(getBusinessPath(id), 'tables.json');

/** GET — Retorna todas las mesas con su estado y pedido actual */
router.get('/tables', authenticate, async (req, res) => {
  try {
    const tables = await readJSON(tablesPath(req.params.businessId)) || [];
    res.json(tables);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /tables/init — Reinicializa el número de mesas del negocio.
 * Crea `count` mesas numeradas desde 1, todas libres y sin pedido.
 * Solo admin y superadmin pueden hacer esto (afecta la configuración global).
 */
router.post('/tables/init', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const { count } = req.body;
    // Si la franquicia tiene espacios con nombre (Alfa, Mega…) se conservan los nombres
    const profile = await readJSON(profilePath(req.params.businessId)) || {};
    const names = spaces.cleanNames(profile.spaceNames);
    const tables = spaces.buildTables({ names, count, multi: !!profile.multiOrders });
    await writeJSON(tablesPath(req.params.businessId), tables);
    res.json(tables);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /tables/:id/order — Actualiza o crea el pedido de una mesa.
 *
 * Si `items` está vacío, la mesa vuelve a estado 'libre' y se borra el pedido.
 * Si hay items, la mesa pasa a 'ocupada' y se guarda el pedido con:
 *   - El mesero (del body o del usuario autenticado como fallback)
 *   - El cliente (si se especificó)
 *   - La fecha de apertura original (si ya existía un pedido previo)
 *   - La fecha de última actualización (siempre se renueva)
 */
router.put('/tables/:id/order', authenticate, async (req, res) => {
  try {
    const tables = await readJSON(tablesPath(req.params.businessId)) || [];
    const idx = tables.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Table not found' });

    const { items, waiter, client } = req.body;

    if (!items || items.length === 0) {
      // Sin items → liberar la mesa
      tables[idx].status = 'libre';
      tables[idx].order = null;
    } else {
      // Con items → marcar como ocupada y guardar pedido
      tables[idx].status = 'ocupada';
      tables[idx].order = {
        items,
        waiter: waiter || req.user.name || req.user.username,
        client: client || tables[idx].order?.client || '', // Preservar cliente si ya existía
        createdAt: tables[idx].order?.createdAt || new Date().toISOString(), // Preservar hora de apertura original
        updatedAt: new Date().toISOString()
      };
    }

    await writeJSON(tablesPath(req.params.businessId), tables);
    res.json(tables[idx]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /tables/:id/order — Libera una mesa (limpia su pedido).
 * Se llama desde el store de ventas después de crear la factura exitosamente,
 * pero también puede llamarse manualmente para cancelar un pedido.
 */
router.delete('/tables/:id/order', authenticate, async (req, res) => {
  try {
    const tables = await readJSON(tablesPath(req.params.businessId)) || [];
    const idx = tables.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Table not found' });

    tables[idx].status = 'libre';
    tables[idx].order = null;

    await writeJSON(tablesPath(req.params.businessId), tables);
    res.json(tables[idx]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/** Busca un espacio y devuelve { tables, idx } (o null si no existe) */
async function findTable(businessId, tableId) {
  const tables = await readJSON(tablesPath(businessId)) || [];
  const idx = tables.findIndex(t => t.id === tableId);
  return idx === -1 ? null : { tables, idx };
}

/** Un espacio con ventas guardadas está 'ocupada'; sin ninguna, 'libre' */
function refreshStatus(t) {
  t.status = (t.orders && t.orders.length > 0) ? 'ocupada' : 'libre';
}

/** POST /tables/:id/orders — Crea una venta guardada nueva en el espacio */
router.post('/tables/:id/orders', authenticate, async (req, res) => {
  try {
    const f = await findTable(req.params.businessId, req.params.id);
    if (!f) return res.status(404).json({ error: 'Table not found' });
    const t = f.tables[f.idx];
    t.orders = Array.isArray(t.orders) ? t.orders : [];
    t.orderSeq = (t.orderSeq || t.orders.length) + 1;
    const now = new Date().toISOString();
    const order = {
      id: uuidv4(),
      name: 'Venta ' + t.orderSeq,
      client: spaces.txt(req.body.client, 60),
      items: Array.isArray(req.body.items) ? req.body.items : [],
      waiter: req.user.name || req.user.username,
      createdAt: now,
      updatedAt: now
    };
    t.orders.push(order);
    refreshStatus(t);
    await writeJSON(tablesPath(req.params.businessId), f.tables);
    res.status(201).json({ table: t, order });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/** PUT /tables/:id/orders/:orderId — Guarda los productos y el cliente de una venta */
router.put('/tables/:id/orders/:orderId', authenticate, async (req, res) => {
  try {
    const f = await findTable(req.params.businessId, req.params.id);
    if (!f) return res.status(404).json({ error: 'Table not found' });
    const t = f.tables[f.idx];
    const order = (t.orders || []).find(o => o.id === req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Venta no encontrada' });
    if (Array.isArray(req.body.items)) order.items = req.body.items;
    if (req.body.client !== undefined) order.client = spaces.txt(req.body.client, 60);
    order.waiter = req.body.waiter || order.waiter || req.user.name || req.user.username;
    order.updatedAt = new Date().toISOString();
    refreshStatus(t);
    await writeJSON(tablesPath(req.params.businessId), f.tables);
    res.json({ table: t, order });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/** DELETE /tables/:id/orders/:orderId — Elimina una venta guardada (sin facturar) */
router.delete('/tables/:id/orders/:orderId', authenticate, async (req, res) => {
  try {
    const f = await findTable(req.params.businessId, req.params.id);
    if (!f) return res.status(404).json({ error: 'Table not found' });
    const t = f.tables[f.idx];
    t.orders = (t.orders || []).filter(o => o.id !== req.params.orderId);
    refreshStatus(t);
    await writeJSON(tablesPath(req.params.businessId), f.tables);
    res.json({ table: t });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
