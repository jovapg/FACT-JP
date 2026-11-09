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
const { readJSON, writeJSON, getBusinessPath, collection } = require('./fileStorage');
const drinksLib = require('./drinks');
const { SNACK_SECTIONS } = require('./snacks');

const cartaPath   = (id) => path.join(getBusinessPath(id), 'carta.json');
const pedidosPath = (id) => path.join(getBusinessPath(id), 'pedidos.json');

const EXPIRE_MIN = 15;                       // minutos para confirmar un pedido nuevo
const KEEP_EXPIRED_MS = 24 * 3600 * 1000;    // los vencidos se conservan 1 día
const STATES = ['por_confirmar', 'pendiente', 'en_preparacion', 'en_camino', 'entregado', 'cancelado', 'vencido'];

const txt = (v, max, fb = '') => String(v ?? '').trim().slice(0, max) || fb;
const num = (v) => Math.max(0, Math.round(Number(v) || 0));

// ───────────────────────── Carta por defecto: Deli-Combos ─────────────────────────

const opt = (name, price = 0) => ({ id: uuidv4(), name, price });

// ───────────────────────── Datos de Deli-Combos y actualizaciones de la carta ─────────────────────────

const DRINKS_VERSION = 2;     // 2 = lista real de bebidas
const SETTINGS_VERSION = 1;   // 1 = datos reales del negocio (WhatsApp, horario, dirección, transferencia, domicilio por km)

const DEFAULT_SETTINGS = {
  whatsapp: '573225660214',
  address: 'Barro Blanco, sector Juancho Polo, Santa Elena',
  hours: 'Todos los días de 7:00 am a 8:00 pm. No abrimos el primer día hábil de la semana (el lunes; si es festivo, cerramos el martes).',
  openFrom: '07:00',
  openTo: '20:00',
  bankInfo: 'BBVA · Llave: @bbva3012767185',
  deliveryNote: 'Domicilio a todas las veredas de Santa Elena: $2.500 por kilómetro recorrido.',
  deliveryPerKm: 2500
};

/** Reemplaza las bebidas por la lista real: categorías, productos sueltos y el desplegable de los combos */
function applyDrinks(c) {
  const oldCats = c.categories.filter(x => ['Gaseosas y cervezas', ...drinksLib.SECTIONS].includes(x.name));
  const oldIds = new Set(oldCats.map(x => x.id));
  c.categories = c.categories.filter(x => !oldIds.has(x.id));
  c.products = c.products.filter(p => !oldIds.has(p.categoryId));
  let order = c.categories.reduce((m, x) => Math.max(m, x.order), -1) + 1;
  const catId = {};
  for (const s of drinksLib.SECTIONS) { catId[s] = uuidv4(); c.categories.push({ id: catId[s], name: s, order: order++, extras: false, group: 'Bebidas' }); }
  let pOrder = c.products.reduce((m, p) => Math.max(m, p.order), -1) + 1;
  for (const d of drinksLib.drinks()) c.products.push({
    id: uuidv4(), categoryId: catId[d.section], order: pOrder++, name: d.name, description: d.note || (d.alcohol ? 'Solo mayores de 18 años' : ''),
    price: d.price, active: true, soldOut: false, ...(d.alcohol ? { alcohol: true } : {}), groups: []
  });
  // El desplegable "Bebidas" de cada combo
  for (const p of c.products) for (const g of p.groups || []) if (g.type === 'qty' && g.name === 'Bebidas') {
    g.options = drinksLib.drinkOptions(); g.collapsed = true;
  }
  c.drinksVersion = DRINKS_VERSION;
}

const SNACKS_VERSION = 1;    // 1 = papas, snacks, pasteles, galletas y chicles

