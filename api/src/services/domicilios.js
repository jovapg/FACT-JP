/**
 * services/domicilios.js — Domicilios hechos a mano (los que NO entraron por la carta en línea)
 *
 * Cada domicilio es un pedido guardado, sin mesa: cliente, productos (con su línea de domicilio) y un estado simple
 * ("por_enviar" / "en_camino"). Viven en domicilios.json mientras están activos y DESAPARECEN al facturarse (la factura
 * queda como una venta normal) o al cancelarse (queda constancia en la bitácora).
 */
const path = require('path');
const { readJSON, writeJSON, getBusinessPath } = require('./fileStorage');

const file = (businessId) => path.join(getBusinessPath(businessId), 'domicilios.json');
const STATES = ['por_enviar', 'en_camino'];
const CLAIM_MS = 60 * 1000; // una factura en curso "reserva" el domicilio por un minuto como máximo

const txt = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

async function readAll(businessId) {
  const list = await readJSON(file(businessId));
  return Array.isArray(list) ? list : [];
}
const writeAll = (businessId, list) => writeJSON(file(businessId), list);

/** Valida y deja solo lo necesario de cada producto. Lanza Error con un mensaje claro si algo no sirve. */
function cleanItems(input) {
  if (!Array.isArray(input) || !input.length) throw new Error('Agrega al menos un producto');
  if (input.length > 60) throw new Error('Máximo 60 líneas por domicilio');
  const out = [];
  let products = 0;
  for (const i of input) {
    const name = txt(i && i.name, 100);
    const price = Number(i && i.price), qty = Math.floor(Number(i && (i.qty || i.quantity)));
    if (!name || !Number.isFinite(price) || price < 0 || !(qty >= 1) || qty > 999) throw new Error('Hay un producto con datos no válidos');
    const line = { name, price: Math.round(price), qty, discount: Math.max(0, Math.round(Number(i.discount) || 0)), area: i.area === 'restaurante' ? 'restaurante' : 'bar' };
    if (i.recipeId) line.recipeId = String(i.recipeId).slice(0, 80);
    if (i.inventoryId) line.inventoryId = String(i.inventoryId).slice(0, 80);
    if (i.kind === 'domicilio') line.kind = 'domicilio'; else products++;
    out.push(line);
  }
  if (!products) throw new Error('Agrega al menos un producto');
  if (out.filter(l => l.kind === 'domicilio').length > 1) throw new Error('Solo puede haber una línea de domicilio');
  return out;
}

/** Datos del cliente: solo el nombre es obligatorio */
function cleanContact(b, { requireName = true } = {}) {
  const out = {};
  if (b.name !== undefined || requireName) {
    out.name = txt(b.name, 80);
    if (out.name.length < 2) throw new Error('El nombre del cliente es obligatorio');
  }
  if (b.phone !== undefined) out.phone = txt(b.phone, 30);
  if (b.address !== undefined) out.address = txt(b.address, 160);
  return out;
}

const totalOf = (d) => (d.items || []).reduce((s, i) => s + i.qty * i.price - (Number(i.discount) || 0), 0);

/**
 * Reserva el domicilio para facturarlo (evita que dos personas lo facturen a la vez). Operación atómica:
 * no hay esperas de disco entre leer y guardar. Devuelve { ok, dom } o { ok:false, code, error }.
 */
async function claim(businessId, id) {
  const list = await readAll(businessId);
  const dom = list.find(d => d.id === id);
  if (!dom) return { ok: false, code: 404, error: 'Este domicilio ya fue facturado o cancelado. Actualiza la lista.' };
  if (dom.claimedAt && Date.now() - dom.claimedAt < CLAIM_MS) return { ok: false, code: 409, error: 'Este domicilio se está facturando en otro equipo.' };
  dom.claimedAt = Date.now();
  await writeAll(businessId, list);
  return { ok: true, dom };
}
async function release(businessId, id) {
  const list = await readAll(businessId);
  const dom = list.find(d => d.id === id);
  if (dom && dom.claimedAt) { delete dom.claimedAt; await writeAll(businessId, list); }
}
/** La factura ya se creó: el domicilio sale de la lista */
async function finish(businessId, id) {
  const list = await readAll(businessId);
  const rest = list.filter(d => d.id !== id);
  if (rest.length !== list.length) await writeAll(businessId, rest);
}

module.exports = { STATES, readAll, writeAll, cleanItems, cleanContact, totalOf, claim, release, finish, txt };
