/**
 * routes/backups.js — Respaldos de los datos (solo superadmin)
 *
 * Rutas:
 *   GET    /api/backups                 → lista de respaldos (más nuevo primero)
 *   POST   /api/backups                 → crea un respaldo ahora
 *   GET    /api/backups/:name/download  → descarga un respaldo (.json.gz)
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const { NAME_RE, backupDir, listBackups, createBackup, KEEP } = require('../services/backupService');
const { recordProblem } = require('../services/systemEvents');

const router = express.Router();

router.get('/', authenticate, requireSuperAdmin, (req, res) => {
  try {
    res.json({ keep: KEEP, backups: listBackups() });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'No se pudo leer la lista de respaldos' });
  }
});

router.post('/', authenticate, requireSuperAdmin, (req, res) => {
  try {
    res.status(201).json(createBackup());
  } catch (err) {
    console.error(err);
    recordProblem({ type: 'respaldo_fallo', title: 'No se pudo crear el respaldo', detail: err.message });
    res.status(500).json({ error: 'No se pudo crear el respaldo' });
  }
});

router.get('/:name/download', authenticate, requireSuperAdmin, (req, res) => {
  // Solo nombres con el formato exacto de los respaldos (evita rutas como ../)
  if (!NAME_RE.test(req.params.name)) return res.status(400).json({ error: 'Nombre de respaldo no válido' });
  const file = path.join(backupDir(), req.params.name);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Respaldo no encontrado' });
  res.download(file, req.params.name);
});

module.exports = router;
