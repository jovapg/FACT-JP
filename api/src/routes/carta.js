/**
 * routes/carta.js — Carta y pedidos en línea: lado interno (quien atiende y el admin)
 *
 *   GET  /api/:businessId/carta                 → carta completa (incluye lo inactivo)
 *   PUT  /api/:businessId/carta/settings        → abierto/pausa/WhatsApp/domicilio gratis… (admin; cajero solo abierto/pausa)
 *   PUT  /api/:businessId/carta/products/:id    → editar producto (admin) o marcar agotado (cajero)
 *   POST /api/:businessId/carta/load-default    → carga la carta de Deli-Combos (solo superadmin)
 *   GET  /api/:businessId/pedidos               → pedidos (vence los de 15 min sin confirmar)
 *   PUT  /api/:businessId/pedidos/:id           → cambiar estado / valor del domicilio
 *
 * Al marcar "entregado" el pedido se convierte en una venta (factura) normal:
 * entra al turno, a reportes y a Finanzas como cualquier otra.
 */
const express = require('express');
const router = express.Router({ mergeParams: true });
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, getBusinessPath } = require('../services/fileStorage');
const { authenticate } = require('../middleware/auth');
const carta = require('../services/cartaService');
const { updateActiveShift } = require('../services/shiftSales');

const salesPath   = (id) => path.join(getBusinessPath(id), 'sales.json');
const profilePath = (id) => path.join(getBusinessPath(id), 'profile.json');

const isAdmin = (req) => req.user.role === 'admin' || req.user.role === 'superadmin';
const ACTIVE = ['por_confirmar', 'pendiente', 'en_preparacion', 'en_camino'];
const FLOW = ['por_confirmar', 'pendiente', 'en_preparacion', 'en_camino', 'entregado'];

