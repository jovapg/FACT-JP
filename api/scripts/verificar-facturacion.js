/**
 * Pregunta al servidor REAL (sus propias funciones) si dejaría facturar cada producto del menú de un negocio, a partir de un RESPALDO. Solo lee.
 *   node scripts/verificar-facturacion.js <respaldo.json.gz> [filtro-de-nombres]
 * Muestra, por producto: si el botón de la pantalla está activo, si el servidor lo deja facturar y qué ve el cliente en la carta.
 */
const fs = require('fs'), zlib = require('zlib'), os = require('os'), path = require('path');
const REPO = path.join(__dirname, '../src/services/');
const backup = process.argv[2];
const p = JSON.parse(zlib.gunzipSync(fs.readFileSync(backup)).toString());

// 1) restaurar el respaldo en una carpeta temporal (no toca nada real)
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verif-fact-'));
for (const [rel, text] of Object.entries(p.files)) { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); }
process.env.DATA_PATH = dir; process.env.STORAGE_ENGINE = 'json';
const { findOutOfStockItems } = require(REPO + 'inventoryService.js');
const carta = require(REPO + 'cartaService.js');

const biz = JSON.parse(p.files['businesses.json']).find(b => b.slug === 'deli-combos');
const get = (n, d) => { try { return JSON.parse(p.files[`${biz.id}/${n}`]); } catch { return d; } };
const inv = get('inventory.json', []), recipes = get('recipes.json', []), cartaData = get('carta.json', { products: [] }), sales = get('sales.json', []);
const low = (s) => String(s).toLowerCase().trim();
const invByName = new Map(); inv.forEach(i => invByName.set(low(i.name), i)); // el sistema usa el último con ese nombre
const invById = new Map(inv.map(i => [i.id, i]));
const vendidos = (n) => sales.reduce((a, s) => a + (s.items || []).filter(i => low(i.name) === low(n)).reduce((x, i) => x + (Number(i.qty) || 1), 0), 0);

(async () => {
  const soldOut = await carta.stockCheck(biz.id); // lo que ve el cliente en la carta pública (agotado por inventario)
  const filas = [];
  // Productos del menú de Registrar venta (recetas)
  for (const r of recipes.filter(x => x.available)) {
    const i = invByName.get(low(r.name));
    const botonBloqueado = i ? (!i.noStock && (i.stock || 0) <= 0) : !!(r.ingredients || []).map(g => invById.get(g.inventoryId)).find(x => x && !x.noStock && (x.stock || 0) <= 0);
    const fuera = await findOutOfStockItems(biz.id, [{ recipeId: r.id, name: r.name, price: r.price, qty: 1 }]);
    filas.push({ nombre: r.name, origen: 'menú', precio: i ? i.salePrice : r.price, inv: i ? `stock ${i.stock}${i.noStock ? ' (sin control)' : ''}` : 'sin inventario con ese nombre', pantalla: !botonBloqueado, servidor: fuera.length === 0, msg: fuera.join(', '), vendidos: vendidos(r.name), carta: cartaData.products.some(c => low(c.name) === low(r.name)) ? (soldOut(r.name) ? 'agotado' : 'disponible') : '—' });
  }
  // Productos de la carta pública que NO están en el menú de ventas
  const enMenu = new Set(recipes.map(r => low(r.name)));
  for (const c of cartaData.products.filter(x => !enMenu.has(low(x.name)))) {
    const i = invByName.get(low(c.name));
    filas.push({ nombre: c.name, origen: 'solo carta', precio: c.price, inv: i ? `stock ${i.stock}${i.noStock ? ' (sin control)' : ''}` : 'sin inventario con ese nombre', pantalla: null, servidor: null, msg: '', vendidos: vendidos(c.name), carta: soldOut(c.name) ? 'agotado' : 'disponible' });
  }
  const pat = new RegExp(process.argv[3] || 'pollo|trag|consom|papito|agua brisa|^agua', 'i');
  const casos = filas.filter(f => pat.test(f.nombre));
  const ok = (v) => (v === null ? '  —  ' : v ? '  SÍ ' : '  NO ');
  console.log('PRODUCTO'.padEnd(46), 'ORIGEN'.padEnd(10), 'PRECIO'.padEnd(7), 'VEND'.padEnd(5), 'PANTALLA', 'SERVIDOR', 'CARTA'.padEnd(11), 'INVENTARIO');
  for (const f of casos) console.log(('"' + f.nombre + '"').padEnd(46), f.origen.padEnd(10), String(f.precio).padEnd(7), String(f.vendidos).padEnd(5), ok(f.pantalla).padEnd(8), ok(f.servidor).padEnd(8), f.carta.padEnd(11), f.inv + (f.msg ? '  <- ' + f.msg : ''));
  const bloqueados = filas.filter(f => f.servidor === false);
  console.log(`\nTotal del menú: ${filas.filter(f => f.origen === 'menú').length} productos · NO dejan facturar: ${bloqueados.length}`);
  const diferentes = filas.filter(f => f.pantalla !== null && f.pantalla !== f.servidor);
  console.log('Casos donde la pantalla y el servidor NO coinciden:', diferentes.length ? diferentes.map(d => d.nombre).join(' | ') : 'ninguno');
})();
