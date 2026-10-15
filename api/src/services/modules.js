/**
 * services/modules.js — Módulos que cada negocio puede prender o apagar
 *
 * El superadmin escoge en Franquicias cuáles módulos usa cada negocio. Lo apagado
 * desaparece del menú y el servidor lo bloquea. Sin dato, todo está prendido
 * (los negocios que ya existían no cambian).
 *
 * No se pueden apagar: Facturas, Inventario, Turnos de caja ni el Directorio de
 * pagos (el inventario exige elegir un proveedor). Recetas/Combos tiene su propio
 * interruptor (usesRecipes).
 */

const MODULE_KEYS = ['debtors', 'payroll', 'finance', 'reports', 'audit'];

/**
 * Devuelve el mapa completo { debtors, payroll, ... } con booleanos.
 * Toma lo que venga en `input` y, si falta alguno, lo que ya había en `base`
 * (o prendido si tampoco estaba).
 */
function cleanModules(input, base) {
  const out = {};
  for (const k of MODULE_KEYS) {
    if (input && typeof input[k] === 'boolean') out[k] = input[k];
    else out[k] = !(base && base[k] === false);
  }
  return out;
}

module.exports = { MODULE_KEYS, cleanModules };
