/**
 * services/snacks.js — Papas, snacks, pasteles, galletas y chicles de Deli-Combos (lista y precios del negocio)
 * Se agregan a la carta como categorías nuevas, sin tocar lo que ya existe (migración por versión).
 */
const SNACK_SECTIONS = [
  ['Papas grandes', [
    ['De todito grande', 8500], ['Doritos grande', 8500], ['Margarita receta clásica grande', 7500],
    ['Margarita pollo grande', 6500], ['Margarita limón grande', 6500]
  ]],
  ['Papas y snacks pequeños', [
    ['De todito pequeño', 3500], ['Doritos pequeños', 3500], ['Doritos dinamita', 3500],
    ['Margarita mayonesa pequeña', 3500], ['Margarita pollo pequeña', 3000], ['Margarita limón pequeña', 3000],
    ['Margarita natural pequeña', 3000], ['Margarita crema y cebolla', 3500],
    ['Cheetos natural', 2500], ['Cheetos picantes', 2500], ['Cheetos boliqueso', 2500],
    ['Choclitos pequeños', 2500], ['Cheese Tris', 2500], ['Choquis galletas', 2500], ['Choquis bolitas', 2500],
    ['Maní Moto', 2500]
  ]],
  ['Pasteles, galletas y chicles', [
    ['Pastel Gloria', 3000], ['Pastel Caseritas arequipe', 3500], ['Pastel Caseritas guayaba', 2500],
    ['Galleta Biscotto', 3500], ['Trident x5', 2500], ['Trident individual', 500]
  ]]
];

module.exports = { SNACK_SECTIONS };
