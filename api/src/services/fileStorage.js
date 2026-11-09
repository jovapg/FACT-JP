/**
 * services/fileStorage.js — Capa de persistencia en archivos JSON
 *
 * Reemplaza una base de datos. Todos los datos se guardan como archivos
 * .json en el directorio configurado en DATA_PATH (por defecto ./src/data).
 *
 * Estructura de directorios:
 *   data/
 *     superadmin.json          ← credenciales del superadmin
 *     businesses.json          ← lista de negocios/franquicias
 *     <businessId>/
 *       profile.json           ← configuración del negocio
 *       users.json             ← usuarios del negocio
 *       inventory.json         ← inventario de insumos
 *       recipes.json           ← recetas y menú
 *       tables.json            ← estado de las mesas
 *       sales.json             ← historial de ventas
 *       purchases.json         ← historial de compras
 *       suppliers.json         ← proveedores, empleados, arriendos, créditos
 *
 * Todas las funciones son async para mantener compatibilidad con código
 * que podría migrar a una base de datos real en el futuro.
 */

const fs = require('fs');
const path = require('path');
const docStore = require('./docStore');

// Directorio raíz de los datos.
// Prioridad: 1) variable de entorno DATA_PATH, 2) volumen Railway en /storage,
// 3) ruta local por defecto (desarrollo).
function detectDataPath() {
  if (process.env.DATA_PATH) return process.env.DATA_PATH;
  try {
    if (fs.existsSync('/storage')) return '/storage';
  } catch {}
  return path.join(__dirname, '../data');
}
const DATA_PATH = detectDataPath();

/** Retorna la ruta absoluta del directorio de datos */
function getDataPath() {
  return DATA_PATH;
}

/**
 * Retorna la ruta del directorio de un negocio específico.
 *
 * Prevención de path traversal: el businessId solo puede contener
 * caracteres alfanuméricos, guiones y guiones bajos (formato UUID).
 * Esto bloquea intentos como '../../etc/passwd' o '../superadmin.json'
 * que podrían escapar del directorio data/ y leer archivos del servidor.
 */
function getBusinessPath(businessId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(businessId)) {
    throw new Error('BusinessId inválido: solo se permiten caracteres alfanuméricos y guiones');
  }
  return path.join(DATA_PATH, businessId);
}

/**
 * Crea el directorio del negocio si no existe.
 * Se llama cuando se crea un negocio nuevo.
 */
