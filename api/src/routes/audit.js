/**
 * routes/audit.js — Consulta de la bitácora de cambios (auditoría)
 *
 * Solo admin/superadmin. Lista las acciones sensibles registradas
 * (editar/eliminar facturas, fiados, abonos, compras), más reciente primero.
 *
 * Rutas:
 *   GET /api/:businessId/audit → lista de la bitácora
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticate } = require('../middleware/auth');
const { getAudit } = require('../services/audit');

router.get('/audit', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const log = await getAudit(req.params.businessId);
    res.json(log);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
