/**
 * Fotos que viajan con la app: se asignan por nombre, sin pisar las que ya existen y sin romper nada.
 */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'facjp-fotos-'));
const SEED = fs.mkdtempSync(path.join(os.tmpdir(), 'facjp-seed-'));
process.env.DATA_PATH = DIR;
const st = require('../src/services/fileStorage');
const seed = require('../src/services/seedPhotos');
after(() => { try { require('../src/services/docStore').closeAll(); fs.rmSync(DIR, { recursive: true, force: true }); fs.rmSync(SEED, { recursive: true, force: true }); } catch { /* Windows */ } });

test('asigna por nombre (sin importar tildes ni mayúsculas), no pisa fotos existentes y se puede repetir', async () => {
  const id = 'biz-uno';
  await st.writeJSON(path.join(DIR, 'businesses.json'), [{ id, slug: 'mi-negocio', name: 'Mi Negocio' }, { id: 'biz-dos', slug: 'otro', name: 'Otro' }]);
  await st.writeJSON(path.join(DIR, id, 'inventory.json'), [
    { id: 'i1', name: 'Deditos' }, { id: 'i2', name: '¼ de pollo (muslo y contramuslo)' },
    { id: 'i3', name: 'Alitas x12', imageUrl: '/uploads/biz-uno/subida-a-mano.webp' }, { id: 'i4', name: 'Otro producto' }]);
  const d = path.join(SEED, 'mi-negocio'); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'a.webp'), 'foto-a'); fs.writeFileSync(path.join(d, 'b.webp'), 'foto-b');
  fs.writeFileSync(path.join(d, 'manifest.json'), JSON.stringify({ slug: 'mi-negocio', photos: [
    { file: 'a.webp', products: ['DEDITOS', '1/4 de pollo (muslo y contramuslo)', 'Alitas x12', 'No existe todavía'] }, { file: 'b.webp', products: ['Deditos'] }, { file: 'falta.webp', products: ['Otro producto'] }] }));

  const r = (await seed.run(SEED))[0];
  assert.equal(r.slug, 'mi-negocio');
  assert.equal(r.set, 1, 'solo Deditos (¼ lleva un símbolo distinto a "1/4"; no se adivina)');
  assert.equal(r.skippedHasPhoto, 2, 'Alitas x12 ya tenía foto; Deditos ya la recibió de la primera');
  assert.deepEqual(r.missing.sort(), ['1/4 de pollo (muslo y contramuslo)', 'No existe todavía']);
  const inv = await st.readJSON(path.join(DIR, id, 'inventory.json'));
  assert.match(inv.find(i => i.id === 'i1').imageUrl, /^\/uploads\/biz-uno\/i1\.webp\?v=\d+$/);
  assert.equal(inv.find(i => i.id === 'i3').imageUrl, '/uploads/biz-uno/subida-a-mano.webp', 'la foto subida a mano se respeta');
  assert.equal(inv.find(i => i.id === 'i4').imageUrl, undefined, 'sin archivo de foto no se asigna nada');
  assert.equal(fs.readFileSync(path.join(DIR, id, 'i1.webp'), 'utf8'), 'foto-a', 'el archivo quedó en la carpeta del negocio');
  const otra = (await seed.run(SEED))[0];
  assert.equal(otra.set, 0, 'repetir no cambia nada');
});

test('sin carpeta de fotos, sin negocio con ese slug o con un manifest dañado no pasa nada', async () => {
  assert.deepEqual(await seed.run(path.join(SEED, 'no-existe')), []);
  const d = path.join(SEED, 'roto'); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'manifest.json'), '{no es json');
  const d2 = path.join(SEED, 'sin-negocio'); fs.mkdirSync(d2, { recursive: true }); fs.writeFileSync(path.join(d2, 'manifest.json'), JSON.stringify({ slug: 'fantasma', photos: [] }));
  const r = await seed.run(SEED);
  assert.ok(r.every(x => x.slug === 'mi-negocio'));
});

test('las fotos reales de Deli-Combos: cada archivo existe y cada producto del manifest existe en la carta', () => {
  const dir = path.join(__dirname, '../seed-photos/deli-combos');
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const carta = require('../src/services/cartaService').defaultCarta();
  const nombres = new Set(carta.products.map(p => p.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()));
  for (const p of m.photos) {
    assert.ok(fs.existsSync(path.join(dir, p.file)), p.file + ' existe');
    assert.ok(fs.statSync(path.join(dir, p.file)).size < 120 * 1024, p.file + ' pesa poco');
    for (const n of p.products) assert.ok(nombres.has(n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()), 'producto de la carta: ' + n);
  }
});
