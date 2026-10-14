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
    if (!name) return res.status(400).json({ error: 'Name required' });

    const id = uuidv4();
    const businesses = await readJSON(BUSINESSES_FILE()) || [];

    const newBusiness = {
      id,
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, '-'), // Slug auto-generado del nombre
      active: true,
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