router.get('/carta', authenticate, async (req, res) => {
  try {
    const c = await carta.readCarta(req.params.businessId);
    if (!c) return res.json({ enabled: false });
    res.json({ enabled: true, ...c });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/carta/load-default', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
    const existing = await carta.readCarta(req.params.businessId);
    if (existing && req.body?.force !== true) return res.status(409).json({ error: 'Ya hay una carta cargada' });
    const c = carta.defaultCarta();
    await carta.writeCarta(req.params.businessId, c);
    // Prende "Pedidos en línea" en el menú de este negocio
    const profile = await readJSON(profilePath(req.params.businessId)) || {};
    profile.cartaOnline = true;
    await writeJSON(profilePath(req.params.businessId), profile);
    res.status(201).json({ ok: true, products: c.products.length });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/carta/settings', authenticate, async (req, res) => {
  try {
    const c = await carta.readCarta(req.params.businessId);
    if (!c) return res.status(404).json({ error: 'Sin carta' });
    const b = req.body || {};
    const s = c.settings;
    // Cualquiera que atiende puede abrir/cerrar y pausar
    if (typeof b.open === 'boolean') s.open = b.open;
    if (typeof b.paused === 'boolean') s.paused = b.paused;
    if (isAdmin(req)) {
      if (typeof b.enabled === 'boolean') s.enabled = b.enabled;
      if (typeof b.pickup === 'boolean') s.pickup = b.pickup;
      if (b.whatsapp !== undefined) {
        let w = String(b.whatsapp).replace(/\D/g, '');
        if (w.length === 10) w = '57' + w; // celular colombiano sin indicativo
        if (w.length < 11) return res.status(400).json({ error: 'WhatsApp no válido' });
        s.whatsapp = w.slice(0, 15);
      }
      if (b.freeDeliveryFrom !== undefined) s.freeDeliveryFrom = carta.num(b.freeDeliveryFrom);
      if (b.hours !== undefined) s.hours = carta.txt(b.hours, 120);
      if (b.welcome !== undefined) s.welcome = carta.txt(b.welcome, 200);
    }
    await carta.writeCarta(req.params.businessId, c);
    res.json(s);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/carta/products/:id', authenticate, async (req, res) => {
  try {
    const c = await carta.readCarta(req.params.businessId);
    const p = c && c.products.find(x => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    const b = req.body || {};
    if (typeof b.soldOut === 'boolean') p.soldOut = b.soldOut; // cajero también puede marcar agotado
    if (isAdmin(req)) {
      if (typeof b.active === 'boolean') p.active = b.active;
      if (b.name !== undefined) p.name = carta.txt(b.name, 80, p.name);
      if (b.description !== undefined) p.description = carta.txt(b.description, 160);
      if (b.price !== undefined) p.price = carta.num(b.price);
      // Precio de una opción dentro de un grupo: { optionId, price }
      if (b.optionPrice && b.optionPrice.optionId) {
        for (const g of p.groups || []) {
          const o = g.options.find(x => x.id === b.optionPrice.optionId);
          if (o) o.price = carta.num(b.optionPrice.price);
        }
      }
    }
    await carta.writeCarta(req.params.businessId, c);
    res.json(p);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

/** Precio de una opción compartida (p. ej. Coca-Cola): cambia en TODOS los productos donde aparece */
router.put('/carta/option-price', authenticate, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const c = await carta.readCarta(req.params.businessId);
    if (!c) return res.status(404).json({ error: 'Sin carta' });
    const name = String(req.body?.name || '');
    const price = carta.num(req.body?.price);
    let n = 0;
    for (const p of c.products) for (const g of p.groups || []) for (const o of g.options) {
      if (o.name === name && g.type === 'qty') { o.price = price; n++; }
    }
    // Y el producto suelto con ese nombre (adiciones / bebidas que se piden solas)
    for (const p of c.products) if (p.name === name && !(p.groups || []).length) { p.price = price; n++; }
    await carta.writeCarta(req.params.businessId, c);
    res.json({ updated: n });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/pedidos', authenticate, async (req, res) => {
  try {
    const list = await carta.readPedidos(req.params.businessId);
    res.set('Cache-Control', 'no-store');
    res.json(list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

/** Convierte un pedido entregado en una venta normal */
async function pedidoToSale(businessId, p, user) {
  const items = p.lines.map(l => {
    const detail = l.choices && l.choices.length ? ` (${l.choices.join(', ')})` : '';
    return { name: l.name + detail, price: l.unitPrice, qty: l.qty, discount: 0, area: 'bar',
      kind: l.kind === 'adicion' ? 'adicion' : 'producto', ...(l.note ? { note: l.note } : {}) };
  });
  const fee = Number(p.deliveryFee) || 0;
  if (fee > 0) items.push({ name: 'Domicilio', price: fee, qty: 1, discount: 0, area: 'bar', kind: 'domicilio' });

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const profile = await readJSON(profilePath(businessId)) || {};
  const prefix = profile.invoicePrefix || 'FAC';
  const invoiceNumber = `${prefix}-${String((profile.invoiceCounter || 0) + 1).padStart(4, '0')}-${new Date().getFullYear()}`;

  const sale = {
    id: uuidv4(), invoiceNumber,
    tableId: null, tableNumber: null,
    items, subtotal, discount: 0, total: subtotal,
    totalsByArea: { bar: subtotal, restaurante: 0 },
    paymentMethod: p.payment, cashier: user.name || user.username,
    client: p.customer.name,
    notes: `Pedido ${p.code} (${p.mode === 'domicilio' ? 'domicilio' : 'recoger en el local'})`,
    source: 'carta', pedidoId: p.id, deliveryFee: fee,
    createdAt: new Date().toISOString()
  };
  const sales = await readJSON(salesPath(businessId)) || [];
  sales.push(sale);
  await writeJSON(salesPath(businessId), sales);
  profile.invoiceCounter = (profile.invoiceCounter || 0) + 1;
  await writeJSON(profilePath(businessId), profile);
  await updateActiveShift(businessId, sale);
  return sale;
}

router.put('/pedidos/:id', authenticate, async (req, res) => {
  try {
    const bid = req.params.businessId;
    const list = await carta.readPedidos(bid);
    const p = list.find(x => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (['entregado', 'cancelado'].includes(p.status)) return res.status(409).json({ error: 'Este pedido ya está cerrado' });

    const b = req.body || {};
    if (b.deliveryFee !== undefined && b.deliveryFee !== null && b.deliveryFee !== '') {
      if (p.mode !== 'domicilio') return res.status(400).json({ error: 'Este pedido es para recoger' });
      p.deliveryFee = carta.num(b.deliveryFee);
    }
    if (b.payment === 'efectivo' || b.payment === 'transferencia') p.payment = b.payment;

    let sale = null;
    if (b.status) {
      if (!carta.STATES.includes(b.status)) return res.status(400).json({ error: 'Estado no válido' });
      if (b.status === 'cancelado') {
        p.status = 'cancelado';
      } else {
        if (p.status === 'vencido') { p.status = 'por_confirmar'; p.expiresAt = new Date(Date.now() + carta.EXPIRE_MIN * 60000).toISOString(); } // reactivar un vencido
        if (!FLOW.includes(b.status)) return res.status(400).json({ error: 'Estado no válido' });
        if (FLOW.indexOf(b.status) < FLOW.indexOf(p.status)) return res.status(400).json({ error: 'No se puede devolver el estado' });
        if (b.status !== 'por_confirmar' && p.mode === 'domicilio' && (p.deliveryFee === null || p.deliveryFee === undefined)) {
          return res.status(400).json({ error: 'Escribe el valor del domicilio (0 si es gratis) antes de confirmar' });
        }
        p.status = b.status;
        if (b.status === 'entregado') {
          sale = await pedidoToSale(bid, p, req.user);
          p.saleId = sale.id; p.invoiceNumber = sale.invoiceNumber;
        }
      }
    }
    p.updatedAt = new Date().toISOString();
    await carta.writePedidos(bid, list);
    res.json({ pedido: p, sale });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
