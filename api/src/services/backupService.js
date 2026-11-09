/**
 * services/backupService.js — Respaldos automáticos de los datos
 *
 * Los datos viven en archivos JSON dentro del volumen de Railway. Este servicio crea un respaldo comprimido
 * (.json.gz) con TODOS esos archivos (negocios, ventas, inventario, usuarios, deudas, nómina…) y también las
 * imágenes (logos, QR de pago y fotos de productos), y lo guarda en <datos>/backups/.
 *
 *   - Se crea uno automático cada ~6 horas (se revisa al arrancar y cada 30 minutos).
 *   - Se conservan los últimos KEEP en el volumen; los más viejos se borran solos.
 *   - Si el respaldo externo está configurado (variables B2_… + clave de cifrado), cada respaldo se CIFRA y se
 *     sube a Backblaze B2: así existe una copia fuera de Railway. Se conservan los últimos KEEP_REMOTE.
 *   - Una vez por semana se descarga el último respaldo externo, se descifra y se comprueba que se puede leer.
 *   - El superadmin puede crear uno a mano, descargarlos y restaurar (Franquicias → Respaldos).
 *
 * Restaurar: desde la pantalla de Franquicias (una franquicia o todas), o con node restore-backup.js.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { getDataPath } = require('./fileStorage');
const { recordProblem } = require('./systemEvents');
const crypto_ = require('./backupCrypto');
const offsite = require('./offsite');

const KEEP = 40;                       // respaldos que se conservan en el volumen (~10 días a 4 por día)
const KEEP_REMOTE = 80;                // respaldos que se conservan en el almacenamiento externo
const EVERY_MS = 6 * 3600 * 1000;      // cada cuánto se crea uno automático
const CHECK_MS = 30 * 60 * 1000;       // cada cuánto se revisa si toca
const VERIFY_MS = 7 * 24 * 3600 * 1000; // cada cuánto se comprueba un respaldo externo
const MAX_BLOB = 2 * 1024 * 1024;      // una imagen más grande que esto no entra al respaldo
const MAX_BLOBS_TOTAL = 40 * 1024 * 1024;
const IMG_RE = /\.(webp|png|jpe?g|gif|ico)$/i;
const NAME_RE = /^backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(-\d{3})?\.json\.gz$/;

const backupDir = () => path.join(getDataPath(), 'backups');
const statusFile = () => path.join(backupDir(), 'status.json');

function readStatus() { try { return JSON.parse(fs.readFileSync(statusFile(), 'utf8')); } catch { return {}; } }
function writeStatus(patch) {
  const s = { ...readStatus(), ...patch };
  fs.mkdirSync(backupDir(), { recursive: true });
  require('./fileStorage').writeFileAtomicSync(statusFile(), JSON.stringify(s, null, 2));
  return s;
}

/** Lee los .json (texto exacto) y las imágenes (base64) del directorio de datos, menos la carpeta de respaldos */
function collectFiles(root) {
  const files = {}, blobs = {};
  let blobBytes = 0, skipped = 0;
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (rel === '' && e.name === 'backups') continue;
      const full = path.join(dir, e.name);
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(full, r);
      else if (e.name.toLowerCase().endsWith('.json')) { continue; /* los documentos (de la raíz y de cada negocio) salen de su base de datos (abajo) */ }
      else if (IMG_RE.test(e.name)) {
        const size = fs.statSync(full).size;
        if (size > MAX_BLOB || blobBytes + size > MAX_BLOBS_TOTAL) { skipped++; continue; }
        blobs[r] = fs.readFileSync(full).toString('base64'); blobBytes += size;
      }
    }
  };
  if (fs.existsSync(root)) {
    walk(root, '');
    // Documentos de cada negocio (ventas, pedidos, inventario...): vengan de archivos o de su base SQLite, el respaldo
    // los guarda siempre igual, como texto .json. Así el formato del respaldo no depende del motor de almacenamiento.
    const st = require('./fileStorage');
    for (const [name, text] of Object.entries(st.listRootDocs())) files[name] = text; // lista de franquicias, superadmin, enlaces cortos...
    for (const e of fs.readdirSync(root, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name === 'backups' || !/^[a-zA-Z0-9_-]+$/.test(e.name)) continue;
      for (const [name, text] of Object.entries(st.listBusinessDocs(e.name))) files[e.name + '/' + name] = text;
    }
  }
  return { files, blobs, skipped };
}

