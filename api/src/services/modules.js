/**
 * services/modules.js — Lista única de módulos y plantillas de negocio
 *
 * UNA sola lista (REGISTRY) describe cada módulo que el superadmin puede prender o apagar por franquicia:
 * nombre, grupo, para qué sirve y de cuáles otros depende. El asistente de crear franquicias, el editor de
 * módulos y lo que ve cada admin se arman leyendo esta lista: agregar un módulo nuevo = agregar una entrada.
 *
 * Cómo se guarda (sin migraciones: los negocios que ya existían tienen exactamente lo mismo de siempre):
 *   multi → profile.multiOrders        rec   → profile.usesRecipes
 *   fin   → profile.modules.finance    fiado → profile.modules.debtors     nom → profile.modules.payroll
 *   rep   → profile.modules.reports    aud   → profile.modules.audit
 *   carta → profile.cartaOnline        bol   → profile.modules.domicilios (y necesita carta + fin)
 *
 * No se pueden apagar (siempre incluidos): Facturas, Inventario con stock, Turnos de caja, Directorio de
 * pagos y Mesas/espacios de venta. Son la base que usan todas las pantallas.
 *
 * Quién ve qué:
 *   superadmin → prende/apaga módulos, crea y borra franquicias, respaldos y bitácora del sistema.
 *   admin      → usa los módulos prendidos de SU franquicia y ve cuáles tiene (no los cambia).
 *   cajero     → vende, factura, turnos, inventario y pedidos; sin Finanzas, Reportes ni configuración.
 *   domiciliario → solo ve pedidos y marca salida/entrega.
 */

// Claves de profile.modules (se conserva por compatibilidad con la versión anterior)
const MODULE_KEYS = ['debtors', 'payroll', 'finance', 'reports', 'audit', 'domicilios'];

const REGISTRY = [
  { key: 'multi', group: 'Ventas', label: 'Varias ventas por espacio', desc: 'Un mismo campo o mesa guarda varias cuentas abiertas a la vez', requires: [] },
  { key: 'rec', group: 'Ventas', label: 'Recetas y combos', desc: 'Arma productos con ingredientes o combos', requires: [] },
  { key: 'fin', group: 'Dinero', label: 'Finanzas', desc: 'Efectivo y banco, entradas y salidas del negocio', requires: [] },
  { key: 'fiado', group: 'Dinero', label: 'Deudas y fiado', desc: 'Clientes que pagan después', requires: [] },
  { key: 'nom', group: 'Dinero', label: 'Nómina', desc: 'Días trabajados y pagos al personal', requires: [] },
  { key: 'carta', group: 'En línea', label: 'Carta pública y pedidos', desc: 'Link para que el cliente vea la carta y pida, con domiciliario y WhatsApp', requires: [] },
  { key: 'bol', group: 'En línea', label: 'Bolsillo Domicilios', desc: 'Lleva lo cobrado por domicilio y el pago del domiciliario', requires: ['carta', 'fin'] },
  { key: 'rep', group: 'Control', label: 'Reportes', desc: 'Ventas por producto y por día', requires: [] },
  { key: 'aud', group: 'Control', label: 'Bitácora', desc: 'Quién cambió qué y cuándo', requires: [] }
];

const BASE = [
  { label: 'Facturas', desc: 'Historial, PDF y envío por WhatsApp' },
  { label: 'Inventario con stock', desc: 'Productos, stock, fotos y alertas' },
  { label: 'Turnos de caja', desc: 'Apertura, cierre y cuadre de caja' },
  { label: 'Directorio de pagos', desc: 'Proveedores, créditos y salidas' },
  { label: 'Mesas o espacios de venta', desc: 'Dónde se registran las ventas' }
];

