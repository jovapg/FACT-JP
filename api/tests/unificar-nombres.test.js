/**
 * Unificar productos repetidos: se queda uno, se quitan los repetidos, la foto y los enlaces pasan al que se queda, y no se toca el historial.
 */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'facjp-unif-'));
const SEED = fs.mkdtempSync(path.join(os.tmpdir(), 'facjp-unif-seed-'));
process.env.DATA_PATH = DIR; process.env.STORAGE_ENGINE = 'json';
const st = require('../src/services/fileStorage');
const { unify } = require('../src/services/unifyNames');
const seed = require('../src/services/seedPhotos');
after(() => { try { fs.rmSync(DIR, { recursive: true, force: true }); fs.rmSync(SEED, { recursive: true, force: true }); } catch { /* Windows */ } });

const datos = () => ({
  inventory: [
    { id: 'i-cuarto', name: 'cuarto de pollo (ala y pechuga)', salePrice: 15000, noStock: true },
    { id: 'i-cuarto-carta', name: '¼ de pollo (ala y pechuga)', salePrice: 15000, noStock: true, imageUrl: '/uploads/x/foto.webp' },
    { id: 'i-medio', name: 'Medio pollo', salePrice: 26000, noStock: true },
    { id: 'i-tragon', name: 'Tragón con papas a la francesa ', salePrice: 20000, noStock: true }
  ],
  recipes: [
    { id: 'r-cuarto', name: 'Cuarto de pollo (ala y pechuga)', price: 15000, ingredients: [{ inventoryId: 'i-cuarto', quantity: 1 }] },
    { id: 'r-cuarto-carta', name: '¼ de pollo (ala y pechuga)', price: 15000, ingredients: [{ inventoryId: 'i-cuarto', quantity: 1 }] },
    { id: 'r-otra', name: 'Combo raro', price: 1, ingredients: [{ inventoryId: 'i-cuarto-carta', quantity: 2 }] },
    { id: 'r-medio', name: 'Medio pollo', price: 26000, ingredients: [] },
    { id: 'r-tragon', name: 'Tragón con papas a la francesa ', price: 20000, ingredients: [{ inventoryId: 'i-tragon', quantity: 1 }] }
  ],
  carta: { products: [
    { id: 'c-cuarto', name: '¼ de pollo (ala y pechuga)', price: 15000, inventoryId: 'i-cuarto-carta', featured: true },
    { id: 'c-tragon', name: 'Tragón con papas francesas', price: 20000, inventoryId: 'ya-no-existe' }
  ] }
});
const OPS = [
  { canonical: 'Cuarto de pollo (ala y pechuga)', keepInventory: 'cuarto de pollo (ala y pechuga)', keepRecipe: 'Cuarto de pollo (ala y pechuga)', dropInventory: ['¼ de pollo (ala y pechuga)'], dropRecipes: ['¼ de pollo (ala y pechuga)'], carta: ['¼ de pollo (ala y pechuga)'] },
  { canonical: 'Tragón con papas francesas', keepInventory: 'Tragón con papas a la francesa', keepRecipe: 'Tragón con papas a la francesa', carta: ['Tragón con papas francesas'] }
];

test('se quita el repetido, la foto y los enlaces pasan al que se queda, y el nombre queda limpio', () => {
  const d = datos();
  const r = unify(d, OPS);
  assert.equal(r.cambio, true);
  assert.deepEqual(d.inventory.map(i => i.name), ['Cuarto de pollo (ala y pechuga)', 'Medio pollo', 'Tragón con papas francesas']);
  assert.equal(d.inventory.find(i => i.id === 'i-cuarto').imageUrl, '/uploads/x/foto.webp', 'la foto del repetido pasó al que se queda');
  assert.deepEqual(d.recipes.map(x => x.name), ['Cuarto de pollo (ala y pechuga)', 'Combo raro', 'Medio pollo', 'Tragón con papas francesas']);
  assert.equal(d.recipes.find(x => x.id === 'r-otra').ingredients[0].inventoryId, 'i-cuarto', 'un insumo que apuntaba al repetido ahora apunta al que se queda');
  const c = d.carta.products;
  assert.deepEqual(c.map(x => [x.name, x.inventoryId]), [['Cuarto de pollo (ala y pechuga)', 'i-cuarto'], ['Tragón con papas francesas', 'i-tragon']], 'carta: mismo nombre y enlace arreglado (también el que estaba roto)');
  assert.equal(c[0].featured, true, 'lo que la carta ya tenía (destacado) se conserva');
  assert.equal(d.inventory.find(i => i.id === 'i-medio').name, 'Medio pollo', 'lo que no es de la operación no se toca');
});

test('es repetible: la segunda vez no cambia nada', () => {
  const d = datos(); unify(d, OPS);
  const antes = JSON.stringify(d);
  const r = unify(d, OPS);
  assert.equal(r.cambio, false); assert.equal(JSON.stringify(d), antes);
});

test('si no encuentra el producto que debe quedarse, no toca nada de esa operación y avisa', () => {
  const d = datos(); const antes = JSON.stringify(d);
  const r = unify(d, [{ canonical: 'X', keepInventory: 'no existe', dropInventory: ['Medio pollo'], dropRecipes: ['Medio pollo'] }]);
  assert.equal(r.cambio, false); assert.equal(JSON.stringify(d), antes);
  assert.match(r.avisos[0], /no encontré/);
});

