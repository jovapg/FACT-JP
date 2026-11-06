/**
 * services/cartaService.js — Carta digital y pedidos en línea (domicilios)
 *
 * Archivos por negocio:
 *   carta.json   → { settings, categories[], products[] }
 *   pedidos.json → pedidos que llegan de la carta pública
 *
 * Producto: { id, categoryId, name, description, price, active, soldOut, groups[] }
 * Grupo de opciones (dentro de cada producto):
 *   type 'one'  → escoge UNA opción (puede sumar precio)         p. ej. Asado / Apanado
 *   type 'many' → escoge varias, máximo `max`, cada una suma     p. ej. Salsas
 *   type 'qty'  → cada opción lleva cantidad; se vende como LÍNEA APARTE (adiciones, bebidas)
 *
 * El servidor SIEMPRE recalcula los precios; nunca confía en el total que manda el cliente.
 */

const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, getBusinessPath } = require('./fileStorage');

const cartaPath   = (id) => path.join(getBusinessPath(id), 'carta.json');
const pedidosPath = (id) => path.join(getBusinessPath(id), 'pedidos.json');

const EXPIRE_MIN = 15;                       // minutos para confirmar un pedido nuevo
const KEEP_EXPIRED_MS = 24 * 3600 * 1000;    // los vencidos se conservan 1 día
const STATES = ['por_confirmar', 'pendiente', 'en_preparacion', 'en_camino', 'entregado', 'cancelado', 'vencido'];

const txt = (v, max, fb = '') => String(v ?? '').trim().slice(0, max) || fb;
const num = (v) => Math.max(0, Math.round(Number(v) || 0));

// ───────────────────────── Carta por defecto: Deli-Combos ─────────────────────────

const opt = (name, price = 0) => ({ id: uuidv4(), name, price });