/** Agrega las categorías de snacks (antes de las bebidas) sin tocar nada de lo que ya existe */
function applySnacks(c) {
  const have = new Set(c.categories.map(x => x.name));
  const drinkOrders = c.categories.filter(x => drinksLib.SECTIONS.includes(x.name)).map(x => x.order);
  let order = (drinkOrders.length ? Math.min(...drinkOrders) : c.categories.reduce((m, x) => Math.max(m, x.order), -1) + 1) - 0.5;
  let pOrder = c.products.reduce((m, p) => Math.max(m, p.order), -1) + 1;
  for (const [name, items] of SNACK_SECTIONS) {
    if (have.has(name)) continue; // ya estaba: no se duplica
    const id = uuidv4();
    c.categories.push({ id, name, order: order, extras: false });
    order += 0.1;
    for (const [pn, price] of items) c.products.push({ id: uuidv4(), categoryId: id, order: pOrder++, name: pn, description: '', price, active: true, soldOut: false, groups: [] });
  }
  c.snacksVersion = SNACKS_VERSION;
}

/** Pone al día una carta guardada. Devuelve true si cambió algo (y entonces se guarda). */
function migrateCarta(c) {
  let changed = false;
  if (c.drinksVersion !== DRINKS_VERSION) { applyDrinks(c); changed = true; }
  if (c.snacksVersion !== SNACKS_VERSION) { applySnacks(c); changed = true; }
  // Las categorías de bebidas se juntan en un solo botón del menú ("grupo"); las cartas viejas no lo tenían
  for (const cat of c.categories) if (!cat.group && drinksLib.SECTIONS.includes(cat.name)) { cat.group = 'Bebidas'; changed = true; }
  if (c.settingsVersion !== SETTINGS_VERSION) {
    const s = c.settings || (c.settings = {});
    // Solo se reemplaza el número de PRUEBA; lo demás se llena si estaba vacío (no pisa lo que el admin ya escribió)
    if (!s.whatsapp || s.whatsapp === '573012408505') s.whatsapp = DEFAULT_SETTINGS.whatsapp;
    for (const k of ['address', 'hours', 'openFrom', 'openTo', 'bankInfo', 'deliveryNote', 'deliveryPerKm']) {
      if (s[k] === undefined || s[k] === '' || s[k] === null) s[k] = DEFAULT_SETTINGS[k];
    }
    c.settingsVersion = SETTINGS_VERSION;
    changed = true;
  }
  return changed;
}


function defaultCarta() {
  const prep   = () => ({ id: uuidv4(), name: 'Preparación', type: 'one', required: true, options: [opt('Asado'), opt('Apanado')] });
  const prepEntero = () => ({ id: uuidv4(), name: 'Preparación', type: 'one', required: true,
    options: [opt('Asado'), opt('Apanado', 2000), opt('Mitad y mitad', 3000)] });
  const salsas = (n) => ({ id: uuidv4(), name: 'Salsas', type: 'many', required: false, max: n,
    options: [opt('BBQ dulce'), opt('Miel mostaza dulce'), opt('Rosada'), opt('Roja')] });
  const adiciones = () => ({ id: uuidv4(), name: 'Adiciones', type: 'qty', options: [
    opt('Papa francesa', 6000), opt('Ensalada', 6000), opt('Papa al vapor x5', 2000), opt('Arepa x5', 2000), opt('Arroz', 3000)] });
  const bebidas = () => ({ id: uuidv4(), name: 'Bebidas', type: 'qty', collapsed: true, options: drinksLib.drinkOptions() });

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
    ...drinksLib.SECTIONS.map(n => ({ key: 'bb:' + n, name: n, extras: false, group: 'Bebidas' }))
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
    ['calientes', 'Jugo en leche', '', 6000, '']
  ];

  for (const d of drinksLib.drinks()) rows.push(['bb:' + d.section, d.name, d.note || (d.alcohol ? 'Solo mayores de 18 años' : ''), d.price, '', d.alcohol]);

  const extrasOf = Object.fromEntries(cats.map(c => [c.key, c.extras]));
  const products = rows.map(([cat, name, description, price, kind, alcohol], i) => {
    const groups = [];
    if (kind === 'p') groups.push(prep());
    if (kind === 'e') groups.push(prepEntero());
    if (/^s\d$/.test(kind)) groups.push(salsas(Number(kind.slice(1))));
    if (extrasOf[cat]) { groups.push(adiciones()); groups.push(bebidas()); }
    return { id: uuidv4(), categoryId: cid[cat], order: i, name, description, price, active: true, soldOut: false,
      ...(alcohol ? { alcohol: true } : {}), groups };
  });

  const carta = {
    settings: {
      enabled: true,
      open: true,            // abierto / cerrado (lo cambia quien atiende)
      paused: false,         // "pausar pedidos" temporalmente
      whatsapp: DEFAULT_SETTINGS.whatsapp,
      pickup: true,          // permite "recoger en el local"
      freeDeliveryFrom: 100000,
      hours: DEFAULT_SETTINGS.hours,
      openFrom: DEFAULT_SETTINGS.openFrom, openTo: DEFAULT_SETTINGS.openTo,   // horario de pedidos (hora de Colombia)
      address: DEFAULT_SETTINGS.address,
      bankInfo: DEFAULT_SETTINGS.bankInfo,
      deliveryNote: DEFAULT_SETTINGS.deliveryNote, deliveryPerKm: DEFAULT_SETTINGS.deliveryPerKm,
      welcome: ''
    },
    categories: cats.map(({ key, ...c }) => c),
    products,
    drinksVersion: DRINKS_VERSION, settingsVersion: SETTINGS_VERSION
  };
  applySnacks(carta);
  return carta;
}

