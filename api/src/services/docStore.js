/**
 * services/docStore.js — Motor SQLite: UNA base de datos por negocio
 *
 * Cada negocio guarda sus datos en
 *   <DATA_PATH>/<negocio>/negocio.db
 * con dos formas de guardar:
 *   - docs(name, json)  → documentos pequeños (perfil, inventario, turnos, deudas, carta...), uno por archivo .json de antes
 *   - rows(coll, id...) → lo que CRECE sin parar (ventas y pedidos): UNA FILA por registro, con fecha y estado indexados
 * Lo que NO es dato de negocio (fotos, clave de respaldos, secretos) sigue como archivo.
 *
 * Se activa con STORAGE_ENGINE=sqlite. Sin esa variable todo funciona como antes (archivos JSON).
 * Usa el SQLite que ya trae Node (node:sqlite): no hay que instalar nada nativo.
 *
 * Seguridad de los datos:
 *  - Cada guardado es una transacción: o queda completo o no queda (aunque el servidor se corte).
 *  - Al abrir un negocio por primera vez, sus archivos .json se IMPORTAN a la base en una sola transacción.
 *    Los .json originales NO se borran ni se modifican.
 *  - Los documentos que pasan a filas (ventas y pedidos) se convierten una sola vez, en una transacción.
 */
const fs = require('fs');
const path = require('path');

const ENGINE = (process.env.STORAGE_ENGINE || 'json').toLowerCase() === 'sqlite' ? 'sqlite' : 'json';
const DB_NAME = 'negocio.db';        // la base de cada negocio
const GLOBAL_DB = 'global.db';       // la base de la raíz: lista de franquicias, superadmin, enlaces cortos, problemas del sistema
const dbs = new Map(); // archivo de base -> conexión

// Lo que crece sin parar se guarda como FILAS: agregar una venta toca una fila, y las listas se consultan
// por fecha o estado sin leer todo el historial.
const COLLECTIONS = new Set(['sales.json', 'pedidos.json']);
const isColl = (name) => COLLECTIONS.has(name);
const collKey = (name) => name.replace(/\.json$/i, '');

let DatabaseSync = null;
function loadSqlite() {
  if (DatabaseSync) return DatabaseSync;
  // Node 22.13+ lo trae sin banderas; avisa como "experimental" y lo silenciamos solo para este aviso
  const orig = process.emitWarning;
  process.emitWarning = function (w, ...a) { if (String(w && w.message || w).includes('SQLite')) return; return orig.call(process, w, ...a); };
  try { DatabaseSync = require('node:sqlite').DatabaseSync; } finally { process.emitWarning = orig; }
  return DatabaseSync;
}

/**
 * Un archivo es "documento" si es un .json que está DIRECTAMENTE dentro de la carpeta de un negocio (va a la base de ese negocio)
 * o directamente en la raíz de datos (va a la base global).
 */
function classify(filePath, dataPath) {
  const rel = path.relative(path.resolve(dataPath), path.resolve(filePath));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const parts = rel.split(path.sep);
  if (parts.length === 1) { // raíz de datos
    if (!/^[\w.-]+\.json$/i.test(parts[0])) return null;
    return { biz: null, name: parts[0], dir: path.resolve(dataPath), file: GLOBAL_DB };
  }
  if (parts.length !== 2) return null;
  const [biz, file] = parts;
  if (biz === 'backups' || !/^[a-zA-Z0-9_-]+$/.test(biz)) return null;
  if (!/^[\w.-]+\.json$/i.test(file)) return null;
  return { biz, name: file, dir: path.join(path.resolve(dataPath), biz), file: DB_NAME };
}

function open(dir, file = DB_NAME) {
  const key = path.join(dir, file);
  let db = dbs.get(key);
  if (db) return db;
  const Db = loadSqlite();
  fs.mkdirSync(dir, { recursive: true });
  db = new Db(key);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;');
  db.exec('CREATE TABLE IF NOT EXISTS docs (name TEXT PRIMARY KEY, json TEXT NOT NULL, updated TEXT NOT NULL)');
  db.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
  db.exec(`CREATE TABLE IF NOT EXISTS rows (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, coll TEXT NOT NULL, id TEXT NOT NULL,
    ts INTEGER, status TEXT, json TEXT NOT NULL, UNIQUE (coll, id))`);
  db.exec('CREATE INDEX IF NOT EXISTS rows_ts ON rows (coll, ts)');
  db.exec('CREATE INDEX IF NOT EXISTS rows_status ON rows (coll, status, seq)'); // por estado, ya en orden de llegada
  dbs.set(key, db);
  importLegacy(db, dir);
  collectionsFromDocs(db);
  return db;
}

