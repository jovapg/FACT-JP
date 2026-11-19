/**
 * Simula la unificación de productos repetidos sobre una COPIA de un respaldo (no toca nada real) y muestra, paso por paso,
 * qué cambiaría y cómo queda el menú después.
 *
 *   node scripts/simular-unificacion.js <respaldo.json.gz> [operaciones.json]
 */
const fs = require('fs'), zlib = require('zlib'), os = require('os'), path = require('path');
const backup = process.argv[2];
const opsFile = process.argv[3] || path.join(__dirname, '../seed-photos/deli-combos/unify-propuesta.json');
if (!backup || !fs.existsSync(backup)) { console.error('Uso: node scripts/simular-unificacion.js <respaldo.json.gz> [operaciones.json]'); process.exit(1); }
const p = JSON.parse(zlib.gunzipSync(fs.readFileSync(backup)).toString());
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unificar-'));
for (const [rel, text] of Object.entries(p.files)) { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); }
process.env.DATA_PATH = dir; process.env.STORAGE_ENGINE = 'json';
const { applyToBusiness } = require('../src/services/unifyNames');
const { findOutOfStockItems } = require('../src/services/inventoryService');
const cartaSvc = require('../src/services/cartaService');
const biz = JSON.parse(p.files['businesses.json']).find(b => b.slug === 'deli-combos');
const rd = (n, d) => JSON.parse(fs.readFileSync(path.join(dir, biz.id, n), 'utf8') || 'null') ?? d;
const ops = JSON.parse(fs.readFileSync(opsFile, 'utf8'));
const low = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
const FAM = /cuarto|¼|½|medio|pollo entero|trag/i;

const resumen = () => ({ inv: rd('inventory.json', []), rec: rd('recipes.json', []), carta: rd('carta.json', { products: [] }) });
const antes = resumen();

(async () => {
  console.log('=== CAMBIOS (sobre una copia, nada real se toca) ===');
  const r = await applyToBusiness(biz.id, ops);
  r.acciones.forEach((a, i) => console.log(String(i + 1).padStart(2) + '. ' + a));
  if (r.avisos.length) { console.log('\nAVISOS:'); r.avisos.forEach(a => console.log(' - ' + a)); }
  console.log(`\nTotal: ${r.acciones.length} cambios`);

  const despues = resumen();
  const sales = rd('sales.json', []);
  const vend = (n) => sales.reduce((a, s) => a + (s.items || []).filter(i => low(i.name) === low(n)).reduce((x, i) => x + (Number(i.qty) || 1), 0), 0);
  console.log(`\n=== ANTES -> DESPUÉS ===\ninventario: ${antes.inv.length} -> ${despues.inv.length} productos · recetas: ${antes.rec.length} -> ${despues.rec.length} · carta: ${antes.carta.products.length} -> ${despues.carta.products.length} (misma cantidad)`);

  console.log('\n=== CÓMO QUEDA CADA PRODUCTO (menú de Registrar venta / carta en línea) ===');
  const invByName = new Map(); despues.inv.forEach(i => invByName.set(low(i.name), i));
  const filas = [];
  for (const rc of despues.rec.filter(x => FAM.test(x.name))) {
    const fuera = await findOutOfStockItems(biz.id, [{ recipeId: rc.id, name: rc.name, price: rc.price, qty: 1 }]);
    const i = invByName.get(low(rc.name));
    filas.push(`  MENÚ   "${rc.name}" · $${rc.price} · ${fuera.length ? 'NO factura' : 'factura SÍ'} · foto: ${i && i.imageUrl ? 'sí' : 'no'} · vendido ${vend(rc.name)} veces`);
  }
  for (const c of despues.carta.products.filter(x => FAM.test(x.name))) {
    const i = despues.inv.find(x => x.id === c.inventoryId);
    filas.push(`  CARTA  "${c.name}" · $${c.price} · inventario enlazado: ${i ? '"' + i.name + '"' : 'ninguno'}`);
  }
  console.log(filas.join('\n'));

  // verificación final: ¿queda algún nombre repetido?
  const rep = new Map(); despues.rec.forEach(x => rep.set(low(x.name), (rep.get(low(x.name)) || 0) + 1));
  const repI = new Map(); despues.inv.forEach(x => repI.set(low(x.name), (repI.get(low(x.name)) || 0) + 1));
  const dups = [...rep].filter(([, n]) => n > 1).map(([k]) => 'receta ' + k).concat([...repI].filter(([, n]) => n > 1).map(([k]) => 'inventario ' + k));
  console.log('\nNombres idénticos repetidos que quedan:', dups.length ? dups.join(', ') : 'ninguno');
  // enlaces rotos
  const ids = new Set(despues.inv.map(i => i.id));
  const rotos = [];
  despues.rec.forEach(rc => (rc.ingredients || []).forEach(g => { if (!ids.has(g.inventoryId)) rotos.push(`receta "${rc.name}"`); }));
  despues.carta.products.forEach(c => { if (c.inventoryId && !ids.has(c.inventoryId)) rotos.push(`carta "${c.name}"`); });
  console.log('Enlaces rotos después del cambio:', rotos.length ? rotos.join(', ') : 'ninguno');
  const rotosAntes = [];
  antes.carta.products.forEach(c => { if (c.inventoryId && !antes.inv.some(i => i.id === c.inventoryId)) rotosAntes.push(c.name); });
  console.log('(Antes del cambio había', rotosAntes.length, 'enlace(s) roto(s) en la carta:', rotosAntes.join(', ') || '-', ')');
  // ¿cambió el historial de ventas?
  const salesDespues = rd('sales.json', []);
  console.log('Historial de ventas intacto:', JSON.stringify(sales) === JSON.stringify(salesDespues) ? 'sí (idéntico)' : 'NO');
})();