test('no renombra un producto de la carta si ya hay otro con el nombre final', () => {
  const d = datos(); d.carta.products.push({ id: 'c-otro', name: 'Cuarto de pollo (ala y pechuga)', inventoryId: 'i-cuarto' });
  const r = unify(d, [OPS[0]]);
  assert.ok(r.avisos.some(a => /ya existe otro producto/.test(a)));
  assert.ok(d.carta.products.some(p => p.id === 'c-cuarto' && p.name === '¼ de pollo (ala y pechuga)'), 'no se pisó');
});

test('al arrancar, el manifiesto (manifest.unify) aplica la unificación una vez, deja una nota en la bitácora y no toca las ventas', async () => {
  const id = 'biz-unif'; const d = datos();
  await st.writeJSON(path.join(DIR, 'businesses.json'), [{ id, slug: 'con-repetidos' }]);
  await st.writeJSON(path.join(DIR, id, 'inventory.json'), d.inventory); await st.writeJSON(path.join(DIR, id, 'recipes.json'), d.recipes); await st.writeJSON(path.join(DIR, id, 'carta.json'), d.carta);
  const ventas = [{ id: 'v1', items: [{ name: '¼ de pollo (ala y pechuga)', qty: 2, price: 15000 }], total: 30000 }];
  await st.writeJSON(path.join(DIR, id, 'sales.json'), ventas);
  const sd = path.join(SEED, 'con-repetidos'); fs.mkdirSync(sd, { recursive: true });
  fs.writeFileSync(path.join(sd, 'manifest.json'), JSON.stringify({ slug: 'con-repetidos', unify: OPS, photos: [] }));
  await seed.run(SEED);
  const inv = await st.readJSON(path.join(DIR, id, 'inventory.json'));
  assert.equal(inv.length, 3); assert.ok(inv.some(i => i.name === 'Cuarto de pollo (ala y pechuga)'));
  assert.deepEqual(await st.readJSON(path.join(DIR, id, 'sales.json')), ventas, 'el historial de ventas quedó idéntico');
  const bit = JSON.stringify(await st.readJSON(path.join(DIR, id, 'audit.json')));
  assert.match(bit, /productos_unificados/);
  const antes = JSON.stringify(inv); await seed.run(SEED);
  assert.equal(JSON.stringify(await st.readJSON(path.join(DIR, id, 'inventory.json'))), antes, 'segundo arranque: sin cambios');
});

test('un manifiesto sin "unify" (como hoy) no cambia nada', async () => {
  const id = 'biz-sin'; const d = datos();
  await st.writeJSON(path.join(DIR, 'businesses.json'), [{ id: 'biz-unif', slug: 'con-repetidos' }, { id, slug: 'sin-unify' }]);
  await st.writeJSON(path.join(DIR, id, 'inventory.json'), d.inventory);
  const sd = path.join(SEED, 'sin-unify'); fs.mkdirSync(sd, { recursive: true });
  fs.writeFileSync(path.join(sd, 'manifest.json'), JSON.stringify({ slug: 'sin-unify', photos: [] }));
  await seed.run(SEED);
  assert.equal((await st.readJSON(path.join(DIR, id, 'inventory.json'))).length, 4);
});

test('la lista real de Deli-Combos (manifest.unify) es válida y todos sus campos son texto', () => {
  const ops = JSON.parse(fs.readFileSync(path.join(__dirname, '../seed-photos/deli-combos/manifest.json'), 'utf8')).unify;
  assert.equal(ops.length, 8);
  for (const o of ops) { assert.ok(o.canonical && o.keepInventory, o.canonical); for (const k of ['dropInventory', 'dropRecipes', 'carta']) assert.ok(o[k] === undefined || (Array.isArray(o[k]) && o[k].every(x => typeof x === 'string')), k); }
});

test('la carta pública encuentra la foto por el enlace con el inventario aunque el producto de inventario tenga otro nombre', async () => {
  const { startServer, createFranchise, leerDoc, escribirDoc } = require('./helpers');
  const srv = await startServer();
  try {
    const F = await createFranchise(srv, await srv.superToken(), { name: 'Foto Enlace', slug: 'foto-enlace', template: 'polleria' });
    await srv.api('POST', `/api/${F.id}/carta/sync-inventory`, { token: F.tokens.admin });
    const carta = JSON.parse(leerDoc(srv.dataDir, F.id, 'carta.json'));
    const p = carta.products.find(x => x.name === 'Pollo entero');
    const inv = JSON.parse(leerDoc(srv.dataDir, F.id, 'inventory.json'));
    const it = inv.find(i => i.id === p.inventoryId);
    it.name = 'Pollo entero asado'; it.imageUrl = `/uploads/${F.id}/foto.webp`; // la dueña lo renombró y tiene foto
    escribirDoc(srv.dataDir, F.id, 'inventory.json', JSON.stringify(inv));
    const pub = (await srv.api('GET', '/api/public/carta/foto-enlace')).data;
    assert.equal(pub.products.find(x => x.name === 'Pollo entero').image, `/uploads/${F.id}/foto.webp`, 'la foto aparece por el enlace');
    assert.equal(pub.products.find(x => x.name === 'Muslo').image, '', 'un producto sin foto sigue sin foto');
  } finally { await srv.stop(); }
});
