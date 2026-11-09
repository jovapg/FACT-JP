/**
 * services/docStore.js — Motor SQLite: UNA base de datos por negocio
 *
 * Cada negocio guarda sus "documentos" (sales, pedidos, inventory, profile, shifts...) en
 *   <DATA_PATH>/<negocio>/negocio.db      tabla docs(name, json, updated)
 * Lo que NO es documento (fotos, clave de respaldos, lista de franquicias, superadmin) sigue como archivo.
 *
 * Se activa con STORAGE_ENGINE=sqlite. Sin esa variable todo funciona como antes (archivos JSON).
 * Usa el SQLite que ya trae Node (node:sqlite): no hay que instalar nada nativo.
 *
 * Seguridad de los datos:
 *  - Cada guardado es una transacción: o queda completo o no queda (aunque el servidor se corte).
 *  - Al abrir un negocio por primera vez, sus archivos .json se IMPORTAN a la base en una sola transacción.
 *    Los .json originales NO se borran ni se modifican: son el camino de retroceso.
 */
const fs = require('fs');
const path = require('path');

const ENGINE = (process.env.STORAGE_ENGINE || 'json').toLowerCase() === 'sqlite' ? 'sqlite' : 'json';
const DB_NAME = 'negocio.db';
const dbs = new Map(); // carpeta del negocio -> conexión

let DatabaseSync = null;
function loadSqlite() {
  if (DatabaseSync) return DatabaseSync;
  // Node 22.13+ lo trae sin banderas; avisa como "experimental" y lo silenciamos solo para este aviso
  const orig = process.emitWarning;
  process.emitWarning = function (w, ...a) { if (String(w && w.message || w).includes('SQLite')) return; return orig.call(process, w, ...a); };
  try { DatabaseSync = require('node:sqlite').DatabaseSync; } finally { process.emitWarning = orig; }
  return DatabaseSync;
}

/** Un archivo es "documento" si es un .json que está DIRECTAMENTE dentro de la carpeta de un negocio */
function classify(filePath, dataPath) {
  const rel = path.relative(path.resolve(dataPath), path.resolve(filePath));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const parts = rel.split(path.sep);
  if (parts.length !== 2) return null;
  const [biz, file] = parts;
  if (biz === 'backups' || !/^[a-zA-Z0-9_-]+$/.test(biz)) return null;
  if (!/^[\w.-]+\.json$/i.test(file)) return null;
  return { biz, name: file, dir: path.join(path.resolve(dataPath), biz) };
}

function open(dir) {
  let db = dbs.get(dir);
  if (db) return db;
  const Db = loadSqlite();
  fs.mkdirSync(dir, { recursive: true });
  db = new Db(path.join(dir, DB_NAME));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;');
  db.exec('CREATE TABLE IF NOT EXISTS docs (name TEXT PRIMARY KEY, json TEXT NOT NULL, updated TEXT NOT NULL)');
  db.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
  dbs.set(dir, db);
  importLegacy(db, dir);
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

function readDoc(info) {
  const row = open(info.dir).prepare('SELECT json FROM docs WHERE name = ?').get(info.name);
  return row ? row.json : null;
}
function writeDoc(info, text) {
  open(info.dir).prepare('INSERT INTO docs (name, json, updated) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET json = excluded.json, updated = excluded.updated')
    .run(info.name, text, new Date().toISOString());
}
function listDocs(dir) {
  return open(dir).prepare('SELECT name, json FROM docs ORDER BY name').all();
}
function existsDoc(info) {
  return !!open(info.dir).prepare('SELECT 1 AS x FROM docs WHERE name = ?').get(info.name);
}
/** Cierra las conexiones (para pruebas y para borrar carpetas) */
function closeAll() { for (const db of dbs.values()) { try { db.close(); } catch { /* */ } } dbs.clear(); }
function close(dir) { const db = dbs.get(dir); if (db) { try { db.close(); } catch { /* */ } dbs.delete(dir); } }

module.exports = { ENGINE, DB_NAME, classify, readDoc, writeDoc, listDocs, existsDoc, closeAll, close };
