/**
 * services/unifyNames.js — Unifica productos repetidos (mismo producto con dos o tres nombres)
 *
 * Cada operación dice qué producto se QUEDA y qué repetidos se quitan:
 *   { canonical:        nombre final (el que se ve en inventario, receta y carta),
 *     keepInventory:    producto de inventario que se queda (se le pone el nombre final),
 *     keepRecipe:       receta que se queda (opcional; también toma el nombre final),
 *     dropInventory:    [nombres de productos de inventario repetidos que se quitan],
 *     dropRecipes:      [nombres de recetas repetidas que se quitan],
 *     carta:            [nombres de productos de la carta que pasan a llamarse igual y a enlazarse con el que se queda] }
 *
 * Reglas de seguridad:
 *   - Los nombres se comparan sin importar mayúsculas ni espacios de más.
 *   - Lo que se quita deja sus cosas buenas al que se queda: la foto, y todo lo que apuntaba a él (insumos de recetas, enlaces de la carta).
 *   - NUNCA se toca el historial de ventas: las facturas viejas conservan el nombre con el que se vendieron.
 *   - Es repetible: si ya está unificado, no cambia nada.
 *   - Si no encuentra el producto que debe quedarse, NO hace nada con esa operación y lo avisa.
 */
const path = require('path');
const { readJSON, writeJSON, getBusinessPath } = require('./fileStorage');

const key = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Aplica las operaciones sobre los datos en memoria. Devuelve { acciones, avisos, cambio } */
function unify(data, ops) {
  const inv = data.inventory, rec = data.recipes, cartaProducts = (data.carta && data.carta.products) || [];
  const acciones = [], avisos = [];
  let cambio = false;
  const log = (t) => { acciones.push(t); cambio = true; };

  for (const op of ops || []) {
    const keeperInv = inv.find(i => key(i.name) === key(op.keepInventory));
    if (!keeperInv) { avisos.push(`"${op.canonical}": no encontré el producto de inventario "${op.keepInventory}" (o ya se unificó); no se cambió nada`); continue; }
    const keeperRec = op.keepRecipe ? rec.find(r => key(r.name) === key(op.keepRecipe)) : null;

    // 1) Repetidos de inventario: su foto y sus enlaces pasan al que se queda, y se quitan
    for (const nombre of op.dropInventory || []) {
      for (const d of inv.filter(i => key(i.name) === key(nombre) && i.id !== keeperInv.id)) {
        if (d.imageUrl && !keeperInv.imageUrl) { keeperInv.imageUrl = d.imageUrl; log(`Inventario: la foto de "${d.name}" pasa a "${op.canonical}"`); }
        for (const r of rec) for (const ing of r.ingredients || []) if (ing.inventoryId === d.id) { ing.inventoryId = keeperInv.id; log(`Receta "${r.name}": su insumo "${d.name}" ahora apunta a "${op.canonical}"`); }
        for (const c of cartaProducts) if (c.inventoryId === d.id) { c.inventoryId = keeperInv.id; log(`Carta "${c.name}": su enlace de inventario pasa a "${op.canonical}"`); }
        inv.splice(inv.indexOf(d), 1);
        log(`Inventario: se QUITA el repetido "${d.name}" ($${d.salePrice || 0})`);
      }
    }
    // 2) Recetas repetidas: se quitan (nunca la que se queda)
    for (const nombre of op.dropRecipes || []) {
      for (const d of rec.filter(r => key(r.name) === key(nombre) && r !== keeperRec)) {
        rec.splice(rec.indexOf(d), 1);
        log(`Receta: se QUITA la repetida "${d.name}" ($${d.price || 0})`);
      }
    }
    // 3) Nombre final del que se queda (el inventario y la receta deben llamarse igual: así se encuentran entre sí)
    if (keeperInv.name !== op.canonical) { log(`Inventario: "${keeperInv.name}" pasa a llamarse "${op.canonical}"`); keeperInv.name = op.canonical; }
    if (keeperRec && keeperRec.name !== op.canonical) { log(`Receta: "${keeperRec.name}" pasa a llamarse "${op.canonical}"`); keeperRec.name = op.canonical; }
    // 4) Carta en línea: mismo nombre y enlazada al inventario que se queda
    for (const nombre of op.carta || []) {
      for (const c of cartaProducts.filter(x => key(x.name) === key(nombre) || key(x.name) === key(op.canonical))) {
        if (c.name !== op.canonical) {
          if (cartaProducts.some(o => o !== c && key(o.name) === key(op.canonical))) { avisos.push(`Carta: ya existe otro producto llamado "${op.canonical}"; no renombré "${c.name}"`); continue; }
          log(`Carta: "${c.name}" pasa a llamarse "${op.canonical}"`); c.name = op.canonical;
        }
        if (c.inventoryId !== keeperInv.id) { c.inventoryId = keeperInv.id; log(`Carta: "${c.name}" queda enlazada a su inventario`); }
      }
    }
  }
  return { acciones, avisos, cambio };
}

/** Lee los datos de un negocio, aplica las operaciones y guarda SOLO si hubo cambios */
async function applyToBusiness(businessId, ops) {
  const dir = getBusinessPath(businessId);
  const inventory = await readJSON(path.join(dir, 'inventory.json'));
  const recipes = await readJSON(path.join(dir, 'recipes.json')) || [];
  const carta = await readJSON(path.join(dir, 'carta.json'));
  if (!Array.isArray(inventory)) return { acciones: [], avisos: ['sin inventario'], cambio: false };
  const data = { inventory, recipes, carta };
  const r = unify(data, ops);
  if (r.cambio) {
    await writeJSON(path.join(dir, 'inventory.json'), inventory);
    await writeJSON(path.join(dir, 'recipes.json'), recipes);
    if (carta && Array.isArray(carta.products)) await writeJSON(path.join(dir, 'carta.json'), carta);
    try { await require('./audit').logAudit(businessId, { user: 'sistema', role: 'superadmin', action: 'productos_unificados', summary: `Se unificaron productos repetidos (${r.acciones.length} cambios): ` + r.acciones.slice(0, 6).join(' · ') + (r.acciones.length > 6 ? ' …' : '') }); } catch { /* la bitácora no frena el arreglo */ }
  }
  return r;
}

module.exports = { unify, applyToBusiness, key };
