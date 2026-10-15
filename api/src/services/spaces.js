/**
 * services/spaces.js — "Espacios" de venta de un negocio (mesas, campos, pistas…)
 *
 * Cada franquicia define cómo se llaman sus espacios (Mesa, Campo…), si tienen
 * nombre propio (Alfa, Mega, Beta) y si un espacio puede guardar VARIAS ventas
 * abiertas a la vez (multiOrders) o una sola cuenta, como una mesa clásica.
 *
 * Estructura de cada espacio en tables.json:
 *   { id, number, name?, status: 'libre'|'ocupada', order: {…}|null, orders?: [ {…} ] }
 *   - order  → una sola cuenta (modo clásico)
 *   - orders → ventas guardadas (modo multiOrders):
 *              { id, name: 'Venta 1', client, items, waiter, createdAt, updatedAt }
 */

const { v4: uuidv4 } = require('uuid');

/** Texto limpio, con largo máximo y valor por defecto */
function txt(v, max, fallback = '') {
  const s = String(v ?? '').trim().slice(0, max);
  return s || fallback;
}

/** Lista de nombres de espacios: sin vacíos, máximo 50, cada uno de hasta 40 caracteres */
function cleanNames(arr) {
  return Array.isArray(arr) ? arr.map(x => txt(x, 40)).filter(Boolean).slice(0, 50) : [];
}

/** Crea los espacios de un negocio nuevo (con nombres, o numerados del 1 al N) */
function buildTables({ names, count, multi }) {
  const n = names && names.length ? names.length : (Number(count) || 10);
  const list = [];
  for (let i = 0; i < n; i++) {
    const t = { id: uuidv4(), number: i + 1, status: 'libre', order: null };
    if (names && names[i]) t.name = names[i];
    if (multi) t.orders = [];
    list.push(t);
  }
  return list;
}

/** ¿El espacio tiene algo abierto (cuenta o ventas guardadas)? */
function isBusy(t) {
  return t.status === 'ocupada' || !!t.order || (Array.isArray(t.orders) && t.orders.length > 0);
}

/**
 * Aplica una lista de nombres a los espacios existentes: renombra por posición,
 * agrega los que falten y quita los sobrantes SOLO si están libres.
 * Con lista vacía, quita los nombres (vuelven a verse numerados).
 * Devuelve { tables } o { blocked: [espacios ocupados que se perderían] }.
 */
function applyNames(tables, names, multi) {
  if (!names.length) {
    return { tables: tables.map(t => { const c = { ...t }; delete c.name; return c; }) };
  }
  const extra = tables.slice(names.length);
  const blocked = extra.filter(isBusy);
  if (blocked.length) return { blocked };
  const result = names.map((name, i) => {
    if (tables[i]) return { ...tables[i], name };
    const t = { id: uuidv4(), number: i + 1, name, status: 'libre', order: null };
    if (multi) t.orders = [];
    return t;
  });
  return { tables: result };
}

/** Pasa los espacios a "varias ventas": la cuenta única pasa a ser la Venta 1 */
function convertToMulti(tables) {
  return tables.map(t => {
    if (Array.isArray(t.orders)) return t;
    const orders = [];
    if (t.order && t.order.items && t.order.items.length) {
      orders.push({ id: uuidv4(), name: 'Venta 1', client: t.order.client || '', items: t.order.items, waiter: t.order.waiter, createdAt: t.order.createdAt, updatedAt: t.order.updatedAt });
    }
    return { ...t, order: null, orders, orderSeq: orders.length, status: orders.length ? 'ocupada' : 'libre' };
  });
}

/** Vuelve al modo de una sola cuenta: solo si no hay ventas guardadas */
function convertToSingle(tables) {
  if (tables.some(t => Array.isArray(t.orders) && t.orders.length > 0)) return { blocked: true };
  return { tables: tables.map(t => { const c = { ...t }; delete c.orders; delete c.orderSeq; return c; }) };
}

module.exports = { txt, cleanNames, buildTables, isBusy, applyNames, convertToMulti, convertToSingle };
