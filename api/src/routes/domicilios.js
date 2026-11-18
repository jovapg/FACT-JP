/**
 * routes/domicilios.js — Domicilios hechos a mano (no entraron por la carta en línea)
 *
 *   GET    /api/:businessId/domicilios          → los que están por enviar o en camino (más antiguo primero)
 *   POST   /api/:businessId/domicilios          → crear (nombre obligatorio; teléfono y dirección opcionales)
 *   PUT    /api/:businessId/domicilios/:id      → editar datos, productos o estado
 *   DELETE /api/:businessId/domicilios/:id      → cancelar (queda en la bitácora)
 *
 * Solo en negocios con pedidos en línea (lo controla server.js con cartaGuard). Se factura con POST /sales (domicilioId).
 * El domiciliario no entra aquí (solo ve Pedidos).
 */
const express = require('express');
const router = express.Router({ mergeParams: true });
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { logAudit, cop } = require('../services/audit');
const D = require('../services/domicilios');

const who = (req) => ({ user: req.user.name || req.user.username, role: req.user.role });
const MAX_ACTIVOS = 150;
const fail = (res, e) => res.status(400).json({ error: e.message || 'Datos no válidos' });

router.get('/', authenticate, async (req, res) => {
  try {
    const list = await D.readAll(req.params.businessId);
    res.set('Cache-Control', 'no-store');
    res.json(list.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).map(({ claimedAt, ...d }) => d));
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const b = req.body || {};
    let contact, items;
    try { contact = D.cleanContact(b); items = D.cleanItems(b.items); } catch (e) { return fail(res, e); }
    const list = await D.readAll(req.params.businessId);
    if (list.length >= MAX_ACTIVOS) return res.status(409).json({ error: 'Hay demasiados domicilios sin facturar. Factura o cancela algunos.' });
    const now = new Date().toISOString();
    const dom = { id: uuidv4(), ...contact, phone: contact.phone || '', address: contact.address || '', items, status: 'por_enviar', createdAt: now, updatedAt: now, createdBy: who(req).user };
    list.push(dom);
    await D.writeAll(req.params.businessId, list);
    await logAudit(req.params.businessId, { ...who(req), action: 'domicilio_nuevo', summary: `Creó el domicilio de ${dom.name} por ${cop(D.totalOf(dom))}` });
    res.status(201).json(dom);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const b = req.body || {};
    const list = await D.readAll(req.params.businessId);
    const dom = list.find(d => d.id === req.params.id);
    if (!dom) return res.status(404).json({ error: 'Este domicilio ya fue facturado o cancelado. Actualiza la lista.' });
    if (dom.claimedAt && Date.now() - dom.claimedAt < 60000) return res.status(409).json({ error: 'Este domicilio se está facturando en otro equipo.' });
    try {
      Object.assign(dom, D.cleanContact(b, { requireName: false }));
      if (b.items !== undefined) dom.items = D.cleanItems(b.items);
      if (b.status !== undefined) {
        if (!D.STATES.includes(b.status)) return res.status(400).json({ error: 'Estado no válido' });
        dom.status = b.status;
      }
    } catch (e) { return fail(res, e); }
    dom.updatedAt = new Date().toISOString();
    await D.writeAll(req.params.businessId, list);
    const { claimedAt, ...out } = dom;
    res.json(out);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const list = await D.readAll(req.params.businessId);
    const dom = list.find(d => d.id === req.params.id);
    if (!dom) return res.status(404).json({ error: 'Este domicilio ya fue facturado o cancelado. Actualiza la lista.' });
    if (dom.claimedAt && Date.now() - dom.claimedAt < 60000) return res.status(409).json({ error: 'Este domicilio se está facturando en otro equipo.' });
    await D.writeAll(req.params.businessId, list.filter(d => d.id !== dom.id));
    await logAudit(req.params.businessId, { ...who(req), action: 'domicilio_cancelado', summary: `CANCELÓ el domicilio de ${dom.name} (${cop(D.totalOf(dom))}, estaba ${dom.status === 'en_camino' ? 'en camino' : 'por enviar'}) sin facturar` });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
