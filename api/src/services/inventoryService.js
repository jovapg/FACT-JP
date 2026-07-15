/**
 * services/inventoryService.js — Lógica de negocio del inventario
 *
 * Contiene las operaciones que afectan el stock de inventario
 * de forma indirecta (como consecuencia de ventas o compras).
 * Se separa de la ruta de inventario para mantener el código limpio
 * y reutilizar la lógica desde múltiples rutas (sales, purchases).
 *
 * Funciones principales:
 *   - deductFromSale:   descuenta ingredientes al crear una venta
 *   - addFromPurchase:  suma stock al registrar una compra
 *   - adjustStock:      ajusta manualmente el stock de un ítem
 *   - getLowStockAlerts: retorna ítems por debajo del stock mínimo
 */

const path = require('path');
const { readJSON, writeJSON, getBusinessPath } = require('./fileStorage');

/**
 * Resuelve, para un ítem vendido, DE DÓNDE sale (o vuelve) el stock.
 *
 * Es la única fuente de verdad de la regla de "match por nombre": un producto
 * puede venderse de tres formas y esta función las unifica para que el POS
 * (sellableItems), el bloqueo por agotado (findOutOfStockItems) y el
 * descuento/devolución (deductFromSale/restoreFromSale) coincidan siempre.
 *
 * @returns
 *   - { type: 'direct', item }              → descontar qty unidades de ese ítem
 *       (ítem de inventario vendido directo, O receta que en realidad es un
 *        producto de inventario y coincide por nombre — ahí vive el stock)
 *   - { type: 'ingredients', list, name }   → descontar cada insumo × qty
 *   - null                                  → no hay stock que rastrear
 */
function resolveStockTarget(saleItem, recipes, invById, invByName) {
  // Ítem de inventario vendido directamente (sin receta)
  if (saleItem.inventoryId && !saleItem.recipeId) {
    const item = invById.get(saleItem.inventoryId);
    return item ? { type: 'direct', item } : null;
  }

  if (saleItem.recipeId) {
    const recipe = recipes.find(r => r.id === saleItem.recipeId);
    // Receta que en realidad es un producto de inventario (match por nombre):
    // el stock vive en el ítem de inventario, no en ingredientes.
    const byName = invByName.get((saleItem.name || recipe?.name || '').toLowerCase().trim());
    if (byName) return { type: 'direct', item: byName };
    // Receta con ingredientes: descontar cada insumo
    if (recipe?.ingredients?.length) {
      return { type: 'ingredients', list: recipe.ingredients, name: recipe.name };
    }
  }
  return null;
}

/**
 * Descuenta los ingredientes del inventario al crear una venta.
 *
 * Para cada ítem vendido, busca su receta y descuenta de inventario
 * la cantidad de ingredientes × cantidad vendida.
 * Si un ingrediente baja del stock mínimo, lo incluye en las alertas.
 *
 * @param {string} businessId - ID del negocio
 * @param {Array}  saleItems  - Items de la venta [{ recipeId, qty }]
 * @returns {{ success: boolean, alerts: Array }} - Alertas de stock bajo
 */
async function deductFromSale(businessId, saleItems) {
  const inventoryPath = path.join(getBusinessPath(businessId), 'inventory.json');
  const recipesPath = path.join(getBusinessPath(businessId), 'recipes.json');

  const inventory = await readJSON(inventoryPath) || [];
  const recipes = await readJSON(recipesPath) || [];

  // Índices por id y por nombre (referencian los mismos objetos del array)
  const invById = new Map(inventory.map(i => [i.id, i]));
  const invByName = new Map(inventory.map(i => [i.name.toLowerCase().trim(), i]));

  const alerts = [];
  const pushAlertIfLow = (inv) => {
    if (inv.stock <= (inv.minStock || 0)) {
      alerts.push({ id: inv.id, name: inv.name, stock: inv.stock, minStock: inv.minStock });
    }
  };

  for (const saleItem of saleItems) {
    const qty = saleItem.qty || 1;
    const target = resolveStockTarget(saleItem, recipes, invById, invByName);
    if (!target) continue; // Sin stock que rastrear (receta sin ingredientes ni match)

    if (target.type === 'direct') {
      // Producto de inventario (directo o receta que coincide por nombre): −qty unidades
      const inv = target.item;
      inv.stock = Math.max(0, (inv.stock || 0) - qty);
      pushAlertIfLow(inv);
    } else {
      // Receta con ingredientes: descontar cada insumo × cantidad vendida
      for (const ingredient of target.list) {
        const inv = invById.get(ingredient.inventoryId);
        if (!inv) continue; // Si el ingrediente no está en inventario, omitir
        inv.stock = Math.max(0, (inv.stock || 0) - ingredient.quantity * qty);
        pushAlertIfLow(inv);
      }
    }
  }

  await writeJSON(inventoryPath, inventory);
  return { success: true, alerts };
}

/**
 * Devuelve stock al inventario (operación inversa de deductFromSale).
 *
 * Se usa cuando se corrige o elimina un fiado: los productos que habían
 * "salido" del negocio vuelven a entrar. Para items de inventario directo
 * suma 1 unidad × qty; para recetas suma los ingredientes × qty vendida.
 *
 * @param {string} businessId
 * @param {Array}  saleItems - Items a devolver [{ recipeId|inventoryId, qty }]
 */
