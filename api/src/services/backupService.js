/**
 * services/backupService.js — Respaldos automáticos de los datos
 *
 * Los datos viven en archivos JSON dentro del volumen de Railway. Este servicio
 * crea un respaldo comprimido (.json.gz) con TODOS esos archivos (negocios, ventas,
 * inventario, usuarios, deudas, nómina…) y lo guarda en <datos>/backups/.
 *
 *   - Se crea uno automático cada ~24 horas (se revisa al arrancar y cada 3 horas).
 *   - Se conservan los últimos 30; los más viejos se borran solos.
 *   - El superadmin puede crear uno a mano y descargarlos (Franquicias → Respaldos).
 *
 * Qué NO incluye: las imágenes (logos, QR de pago, fotos de productos); solo los .json.
 * Importante: el respaldo vive en el mismo volumen. Protege contra errores (borrados
 * por accidente, archivos dañados) pero no contra perder el volumen entero, por eso
 * conviene descargar uno de vez en cuando al computador.
 *
 * Restaurar: node restore-backup.js <archivo.json.gz> <carpeta-destino>
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { getDataPath } = require('./fileStorage');
const { recordProblem } = require('./systemEvents');

const KEEP = 30;                       // cuántos respaldos se conservan
const EVERY_MS = 24 * 3600 * 1000;     // cada cuánto se crea uno automático
const CHECK_MS = 3 * 3600 * 1000;      // cada cuánto se revisa si toca
const NAME_RE = /^backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(-\d{3})?\.json\.gz$/;

const backupDir = () => path.join(getDataPath(), 'backups');

/** Lee todos los .json del directorio de datos (menos la carpeta de respaldos), como texto exacto */
function collectFiles(root) {
  const files = {};
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (rel === '' && e.name === 'backups') continue;
      const full = path.join(dir, e.name);
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(full, r);
      else if (e.name.toLowerCase().endsWith('.json')) files[r] = fs.readFileSync(full, 'utf8');
    }
  };
  if (fs.existsSync(root)) walk(root, '');
  return files;
}

/** Lista los respaldos existentes, el más nuevo primero */
function listBackups() {
  const dir = backupDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(n => NAME_RE.test(n))
    .map(n => {
      const st = fs.statSync(path.join(dir, n));
      return { name: n, size: st.size, createdAt: st.mtime.toISOString() };
    })
    .sort((a, b) => (a.name < b.name ? 1 : -1));
}

/** Borra los respaldos más viejos, dejando los últimos KEEP */
function pruneBackups() {
  for (const b of listBackups().slice(KEEP)) {
    try { fs.unlinkSync(path.join(backupDir(), b.name)); } catch { /* ya no existe */ }
  }
}

/** Crea un respaldo ahora. Devuelve { name, size, createdAt, fileCount } */
function createBackup() {
  const files = collectFiles(getDataPath());
  const createdAt = new Date().toISOString();
  const payload = { app: 'facjp', version: 1, createdAt, fileCount: Object.keys(files).length, files };
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));

  fs.mkdirSync(backupDir(), { recursive: true });
  const stamp = createdAt.replace('T', '_').replace(/:/g, '-').replace('.', '-').replace('Z', '');
  const name = `backup-${stamp}.json.gz`;
  const tmp = path.join(backupDir(), name + '.tmp');
  fs.writeFileSync(tmp, gz);
  fs.renameSync(tmp, path.join(backupDir(), name)); // se publica completo o no se publica
  pruneBackups();
  return { name, size: gz.length, createdAt, fileCount: payload.fileCount };
}

/** Si el último respaldo tiene más de 24 horas (o no hay ninguno), crea uno */
function backupIfDue() {
  try {
    const last = listBackups()[0];
    if (!last || Date.now() - new Date(last.createdAt).getTime() > EVERY_MS) {
      const b = createBackup();
      console.log(`[backup] respaldo automático creado: ${b.name} (${b.fileCount} archivos)`);
    }
  } catch (err) {
    console.error('[backup] error al crear el respaldo automático:', err);
    recordProblem({ type: 'respaldo_fallo', title: 'No se pudo crear el respaldo automático', detail: err.message });
  }
}

/** Arranca la revisión periódica. Se llama una vez al iniciar el servidor */
function scheduleBackups() {
  setTimeout(backupIfDue, 60 * 1000);                // 1 minuto después de arrancar
  setInterval(backupIfDue, CHECK_MS).unref();        // y cada 3 horas
}

module.exports = { NAME_RE, backupDir, listBackups, createBackup, scheduleBackups, KEEP };