/** Primera vez: pasar a la base los .json que ya existían (una sola transacción; los archivos quedan intactos) */
function importLegacy(db, dir) {
  const done = db.prepare("SELECT v FROM meta WHERE k = 'imported'").get();
  if (done) return;
  let names = [];
  try { names = fs.readdirSync(dir).filter(n => /^[\w.-]+\.json$/i.test(n)); } catch { /* carpeta nueva */ }
  const ins = db.prepare('INSERT OR IGNORE INTO docs (name, json, updated) VALUES (?, ?, ?)');
  db.exec('BEGIN');
  try {
    for (const n of names) {
      const text = fs.readFileSync(path.join(dir, n), 'utf8');
      try { JSON.parse(text); } catch { continue; } // un archivo ya dañado no se importa (queda el original para revisarlo)
      ins.run(n, text, new Date().toISOString());
    }
    db.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('imported', ?)").run(new Date().toISOString());
    db.exec('COMMIT');
  } catch (e) { try { db.exec('ROLLBACK'); } catch { /* */ } throw e; }
}

/** Pasa de documento a filas lo que crece (una sola vez por negocio, en una transacción) */
function collectionsFromDocs(db) {
  for (const name of COLLECTIONS) {
    const doc = db.prepare('SELECT json FROM docs WHERE name = ?').get(name);
    if (!doc) continue;
    let list; try { list = JSON.parse(doc.json); } catch { continue; }
    if (!Array.isArray(list)) continue;
    inTx(db, () => { replaceRows(db, name, list); db.prepare('DELETE FROM docs WHERE name = ?').run(name); });
  }
}

// ── Filas ──────────────────────────────────────────────────────────────────
const tsOf = (item) => { const t = Date.parse(item && item.createdAt); return Number.isNaN(t) ? null : t; };
/**
 * Etiqueta de estado que se indexa. Casi siempre es item.status; un pedido entregado Y facturado se etiqueta 'facturado'
 * para poder pedir solo "los que faltan por facturar" sin leer todo el historial. El contenido guardado no cambia.
 */
const statusKey = (coll, item) => {
  if (!item || item.status == null) return null;
  if (coll === 'pedidos' && item.status === 'entregado' && item.saleId) return 'facturado';
  return String(item.status);
};
const idOf = (item) => {
  if (!item || (typeof item.id !== 'string' && typeof item.id !== 'number')) throw new Error('Cada registro necesita un id');
  return String(item.id);
};
const UPSERT = 'INSERT INTO rows (coll, id, ts, status, json) VALUES (?, ?, ?, ?, ?) ON CONFLICT(coll, id) DO UPDATE SET ts = excluded.ts, status = excluded.status, json = excluded.json';
const collMarked = (db, name) => !!db.prepare('SELECT 1 AS x FROM meta WHERE k = ?').get('coll:' + name);
const markColl = (db, name) => db.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES (?, '1')").run('coll:' + name);

function inTx(db, fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { try { db.exec('ROLLBACK'); } catch { /* */ } throw e; }
}

/** Reemplaza la colección completa tocando solo lo que cambió (los que ya existían conservan su lugar) */
function replaceRows(db, name, list) {
  const c = collKey(name);
  const ex = new Map(db.prepare('SELECT id, json FROM rows WHERE coll = ?').all(c).map(r => [r.id, r.json]));
  const up = db.prepare(UPSERT);
  const seen = new Set();
  for (const item of list) {
    const id = idOf(item); seen.add(id);
    const text = JSON.stringify(item);
    if (ex.get(id) !== text) up.run(c, id, tsOf(item), statusKey(c, item), text);
  }
  const del = db.prepare('DELETE FROM rows WHERE coll = ? AND id = ?');
  for (const id of ex.keys()) if (!seen.has(id)) del.run(c, id);
  markColl(db, name);
}