/** Lista los respaldos existentes en el volumen, el más nuevo primero */
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

/** Crea un respaldo ahora. Devuelve { meta: { name, size, createdAt, fileCount, photoCount }, gz } */
function createBackupFull() {
  const { files, blobs, skipped } = collectFiles(getDataPath());
  const createdAt = new Date().toISOString();
  const payload = { app: 'facjp', version: 2, createdAt, fileCount: Object.keys(files).length, photoCount: Object.keys(blobs).length, files, blobs };
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));

  fs.mkdirSync(backupDir(), { recursive: true });
  const stamp = createdAt.replace('T', '_').replace(/:/g, '-').replace('.', '-').replace('Z', '');
  const name = `backup-${stamp}.json.gz`;
  const tmp = path.join(backupDir(), name + '.tmp');
  fs.writeFileSync(tmp, gz);
  fs.renameSync(tmp, path.join(backupDir(), name)); // se publica completo o no se publica
  pruneBackups();
  return { meta: { name, size: gz.length, createdAt, fileCount: payload.fileCount, photoCount: payload.photoCount, photosSkipped: skipped }, gz };
}
const createBackup = () => createBackupFull().meta;

// ───────────────────────── Respaldo externo ─────────────────────────

const remoteReady = () => offsite.isConfigured() && !!crypto_.getKey();

/** Cifra y sube un respaldo. Guarda el resultado en el estado (lo ve el superadmin). */
async function pushOffsite(name, gz) {
  const key = crypto_.getKey();
  if (!offsite.isConfigured()) throw new Error('El respaldo externo no está configurado (faltan las variables B2_… en Railway)');
  if (!key) throw new Error('Falta la clave de cifrado. Créala en Franquicias → Respaldos.');
  const enc = crypto_.encrypt(gz, key);
  await offsite.put(`backups/${name}.enc`, enc);
  // Se conservan los últimos KEEP_REMOTE
  try { for (const o of (await offsite.list('backups/')).slice(KEEP_REMOTE)) await offsite.del(o.key); } catch { /* limpiar no es crítico */ }
  const info = { ok: true, at: new Date().toISOString(), name, size: enc.length };
  writeStatus({ offsite: info });
  return info;
}

/** Crea un respaldo y lo sube ahora (botón "Respaldar y subir"). */
async function runNow() {
  const { meta, gz } = createBackupFull();
  let remote = null, remoteError = null;
  try { remote = await pushOffsite(meta.name, gz); } catch (e) { remoteError = e.message; writeStatus({ offsite: { ok: false, at: new Date().toISOString(), error: e.message } }); }
  return { meta, remote, remoteError };
}

/** Si hay respaldo externo configurado y el último no se subió en las últimas 6 horas, sube el más reciente */
async function offsiteIfDue() {
  if (!remoteReady()) return;
  const st = readStatus().offsite;
  if (st && st.ok && Date.now() - new Date(st.at).getTime() < EVERY_MS) return;
  const last = listBackups()[0];
  if (!last) return;
  try { await pushOffsite(last.name, fs.readFileSync(path.join(backupDir(), last.name))); console.log('[backup] subido al almacenamiento externo:', last.name); }
  catch (err) {
    console.error('[backup] no se pudo subir el respaldo externo:', err.message);
    writeStatus({ offsite: { ok: false, at: new Date().toISOString(), error: err.message } });
    recordProblem({ type: 'respaldo_externo_fallo', title: 'No se pudo subir el respaldo al almacenamiento externo', detail: err.message });
  }
}