function ensureBusinessDir(businessId) {
  const dir = getBusinessPath(businessId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Crea un directorio si no existe.
 * Versión genérica de ensureBusinessDir para cualquier ruta.
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ── Motor de almacenamiento ──────────────────────────────────────────────────────────────
// Con STORAGE_ENGINE=sqlite, los .json de cada negocio viven en su base negocio.db (ver docStore.js).
// Todo lo demás (superadmin, lista de franquicias, fotos, claves) sigue siendo archivo.
const docInfo = (filePath) => (docStore.ENGINE === 'sqlite' ? docStore.classify(filePath, DATA_PATH) : null);

/** Texto crudo de un documento (o null si no existe), venga de la base o de un archivo */
function readText(filePath) {
  const info = docInfo(filePath);
  if (info) return docStore.readDoc(info);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}
/** Guarda el texto crudo de un documento de forma segura (transacción o archivo atómico) */
function writeText(filePath, text) {
  const info = docInfo(filePath);
  if (info) docStore.writeDoc(info, text); else writeFileAtomicSync(filePath, text);
}
/** ¿Existe el documento? */
function existsDoc(filePath) {
  const info = docInfo(filePath);
  return info ? docStore.existsDoc(info) : fs.existsSync(filePath);
}
/** Todos los documentos de un negocio como { 'sales.json': texto, ... } (para respaldos) */
function listBusinessDocs(businessId) {
  const dir = getBusinessPath(businessId);
  if (docStore.ENGINE === 'sqlite') {
    const out = {};
    for (const r of docStore.listDocs(path.resolve(dir))) out[r.name] = r.json;
    return out;
  }
  const out = {};
  try { for (const n of fs.readdirSync(dir)) if (/\.json$/i.test(n)) out[n] = fs.readFileSync(path.join(dir, n), 'utf8'); } catch { /* sin carpeta */ }
  return out;
}

/**
 * Lee y parsea un archivo JSON.
 * Retorna null si el archivo no existe o tiene un error de parseo
 * (en lugar de lanzar excepción, para simplificar el manejo de errores).
 */
async function readJSON(filePath) {
  try {
    const raw = readText(filePath);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch (err) {
    reportCorruptFile(filePath, err);
    return null;
  }
}

// Archivos dañados ya avisados en esta ejecución (para no avisar en cada lectura)
const reportedCorrupt = new Set();

/**
 * Un archivo que existe pero no se puede leer (JSON dañado) se lee como "vacío", y el
 * siguiente guardado lo sobrescribiría. Antes de eso: se guarda una copia del archivo
 * dañado (<archivo>.corrupt-<fecha>) y se registra un problema en la Bitácora del superadmin.
 */
function reportCorruptFile(filePath, err) {
  try {
    if (!(err instanceof SyntaxError)) return; // solo JSON mal formado
    const key = path.resolve(filePath);
    if (reportedCorrupt.has(key)) return;
    reportedCorrupt.add(key);

    let copyName = '';
    try {
      copyName = key + '.corrupt-' + new Date().toISOString().replace(/[:.]/g, '-');
      fs.copyFileSync(key, copyName);
    } catch { copyName = ''; }

    require('./systemEvents').recordProblem({
      type: 'archivo_danado',
      title: 'Archivo de datos dañado',
      detail: `${path.relative(DATA_PATH, key)} no se pudo leer (${err.message}). ` +
        (copyName ? `Se guardó una copia dañada como ${path.basename(copyName)}. ` : '') +
        'La app lo toma como vacío: restaura el archivo desde un respaldo antes de seguir guardando.'
    });
  } catch { /* avisar nunca debe romper la lectura */ }
}

const sleepMs = (ms) => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { /* sin espera */ } };

/**
 * Escribe un archivo de forma SEGURA: primero se escribe completo en un archivo temporal (y se fuerza a disco),
 * y solo al final se renombra sobre el definitivo. Si el servidor se corta a mitad de la escritura, el archivo
 * anterior queda intacto en lugar de quedar a medias. (En Windows, si el antivirus lo tiene tomado un instante,
 * se reintenta.)
 */
function writeFileAtomicSync(filePath, text, opts = {}) {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const fd = fs.openSync(tmp, 'w', opts.mode);
  try { fs.writeSync(fd, text, null, 'utf-8'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  for (let i = 0; ; i++) {
    try { fs.renameSync(tmp, filePath); return; }
    catch (e) {
      if (i < 4 && ['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) { sleepMs(15 * (i + 1)); continue; }
      try { fs.unlinkSync(tmp); } catch { /* ya no está */ }
      throw e;
    }
  }
}

/** Borra los temporales que quedaron de una escritura interrumpida (más de 10 minutos de antigüedad) */
function cleanTempFiles(root = DATA_PATH) {
  let n = 0;
  const walk = (dir) => {
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(tmp|restore-tmp)(-[\w-]+)?$/.test(e.name)) {
        try { if (Date.now() - fs.statSync(full).mtimeMs > 10 * 60 * 1000) { fs.unlinkSync(full); n++; } } catch { /* otro proceso lo tomó */ }
      }
    }
  };
  walk(root);
  return n;
}

/**
 * Guarda un objeto/array como JSON formateado en el archivo indicado, de forma segura (ver writeFileAtomicSync).
 * Crea el directorio padre si no existe.
 */
async function writeJSON(filePath, data) {
  const info = docInfo(filePath);
  const text = JSON.stringify(data, null, info ? 0 : 2); // si los datos no se pueden convertir, falla ANTES de tocar nada
  writeText(filePath, text);
  reportedCorrupt.delete(path.resolve(filePath)); // el archivo quedó sano otra vez
}

/**
 * Agrega un ítem al final del array en el archivo JSON.
 * Si el archivo no existe, lo crea con el ítem como primer elemento.
 */
async function appendToJSON(filePath, item) {
  const existing = await readJSON(filePath) || [];
  existing.push(item);
  await writeJSON(filePath, existing);
  return existing;
}

/**
 * Actualiza un ítem específico del array en el archivo JSON,
 * identificado por su campo `id`. Retorna null si no lo encuentra.
 */
async function updateInJSON(filePath, id, updates) {
  const items = await readJSON(filePath) || [];
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...updates };
  await writeJSON(filePath, items);
  return items[idx];
}

/**
 * Elimina un ítem del array en el archivo JSON por su campo `id`.
 * Retorna false si el ítem no existía, true si fue eliminado.
 */
async function deleteFromJSON(filePath, id) {
  let items = await readJSON(filePath) || [];
  const before = items.length;
  items = items.filter(i => i.id !== id);
  if (items.length === before) return false; // No se encontró el ítem
  await writeJSON(filePath, items);
  return true;
}

module.exports = {
  readText,
  writeText,
  existsDoc,
  listBusinessDocs,
  docInfo,
  ENGINE: docStore.ENGINE,
  writeFileAtomicSync,
  cleanTempFiles,
  getDataPath,
  getBusinessPath,
  ensureBusinessDir,
  ensureDir,
  readJSON,
  writeJSON,
  appendToJSON,
  updateInJSON,
  deleteFromJSON
};
