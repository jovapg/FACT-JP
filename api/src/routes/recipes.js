/**
 * routes/recipes.js — CRUD de recetas y menú
 *
 * Las recetas son los ítems vendibles del menú. Cada receta tiene:
 *   - nombre, precio de venta, categoría, disponibilidad
 *   - ingredients: array de { inventoryId, quantity } — define qué
 *     insumos se descuentan del inventario al vender este ítem
 *
 * Los cajeros solo pueden leer recetas (para armar pedidos),
 * no pueden crear, editar ni eliminarlas.
 *
 * Rutas:
 *   GET    /api/:businessId/recipes        → listar todas las recetas
 *   POST   /api/:businessId/recipes        → crear receta (admin+)
 *   PUT    /api/:businessId/recipes/:id    → actualizar receta (admin+)
 *   DELETE /api/:businessId/recipes/:id    → eliminar receta (admin+)
 */

const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams: true necesario para :businessId
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, getBusinessPath } = require('../services/fileStorage');
const { authenticate } = require('../middleware/auth');

const recipesPath = (id) => path.join(getBusinessPath(id), 'recipes.json');

/** GET — Lista todas las recetas/ítems del menú del negocio */
router.get('/recipes', authenticate, async (req, res) => {
  try {
    const items = await readJSON(recipesPath(req.params.businessId)) || [];
    res.json(items);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/** POST — Crea una nueva receta/ítem de menú. Solo admin y superadmin. */
router.post('/recipes', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const items = await readJSON(recipesPath(req.params.businessId)) || [];
    const newItem = {
      id: uuidv4(),
      name: req.body.name,
      price: Number(req.body.price) || 0,       // Precio de venta al cliente
      category: req.body.category || 'general',
      available: req.body.available !== false,   // Disponible en el menú por defecto
      ingredients: req.body.ingredients || [],   // Lista de insumos que consume al venderse
      createdAt: new Date().toISOString()
    };
    items.push(newItem);
    await writeJSON(recipesPath(req.params.businessId), items);
    res.status(201).json(newItem);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/** PUT — Actualiza una receta existente por ID */
router.put('/recipes/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const items = await readJSON(recipesPath(req.params.businessId)) || [];
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Recipe not found' });
    items[idx] = { ...items[idx], ...req.body, id: req.params.id };
    await writeJSON(recipesPath(req.params.businessId), items);
    res.json(items[idx]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/** DELETE — Elimina una receta/ítem de menú por ID */
router.delete('/recipes/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    let items = await readJSON(recipesPath(req.params.businessId)) || [];
    items = items.filter(i => i.id !== req.params.id);
    await writeJSON(recipesPath(req.params.businessId), items);
    res.json({ success: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
