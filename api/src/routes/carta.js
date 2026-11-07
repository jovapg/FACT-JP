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
const { deductFromSale } = require('../services/inventoryService');
const { logAudit, cop } = require('../services/audit');

const who = (req) => ({ user: req.user.name || req.user.username, role: req.user.role });
const PAGO = { efectivo: 'efectivo', transferencia: 'transferencia' };

const salesPath   = (id) => path.join(getBusinessPath(id), 'sales.json');
const profilePath = (id) => path.join(getBusinessPath(id), 'profile.json');

const isAdmin = (req) => req.user.role === 'admin' || req.user.role === 'superadmin';
const ACTIVE = ['por_confirmar', 'pendiente', 'en_preparacion', 'en_camino'];
const FLOW = ['por_confirmar', 'pendiente', 'en_preparacion', 'en_camino', 'entregado'];

router.get('/carta', authenticate, async (req, res) => {
  try {
    const c = await carta.readCarta(req.params.businessId);
    if (!c) return res.json({ enabled: false });
    res.json({ enabled: true, ...c, shiftOpen: carta.hasOpenShift(req.params.businessId) });
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

/** Registra los productos de la carta en el inventario (stock 0) y los enlaza para descontar al facturar */
router.post('/carta/sync-inventory', authenticate, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const r = await carta.syncInventory(req.params.businessId);
    await logAudit(req.params.businessId, { ...who(req), action: 'carta_inventario',
      summary: `Carta → inventario: ${r.created} producto(s) nuevos creados con stock 0, ${r.linked} enlazados (de ${r.total})` });
    res.json(r);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message || 'Internal server error' }); }
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
      if (b.hours !== undefined) s.hours = carta.txt(b.hours, 220);
      for (const k of ['openFrom', 'openTo']) if (b[k] !== undefined) {
        const v = String(b[k]).trim();
        if (v && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(v)) return res.status(400).json({ error: 'La hora debe ser como 07:00 o 20:00' });
        s[k] = v;
      }
      if (b.address !== undefined) s.address = carta.txt(b.address, 160);
      if (b.bankInfo !== undefined) s.bankInfo = carta.txt(b.bankInfo, 160);
      if (b.deliveryNote !== undefined) s.deliveryNote = carta.txt(b.deliveryNote, 220);
      if (b.deliveryPerKm !== undefined) s.deliveryPerKm = carta.num(b.deliveryPerKm);
      if (b.welcome !== undefined) s.welcome = carta.txt(b.welcome, 200);
    }
    await carta.writeCarta(req.params.businessId, c);
    const changed = Object.keys(b).filter(k => ['open', 'paused', 'whatsapp', 'freeDeliveryFrom', 'hours', 'openFrom', 'openTo', 'address', 'bankInfo', 'deliveryNote', 'deliveryPerKm', 'pickup', 'enabled'].includes(k));
    if (changed.length) await logAudit(req.params.businessId, { ...who(req), action: 'carta_ajustes', summary: 'Carta en línea: cambió ' + changed.map(k => k + ' = ' + (typeof b[k] === 'boolean' ? (b[k] ? 'sí' : 'no') : b[k])).join(', ') });
    res.json(s);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/carta/products/:id', authenticate, async (req, res) => {
  try {
    const c = await carta.readCarta(req.params.businessId);
    const p = c && c.products.find(x => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    const b = req.body || {};
    const before = { price: p.price, active: p.active, soldOut: p.soldOut, name: p.name, categoryId: p.categoryId };
    if (typeof b.soldOut === 'boolean') p.soldOut = b.soldOut; // cajero también puede marcar agotado
    if (isAdmin(req)) {
      if (typeof b.active === 'boolean') p.active = b.active;
      if (b.name !== undefined) {
        const nn = carta.txt(b.name, 80, p.name);
        if (nn.toLowerCase() !== p.name.toLowerCase() && carta.nameTaken(c, nn, p.id)) return res.status(409).json({ error: 'Ya hay un producto con ese nombre. Los nombres no se pueden repetir.' });
        p.name = nn;
      }
      if (b.categoryId !== undefined) {
        if (!c.categories.some(x => x.id === b.categoryId)) return res.status(400).json({ error: 'Categoría no encontrada' });
        p.categoryId = b.categoryId;
      }
      if (typeof b.alcohol === 'boolean') { if (b.alcohol) p.alcohol = true; else delete p.alcohol; }
      if (b.groups !== undefined) {
        try { p.groups = carta.cleanGroups(b.groups, c); } catch (e) { return res.status(400).json({ error: e.message }); }
      }
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
    const diffs = [];
    if (p.price !== before.price) diffs.push('precio ' + cop(before.price) + ' → ' + cop(p.price));
    if (p.active !== before.active) diffs.push(p.active ? 'ahora visible' : 'ocultado');
    if (p.soldOut !== before.soldOut) diffs.push(p.soldOut ? 'marcado AGOTADO' : 'ya disponible');
    if (p.name !== before.name) diffs.push('nombre era "' + before.name + '"');
    if (p.categoryId !== before.categoryId) diffs.push('cambió de categoría');
    if (b.groups !== undefined) diffs.push('opciones editadas');
    if (diffs.length) await logAudit(req.params.businessId, { ...who(req), action: 'carta_producto', summary: 'Carta: "' + p.name + '" — ' + diffs.join(', ') });
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
    await logAudit(req.params.businessId, { ...who(req), action: 'carta_producto', summary: 'Carta: precio de "' + name + '" cambió a ' + cop(price) + ' en todos los combos' });
    res.json({ updated: n });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// ───────────────────────── Editor de carta (solo admin) ─────────────────────────
const needAdmin = (req, res) => { if (!isAdmin(req)) { res.status(403).json({ error: 'Forbidden' }); return false; } return true; };
const nextOrder = (list) => list.reduce((m, x) => Math.max(m, Number(x.order) || 0), -1) + 1;
const fail = (res, err) => { console.error(err); res.status(500).json({ error: 'Internal server error' }); };

router.post('/carta/categories', authenticate, async (req, res) => {
  try {
    if (!needAdmin(req, res)) return;
    const c = await carta.readCarta(req.params.businessId);
    if (!c) return res.status(404).json({ error: 'Sin carta' });
    const name = carta.txt(req.body?.name, 40);
    if (name.length < 2) return res.status(400).json({ error: 'Escribe el nombre de la categoría' });
    if (c.categories.some(x => x.name.toLowerCase() === name.toLowerCase())) return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
    const cat = { id: uuidv4(), name, order: nextOrder(c.categories), extras: false, emoji: carta.txt(req.body?.emoji, 4), group: carta.txt(req.body?.group, 30) };
    c.categories.push(cat);
    await carta.writeCarta(req.params.businessId, c);
    await logAudit(req.params.businessId, { ...who(req), action: 'carta_categoria', summary: `Carta: categoría "${name}" creada` });
    res.status(201).json(cat);
  } catch (err) { fail(res, err); }
});

router.put('/carta/categories/:id', authenticate, async (req, res) => {
  try {
    if (!needAdmin(req, res)) return;
    const c = await carta.readCarta(req.params.businessId);
    const cat = c && c.categories.find(x => x.id === req.params.id);
    if (!cat) return res.status(404).json({ error: 'Categoría no encontrada' });
    const b = req.body || {}; const was = cat.name;
    if (b.name !== undefined) {
      const name = carta.txt(b.name, 40);
      if (name.length < 2) return res.status(400).json({ error: 'Escribe el nombre de la categoría' });
      if (c.categories.some(x => x.id !== cat.id && x.name.toLowerCase() === name.toLowerCase())) return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
      cat.name = name;
    }
    if (b.emoji !== undefined) cat.emoji = carta.txt(b.emoji, 4);
    if (b.group !== undefined) cat.group = carta.txt(b.group, 30);
    await carta.writeCarta(req.params.businessId, c);
    if (was !== cat.name) await logAudit(req.params.businessId, { ...who(req), action: 'carta_categoria', summary: `Carta: categoría "${was}" ahora se llama "${cat.name}"` });
    res.json(cat);
  } catch (err) { fail(res, err); }
});

router.delete('/carta/categories/:id', authenticate, async (req, res) => {
  try {
    if (!needAdmin(req, res)) return;
    const c = await carta.readCarta(req.params.businessId);
    const cat = c && c.categories.find(x => x.id === req.params.id);
    if (!cat) return res.status(404).json({ error: 'Categoría no encontrada' });
    const n = c.products.filter(p => p.categoryId === cat.id).length;
    if (n) return res.status(409).json({ error: `Esta categoría tiene ${n} producto(s). Muévelos a otra categoría o bórralos primero.` });
    if (c.products.some(p => (p.groups || []).some(g => g.source && g.source.categories.includes(cat.id)))) {
      return res.status(409).json({ error: 'Hay opciones de productos armadas con esta categoría. Quítala de esas opciones primero.' });
    }
    c.categories = c.categories.filter(x => x.id !== cat.id);
    await carta.writeCarta(req.params.businessId, c);
    await logAudit(req.params.businessId, { ...who(req), action: 'carta_categoria', summary: `Carta: categoría "${cat.name}" borrada` });
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

/** Orden de categorías: { ids: [...] } en el orden nuevo */
router.post('/carta/categories/reorder', authenticate, async (req, res) => {
  try {
    if (!needAdmin(req, res)) return;
    const c = await carta.readCarta(req.params.businessId);
    if (!c) return res.status(404).json({ error: 'Sin carta' });
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    const rest = c.categories.filter(x => !ids.includes(x.id)).sort((a, b) => a.order - b.order).map(x => x.id);
    [...ids.filter(id => c.categories.some(x => x.id === id)), ...rest].forEach((id, i) => { c.categories.find(x => x.id === id).order = i; });
    await carta.writeCarta(req.params.businessId, c);
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

router.post('/carta/products', authenticate, async (req, res) => {
  try {
    if (!needAdmin(req, res)) return;
    const c = await carta.readCarta(req.params.businessId);
    if (!c) return res.status(404).json({ error: 'Sin carta' });
    const b = req.body || {};
    const name = carta.txt(b.name, 80);
    if (name.length < 2) return res.status(400).json({ error: 'Escribe el nombre del producto' });
    if (carta.nameTaken(c, name)) return res.status(409).json({ error: 'Ya hay un producto con ese nombre. Los nombres no se pueden repetir.' });
    if (!c.categories.some(x => x.id === b.categoryId)) return res.status(400).json({ error: 'Escoge una categoría' });
    let groups = [];
    try { groups = carta.cleanGroups(b.groups || [], c); } catch (e) { return res.status(400).json({ error: e.message }); }
    const p = { id: uuidv4(), categoryId: b.categoryId, order: nextOrder(c.products), name, description: carta.txt(b.description, 160),
      price: carta.num(b.price), active: b.active !== false, soldOut: false, ...(b.alcohol ? { alcohol: true } : {}), groups };
    c.products.push(p);
    await carta.writeCarta(req.params.businessId, c);
    await logAudit(req.params.businessId, { ...who(req), action: 'carta_producto', summary: `Carta: producto "${name}" creado (${cop(p.price)})` });
    res.status(201).json(p);
  } catch (err) { fail(res, err); }
});

router.delete('/carta/products/:id', authenticate, async (req, res) => {
  try {
    if (!needAdmin(req, res)) return;
    const c = await carta.readCarta(req.params.businessId);
    const p = c && c.products.find(x => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    c.products = c.products.filter(x => x.id !== p.id);
    await carta.writeCarta(req.params.businessId, c);
    await logAudit(req.params.businessId, { ...who(req), action: 'carta_producto', summary: `Carta: producto "${p.name}" borrado` });
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

/** Orden de productos: { ids: [...] } (los de una misma categoría) en el orden nuevo */
router.post('/carta/products/reorder', authenticate, async (req, res) => {
  try {
    if (!needAdmin(req, res)) return;
    const c = await carta.readCarta(req.params.businessId);
    if (!c) return res.status(404).json({ error: 'Sin carta' });
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids.map(String) : []).filter(id => c.products.some(p => p.id === id));
    const orders = ids.map(id => c.products.find(p => p.id === id).order).sort((a, b) => a - b);
    ids.forEach((id, i) => { c.products.find(p => p.id === id).order = orders[i]; });
    await carta.writeCarta(req.params.businessId, c);
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
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
  // Cada línea se enlaza con su ítem de inventario (por el nombre del producto de la carta)
  const cartaData = await carta.readCarta(businessId);
  const invOf = new Map((cartaData?.products || []).filter(x => x.inventoryId).map(x => [x.name, x.inventoryId]));
  const items = p.lines.map(l => {
    const detail = l.choices && l.choices.length ? ` (${l.choices.join(', ')})` : '';
    return { ...(invOf.get(l.name) ? { inventoryId: invOf.get(l.name) } : {}), name: l.name + detail, price: l.unitPrice, qty: l.qty, discount: 0, area: 'bar',
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
    source: 'carta', mode: p.mode, pedidoId: p.id, deliveryFee: fee,
    createdAt: new Date().toISOString()
  };
  const sales = await readJSON(salesPath(businessId)) || [];
  sales.push(sale);
  await writeJSON(salesPath(businessId), sales);
  profile.invoiceCounter = (profile.invoiceCounter || 0) + 1;
  await writeJSON(profilePath(businessId), profile);
  await updateActiveShift(businessId, sale);
  // Baja el stock de los productos enlazados (nunca bloquea ni cancela la factura)
  try { await deductFromSale(businessId, items.filter(i => i.inventoryId)); } catch (e) { console.error('[pedidos] descuento de inventario:', e.message); }
  return sale;
}

const isDomi = (req) => req.user.role === 'domiciliario';
const PAYS = ['efectivo', 'transferencia'];

/**
 * PUT /pedidos/:id — cambia el estado y/o el valor del domicilio y el método de pago.
 *
 * "Entregado" YA NO factura: deja el pedido "por facturar" con el método de pago con que le pagaron
 * (obligatorio, lo escoge quien entrega). La factura se crea después con POST /pedidos/:id/facturar.
 * El domiciliario solo puede: salir con el pedido (en_camino) y marcarlo entregado con su método de pago.
 */
router.put('/pedidos/:id', authenticate, async (req, res) => {
  try {
    const bid = req.params.businessId;
    const list = await carta.readPedidos(bid);
    const p = list.find(x => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Pedido no encontrado' });
    const b = req.body || {};
    const unbilled = p.status === 'entregado' && !p.saleId; // entregado, falta facturar
    const before = { status: p.status, fee: p.deliveryFee, payment: p.payment };

    if (p.status === 'cancelado' || (p.status === 'entregado' && p.saleId)) return res.status(409).json({ error: 'Este pedido ya está cerrado' });

    if (isDomi(req)) {
      // Solo domicilios, y solo estos dos pasos
      if (p.mode !== 'domicilio') return res.status(403).json({ error: 'Forbidden' });
      if (!['en_camino', 'entregado'].includes(b.status)) return res.status(403).json({ error: 'Forbidden' });
      if (b.status === 'en_camino' && p.status !== 'en_preparacion') return res.status(400).json({ error: 'El pedido todavía no está listo para salir' });
      if (b.status === 'entregado' && p.status !== 'en_camino') return res.status(400).json({ error: 'Primero marca que saliste con el pedido' });
    }

    if (b.deliveryFee !== undefined && b.deliveryFee !== null && b.deliveryFee !== '' && !isDomi(req)) {
      if (p.mode !== 'domicilio') return res.status(400).json({ error: 'Este pedido es para recoger' });
      p.deliveryFee = carta.num(b.deliveryFee);
    }
    if (PAYS.includes(b.payment)) p.payment = b.payment;

    if (b.status) {
      if (!carta.STATES.includes(b.status)) return res.status(400).json({ error: 'Estado no válido' });
      if (b.status === 'cancelado') {
        if (unbilled) return res.status(409).json({ error: 'Ya fue entregado: factúralo' });
        p.status = 'cancelado';
      } else if (!unbilled) {
        if (p.status === 'vencido') { p.status = 'por_confirmar'; p.expiresAt = new Date(Date.now() + carta.EXPIRE_MIN * 60000).toISOString(); } // reactivar un vencido
        if (!FLOW.includes(b.status)) return res.status(400).json({ error: 'Estado no válido' });
        if (FLOW.indexOf(b.status) < FLOW.indexOf(p.status)) return res.status(400).json({ error: 'No se puede devolver el estado' });
        if (b.status !== 'por_confirmar' && p.mode === 'domicilio' && (p.deliveryFee === null || p.deliveryFee === undefined)) {
          return res.status(400).json({ error: 'Escribe el valor del domicilio (0 si es gratis) antes de confirmar' });
        }
        if (b.status === 'entregado') {
          if (!PAYS.includes(b.payment)) return res.status(400).json({ error: 'Escoge el método de pago con que te pagaron' });
          p.deliveredAt = new Date().toISOString();
          p.deliveredBy = req.user.name || req.user.username;
        }
        p.status = b.status;
      }
    }
    p.updatedAt = new Date().toISOString();
    await carta.writePedidos(bid, list);

    // Bitácora: qué cambió en el pedido y quién lo hizo
    const LBL = { por_confirmar: 'por confirmar', pendiente: 'confirmado', en_preparacion: 'en preparación', en_camino: p.mode === 'recoger' ? 'listo para recoger' : 'en camino', entregado: 'entregado', cancelado: 'CANCELADO', vencido: 'vencido' };
    const parts = [];
    if (p.status !== before.status) parts.push(`${LBL[before.status] || before.status} → ${LBL[p.status] || p.status}`);
    if (p.deliveryFee !== before.fee) parts.push(`domicilio ${before.fee == null ? 'sin definir' : cop(before.fee)} → ${cop(p.deliveryFee)}`);
    if (p.payment !== before.payment) parts.push(`pago ${before.payment} → ${p.payment}`);
    else if (p.status === 'entregado' && before.status !== 'entregado') parts.push(`cobrado en ${p.payment}`);
    if (parts.length) await logAudit(bid, { ...who(req), action: 'pedido_' + (p.status === 'entregado' && before.status !== 'entregado' ? 'entrega' : 'estado'),
      summary: `Pedido #${p.code} (${p.customer.name}, ${cop(p.subtotal + (Number(p.deliveryFee) || 0))}): ${parts.join('; ')}` });
    res.json({ pedido: p });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

/** POST /pedidos/:id/facturar — crea la factura de un pedido entregado, con el método de pago ya fijado */
router.post('/pedidos/:id/facturar', authenticate, async (req, res) => {
  try {
    if (isDomi(req)) return res.status(403).json({ error: 'Forbidden' });
    const bid = req.params.businessId;
    if (!carta.hasOpenShift(bid)) return res.status(409).json({ error: carta.NO_SHIFT_MSG });
    const list = await carta.readPedidos(bid);
    const p = list.find(x => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (p.status !== 'entregado') return res.status(400).json({ error: 'Primero hay que marcarlo como entregado' });
    if (p.saleId) return res.status(409).json({ error: 'Este pedido ya está facturado' });
    const sale = await pedidoToSale(bid, p, req.user);
    p.saleId = sale.id; p.invoiceNumber = sale.invoiceNumber; p.updatedAt = new Date().toISOString();
    await carta.writePedidos(bid, list);
    await logAudit(bid, { ...who(req), action: 'pedido_factura',
      summary: `Facturó el pedido #${p.code} (${p.customer.name}) → factura ${sale.invoiceNumber} por ${cop(sale.total)}, pago ${sale.paymentMethod}${sale.deliveryFee ? ', domicilio ' + cop(sale.deliveryFee) : ''}` });
    res.status(201).json({ pedido: p, sale });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