/** Abre un respaldo (cifrado o no) y devuelve el contenido, o lanza un error claro */
function openBundle(buf, keyStr) {
  let data = buf;
  if (crypto_.isEncrypted(data)) {
    const typed = String(keyStr || '').trim();
    // Si escribes una clave, se usa ESA (y debe tener el formato correcto): así se prueba tu copia de la clave y no la del servidor.
    const key = typed ? crypto_.parseKey(typed) : crypto_.getKey();
    if (typed && !key) throw new Error('La clave no tiene el formato correcto: son 64 letras y números (con o sin guiones). Revisa que la copiaste completa.');
    if (!key) throw new Error('Este respaldo está cifrado: escribe la clave de respaldos');
    data = crypto_.decrypt(data, key);
  }
  let payload;
  try { payload = JSON.parse(zlib.gunzipSync(data).toString('utf8')); }
  catch { throw new Error('Ese archivo no es un respaldo válido de facJp (o está dañado)'); }
  if (payload.app !== 'facjp' || !payload.files || typeof payload.files !== 'object') throw new Error('Este archivo no es un respaldo válido de facJp');
  return payload;
}

/** Descarga el último respaldo externo, lo descifra y comprueba que todo se puede leer. */
async function verifyLatestOffsite() {
  const items = await offsite.list('backups/');
  if (!items.length) throw new Error('No hay respaldos en el almacenamiento externo');
  const latest = items[0];
  const payload = openBundle(await offsite.get(latest.key));
  let bad = 0;
  for (const text of Object.values(payload.files)) { try { JSON.parse(text); } catch { bad++; } }
  if (bad) throw new Error(`El respaldo ${latest.key} tiene ${bad} archivo(s) dañados`);
  const info = { ok: true, at: new Date().toISOString(), name: latest.key, files: Object.keys(payload.files).length, photos: Object.keys(payload.blobs || {}).length };
  writeStatus({ verify: info });
  return info;
}

async function verifyIfDue() {
  if (!remoteReady()) return;
  const v = readStatus().verify;
  if (v && v.ok && Date.now() - new Date(v.at).getTime() < VERIFY_MS) return;
  if (!(readStatus().offsite && readStatus().offsite.ok)) return; // primero tiene que haber algo subido
  try { await verifyLatestOffsite(); console.log('[backup] verificación semanal del respaldo externo: OK'); }
  catch (err) {
    writeStatus({ verify: { ok: false, at: new Date().toISOString(), error: err.message } });
    recordProblem({ type: 'respaldo_verificacion_fallo', title: 'La comprobación semanal del respaldo externo falló', detail: err.message });
  }
}

/** Si el último respaldo tiene más de 6 horas (o no hay ninguno), crea uno */
function backupIfDue() {
  try {
    const last = listBackups()[0];
    if (!last || Date.now() - new Date(last.createdAt).getTime() > EVERY_MS) {
      const { meta } = createBackupFull();
      console.log(`[backup] respaldo automático creado: ${meta.name} (${meta.fileCount} archivos, ${meta.photoCount} fotos)`);
    }
  } catch (err) {
    console.error('[backup] error al crear el respaldo automático:', err);
    recordProblem({ type: 'respaldo_fallo', title: 'No se pudo crear el respaldo automático', detail: err.message });
  }
}

async function tick() {
  backupIfDue();
  try { await offsiteIfDue(); await verifyIfDue(); } catch (err) { console.error('[backup] tick:', err.message); }
}

/** Arranca la revisión periódica. Se llama una vez al iniciar el servidor */
function scheduleBackups() {
  setTimeout(tick, 60 * 1000);                  // 1 minuto después de arrancar
  setInterval(tick, CHECK_MS).unref();          // y cada 30 minutos
}

module.exports = { NAME_RE, backupDir, listBackups, createBackup, createBackupFull, scheduleBackups, KEEP, KEEP_REMOTE,
  readStatus, writeStatus, pushOffsite, runNow, openBundle, verifyLatestOffsite, remoteReady, collectFiles };
