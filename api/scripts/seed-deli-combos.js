/**
 * Crea (si no existe) la franquicia Deli-Combos y le carga la carta por defecto.
 * Uso:  node scripts/seed-deli-combos.js
 * Solo para desarrollo local. En producción: crear la franquicia desde Franquicias
 * (slug "deli-combos") y cargar la carta con POST /api/<id>/carta/load-default (superadmin).
 */
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, ensureBusinessDir, getBusinessPath, getDataPath } = require('../src/services/fileStorage');
const carta = require('../src/services/cartaService');

(async () => {
  const file = path.join(getDataPath(), 'businesses.json');
  const list = await readJSON(file) || [];
  let b = list.find(x => x.slug === 'deli-combos');
  if (!b) {
    const id = uuidv4();
    b = { id, name: 'Deli-Combos', slug: 'deli-combos', active: true, usesRecipes: false, icon: 'store',
      spaceLabel: 'Mesa', spaceLabelPlural: 'Mesas', recipesLabel: 'Combos', multiOrders: false,
      modules: { debtors: false, payroll: false, finance: true, reports: true, audit: true },
      createdAt: new Date().toISOString() };
    list.push(b);
    await writeJSON(file, list);
    ensureBusinessDir(id);
    const dir = getBusinessPath(id);
    await writeJSON(path.join(dir, 'profile.json'), { id, name: b.name, nit: '', address: '', city: 'Medellín', phone: '',
      logo: '', tablesCount: 0, spaceLabel: 'Mesa', spaceLabelPlural: 'Mesas', spaceNames: [], multiOrders: false,
      recipesLabel: 'Combos', modules: b.modules, usesRecipes: false, icon: 'store', currency: 'COP',
      invoicePrefix: 'DC', invoiceCounter: 0, cartaOnline: true });
    for (const f of ['inventory', 'recipes', 'tables', 'sales', 'purchases', 'suppliers', 'users']) {
      await writeJSON(path.join(dir, f + '.json'), []);
    }
    console.log('Franquicia creada:', id);
  } else console.log('Franquicia ya existía:', b.id);

  const c = carta.defaultCarta();
  await carta.writeCarta(b.id, c);
  console.log('Carta cargada:', c.products.length, 'productos,', c.categories.length, 'categorías');
})();