async function restoreFromSale(businessId, saleItems) {
  const inventoryPath = path.join(getBusinessPath(businessId), 'inventory.json');
  const recipesPath = path.join(getBusinessPath(businessId), 'recipes.json');

  const inventory = await readJSON(inventoryPath) || [];
  const recipes = await readJSON(recipesPath) || [];

  const invById = new Map(inventory.map(i => [i.id, i]));
  const invByName = new Map(inventory.map(i => [i.name.toLowerCase().trim(), i]));

  for (const saleItem of saleItems) {
    const qty = saleItem.qty || 1;
    const target = resolveStockTarget(saleItem, recipes, invById, invByName);
    if (!target) continue;

    if (target.type === 'direct') {
      // Producto de inventario (directo o receta que coincide por nombre): +qty unidades
      target.item.stock = (target.item.stock || 0) + qty;
    } else {
      // Receta con ingredientes: devolver cada insumo × cantidad vendida
      for (const ingredient of target.list) {
        const inv = invById.get(ingredient.inventoryId);
        if (!inv) continue;
        inv.stock = (inv.stock || 0) + ingredient.quantity * qty;
      }
    }
  }

  await writeJSON(inventoryPath, inventory);
  return { success: true };
}

/**
 * Detecta cuáles de los items dados están agotados (stock en cero) y por lo
 * tanto no se pueden vender/facturar. Reutiliza la misma lógica de fusión
 * que el POS del frontend:
 *   - Item de inventario directo (inventoryId): agotado si stock <= 0.
 *   - Receta que coincide por nombre con un item de inventario: usa el stock
 *     de ese item (productos de tienda registrados como receta).
 *   - Receta con ingredientes: agotada si algún ingrediente está en 0.
 *
 * @param {string} businessId
 * @param {Array}  items - Items a vender [{ recipeId|inventoryId, name, qty }]
 * @returns {Promise<string[]>} - Nombres de productos agotados (sin duplicados)
 */
async function findOutOfStockItems(businessId, items) {
  const inventoryPath = path.join(getBusinessPath(businessId), 'inventory.json');
  const recipesPath = path.join(getBusinessPath(businessId), 'recipes.json');

  const inventory = await readJSON(inventoryPath) || [];
  const recipes = await readJSON(recipesPath) || [];

  const invById = new Map(inventory.map(i => [i.id, i]));
  const invByName = new Map(inventory.map(i => [i.name.toLowerCase().trim(), i]));

  const out = [];
  for (const item of items || []) {
    const target = resolveStockTarget(item, recipes, invById, invByName);
    if (!target) continue;

    if (target.type === 'direct') {
      // Producto de inventario (directo o receta que coincide por nombre)
      if ((target.item.stock || 0) <= 0) out.push(target.item.name);
    } else {
      // Receta con ingredientes: agotada si falta alguno
      for (const ing of target.list) {
        const inv = invById.get(ing.inventoryId);
        if (inv && (inv.stock || 0) <= 0) { out.push(target.name); break; }
      }
    }
  }

  return [...new Set(out)];
}

/**
 * Suma stock al inventario al registrar una compra.
 *
 * Para cada ítem de la compra, busca el producto en inventario
 * y le suma la cantidad comprada. También actualiza el costo
 * unitario si se especificó en la compra.
 *
 * @param {string} businessId    - ID del negocio
 * @param {Array}  purchaseItems - Items de la compra [{ inventoryId, quantity, unitCost }]
 */
async function addFromPurchase(businessId, purchaseItems) {
  const inventoryPath = path.join(getBusinessPath(businessId), 'inventory.json');
  const inventory = await readJSON(inventoryPath) || [];

  for (const item of purchaseItems) {
    const invIdx = inventory.findIndex(i => i.id === item.inventoryId);
    if (invIdx === -1) continue;
    inventory[invIdx].stock = (inventory[invIdx].stock || 0) + item.quantity;
    if (item.unitCost) {
      // Actualizar el costo unitario con el precio de la compra más reciente
      inventory[invIdx].cost = item.unitCost;
    }
  }

  await writeJSON(inventoryPath, inventory);
  return { success: true };
}

/**
 * Ajuste manual de stock de un ítem específico.
 * `adjustment` puede ser positivo (entrada) o negativo (merma/corrección).
 * Guarda un registro del último ajuste con fecha y motivo.
 *
 * @param {string} businessId   - ID del negocio
 * @param {string} inventoryId  - ID del ítem de inventario
 * @param {number} adjustment   - Cantidad a sumar (o restar si es negativa)
 * @param {string} reason       - Motivo del ajuste (texto libre)
 * @returns {Object|null} - El ítem actualizado, o null si no se encontró
 */
async function adjustStock(businessId, inventoryId, adjustment, reason) {
  const inventoryPath = path.join(getBusinessPath(businessId), 'inventory.json');
  const inventory = await readJSON(inventoryPath) || [];

  const idx = inventory.findIndex(i => i.id === inventoryId);
  if (idx === -1) return null;

  inventory[idx].stock = Math.max(0, (inventory[idx].stock || 0) + adjustment);
  inventory[idx].lastAdjustment = {
    amount: adjustment,
    reason: reason || 'Manual adjustment',
    date: new Date().toISOString()
  };

  await writeJSON(inventoryPath, inventory);
  return inventory[idx];
}

/**
 * Retorna todos los ítems de inventario cuyo stock
 * está igual o por debajo del stock mínimo configurado.
 * Se usa en el dashboard y en el badge del menú lateral.
 */
async function getLowStockAlerts(businessId) {
  const inventoryPath = path.join(getBusinessPath(businessId), 'inventory.json');
  const inventory = await readJSON(inventoryPath) || [];
  return inventory.filter(i => i.stock <= (i.minStock || 0));
}

module.exports = { deductFromSale, restoreFromSale, findOutOfStockItems, addFromPurchase, adjustStock, getLowStockAlerts };