function collAll(dir, name) {
  return open(dir).prepare('SELECT json FROM rows WHERE coll = ? ORDER BY seq').all(collKey(name)).map(r => JSON.parse(r.json));
}
function collGet(dir, name, id) {
  const r = open(dir).prepare('SELECT json FROM rows WHERE coll = ? AND id = ?').get(collKey(name), String(id));
  return r ? JSON.parse(r.json) : null;
}
function collUpsert(dir, name, item) {
  const db = open(dir);
  db.prepare(UPSERT).run(collKey(name), idOf(item), tsOf(item), statusKey(collKey(name), item), JSON.stringify(item));
  markColl(db, name);
}
function collRemove(dir, name, id) {
  return open(dir).prepare('DELETE FROM rows WHERE coll = ? AND id = ?').run(collKey(name), String(id)).changes > 0;
}
/** Borra varios de una sola vez (una transacción) */
function collRemoveMany(dir, name, ids) {
  const db = open(dir), c = collKey(name), del = db.prepare('DELETE FROM rows WHERE coll = ? AND id = ?');
  return inTx(db, () => { let n = 0; for (const id of ids) n += del.run(c, String(id)).changes; return n; });
}
function collCount(dir, name) {
  return open(dir).prepare('SELECT COUNT(*) AS n FROM rows WHERE coll = ?').get(collKey(name)).n;
}
/** Consulta: { fromTs, toTs (inclusive), statuses: [..], notStatuses: [..], like (texto en cualquier campo), limit, desc }. Orden: el de inserción (o inverso con desc). */
function collQuery(dir, name, o = {}) {
  const w = ['coll = ?'], p = [collKey(name)];
  if (o.fromTs != null) { w.push('ts >= ?'); p.push(o.fromTs); }
  if (o.toTs != null) { w.push('ts <= ?'); p.push(o.toTs); }
  if (o.statuses && o.statuses.length) { w.push(`status IN (${o.statuses.map(() => '?').join(',')})`); p.push(...o.statuses); }
  if (o.notStatuses && o.notStatuses.length) { w.push(`(status IS NULL OR status NOT IN (${o.notStatuses.map(() => '?').join(',')}))`); p.push(...o.notStatuses); }
  if (o.like) { w.push("json LIKE ? ESCAPE '!'"); p.push('%' + String(o.like).replace(/[!%_]/g, (m) => '!' + m) + '%'); }
  let q = `SELECT json FROM rows WHERE ${w.join(' AND ')} ORDER BY seq ${o.desc ? 'DESC' : 'ASC'}`;
  if (o.limit) { q += ' LIMIT ?'; p.push(o.limit); }
  return open(dir).prepare(q).all(...p).map(r => JSON.parse(r.json));
}

// ── Documentos ─────────────────────────────────────────────────────────────
function readDoc(info) {
  const db = open(info.dir, info.file);
  if (isColl(info.name)) { // documento "virtual" armado desde las filas (respaldos y código que lee todo)
    return collMarked(db, info.name) ? JSON.stringify(collAll(info.dir, info.name)) : null;
  }
  const row = db.prepare('SELECT json FROM docs WHERE name = ?').get(info.name);
  return row ? row.json : null;
}
function writeDoc(info, text) {
  const db = open(info.dir, info.file);
  if (isColl(info.name)) {
    let list; try { list = JSON.parse(text); } catch { throw new Error('Datos inválidos para ' + info.name); }
    if (!Array.isArray(list)) throw new Error(info.name + ' debe ser una lista');
    inTx(db, () => replaceRows(db, info.name, list));
    return;
  }
  db.prepare('INSERT INTO docs (name, json, updated) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET json = excluded.json, updated = excluded.updated')
    .run(info.name, text, new Date().toISOString());
}
function listDocs(dir, file = DB_NAME) {
  const db = open(dir, file);
  const out = db.prepare('SELECT name, json FROM docs ORDER BY name').all();
  for (const name of COLLECTIONS) if (collMarked(db, name)) out.push({ name, json: JSON.stringify(collAll(dir, name)) });
  return out.sort((a, b) => (a.name < b.name ? -1 : 1));
}
function existsDoc(info) {
  const db = open(info.dir, info.file);
  if (isColl(info.name)) return collMarked(db, info.name);
  return !!db.prepare('SELECT 1 AS x FROM docs WHERE name = ?').get(info.name);
}
/** Cierra las conexiones (para pruebas y para borrar carpetas) */
function closeAll() { for (const db of dbs.values()) { try { db.close(); } catch { /* */ } } dbs.clear(); }
function close(dir, file = DB_NAME) { const key = path.join(dir, file); const db = dbs.get(key); if (db) { try { db.close(); } catch { /* */ } dbs.delete(key); } }

module.exports = { ENGINE, DB_NAME, GLOBAL_DB, COLLECTIONS, isColl, statusKey, classify, readDoc, writeDoc, listDocs, existsDoc, closeAll, close,
  collAll, collGet, collUpsert, collRemove, collRemoveMany, collCount, collQuery };
