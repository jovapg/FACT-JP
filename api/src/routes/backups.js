/**
 * routes/backups.js — Respaldos de los datos (solo superadmin)
 *
 *   GET    /api/backups                  → lista del volumen + estado del respaldo externo
 *   POST   /api/backups                  → crea un respaldo ahora (solo en el volumen)
 *   GET    /api/backups/:name/download   → descarga un respaldo (.json.gz)
 *   POST   /api/backups/key              → crea la clave de cifrado (se muestra UNA vez)
 *   POST   /api/backups/offsite/test     → prueba la conexión con el almacenamiento externo
 *   POST   /api/backups/offsite/run      → respalda y sube ahora
 *   GET    /api/backups/offsite/list     → respaldos que hay en el almacenamiento externo
 *   POST   /api/backups/inspect          → abre un respaldo (volumen o externo) y muestra qué trae
 *   POST   /api/backups/inspect-upload   → igual, con un archivo subido (cuerpo del POST = el archivo)
 *   POST   /api/backups/restore          → restaura (una franquicia o todas)
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const bk = require('../services/backupService');
const cr = require('../services/backupCrypto');
const offsite = require('../services/offsite');
const restoreSvc = require('../services/restoreService');
const { recordProblem } = require('../services/systemEvents');

const router = express.Router();
const SA = [authenticate, requireSuperAdmin];
const msg = (e) => (e && e.message) || 'Error';

// Respaldos abiertos para restaurar (se guardan 30 min en memoria y se borran al restaurar)
const opened = new Map();
function keep(payload) {
  const token = crypto.randomBytes(16).toString('hex');
  opened.set(token, { payload, at: Date.now() });
  for (const [t, v] of opened) if (Date.now() - v.at > 30 * 60 * 1000) opened.delete(t);
  return token;
}

router.get('/', ...SA, (req, res) => {
  try {
    const st = bk.readStatus();
    res.json({ keep: bk.KEEP, backups: bk.listBackups(),
      offsite: { configured: offsite.isConfigured(), keyReady: !!cr.getKey(), last: st.offsite || null, verify: st.verify || null, keep: bk.KEEP_REMOTE } });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'No se pudo leer la lista de respaldos' });
  }
});

router.post('/', ...SA, (req, res) => {
  try {
    res.status(201).json(bk.createBackup());
  } catch (err) {
    console.error(err);
    recordProblem({ type: 'respaldo_fallo', title: 'No se pudo crear el respaldo', detail: err.message });
    res.status(500).json({ error: 'No se pudo crear el respaldo' });
  }
});

router.post('/key', ...SA, (req, res) => {
  try { res.status(201).json({ key: cr.generateKey() }); }
  catch (err) { res.status(409).json({ error: msg(err) }); }
});

router.post('/offsite/test', ...SA, async (req, res) => {
  try {
    if (!offsite.isConfigured()) return res.status(400).json({ error: 'Faltan las variables B2_KEY_ID, B2_APP_KEY, B2_BUCKET y B2_ENDPOINT en Railway.' });
    const key = `test/prueba-${Date.now()}.txt`;
    await offsite.put(key, Buffer.from('prueba de conexión de facJp'));
    const found = (await offsite.list('test/')).some(o => o.key === key);
    await offsite.del(key);
    if (!found) return res.status(502).json({ error: 'Se subió el archivo de prueba pero no apareció en la lista. Revisa el nombre del bucket.' });
    res.json({ ok: true });
  } catch (err) { res.status(502).json({ error: msg(err) }); }
});

router.post('/offsite/run', ...SA, async (req, res) => {
  try {
    const r = await bk.runNow();
    if (r.remoteError) return res.status(502).json({ error: r.remoteError, backup: r.meta });
    res.status(201).json(r);
  } catch (err) { console.error(err); res.status(500).json({ error: msg(err) }); }
});

router.get('/offsite/list', ...SA, async (req, res) => {
  try {
    if (!offsite.isConfigured()) return res.json({ configured: false, items: [] });
    res.json({ configured: true, items: await offsite.list('backups/') });
  } catch (err) { res.status(502).json({ error: msg(err) }); }
});

router.post('/offsite/verify', ...SA, async (req, res) => {
  try { res.json(await bk.verifyLatestOffsite()); }
  catch (err) { bk.writeStatus({ verify: { ok: false, at: new Date().toISOString(), error: msg(err) } }); res.status(502).json({ error: msg(err) }); }
});

router.get('/:name/download', ...SA, (req, res) => {
  // Solo nombres con el formato exacto de los respaldos (evita rutas como ../)
  if (!bk.NAME_RE.test(req.params.name)) return res.status(400).json({ error: 'Nombre de respaldo no válido' });
  const file = path.join(bk.backupDir(), req.params.name);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Respaldo no encontrado' });
  res.download(file, req.params.name);
});

/** Abre un respaldo y muestra qué trae, sin cambiar nada */
router.post('/inspect', ...SA, async (req, res) => {
  try {
    const { source, name, key } = req.body || {};
    let buf;
    if (source === 'offsite') {
      if (!/^backups\/backup-[\w.-]+\.json\.gz\.enc$/.test(String(name))) return res.status(400).json({ error: 'Nombre de respaldo no válido' });
      buf = await offsite.get(name);
    } else {
      if (!bk.NAME_RE.test(String(name))) return res.status(400).json({ error: 'Nombre de respaldo no válido' });
      const file = path.join(bk.backupDir(), name);
      if (!fs.existsSync(file)) return res.status(404).json({ error: 'Respaldo no encontrado' });
      buf = fs.readFileSync(file);
    }
    const payload = bk.openBundle(buf, key);
    res.json({ token: keep(payload), summary: restoreSvc.summarize(payload) });
  } catch (err) { res.status(400).json({ error: msg(err) }); }
});

router.post('/inspect-upload', ...SA, express.raw({ type: () => true, limit: '250mb' }), (req, res) => {
  try {
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'No llegó ningún archivo' });
    const payload = bk.openBundle(req.body, req.get('x-backup-key'));
    res.json({ token: keep(payload), summary: restoreSvc.summarize(payload) });
  } catch (err) { res.status(400).json({ error: msg(err) }); }
});

router.post('/restore', ...SA, async (req, res) => {
  try {
    const { token, scope, confirm } = req.body || {};
    if (confirm !== 'RESTAURAR') return res.status(400).json({ error: 'Escribe RESTAURAR para confirmar' });
    const held = opened.get(String(token));
    if (!held) return res.status(410).json({ error: 'Ese respaldo ya no está abierto. Ábrelo de nuevo.' });
    const r = await restoreSvc.restore(held.payload, scope === 'all' ? 'all' : scope, req.user.username);
    opened.delete(String(token));
    res.json(r);
  } catch (err) { console.error(err); res.status(400).json({ error: msg(err) }); }
});

module.exports = router;