// ───────────────────────── Lectura / escritura ─────────────────────────

/**
 * Registra en el INVENTARIO todos los productos de la carta (stock 0, para que el negocio lo cuadre) y los enlaza:
 * así, al facturar un pedido, el stock de cada producto baja solo. No duplica: si ya existe un ítem con el mismo
 * nombre lo reutiliza. Las bebidas y adiciones de los combos usan los mismos ítems (mismo nombre).
 * @returns { created, linked, total }
 */
async function syncInventory(businessId) {
  const c = await readCarta(businessId);
  if (!c) throw new Error('Este negocio no tiene carta');
  const invPath = path.join(getBusinessPath(businessId), 'inventory.json');
  const inv = await readJSON(invPath) || [];
  const byName = new Map(inv.map(i => [String(i.name).toLowerCase().trim(), i]));
  const catName = Object.fromEntries(c.categories.map(x => [x.id, x.name]));
  let created = 0, linked = 0;
  for (const p of c.products) {
    const key = p.name.toLowerCase().trim();
    let item = byName.get(key);
    if (!item) {
      item = { id: uuidv4(), name: p.name, unit: 'unidad', stock: 0, cost: 0, category: catName[p.categoryId] || 'general', area: 'bar',
        minStock: 0, supplierId: null, salePrice: p.price, noStock: false, createdAt: new Date().toISOString() };
      inv.push(item); byName.set(key, item); created++;
    }
    if (p.inventoryId !== item.id) { p.inventoryId = item.id; linked++; }
  }
  await writeJSON(invPath, inv);
  await writeJSON(cartaPath(businessId), c);
  return { created, linked, total: c.products.length };
}

/**
 * Disponibilidad según el INVENTARIO: devuelve una función out(nombre) que dice si un producto está agotado
 * (existe en inventario, controla stock y tiene 0 o menos). Lo que no esté en el inventario no se ve afectado.
 */
async function stockCheck(businessId) {
  const inv = await readJSON(path.join(getBusinessPath(businessId), 'inventory.json')) || [];
  const key = (n) => String(n).toLowerCase().trim();
  const out = new Set(inv.filter(i => !i.noStock && (Number(i.stock) || 0) <= 0).map(i => key(i.name)));
  const img = new Map(inv.filter(i => i.imageUrl).map(i => [key(i.name), i.imageUrl]));
  const fn = (name) => out.has(key(name));
  fn.image = (name) => img.get(key(name)) || ''; // foto del producto, la que se sube en Inventario
  return fn;
}