function defaultCarta() {
  const prep   = () => ({ id: uuidv4(), name: 'Preparación', type: 'one', required: true, options: [opt('Asado'), opt('Apanado')] });
  const prepEntero = () => ({ id: uuidv4(), name: 'Preparación', type: 'one', required: true,
    options: [opt('Asado'), opt('Apanado', 2000), opt('Mitad y mitad', 3000)] });
  const salsas = (n) => ({ id: uuidv4(), name: 'Salsas', type: 'many', required: false, max: n,
    options: [opt('BBQ dulce'), opt('Miel mostaza dulce'), opt('Rosada'), opt('Roja')] });
  const adiciones = () => ({ id: uuidv4(), name: 'Adiciones', type: 'qty', options: [
    opt('Papa francesa', 6000), opt('Ensalada', 6000), opt('Papa al vapor x5', 2000), opt('Arepa x5', 2000), opt('Arroz', 3000)] });
  const bebidas = () => ({ id: uuidv4(), name: 'Bebidas', type: 'qty', options: [
    opt('Coca-Cola 400 ml', 6000), opt('Manzana 400 ml', 6000),
    { ...opt('Cerveza Águila 330 ml', 6000), alcohol: true },
    { ...opt('Cerveza Pilsen 330 ml', 6000), alcohol: true },
    { ...opt('Cerveza Míticas 330 ml', 6000), alcohol: true }] });

  const cats = [
    { key: 'presa',   name: 'Presa, papa y arepa',     extras: true },
    { key: 'personal',name: 'Combo personal',          extras: true },
    { key: 'compartir',name: 'Para compartir',         extras: true },
    { key: 'desayuno',name: 'Desayunos',               extras: false },
    { key: 'consome', name: 'Consomés',                extras: false },
    { key: 'alitas',  name: 'Alitas y más',            extras: true },
    { key: 'adicion', name: 'Adiciones',               extras: false },
    { key: 'fritos',  name: 'Fritos',                  extras: false },
    { key: 'calientes',name: 'Calientes y jugos',      extras: false },
    { key: 'bebidas', name: 'Gaseosas y cervezas',     extras: false }
  ].map((c, i) => ({ id: uuidv4(), order: i, ...c }));
  const cid = Object.fromEntries(cats.map(c => [c.key, c.id]));

  // [categoría, nombre, descripción, precio, tipo de opciones]
  //   tipo: 'p' preparación · 'e' preparación pollo entero · 's6/s12/..' salsas · '' sin opciones
  const rows = [
    ['presa', 'Ala', 'Presa de ala, papa y arepa', 6000, 'p'],
    ['presa', '2 alas', 'Dos alas, papa y arepa', 10000, 'p'],
    ['presa', 'Muslo', 'Muslo, papa y arepa', 7000, 'p'],
    ['presa', '3 muslos', 'Tres muslos, papa y arepa', 20000, 'p'],
    ['presa', 'Contramuslo', 'Contramuslo, papa y arepa', 8000, 'p'],
    ['presa', 'Pechuga', 'Pechuga, papa y arepa', 10000, 'p'],

    ['personal', 'Combo personal ala', 'Ala, papas francesas, ensalada dulce y arepa', 11000, 'p'],
    ['personal', 'Combo personal 2 alas', 'Dos alas, papas francesas, ensalada dulce y arepa', 16000, 'p'],
    ['personal', 'Combo personal muslo', 'Muslo, papas francesas, ensalada dulce y arepa', 13000, 'p'],
    ['personal', 'Combo personal contramuslo', 'Contramuslo, papas francesas, ensalada dulce y arepa', 15000, 'p'],
    ['personal', 'Combo personal pechuga', 'Pechuga, papas francesas, ensalada dulce y arepa', 16000, 'p'],

    ['compartir', '¼ de pollo (ala y pechuga)', 'Ala y pechuga', 15000, 'p'],
    ['compartir', '¼ de pollo (muslo y contramuslo)', 'Muslo y contramuslo', 15000, 'p'],
    ['compartir', 'Tragón con papa al vapor', 'Papa al vapor, arepa y consomé', 20000, 'p'],
    ['compartir', 'Tragón con papas francesas', 'Papas francesas, arepa y ensalada dulce', 20000, 'p'],
    ['compartir', 'Comelón', 'Combo Comelón', 25000, 'p'],
    ['compartir', '½ pollo', 'Medio pollo', 26000, 'p'],
    ['compartir', '½ pollo con consomé y ensalada', 'Medio pollo con consomé y ensalada', 34000, 'p'],
    ['compartir', 'Pollo entero', 'Pollo entero', 45000, 'e'],
    ['compartir', 'Delicombo recargado', 'El combo más completo de la casa', 55000, 'p'],

    ['desayuno', 'Desayuno opción 1', 'Disponible de 7 a 11 am', 9000, ''],
    ['desayuno', 'Desayuno opción 2', 'Disponible de 7 a 11 am', 10000, ''],
    ['desayuno', 'Desayuno opción 3', 'Disponible de 7 a 11 am', 12000, ''],
    ['desayuno', 'Desayuno opción 4', 'Disponible de 7 a 11 am', 14000, ''],

    ['consome', 'Consomé de pollo', '', 8000, ''],
    ['consome', 'Consomé de pescado', '', 8000, ''],

    ['alitas', 'Alitas x6', 'Con 1 salsa', 18000, 's1'],
    ['alitas', 'Alitas x12', 'Hasta 2 salsas', 30000, 's2'],
    ['alitas', 'Alitas x18', 'Hasta 3 salsas', 42000, 's3'],
    ['alitas', 'Alitas x24', 'Hasta 4 salsas', 52000, 's4'],
    ['alitas', 'Deditos', 'Deditos de pollo', 18000, ''],
    ['alitas', 'Pop corn de pollo', '', 18000, ''],

    ['adicion', 'Papa francesa', '', 6000, ''],
    ['adicion', 'Ensalada', '', 6000, ''],
    ['adicion', 'Papa al vapor x5', '', 2000, ''],
    ['adicion', 'Arepa x5', '', 2000, ''],
    ['adicion', 'Arroz', '', 3000, ''],

    ['fritos', 'Panzerotis', '', 4800, ''],
    ['fritos', 'Pastel de pollo', '', 4500, ''],
    ['fritos', 'Desmechada', '', 3500, ''],
    ['fritos', 'Palito de puro queso', '', 4500, ''],
    ['fritos', 'Empanada de iglesia', 'Una unidad', 700, ''],
    ['fritos', 'Empanadas de iglesia x3', 'Tres unidades', 2000, ''],

    ['calientes', 'Tinto', '', 1500, ''],
    ['calientes', 'Perico', '', 2000, ''],
    ['calientes', 'Café con leche', '', 3000, ''],
    ['calientes', 'Milo', '', 4000, ''],
    ['calientes', 'Jarra de Milo', '', 8000, ''],
    ['calientes', 'Chocolate en agua', '', 3000, ''],
    ['calientes', 'Chocolate en leche', '', 3500, ''],
    ['calientes', 'Jugo en agua', '', 4500, ''],
    ['calientes', 'Jugo en leche', '', 6000, ''],

    ['bebidas', 'Coca-Cola 400 ml', '', 6000, ''],
    ['bebidas', 'Manzana 400 ml', '', 6000, ''],
    ['bebidas', 'Cerveza Águila 330 ml', 'Solo mayores de 18 años', 6000, ''],
    ['bebidas', 'Cerveza Pilsen 330 ml', 'Solo mayores de 18 años', 6000, ''],
    ['bebidas', 'Cerveza Míticas 330 ml', 'Solo mayores de 18 años', 6000, '']
  ];

  const extrasOf = Object.fromEntries(cats.map(c => [c.key, c.extras]));
  const products = rows.map(([cat, name, description, price, kind], i) => {
    const groups = [];
    if (kind === 'p') groups.push(prep());
    if (kind === 'e') groups.push(prepEntero());
    if (/^s\d$/.test(kind)) groups.push(salsas(Number(kind.slice(1))));
    if (extrasOf[cat]) { groups.push(adiciones()); groups.push(bebidas()); }
    const isBeer = /cerveza/i.test(name);
    return { id: uuidv4(), categoryId: cid[cat], order: i, name, description, price, active: true, soldOut: false,
      ...(isBeer ? { alcohol: true } : {}), groups };
  });

  return {
    settings: {
      enabled: true,
      open: true,            // abierto / cerrado (lo cambia quien atiende)
      paused: false,         // "pausar pedidos" temporalmente
      whatsapp: '573012408505', // NÚMERO DE PRUEBA — cambiar por el real antes de lanzar
      pickup: true,          // permite "recoger en el local"
      freeDeliveryFrom: 100000,
      hours: '',
      welcome: ''
    },
    categories: cats.map(({ key, ...c }) => c),
    products
  };
}

