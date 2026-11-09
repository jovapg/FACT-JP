/**
 * Ensayo de migración a SQLite — NO toca la carpeta original.
 *
 *   node scripts/ensayo-sqlite.js <carpeta-de-datos>
 *
 * 1) Copia la carpeta de datos a una temporal.
 * 2) Abre cada negocio con el motor SQLite (esto importa sus .json a negocio.db).
 * 3) Compara, documento por documento, que lo guardado en la base sea IDÉNTICO al archivo original.
 * 4) Mide cuánto tarda leer y guardar el documento más grande, antes (archivo) y después (SQLite).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const src = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(src)) { console.error('Uso: node scripts/ensayo-sqlite.js <carpeta-de-datos>'); process.exit(1); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'facjp-ensayo-'));
fs.cpSync(src, tmp, { recursive: true, filter: (p) => !p.split(path.sep).includes('backups') });
process.env.DATA_PATH = tmp;
process.env.STORAGE_ENGINE = 'sqlite';
const st = require('../src/services/fileStorage');
const docStore = require('../src/services/docStore');

const stable = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
let docs = 0, bad = 0, bytes = 0, biggest = { n: '', size: 0, biz: '' };
const t0 = Date.now();

for (const e of fs.readdirSync(tmp, { withFileTypes: true })) {
  if (!e.isDirectory() || e.name === 'backups') continue;
  const dir = path.join(tmp, e.name);
  const originals = fs.readdirSync(dir).filter(n => /\.json$/i.test(n));
  if (!originals.length) continue;
  const migrated = st.listBusinessDocs(e.name); // abre la base e importa
  for (const n of originals) {
    const orig = fs.readFileSync(path.join(dir, n), 'utf8');
    docs++; bytes += orig.length;
    if (orig.length > biggest.size) biggest = { n, size: orig.length, biz: e.name };
    let a, b;
    try { a = JSON.parse(orig); } catch { console.log(`  ⚠ ${e.name}/${n}: el original ya estaba dañado (no se importa)`); continue; }
    try { b = JSON.parse(migrated[n]); } catch { b = undefined; }
    if (stable(a) !== stable(b)) { bad++; console.log(`  ✖ DIFERENTE: ${e.name}/${n}`); }
  }
  const extra = Object.keys(migrated).filter(n => !originals.includes(n));
  if (extra.length) console.log(`  ⚠ ${e.name}: hay documentos de más en la base: ${extra.join(', ')}`);
}
console.log(`\nMigrados ${docs} documentos (${(bytes / 1048576).toFixed(2)} MB) en ${Date.now() - t0} ms. Diferencias: ${bad}`);

if (biggest.n) {
  const f = path.join(tmp, biggest.biz, biggest.n);
  const med = (fn, n = 15) => { const t = process.hrtime.bigint(); for (let i = 0; i < n; i++) fn(); return Number(process.hrtime.bigint() - t) / 1e6 / n; };
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  const jr = med(() => JSON.parse(fs.readFileSync(f, 'utf8')));
  const jw = med(() => st.writeFileAtomicSync(f + '.bench', JSON.stringify(data, null, 2)));
  const sr = med(() => JSON.parse(st.readText(f)));
  const sw = med(() => st.writeText(f, JSON.stringify(data)));
  console.log(`Documento más grande: ${biggest.biz}/${biggest.n} (${(biggest.size / 1048576).toFixed(2)} MB)`);
  console.log(`  archivo JSON : leer ${jr.toFixed(1)} ms · guardar ${jw.toFixed(1)} ms`);
  console.log(`  SQLite       : leer ${sr.toFixed(1)} ms · guardar ${sw.toFixed(1)} ms`);
}
docStore.closeAll();
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* Windows */ }
process.exit(bad ? 1 : 0);