const TEMPLATES = [
  { id: 'bar', name: 'Bar o restaurante', desc: 'Mesas, recetas, fiado y nómina', icon: 'utensils',
    on: ['rec', 'fin', 'fiado', 'nom', 'rep', 'aud'],
    labels: { spaceLabel: 'Mesa', spaceLabelPlural: 'Mesas', spaceNames: [], recipesLabel: 'Recetas' }, tablesCount: 10 },
  { id: 'campo', name: 'Campo de tiro', desc: 'Campos con varias ventas, combos y sin fiado', icon: 'crosshair',
    on: ['multi', 'rec', 'fin', 'nom', 'rep', 'aud'],
    labels: { spaceLabel: 'Campo', spaceLabelPlural: 'Campos', spaceNames: ['Alfa', 'Mega', 'Beta'], recipesLabel: 'Combos' } },
  { id: 'polleria', name: 'Pollería con domicilios', desc: 'Carta pública, pedidos, bolsillo e inventario', icon: 'store',
    on: ['carta', 'bol', 'fin', 'rep', 'aud'],
    labels: { spaceLabel: 'Mesa', spaceLabelPlural: 'Mesas', spaceNames: [], recipesLabel: 'Combos' }, tablesCount: 0 },
  { id: 'tienda', name: 'Tienda simple', desc: 'Solo ventas, inventario y finanzas', icon: 'store',
    on: ['fin', 'rep'],
    labels: { spaceLabel: 'Mesa', spaceLabelPlural: 'Mesas', spaceNames: [], recipesLabel: 'Recetas' }, tablesCount: 0 }
];

const KEYS = REGISTRY.map(m => m.key);
const byKey = Object.fromEntries(REGISTRY.map(m => [m.key, m]));

/** ¿Este módulo está prendido en el perfil? Lo que no esté definido sigue prendido, como siempre. */
function isOn(p, key) {
  const m = p.modules || {};
  switch (key) {
    case 'multi': return p.multiOrders === true;
    case 'rec': return p.usesRecipes !== false;
    case 'fin': return m.finance !== false;
    case 'fiado': return m.debtors !== false;
    case 'nom': return m.payroll !== false;
    case 'carta': return p.cartaOnline === true;
    case 'bol': return p.cartaOnline === true && m.domicilios !== false && m.finance !== false;
    case 'rep': return m.reports !== false;
    case 'aud': return m.audit !== false;
    default: return false;
  }
}

/** Estado actual de todos los módulos de un perfil: { multi: true, rec: false, … } */
function currentState(profile) {
  return Object.fromEntries(KEYS.map(k => [k, isOn(profile || {}, k)]));
}

/**
 * Aplica lo que se pidió ({ clave: true|false }) sobre un estado y respeta las dependencias:
 * prender un módulo prende los que necesita; apagar uno apaga los que dependen de él.
 */
function resolve(state, wanted) {
  const out = { ...state };
  const ons = [], offs = [];
  for (const k of KEYS) if (wanted && typeof wanted[k] === 'boolean') { out[k] = wanted[k]; (wanted[k] ? ons : offs).push(k); }
  const turnOn = (k) => { out[k] = true; for (const r of byKey[k].requires) if (!out[r]) turnOn(r); };
  const turnOff = (k) => { out[k] = false; for (const m of REGISTRY) if (out[m.key] && m.requires.includes(k)) turnOff(m.key); };
  ons.forEach(turnOn);
  offs.forEach(turnOff);   // apagar gana si se pide lo contrario
  return out;
}

/** Del estado por claves a los campos de siempre del perfil */
function toPatch(profile, state) {
  const base = (profile && profile.modules) || {};
  return {
    multiOrders: !!state.multi,
    usesRecipes: !!state.rec,
    cartaOnline: !!state.carta,
    modules: {
      ...base,
      finance: !!state.fin, debtors: !!state.fiado, payroll: !!state.nom,
      reports: !!state.rep, audit: !!state.aud, domicilios: !!state.bol
    }
  };
}

/** Estado inicial a partir de una plantilla (y ajustes opcionales encima) */
function stateFromTemplate(templateId, wanted) {
  const t = TEMPLATES.find(x => x.id === templateId);
  const base = Object.fromEntries(KEYS.map(k => [k, !!(t && t.on.includes(k))]));
  return resolve(base, wanted);
}

/**
 * Devuelve el mapa { debtors, payroll, … } con booleanos (compatibilidad con el formato anterior).
 * Lo que venga en `input` manda; si falta, lo que ya había en `base`, o prendido.
 */
function cleanModules(input, base) {
  const out = {};
  for (const k of MODULE_KEYS) {
    if (input && typeof input[k] === 'boolean') out[k] = input[k];
    else out[k] = !(base && base[k] === false);
  }
  return out;
}

module.exports = { MODULE_KEYS, REGISTRY, BASE, TEMPLATES, KEYS, isOn, currentState, resolve, toPatch, stateFromTemplate, cleanModules };
