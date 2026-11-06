/**
 * routes/public.js — Carta y pedidos PÚBLICOS (sin login)
 *
 *   GET  /api/public/carta/:slug    → carta visible del negocio (solo lo activo)
 *   POST /api/public/pedidos/:slug  → el cliente envía su pedido
 *
 * Seguridad: límites por IP, validación de largos, precios recalculados en el servidor.
 * Nunca se devuelven datos internos (pedidos de otros, ventas, usuarios).
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, getBusinessPath } = require('../services/fileStorage');
const carta = require('../services/cartaService');

const router = express.Router();

const readLimiter  = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
// Los envíos con error (400) no cuentan; el tope es holgado porque varios clientes comparten IP en redes móviles
const orderLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, skipFailedRequests: true, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Enviaste muchos pedidos seguidos. Intenta de nuevo en unos minutos.' } });

const BUSINESSES = () => path.join(require('../services/fileStorage').getDataPath(), 'businesses.json');

async function findBusiness(slug) {
  const list = await readJSON(BUSINESSES()) || [];
  const s = String(slug || '').toLowerCase();
  return list.find(b => b.active !== false && String(b.slug || '').toLowerCase() === s) || null;
}

/** Quita lo interno de la carta antes de mostrarla al público */
function publicView(biz, c, profile = {}, isOut = () => false) {
  const { whatsapp, open, paused, pickup, freeDeliveryFrom, hours, welcome, address, bankInfo, deliveryNote, openFrom, openTo } = c.settings;
  const inHours = carta.withinHours(c.settings);
  const cats = [...c.categories].sort((a, b) => a.order - b.order);
  return {
    business: { name: biz.name, slug: biz.slug },
    // Fuera del horario de pedidos la tienda se ve cerrada
    settings: { whatsapp, open: !!open && inHours, paused, pickup, freeDeliveryFrom, hours, welcome, address, bankInfo, deliveryNote, openFrom, openTo, outOfHours: !inHours,
      paymentQr: profile.paymentQr || '' },
    categories: cats.map(({ id, name, order }) => ({ id, name, order })),
    products: c.products.filter(p => p.active).sort((a, b) => a.order - b.order).map(p => ({
      id: p.id, categoryId: p.categoryId, name: p.name, description: p.description, price: p.price,
      soldOut: !!p.soldOut || isOut(p.name), alcohol: !!p.alcohol, image: isOut.image ? isOut.image(p.name) : '',
      groups: (p.groups || []).map(g => ({ id: g.id, name: g.name, type: g.type, required: !!g.required, max: g.max || 0, collapsed: !!g.collapsed,
        options: g.options.map(o => ({ id: o.id, name: o.name, price: o.price, alcohol: !!o.alcohol, section: o.section || '', note: o.note || '', soldOut: g.type === 'qty' && isOut(o.name) })) }))
    }))
  };
}

router.get('/carta/:slug', readLimiter, async (req, res) => {
  try {
    const biz = await findBusiness(req.params.slug);
    const c = biz && await carta.readCarta(biz.id);
    if (!c || c.settings.enabled === false) return res.status(404).json({ error: 'Carta no disponible' });
    res.set('Cache-Control', 'no-store');
    res.json(publicView(biz, c, await readJSON(path.join(getBusinessPath(biz.id), 'profile.json')) || {}, await carta.stockCheck(biz.id)));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error del servidor' }); }
});

router.post('/pedidos/:slug', orderLimiter, async (req, res) => {
  try {
    const biz = await findBusiness(req.params.slug);
    const c = biz && await carta.readCarta(biz.id);
    if (!c || c.settings.enabled === false) return res.status(404).json({ error: 'Carta no disponible' });
    if (!c.settings.open || c.settings.paused || !carta.withinHours(c.settings)) {
      return res.status(409).json({ error: 'Por ahora no estamos recibiendo pedidos. Intenta más tarde.' });
    }

    const b = req.body || {};
    const name = carta.txt(b.name, 60);
    const phone = String(b.phone || '').replace(/\D/g, '').slice(0, 15);
    const mode = b.mode === 'recoger' && c.settings.pickup ? 'recoger' : 'domicilio';
    const address = carta.txt(b.address, 160);
    if (name.length < 2) return res.status(400).json({ error: 'Escribe tu nombre' });
    if (phone.length < 7) return res.status(400).json({ error: 'Escribe un celular válido' });
    if (mode === 'domicilio' && address.length < 5) return res.status(400).json({ error: 'Escribe tu dirección' });
    if (b.privacyAccepted !== true) return res.status(400).json({ error: 'Debes aceptar el tratamiento de datos' });

    const payment = b.payment === 'transferencia' ? 'transferencia' : 'efectivo';
    const cashFor = payment === 'efectivo' ? carta.num(b.cashFor) : 0;

    let priced;
    try { priced = carta.priceOrder(c, b.items, await carta.stockCheck(biz.id)); }
    catch (e) { return res.status(400).json({ error: e.message }); }

    if (priced.lines.some(l => l.alcohol) && b.adult !== true) {
      return res.status(400).json({ error: 'Para pedir licor confirma que eres mayor de 18 años' });
    }

    const list = await carta.readPedidos(biz.id);
    // Freno básico a repetidos: máximo 3 pedidos abiertos por el mismo celular
    const open = list.filter(p => p.phone === phone && ['por_confirmar', 'pendiente', 'en_preparacion', 'en_camino'].includes(p.status));
    if (open.length >= 3) return res.status(429).json({ error: 'Ya tienes pedidos en curso con este celular.' });

    const now = new Date();
    const freeDelivery = c.settings.freeDeliveryFrom > 0 && priced.subtotal >= c.settings.freeDeliveryFrom;
    const pedido = {
      id: uuidv4(),
      code: carta.nextCode(biz.id, mode, (await readJSON(path.join(getBusinessPath(biz.id), 'profile.json')) || {}).invoicePrefix),
      status: 'por_confirmar',
      customer: { name, phone, address: mode === 'domicilio' ? address : '', notes: carta.txt(b.notes, 200) },
      mode, payment, cashFor,
      lines: priced.lines,
      subtotal: priced.subtotal,
      deliveryFee: mode === 'domicilio' ? (freeDelivery ? 0 : null) : 0, // null = aún sin definir (lo pone quien atiende)
      freeDelivery: mode === 'domicilio' && freeDelivery,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + carta.EXPIRE_MIN * 60000).toISOString()
    };
    list.push(pedido);
    await carta.writePedidos(biz.id, list);

    res.status(201).json({
      code: pedido.code, subtotal: pedido.subtotal, freeDelivery: pedido.freeDelivery,
      expiresAt: pedido.expiresAt, mode, lines: pedido.lines
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'No pudimos enviar tu pedido. Intenta de nuevo.' }); }
});

module.exports = router;
