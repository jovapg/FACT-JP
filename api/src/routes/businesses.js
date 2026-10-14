/**
 * routes/businesses.js — CRUD de negocios/franquicias
 *
 * Solo accesible por el superadmin. Permite crear, editar y eliminar
 * los negocios (franquicias) del sistema.
 *
 * Al crear un negocio:
 *   - Se guarda en businesses.json (lista global)
 *   - Se crea su carpeta en data/<id>/
 *   - Se inicializa su profile.json con la configuración base
 *   - Se crean archivos JSON vacíos para todos los módulos
 *   - Se generan las mesas iniciales según `tablesCount`
 *
 * Rutas:
 *   GET    /api/businesses       → listar todos los negocios
 *   POST   /api/businesses       → crear nuevo negocio (superadmin)
 *   PUT    /api/businesses/:id   → editar negocio (superadmin)
 *   DELETE /api/businesses/:id   → eliminar negocio y todos sus datos (superadmin)
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, getDataPath, getBusinessPath, ensureBusinessDir } = require('../services/fileStorage');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

/** Íconos permitidos para un negocio (deben coincidir con frontend/src/utils/businessIcons.js) */
const BUSINESS_ICON_KEYS = ['store', 'utensils', 'beer', 'wine', 'coffee', 'crosshair', 'croissant', 'dumbbell', 'hotel', 'briefcase'];

/** Ruta al archivo con la lista de todos los negocios */
const BUSINESSES_FILE = () => path.join(getDataPath(), 'businesses.json');

/**
 * GET /api/businesses — Lista los negocios registrados.
 * El superadmin ve todos; admin/cajero solo ven el suyo (para no exponer
 * los nombres de los demás clientes).
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const businesses = await readJSON(BUSINESSES_FILE()) || [];
    if (req.user.role === 'superadmin') return res.json(businesses);
    res.json(businesses.filter(b => b.id === req.user.businessId));
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/businesses — Crea un nuevo negocio/franquicia.
 * Solo el superadmin puede crear negocios.
 * Inicializa todos los archivos de datos y crea las mesas.
 */
router.post('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { name, slug, nit, address, city, phone, currency, invoicePrefix, tablesCount } = req.body;
    const usesRecipes = req.body.usesRecipes !== false; // por defecto sí usa recetas
    const icon = BUSINESS_ICON_KEYS.includes(req.body.icon) ? req.body.icon : 'store'; // ícono neutro por defecto
    if (!name) return res.status(400).json({ error: 'Name required' });

    const id = uuidv4();
    const businesses = await readJSON(BUSINESSES_FILE()) || [];

    const newBusiness = {
      id,
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, '-'), // Slug auto-generado del nombre
      active: true,
      usesRecipes,
      icon,
      createdAt: new Date().toISOString()
    };

    businesses.push(newBusiness);
    await writeJSON(BUSINESSES_FILE(), businesses);

    // Crear directorio y archivos iniciales del negocio
    ensureBusinessDir(id);
    const profilePath = path.join(getBusinessPath(id), 'profile.json');
    await writeJSON(profilePath, {
      id,
      name,
      nit: nit || '',
      address: address || '',
      city: city || 'Medellín',
      phone: phone || '',
      logo: '',
      tablesCount: tablesCount || 10,
      usesRecipes,   // false = el negocio vende directo del inventario (sin pantalla de Recetas)
      icon,          // ícono del negocio en el menú lateral (cuando no tiene logo)
      currency: currency || 'COP',
      invoicePrefix: invoicePrefix || name.substring(0, 2).toUpperCase(), // Prefijo auto de las 2 primeras letras
      invoiceCounter: 0  // Contador de facturas, se incrementa con cada venta
    });

    // Inicializar todos los archivos de datos vacíos
    await writeJSON(path.join(getBusinessPath(id), 'inventory.json'), []);
    await writeJSON(path.join(getBusinessPath(id), 'recipes.json'), []);
    await writeJSON(path.join(getBusinessPath(id), 'tables.json'), []);
    await writeJSON(path.join(getBusinessPath(id), 'sales.json'), []);
    await writeJSON(path.join(getBusinessPath(id), 'purchases.json'), []);
    await writeJSON(path.join(getBusinessPath(id), 'suppliers.json'), []);
    await writeJSON(path.join(getBusinessPath(id), 'users.json'), []);

    // Crear mesas numeradas del 1 al N, todas libres por defecto
    const tables = [];
    const count = tablesCount || 10;
    for (let i = 1; i <= count; i++) {
      tables.push({ id: uuidv4(), number: i, status: 'libre', order: null });
    }
    await writeJSON(path.join(getBusinessPath(id), 'tables.json'), tables);

    res.status(201).json(newBusiness);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/** PUT /api/businesses/:id — Actualiza datos básicos de un negocio */
