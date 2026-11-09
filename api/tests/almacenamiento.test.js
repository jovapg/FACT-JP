/**
 * Guardado de archivos: que un corte o una falla no deje datos a medias ni dañados.
 */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'facjp-almacen-'));
process.env.DATA_PATH = DIR; // antes de cargar el módulo: ahí se decide dónde se guarda
const st = require('../src/services/fileStorage');
after(() => { try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { /* */ } });

const file = (n) => path.join(DIR, 'negocio', n);
const sobras = () => fs.readdirSync(path.join(DIR, 'negocio')).filter(n => /\.tmp-/.test(n));

test('guardar y leer devuelve exactamente lo mismo, sin temporales de sobra', async () => {
  const datos = [{ id: 1, nombre: 'Pechuga', precio: 10000, ñ: 'áéíóú 🍗' }];
  await st.writeJSON(file('ventas.json'), datos);
  assert.deepEqual(await st.readJSON(file('ventas.json')), datos);
  assert.deepEqual(sobras(), []);
});

test('si los datos no se pueden guardar, el archivo anterior queda intacto', async () => {
  await st.writeJSON(file('a.json'), { bueno: true });
  const circular = {}; circular.yo = circular;
  await assert.rejects(() => st.writeJSON(file('a.json'), circular));
  assert.deepEqual(await st.readJSON(file('a.json')), { bueno: true });
  assert.deepEqual(sobras(), [], 'no queda ningún temporal');
});

test('un corte a mitad de escritura no daña el archivo: solo queda un temporal que luego se limpia', async () => {
  await st.writeJSON(file('b.json'), { version: 1 });
  // simulación de un corte: quedó un temporal a medias junto al archivo bueno
  const huerfano = file('b.json') + '.tmp-999-abc';
  fs.writeFileSync(huerfano, '{"version": 2, "a medias');
  assert.deepEqual(await st.readJSON(file('b.json')), { version: 1 }, 'el archivo real sigue entero');
  assert.equal(st.cleanTempFiles(), 0, 'un temporal reciente no se borra (podría estar en uso)');
  const viejo = new Date(Date.now() - 30 * 60 * 1000);
  fs.utimesSync(huerfano, viejo, viejo);
  assert.equal(st.cleanTempFiles(), 1);
  assert.equal(fs.existsSync(huerfano), false);
  assert.deepEqual(await st.readJSON(file('b.json')), { version: 1 });
});

test('muchas escrituras al mismo tiempo nunca dejan el archivo a medias', async () => {
  await Promise.all(Array.from({ length: 60 }, (_, i) => st.writeJSON(file('c.json'), { i, relleno: 'x'.repeat(5000) })));
  const leido = await st.readJSON(file('c.json'));
  assert.ok(leido && Number.isInteger(leido.i), 'el archivo se puede leer y es uno de los guardados completos');
  assert.deepEqual(sobras(), []);
});

// Con SQLite este caso no existe: la base nunca queda "a medias" y solo se guardan documentos válidos.
test('un archivo dañado no rompe la lectura y se guarda una copia para revisarlo', { skip: process.env.STORAGE_ENGINE === 'sqlite' && 'solo aplica a archivos .json' }, async () => {
  fs.writeFileSync(file('d.json'), '{"roto": [1, 2,');
  assert.equal(await st.readJSON(file('d.json')), null);
  const copias = fs.readdirSync(path.join(DIR, 'negocio')).filter(n => n.startsWith('d.json.corrupt-'));
  assert.equal(copias.length, 1, 'se guardó una copia del archivo dañado');
  await st.writeJSON(file('d.json'), { sano: true });
  assert.deepEqual(await st.readJSON(file('d.json')), { sano: true });
});

test('los identificadores de franquicia no pueden salirse de la carpeta de datos', () => {
  for (const malo of ['../x', '..\\x', 'a/b', '', '../../etc/passwd']) assert.throws(() => st.getBusinessPath(malo), undefined, malo);
  assert.ok(st.getBusinessPath('3f2a-uuid_ok').startsWith(DIR));
});

test('los archivos con permisos especiales se escriben igual de seguros (clave de respaldos)', () => {
  const f = path.join(DIR, 'secreto.txt');
  st.writeFileAtomicSync(f, 'abc', { mode: 0o600 });
  assert.equal(fs.readFileSync(f, 'utf8'), 'abc');
  st.writeFileAtomicSync(f, 'def', { mode: 0o600 });
  assert.equal(fs.readFileSync(f, 'utf8'), 'def');
});