// ───────────────────────── Lectura / escritura ─────────────────────────

async function readCarta(businessId) { return await readJSON(cartaPath(businessId)); }
async function writeCarta(businessId, carta) { await writeJSON(cartaPath(businessId), carta); }

/** Lee pedidos aplicando vencimiento (15 min) y limpieza (vencidos > 1 día). Guarda si cambió algo. */
async function readPedidos(businessId) {
  let list = await readJSON(pedidosPath(businessId)) || [];
  const now = Date.now();
  let changed = false;
  for (const p of list) {
    if (p.status === 'por_confirmar' && new Date(p.expiresAt).getTime() < now) {
      p.status = 'vencido'; p.updatedAt = new Date().toISOString(); changed = true;
    }
  }
  const before = list.length;
  list = list.filter(p => !(p.status === 'vencido' && now - new Date(p.expiresAt).getTime() > KEEP_EXPIRED_MS));
  if (list.length !== before) changed = true;
  if (changed) await writeJSON(pedidosPath(businessId), list);
  return list;
}
async function writePedidos(businessId, list) { await writeJSON(pedidosPath(businessId), list); }

const fs = require('fs');
const counterPath = (id) => path.join(getBusinessPath(id), 'pedidos-counter.json');

/**
 * Número de pedido consecutivo: D-DC01 (D = domicilio, R = recoger; DC = prefijo del negocio; 01 = consecutivo).
 * Cada tipo lleva su propio contador y nunca se repite. Se lee y se guarda de forma SÍNCRONA para que dos
 * pedidos que llegan a la vez no reciban el mismo número.
 */