async function readCarta(businessId) {
  const c = await readJSON(cartaPath(businessId));
  if (c && Array.isArray(c.products)) {
    const needSettings = c.settingsVersion !== SETTINGS_VERSION;
    if (migrateCarta(c)) {
      await writeJSON(cartaPath(businessId), c);
      // Dirección y teléfono del negocio salen en las facturas: se llenan solo si estaban vacíos
      if (needSettings) {
        try {
          const pPath = path.join(getBusinessPath(businessId), 'profile.json');
          const prof = await readJSON(pPath);
          if (prof) {
            if (!prof.address) prof.address = DEFAULT_SETTINGS.address;
            if (!prof.phone) prof.phone = DEFAULT_SETTINGS.whatsapp.replace(/^57/, '');
            await writeJSON(pPath, prof);
          }
        } catch { /* no es crítico */ }
      }
    }
  }
  return c;
}

async function writeCarta(businessId, carta) { await writeJSON(cartaPath(businessId), carta); }

// Los pedidos se guardan como FILAS (una por pedido, con fecha y estado indexados): crear o cambiar uno toca una sola fila
// y la pantalla de Pedidos (que consulta cada 10 s) no lee el historial completo.
const pedidosColl = (businessId) => collection(businessId, 'pedidos.json');
const OPEN_STATES = ['por_confirmar', 'pendiente', 'en_preparacion', 'en_camino', 'entregado']; // entregado = por facturar
const RECENT_MS = 48 * 3600 * 1000;   // los cerrados de los últimos 2 días siempre se muestran
const HISTORY_N = 60;                 // y, además, los últimos 60 cerrados

