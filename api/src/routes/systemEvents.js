/**
 * routes/systemEvents.js — Problemas del sistema (solo superadmin)
 *
 * Rutas:
 *   GET  /api/system-events               → { open, events } (más reciente primero)
 *   POST /api/system-events/resolve-all   → marca todos como revisados
 *   POST /api/system-events/:id/resolve   → marca uno como revisado
 */

const express = require('express');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const { listEvents, resolveEvent, resolveAll } = require('../services/systemEvents');

const router = express.Router();

router.get('/', authenticate, requireSuperAdmin, (req, res) => {
  const events = listEvents();
  res.json({ open: events.filter(e => !e.resolved).length, events });
});

// Va antes de '/:id/resolve' para que "resolve-all" no se tome como un id
router.post('/resolve-all', authenticate, requireSuperAdmin, (req, res) => {
  resolveAll();
  res.json({ success: true });
});

router.post('/:id/resolve', authenticate, requireSuperAdmin, (req, res) => {
  if (!resolveEvent(req.params.id)) return res.status(404).json({ error: 'Problema no encontrado' });
  res.json({ success: true });
});

module.exports = router;
