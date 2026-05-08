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

  const alerts = [];

  for (const saleItem of saleItems) {
    // Buscar la receta correspondiente al ítem vendido
    const recipe = recipes.find(r => r.id === saleItem.recipeId);
    if (!recipe || !recipe.ingredients) continue; // Si no tiene receta, no descontar

    for (const ingredient of recipe.ingredients) {
      const invIdx = inventory.findIndex(i => i.id === ingredient.inventoryId);
      if (invIdx === -1) continue; // Si el ingrediente no está en inventario, omitir

      // Descontar: cantidad del ingrediente × cantidad vendida del ítem
      const deductQty = ingredient.quantity * saleItem.qty;
      inventory[invIdx].stock = Math.max(0, (inventory[invIdx].stock || 0) - deductQty);

      // Si el stock resultante es menor o igual al mínimo, generar alerta
      if (inventory[invIdx].stock <= (inventory[invIdx].minStock || 0)) {
        alerts.push({
          id: inventory[invIdx].id,
          name: inventory[invIdx].name,
          stock: inventory[invIdx].stock,
          minStock: inventory[invIdx].minStock
        });
      }
    }
  }

  await writeJSON(inventoryPath, inventory);
  return { success: true, alerts };
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

module.exports = { deductFromSale, addFromPurchase, adjustStock, getLowStockAlerts };
