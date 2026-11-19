/**
 * Busca productos duplicados en el inventario de un negocio a partir de un RESPALDO descargado (solo lee, no cambia nada).
 *
 *   node scripts/analizar-duplicados.js <respaldo.json.gz> [nombre-o-slug-del-negocio]   (por defecto: deli-combos)
 *
 * Muestra:
 *   1. IDÉNTICOS: mismo nombre (sin importar mayúsculas ni espacios de los lados). Aquí el sistema usa UNO SOLO, el último de la lista:
 *      si ese está en cero con control de stock, la factura dice "agotado" aunque el otro tenga existencias.
 *   2. PARECIDOS: casi el mismo nombre (tildes, símbolos, orden de palabras, una letra de más).
 *   3. Productos de la carta cuyo inventario está agotado (bloquean pedidos y facturas).
 */
const fs = require('fs');
const zlib = require('zlib');

const file = process.argv[2];
const quien = (process.argv[3] || 'deli-combos').toLowerCase();
if (!file || !fs.existsSync(file)) { console.error('Uso: node scripts/analizar-duplicados.js <respaldo.json.gz> [negocio]'); process.exit(1); }

let raw = fs.readFileSync(file);
try { raw = zlib.gunzipSync(raw); } catch { /* ya viene sin comprimir */ }
let p; try { p = JSON.parse(raw.toString()); } catch { console.error('No pude leer el respaldo (si está cifrado no se puede abrir sin la clave).'); process.exit(1); }
const files = p.files || {};
const biz = JSON.parse(files['businesses.json'] || '[]').find(b => String(b.slug).toLowerCase() === quien || String(b.name).toLowerCase().includes(quien));
if (!biz) { console.error('No encontré ese negocio. Hay:', JSON.parse(files['businesses.json'] || '[]').map(b => b.slug).join(', ')); process.exit(1); }
const get = (n, d) => { try { return JSON.parse(files[`${biz.id}/${n}`]); } catch { return d; } };
const inv = get('inventory.json', []), sales = get('sales.json', []), carta = get('carta.json', null);

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const STOP = new Set(['de', 'la', 'el', 'con', 'y', 'en', 'ml', 'x', 'del', 'los', 'las', 'un', 'una']);
const tokens = (s) => new Set(norm(s).split(' ').filter(t => t && !STOP.has(t)).map(t => t.replace(/s$/, '')));
const jaccard = (a, b) => { const A = tokens(a), B = tokens(b); if (!A.size || !B.size) return 0; let i = 0; for (const t of A) if (B.has(t)) i++; return i / (A.size + B.size - i); };

const usos = new Map(); // cuántas veces se vendió cada nombre / id
for (const s of sales) for (const it of s.items || []) {
  const k = String(it.name || '').toLowerCase().trim(); usos.set('n:' + k, (usos.get('n:' + k) || 0) + (Number(it.qty) || 1));
  if (it.inventoryId) usos.set('i:' + it.inventoryId, (usos.get('i:' + it.inventoryId) || 0) + (Number(it.qty) || 1));
}
const bloquea = (i) => !i.noStock && (Number(i.stock) || 0) <= 0;
const fila = (i, extra = '') => `   - "${i.name}" · ${i.category || '-'} · $${i.salePrice || 0} · stock ${i.stock ?? 0}${i.noStock ? ' (sin control)' : ''}${bloquea(i) ? '  ⛔ BLOQUEA (agotado)' : ''}${i.imageUrl ? ' · con foto' : ''} · ventas: ${usos.get('i:' + i.id) || 0}/${usos.get('n:' + String(i.name).toLowerCase().trim()) || 0}  [id ${String(i.id).slice(0, 8)}, creado ${String(i.createdAt || '').slice(0, 10)}]${extra}`;

console.log(`Negocio: ${biz.name} · respaldo del ${new Date(p.createdAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · ${inv.length} productos en inventario, ${sales.length} ventas`);

// 1) IDÉNTICOS (así los busca el sistema: minúsculas y sin espacios en los extremos)
const porClave = new Map();
inv.forEach((i, idx) => { const k = String(i.name).toLowerCase().trim(); (porClave.get(k) || porClave.set(k, []).get(k)).push({ i, idx }); });
const identicos = [...porClave.values()].filter(g => g.length > 1);
console.log(`\n=== 1) NOMBRES IDÉNTICOS: ${identicos.length} grupo(s) ===`);
for (const g of identicos) {
  const ultimo = g[g.length - 1];
  console.log(` • "${g[0].i.name}" aparece ${g.length} veces. El sistema usa el ÚLTIMO de la lista:`);
  for (const x of g) console.log(fila(x.i, x === ultimo ? '   ← el que usa el sistema' : ''));
  if (bloquea(ultimo.i) && g.some(x => !bloquea(x.i))) console.log('   ⚠️  El que usa el sistema está agotado y el otro NO: por eso no deja facturar.');
}

// 2) PARECIDOS (no idénticos para el sistema, pero se ven repetidos)
const vistos = new Set(identicos.flat().map(x => x.i.id)); const par = [];
for (let a = 0; a < inv.length; a++) for (let b = a + 1; b < inv.length; b++) {
  const A = inv[a], B = inv[b];
  if (String(A.name).toLowerCase().trim() === String(B.name).toLowerCase().trim()) continue;
  const igual = norm(A.name) === norm(B.name), sim = jaccard(A.name, B.name);
  if (igual || sim >= 0.8) par.push([A, B, igual ? 'solo cambian tildes, símbolos o espacios' : `se parecen un ${Math.round(sim * 100)}%`]);
}
console.log(`\n=== 2) NOMBRES PARECIDOS: ${par.length} pareja(s) ===`);
for (const [A, B, why] of par) { console.log(` • ${why}:`); console.log(fila(A)); console.log(fila(B)); }

// 3) Carta vs inventario
if (carta && Array.isArray(carta.products)) {
  const byName = new Map(); inv.forEach(i => byName.set(String(i.name).toLowerCase().trim(), i)); // igual que el sistema: gana el último
  const sinInv = [], agot = [];
  for (const pr of carta.products) { const i = byName.get(String(pr.name).toLowerCase().trim()); if (!i) sinInv.push(pr.name); else if (bloquea(i)) agot.push(pr.name); }
  console.log(`\n=== 3) CARTA ===\n productos de la carta: ${carta.products.length} · sin producto en inventario con ese nombre: ${sinInv.length}${sinInv.length ? ' → ' + sinInv.slice(0, 12).join(', ') + (sinInv.length > 12 ? '…' : '') : ''}`);
  console.log(` agotados por inventario (no se pueden pedir ni facturar): ${agot.length}`);
}
console.log('\nLeyenda de "ventas: A/B": A = veces vendido con ESE inventario; B = veces vendido con ese nombre.');