router.put('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const businesses = await readJSON(BUSINESSES_FILE()) || [];
    const idx = businesses.findIndex(b => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Business not found' });

    businesses[idx] = { ...businesses[idx], ...req.body, id: req.params.id };
    await writeJSON(BUSINESSES_FILE(), businesses);
    res.json(businesses[idx]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/businesses/:id/settings — Ajustes de módulos del negocio (solo superadmin).
 * Body: { usesRecipes?: boolean, icon?: string } (al menos uno). Se guarda en la lista global (para mostrarlo en
 * Franquicias) y en el profile.json del negocio (para que la app lo aplique).
 */
router.put('/:id/settings', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { usesRecipes, icon } = req.body;
    if (usesRecipes !== undefined && typeof usesRecipes !== 'boolean') return res.status(400).json({ error: 'usesRecipes debe ser true o false' });
    if (icon !== undefined && !BUSINESS_ICON_KEYS.includes(icon)) return res.status(400).json({ error: 'Ícono no válido' });
    if (usesRecipes === undefined && icon === undefined) return res.status(400).json({ error: 'Nada que actualizar' });
    const businesses = await readJSON(BUSINESSES_FILE()) || [];
    const idx = businesses.findIndex(b => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Business not found' });
    if (usesRecipes !== undefined) businesses[idx].usesRecipes = usesRecipes;
    if (icon !== undefined) businesses[idx].icon = icon;
    await writeJSON(BUSINESSES_FILE(), businesses);

    const profilePath = path.join(getBusinessPath(req.params.id), 'profile.json');
    const profile = await readJSON(profilePath) || {};
    if (usesRecipes !== undefined) profile.usesRecipes = usesRecipes;
    if (icon !== undefined) profile.icon = icon;
    await writeJSON(profilePath, profile);

    res.json(businesses[idx]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/businesses/:id/reset-sales — Borra todo el historial de ventas.
 * Resetea sales.json, shifts.json y el contador de facturas a cero.
 * No toca inventario, recetas, proveedores ni configuración.
 */
router.post('/:id/reset-sales', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const businesses = await readJSON(BUSINESSES_FILE()) || [];
    const biz = businesses.find(b => b.id === req.params.id);
    if (!biz) return res.status(404).json({ error: 'Business not found' });

    const bizDir = getBusinessPath(req.params.id);
    await writeJSON(path.join(bizDir, 'sales.json'), []);
    await writeJSON(path.join(bizDir, 'shifts.json'), []);

    const profilePath = path.join(bizDir, 'profile.json');
    const profile = await readJSON(profilePath);
    if (profile) {
      profile.invoiceCounter = 0;
      await writeJSON(profilePath, profile);
    }

    res.json({ success: true, message: 'Historial de ventas borrado' });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/businesses/purge-orphans — Borra las carpetas de datos de negocios
 * que ya no están registrados (quedaron de cuando eliminar solo desregistraba).
 * Solo borra carpetas con nombre de UUID que no figuren en businesses.json.
 */
router.post('/purge-orphans', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const registered = new Set((await readJSON(BUSINESSES_FILE()) || []).map(b => b.id));
    const root = path.resolve(getDataPath());
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const entries = await fs.promises.readdir(root, { withFileTypes: true });
    const removed = [];
    for (const e of entries) {
      if (!e.isDirectory() || !uuidRe.test(e.name) || registered.has(e.name)) continue;
      await fs.promises.rm(path.join(root, e.name), { recursive: true, force: true });
      removed.push(e.name);
    }
    res.json({ success: true, removed });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/businesses/:id — Elimina un negocio por completo.
 * Lo quita de la lista global, borra su carpeta de datos (ventas, inventario,
 * usuarios, logo, QR, etc.) y sus links cortos de facturas. Es irreversible.
 */
router.delete('/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const all = await readJSON(BUSINESSES_FILE()) || [];
    if (!all.some(b => b.id === req.params.id)) return res.status(404).json({ error: 'Business not found' });
    await writeJSON(BUSINESSES_FILE(), all.filter(b => b.id !== req.params.id));

    // Borrar la carpeta del negocio, solo si queda realmente dentro de la carpeta de datos
    const root = path.resolve(getDataPath());
    const target = path.resolve(getBusinessPath(req.params.id));
    if (target.startsWith(root + path.sep)) {
      await fs.promises.rm(target, { recursive: true, force: true });
    }

    // Quitar los links cortos de facturas de este negocio
    const linksFile = path.join(getDataPath(), 'shortlinks.json');
    const links = await readJSON(linksFile);
    if (links && typeof links === 'object') {
      for (const code of Object.keys(links)) {
        if (links[code]?.businessId === req.params.id) delete links[code];
      }
      await writeJSON(linksFile, links);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