/** Aplica el vencimiento (15 min sin confirmar) y la limpieza (vencidos de más de 1 día). Solo toca lo que cambia. */
function expireStale(businessId) {
  const c = pedidosColl(businessId), now = Date.now();
  for (const p of c.query({ statuses: ['por_confirmar'] })) {
    if (new Date(p.expiresAt).getTime() < now) { p.status = 'vencido'; p.updatedAt = new Date().toISOString(); c.upsert(p); }
  }
  const viejos = c.query({ statuses: ['vencido'] }).filter(p => now - new Date(p.expiresAt).getTime() > KEEP_EXPIRED_MS).map(p => p.id);
  if (viejos.length) c.removeMany(viejos);
}
/** Pedidos en curso (los que faltan por facturar incluidos) */
function openPedidos(businessId) { return pedidosColl(businessId).query({ statuses: OPEN_STATES }); }
/** Lo que necesita la pantalla: todo lo en curso + los cerrados recientes + los últimos cerrados. Más nuevo primero. */
function listPedidos(businessId) {
  expireStale(businessId);
  const c = pedidosColl(businessId);
  const byId = new Map();
  for (const p of c.query({ statuses: OPEN_STATES })) byId.set(p.id, p);
  const closed = ['facturado', 'cancelado', 'vencido'];
  for (const p of c.query({ statuses: closed, fromTs: Date.now() - RECENT_MS })) byId.set(p.id, p);
  // Los últimos cerrados: se piden por estado (cada uno usa su índice, ya ordenado) y se juntan los más recientes
  const ultimos = [];
  for (const st of closed) ultimos.push(...c.query({ statuses: [st], desc: true, limit: HISTORY_N }));
  ultimos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  for (const p of ultimos.slice(0, HISTORY_N)) byId.set(p.id, p);
  return [...byId.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
/** Lee TODOS los pedidos (solo para casos raros: respaldos, reportes). La pantalla usa listPedidos. */
async function readPedidos(businessId) { expireStale(businessId); return pedidosColl(businessId).all(); }
async function writePedidos(businessId, list) { await writeJSON(pedidosPath(businessId), list); }

const fs = require('fs');

/**
 * Carta de EJEMPLO para otra franquicia: los mismos productos de Deli-Combos (se editan precios, agotados y
 * visibilidad), pero SIN sus datos de contacto: WhatsApp, dirección, horario, datos del banco, domicilio.
 */
function sampleCarta(settings = {}) {
  const c = defaultCarta();
  c.settings = { ...c.settings, whatsapp: '', address: '', hours: '', bankInfo: '', deliveryNote: '', deliveryPerKm: 0, openFrom: '', openTo: '', ...settings };
  return c;
}
/** Carta vacía (todavía no hay editor de productos: se llena cargando una de ejemplo) */
function blankCarta(settings = {}) {
  return {
    settings: { enabled: true, open: true, paused: false, pickup: true, freeDeliveryFrom: 0, welcome: '', whatsapp: '', address: '', hours: '',
      bankInfo: '', deliveryNote: '', deliveryPerKm: 0, openFrom: '', openTo: '', ...settings },
    categories: [], products: [], drinksVersion: DRINKS_VERSION, settingsVersion: SETTINGS_VERSION, snacksVersion: SNACKS_VERSION
  };
}

/**
 * Grupos "desde la carta": un grupo de cantidades (bebidas, adiciones) puede armarse a partir de las categorías
 * que se escojan (g.source.categories). Sus opciones se calculan AL MOMENTO con los productos de esas categorías:
 * si cambias el precio o marcas agotada una bebida, cambia en todos los combos, sin repetir la lista en cada uno.
 */
function resolveCarta(c) {
  const byCat = new Map(c.categories.map(x => [x.id, x]));
  return { ...c, products: c.products.map(p => {
    if (!(p.groups || []).some(g => g.source)) return p;
    return { ...p, groups: p.groups.map(g => {
      if (!g.source) return g;
      const cats = (g.source.categories || []).map(id => byCat.get(id)).filter(Boolean).sort((a, b) => a.order - b.order);
      const options = [];
      for (const cat of cats) {
        for (const q of c.products.filter(x => x.categoryId === cat.id && x.active && x.id !== p.id).sort((a, b) => a.order - b.order)) {
          options.push({ id: q.id, name: q.name, price: q.price, section: cats.length > 1 ? cat.name : '', note: q.description || '',
            ...(q.alcohol ? { alcohol: true } : {}), ...(q.soldOut ? { soldOut: true } : {}) });
        }
      }
      return { ...g, options };
    }) };
  }) };
}

/** ¿Ya existe un producto con ese nombre? (el nombre une carta, inventario y precios, por eso no se repite) */
function nameTaken(c, name, exceptId = null) {
  const k = String(name).toLowerCase().trim();
  return c.products.some(p => p.id !== exceptId && p.name.toLowerCase().trim() === k);
}

/** Valida y limpia los grupos de opciones que manda el editor. Lanza Error con un mensaje claro si algo no sirve. */
function cleanGroups(input, c) {
  if (!Array.isArray(input)) return [];
  if (input.length > 8) throw new Error('Máximo 8 grupos de opciones por producto');
  const catIds = new Set(c.categories.map(x => x.id));
  const out = [];
  for (const g of input) {
    const name = txt(g.name, 40);
    if (name.length < 2) throw new Error('Cada grupo de opciones necesita un nombre');
    const type = ['one', 'many', 'qty'].includes(g.type) ? g.type : null;
    if (!type) throw new Error(`El grupo "${name}" tiene un tipo no válido`);
    const clean = { id: g.id && /^[\w-]{8,64}$/.test(String(g.id)) ? String(g.id) : uuidv4(), name, type };
    if (type === 'one') clean.required = !!g.required;
    if (type === 'many') clean.max = Math.min(20, Math.max(1, Math.floor(Number(g.max) || 1)));
    if (type === 'qty' && g.collapsed) clean.collapsed = true;
    if (g.source && Array.isArray(g.source.categories)) {
      if (type !== 'qty') throw new Error(`El grupo "${name}": "desde la carta" solo sirve para cantidades (bebidas, adiciones)`);
      const cats = [...new Set(g.source.categories.map(String))].filter(id => catIds.has(id));
      if (!cats.length) throw new Error(`El grupo "${name}": escoge al menos una categoría de la carta`);
      clean.source = { categories: cats }; clean.options = [];
    } else {
      if (!Array.isArray(g.options) || !g.options.length) throw new Error(`El grupo "${name}" necesita al menos una opción`);
      if (g.options.length > 150) throw new Error(`El grupo "${name}" tiene demasiadas opciones (máx. 150)`);
      const seen = new Set();
      clean.options = g.options.map(o => {
        const on = txt(o.name, 60);
        if (!on) throw new Error(`El grupo "${name}" tiene una opción sin nombre`);
        const id = o.id && /^[\w-]{8,64}$/.test(String(o.id)) && !seen.has(String(o.id)) ? String(o.id) : uuidv4();
        seen.add(id);
        return { id, name: on, price: num(o.price), ...(o.alcohol ? { alcohol: true } : {}), ...(o.section ? { section: txt(o.section, 40) } : {}), ...(o.note ? { note: txt(o.note, 120) } : {}) };
      });
    }
    out.push(clean);
  }
  return out;
}

/** ¿Hay un turno de caja abierto? Los pedidos entran siempre, pero SIN turno abierto no se pueden facturar. */
function hasOpenShift(businessId) {
  try {
    const shifts = JSON.parse(require('./fileStorage').readText(path.join(getBusinessPath(businessId), 'shifts.json')));
    return Array.isArray(shifts) && shifts.some(s => s.status === 'open');
  } catch { return false; }
}
/** ¿Estamos dentro del horario de pedidos (hora de Colombia, UTC-5)? Sin horario configurado, siempre sí. */
function withinHours(settings, now = Date.now()) {
  const f = /^(\d{1,2}):(\d{2})$/.exec(settings.openFrom || ''), t = /^(\d{1,2}):(\d{2})$/.exec(settings.openTo || '');
  if (!f || !t) return true;
  const d = new Date(now - 5 * 3600 * 1000), m = d.getUTCHours() * 60 + d.getUTCMinutes();
  const a = +f[1] * 60 + +f[2], b = +t[1] * 60 + +t[2];
  return a <= b ? (m >= a && m < b) : (m >= a || m < b);
}
const NO_SHIFT_MSG = 'Primero abre el turno de caja: sin turno abierto no se puede facturar. El pedido queda guardado y lo facturas cuando abras turno.';

const counterPath = (id) => path.join(getBusinessPath(id), 'pedidos-counter.json');

/**
 * Número de pedido consecutivo: D-DC01 (D = domicilio, R = recoger; DC = prefijo del negocio; 01 = consecutivo).
 * Cada tipo lleva su propio contador y nunca se repite. Se lee y se guarda de forma SÍNCRONA para que dos
 * pedidos que llegan a la vez no reciban el mismo número.
 */
function nextCode(businessId, mode, prefix) {
  const letter = mode === 'recoger' ? 'R' : 'D';
  let c = {};
  try { c = JSON.parse(require('./fileStorage').readText(counterPath(businessId))) || {}; } catch { c = {}; }
  c[letter] = (Number(c[letter]) || 0) + 1;
  require('./fileStorage').writeText(counterPath(businessId), JSON.stringify(c)); // contador de pedidos: nunca a medias
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
function priceOrder(cartaIn, rawItems, isOut = () => false) {
  const carta = resolveCarta(cartaIn);
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new Error('El pedido está vacío');
  if (rawItems.length > 40) throw new Error('Demasiados productos en el pedido');
  const byId = new Map(carta.products.map(p => [p.id, p]));
  const lines = [];

  for (const it of rawItems) {
    const p = byId.get(String(it.productId));
    if (!p || !p.active) throw new Error('Un producto de tu pedido ya no está disponible');
    if (p.soldOut || isOut(p.name)) throw new Error(`"${p.name}" está agotado`);
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
          if (o.soldOut || isOut(o.name)) throw new Error(`"${o.name}" está agotado`);
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
  defaultCarta, resolveCarta, cleanGroups, nameTaken, sampleCarta, blankCarta, syncInventory, stockCheck, readCarta, writeCarta, readPedidos, writePedidos, pedidosColl, expireStale, openPedidos, listPedidos, newCode, nextCode, priceOrder, counterPath, hasOpenShift, NO_SHIFT_MSG, withinHours
};