function nextCode(businessId, mode, prefix) {
  const letter = mode === 'recoger' ? 'R' : 'D';
  let c = {};
  try { c = JSON.parse(fs.readFileSync(counterPath(businessId), 'utf8')) || {}; } catch { c = {}; }
  c[letter] = (Number(c[letter]) || 0) + 1;
  fs.mkdirSync(path.dirname(counterPath(businessId)), { recursive: true });
  fs.writeFileSync(counterPath(businessId), JSON.stringify(c));
  const pre = String(prefix || 'DC').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'DC';
  return `${letter}-${pre}${String(c[letter]).padStart(2, '0')}`;
}

/** (antiguo) Código corto aleatorio tipo A47 */
function newCode(list) {
  const used = new Set(list.map(p => p.code));
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (let i = 0; i < 200; i++) {
    const c = L[Math.floor(Math.random() * L.length)] + String(Math.floor(Math.random() * 90) + 10);
    if (!used.has(c)) return c;
  }
  return 'Z' + String(Date.now()).slice(-3);
}

// ───────────────────────── Cálculo del pedido (servidor) ─────────────────────────

/**
 * Convierte lo que eligió el cliente en líneas con precio verificado.
 * @returns { lines, subtotal } o lanza Error con mensaje para el cliente.
 * Cada línea: { productId, name, qty, unitPrice, total, choices:[texto], note, kind:'producto'|'adicion' }
 */
function priceOrder(carta, rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new Error('El pedido está vacío');
  if (rawItems.length > 40) throw new Error('Demasiados productos en el pedido');
  const byId = new Map(carta.products.map(p => [p.id, p]));
  const lines = [];

  for (const it of rawItems) {
    const p = byId.get(String(it.productId));
    if (!p || !p.active) throw new Error('Un producto de tu pedido ya no está disponible');
    if (p.soldOut) throw new Error(`"${p.name}" está agotado`);
    const qty = Math.min(50, Math.max(1, Math.floor(Number(it.qty) || 1)));
    let unit = p.price;
    const picked = [];
    const extras = [];
    const sel = (it.choices && typeof it.choices === 'object') ? it.choices : {};

    for (const g of p.groups || []) {
      const chosen = Array.isArray(sel[g.id]) ? sel[g.id] : [];
      if (g.type === 'one') {
        if (chosen.length > 1) throw new Error(`En "${p.name}" escoge solo una opción de ${g.name}`);
        if (g.required && chosen.length !== 1) throw new Error(`En "${p.name}" falta escoger: ${g.name}`);
        if (chosen[0]) {
          const o = g.options.find(x => x.id === String(chosen[0].optionId ?? chosen[0]));
          if (!o) throw new Error(`Opción no válida en "${p.name}"`);
          unit += o.price; picked.push(o.name);
        }
      } else if (g.type === 'many') {
        const ids = [...new Set(chosen.map(c => String(c.optionId ?? c)))];
        if (g.max && ids.length > g.max) throw new Error(`En "${p.name}" máximo ${g.max} en ${g.name}`);
        for (const id of ids) {
          const o = g.options.find(x => x.id === id);
          if (!o) throw new Error(`Opción no válida en "${p.name}"`);
          unit += o.price; picked.push(o.name);
        }
      } else if (g.type === 'qty') {
        for (const c of chosen) {
          const o = g.options.find(x => x.id === String(c.optionId));
          const q = Math.min(20, Math.floor(Number(c.qty) || 0));
          if (!o || q <= 0) continue;
          extras.push({ productId: p.id, name: o.name, qty: q * qty, unitPrice: o.price, total: o.price * q * qty,
            kind: 'adicion', alcohol: !!o.alcohol, parentName: p.name });
        }
      }
    }

    lines.push({ productId: p.id, name: p.name, qty, unitPrice: unit, total: unit * qty, choices: picked,
      note: txt(it.note, 140), kind: 'producto', alcohol: !!p.alcohol });
    lines.push(...extras);
  }
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  return { lines, subtotal };
}

module.exports = {
  cartaPath, pedidosPath, EXPIRE_MIN, STATES, txt, num,
  defaultCarta, readCarta, writeCarta, readPedidos, writePedidos, newCode, nextCode, priceOrder, counterPath
};
