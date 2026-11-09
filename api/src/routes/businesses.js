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
const spaces = require('../services/spaces');
const mods = require('../services/modules');
const usersLib = require('../services/users');
const cartaSvc = require('../services/cartaService');
const { logAudit } = require('../services/audit');

/** Íconos permitidos para un negocio (deben coincidir con frontend/src/utils/businessIcons.js) */
const BUSINESS_ICON_KEYS = ['store', 'utensils', 'beer', 'wine', 'coffee', 'crosshair', 'croissant', 'dumbbell', 'hotel', 'briefcase'];

/** Ruta al archivo con la lista de todos los negocios */
const BUSINESSES_FILE = () => path.join(getDataPath(), 'businesses.json');

/**
 * GET /api/businesses/registry — La lista única de módulos, la base fija y las plantillas.
 * No tiene nada sensible; el asistente de franquicias y la vista "módulos de tu negocio" la leen de aquí.
 */
router.get('/registry', authenticate, (req, res) => {
  res.json({ modules: mods.REGISTRY, base: mods.BASE, templates: mods.TEMPLATES, icons: BUSINESS_ICON_KEYS });
});

/**
 * GET /api/businesses/:id/modules — Qué módulos tiene prendidos una franquicia: { multi: true, rec: false, … }.
 * Lo ve el superadmin, y el admin de esa misma franquicia (solo para mirar, no puede cambiarlos).
 */
router.get('/:id/modules', authenticate, async (req, res) => {
  try {
    const own = req.user.businessId && req.user.businessId === req.params.id;
    if (req.user.role !== 'superadmin' && !(req.user.role === 'admin' && own)) return res.status(403).json({ error: 'Forbidden' });
    const profile = await readJSON(path.join(getBusinessPath(req.params.id), 'profile.json'));
    if (!profile) return res.status(404).json({ error: 'Business not found' });
    res.json(mods.currentState(profile));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

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

    // ── Forma de trabajo: con plantilla y módulos (asistente) o con los campos de siempre ──
    const tpl = mods.TEMPLATES.find(t => t.id === req.body.template) || null;
    const wizard = !!(tpl || req.body.moduleKeys);
    let usesRecipes, multiOrders, modules, cartaOnline, spaceLabel, spaceLabelPlural, recipesLabel, spaceNames, icon, tablesN;
    if (wizard) {
      const state = mods.stateFromTemplate(tpl && tpl.id, req.body.moduleKeys);
      const patch = mods.toPatch({}, state);
      usesRecipes = patch.usesRecipes; multiOrders = patch.multiOrders; cartaOnline = patch.cartaOnline;
      modules = mods.cleanModules(patch.modules);
      const lab = { ...(tpl ? tpl.labels : {}), ...(req.body.labels || {}) };
      spaceLabel = spaces.txt(lab.spaceLabel, 30, 'Mesa');
      spaceLabelPlural = spaces.txt(lab.spaceLabelPlural, 30, spaceLabel + 's');
      recipesLabel = spaces.txt(lab.recipesLabel, 30, 'Recetas');
      spaceNames = spaces.cleanNames(lab.spaceNames);
      icon = BUSINESS_ICON_KEYS.includes(req.body.icon) ? req.body.icon : (tpl ? tpl.icon : 'store');
      const asked = req.body.labels && Number.isInteger(req.body.labels.tablesCount) ? req.body.labels.tablesCount : (tpl && tpl.tablesCount !== undefined ? tpl.tablesCount : 10);
      tablesN = spaceNames.length || Math.max(0, Math.min(200, asked));
    } else {
      usesRecipes = req.body.usesRecipes !== false; // por defecto sí usa recetas
      icon = BUSINESS_ICON_KEYS.includes(req.body.icon) ? req.body.icon : 'store'; // ícono neutro por defecto
      // Cómo se llaman y cómo funcionan los espacios de venta (Mesa, Campo…) — configurable
      spaceLabel = spaces.txt(req.body.spaceLabel, 30, 'Mesa');
      spaceLabelPlural = spaces.txt(req.body.spaceLabelPlural, 30, spaceLabel + 's');
      recipesLabel = spaces.txt(req.body.recipesLabel, 30, 'Recetas');
      multiOrders = req.body.multiOrders === true;
      spaceNames = spaces.cleanNames(req.body.spaceNames);
      modules = mods.cleanModules(req.body.modules); // módulos prendidos (por defecto todos)
      cartaOnline = false;
      tablesN = spaceNames.length || tablesCount || 10;
    }

    // ── Validar usuarios y ajustes de la carta ANTES de crear nada (así no queda una franquicia a medias) ──
    const usersIn = Array.isArray(req.body.users) ? req.body.users.slice(0, 12) : [];
    const seen = new Set();
    for (const u of usersIn) {
      const un = String(u.username || '').trim();
      if (!/^[a-zA-Z0-9._-]{3,30}$/.test(un)) return res.status(400).json({ error: `Usuario no válido: "${un}". Usa de 3 a 30 letras, números, punto o guion.` });
      if (!usersLib.ASSIGNABLE_ROLES.includes(u.role)) return res.status(400).json({ error: `Rol no permitido para "${un}"` });
      if (u.role === 'domiciliario' && !cartaOnline) return res.status(400).json({ error: 'El rol Domiciliario solo existe cuando la franquicia tiene pedidos en línea.' });
      if (String(u.password || '').length < 6) return res.status(400).json({ error: `La contraseña de "${un}" debe tener al menos 6 caracteres.` });
      if (seen.has(un.toLowerCase()) || await usersLib.usernameTaken(un)) return res.status(409).json({ error: `El usuario "${un}" ya existe. Usa otro (ej: el prefijo del negocio).` });
      seen.add(un.toLowerCase());
    }
    const cs = req.body.cartaSettings || {};
    let waDigits = String(cs.whatsapp || '').replace(/\D/g, '');
    if (waDigits.length === 10) waDigits = '57' + waDigits;
    if (waDigits && (waDigits.length < 11 || waDigits.length > 15)) return res.status(400).json({ error: 'El WhatsApp no es válido. Escríbelo con 10 dígitos.' });
    const hhmm = /^([01]?\d|2[0-3]):[0-5]\d$/;
    for (const k of ['openFrom', 'openTo']) if (cs[k] && !hhmm.test(String(cs[k]))) return res.status(400).json({ error: 'La hora debe ser como 07:00 o 20:00' });

    const id = uuidv4();
    const businesses = await readJSON(BUSINESSES_FILE()) || [];

    const newBusiness = {
      id,
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, '-'), // Slug auto-generado del nombre
      active: true,
      usesRecipes,
      icon,
      spaceLabel, spaceLabelPlural, recipesLabel, multiOrders, modules,
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
      tablesCount: spaceNames.length || tablesN,
      spaceLabel,        // cómo se llaman los espacios: Mesa, Campo…
      spaceLabelPlural,  // Mesas, Campos…
      spaceNames,        // nombres propios (Alfa, Mega…); vacío = numerados
      multiOrders,       // true = cada espacio guarda varias ventas abiertas
      recipesLabel,      // cómo se llama el módulo de recetas (Recetas, Combos…)
      modules,           // módulos prendidos: { debtors, payroll, finance, reports, audit, domicilios }
      usesRecipes,   // false = el negocio vende directo del inventario (sin pantalla de Recetas)
      cartaOnline,   // true = carta pública y pedidos en línea
      icon,          // ícono del negocio en el menú lateral (cuando no tiene logo)
      currency: currency || 'COP',
      invoicePrefix: invoicePrefix || name.substring(0, 2).toUpperCase(), // Prefijo auto de las 2 primeras letras
      invoiceCounter: 0  // Contador de facturas, se incrementa con cada venta
    });

    // Inicializar todos los archivos de datos vacíos
    for (const f of ['inventory', 'recipes', 'sales', 'purchases', 'suppliers', 'users']) {
      await writeJSON(path.join(getBusinessPath(id), f + '.json'), []);
    }

    // Crear los espacios (con nombre o numerados), todos libres por defecto. Con 0 espacios no se crea ninguno.
    const tables = (!spaceNames.length && tablesN === 0) ? [] : spaces.buildTables({ names: spaceNames, count: tablesN || 10, multi: multiOrders });
    await writeJSON(path.join(getBusinessPath(id), 'tables.json'), tables);

    // Carta pública y pedidos: con la carta de ejemplo (editable) o vacía. Sin los datos de contacto de Deli-Combos.
    if (cartaOnline) {
      const settingsIn = { whatsapp: waDigits, openFrom: cs.openFrom || '', openTo: cs.openTo || '', address: cs.address || address || '', hours: String(cs.hours || '').slice(0, 220) };
      const carta = req.body.cartaSample === false ? cartaSvc.blankCarta(settingsIn) : cartaSvc.sampleCarta(settingsIn);
      await cartaSvc.writeCarta(id, carta);
    }

    // Usuarios iniciales (admin, cajeros, domiciliario)
    const createdUsers = [];
    for (const u of usersIn) createdUsers.push(await usersLib.addUser(id, u));

    const on = mods.REGISTRY.filter(m => mods.isOn({ multiOrders, usesRecipes, cartaOnline, modules }, m.key)).map(m => m.label);
    await logAudit(id, { user: req.user.name || req.user.username, role: req.user.role, action: 'franquicia_creada',
      summary: `Franquicia creada${tpl ? ' con la plantilla "' + tpl.name + '"' : ''}. Módulos: ${on.join(', ') || 'solo la base'}. Usuarios creados: ${createdUsers.length}.` });

    res.status(201).json({ ...newBusiness, createdUsers });
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
 * Body (al menos uno): { usesRecipes?, icon?, spaceLabel?, spaceLabelPlural?, recipesLabel?,
 *   multiOrders?, spaceNames?, modules? }. Se guarda en la lista global (para mostrarlo en
 * Franquicias) y en el profile.json del negocio (para que la app lo aplique).
 */
router.put('/:id/settings', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { usesRecipes, icon } = req.body;
    const b = req.body;
    // Módulos por clave (asistente / editor): se traducen a los campos de siempre respetando dependencias
    let moduleChange = null;
    if (b.moduleKeys && typeof b.moduleKeys === 'object') {
      const prof0 = await readJSON(path.join(getBusinessPath(req.params.id), 'profile.json')) || {};
      const before = mods.currentState(prof0);
      const state = mods.resolve(before, b.moduleKeys);
      Object.assign(b, mods.toPatch(prof0, state));
      moduleChange = { before, state };
      b.usesRecipes = b.usesRecipes; // (ya viene en el parche)
    }
    const has = (k) => b[k] !== undefined;
    if (has('multiOrders') && typeof b.multiOrders !== 'boolean') return res.status(400).json({ error: 'multiOrders debe ser true o false' });
    if (has('spaceNames') && !Array.isArray(b.spaceNames)) return res.status(400).json({ error: 'spaceNames debe ser una lista' });
    if (usesRecipes !== undefined && typeof usesRecipes !== 'boolean') return res.status(400).json({ error: 'usesRecipes debe ser true o false' });
    if (icon !== undefined && !BUSINESS_ICON_KEYS.includes(icon)) return res.status(400).json({ error: 'Ícono no válido' });
    if (has('modules') && (typeof b.modules !== 'object' || b.modules === null)) return res.status(400).json({ error: 'modules debe ser un objeto' });
    const touchesSpaces = ['spaceLabel', 'spaceLabelPlural', 'recipesLabel', 'multiOrders', 'spaceNames'].some(has);
    if (b.usesRecipes === undefined && icon === undefined && !touchesSpaces && !has('modules') && !has('cartaOnline')) return res.status(400).json({ error: 'Nada que actualizar' });
    const businesses = await readJSON(BUSINESSES_FILE()) || [];
    const idx = businesses.findIndex(b => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Business not found' });
    if (b.usesRecipes !== undefined) businesses[idx].usesRecipes = b.usesRecipes;
    if (icon !== undefined) businesses[idx].icon = icon;

    const profilePath = path.join(getBusinessPath(req.params.id), 'profile.json');
    const profile = await readJSON(profilePath) || {};
    if (b.usesRecipes !== undefined) profile.usesRecipes = b.usesRecipes;
    if (icon !== undefined) profile.icon = icon;

    // Carta pública y pedidos: al prenderla por primera vez se crea la carta (de ejemplo o vacía)
    if (has('cartaOnline')) {
      if (typeof b.cartaOnline !== 'boolean') return res.status(400).json({ error: 'cartaOnline debe ser true o false' });
      if (b.cartaOnline && !(await cartaSvc.readCarta(req.params.id))) {
        const cs = b.cartaSettings || {};
        let wa = String(cs.whatsapp || '').replace(/\D/g, ''); if (wa.length === 10) wa = '57' + wa;
        const sIn = { whatsapp: wa, openFrom: cs.openFrom || '', openTo: cs.openTo || '', address: cs.address || profile.address || '', hours: String(cs.hours || '').slice(0, 220) };
        await cartaSvc.writeCarta(req.params.id, b.cartaSample === false ? cartaSvc.blankCarta(sIn) : cartaSvc.sampleCarta(sIn));
      }
      profile.cartaOnline = b.cartaOnline;
    }

    // Espacios de venta: nombre, modo de cobro y nombres propios
    if (touchesSpaces) {
      const tablesFile = path.join(getBusinessPath(req.params.id), 'tables.json');
      let tables = await readJSON(tablesFile) || [];
      let tablesChanged = false;

      const multi = has('multiOrders') ? b.multiOrders : !!profile.multiOrders;
      if (has('multiOrders') && b.multiOrders !== !!profile.multiOrders) {
        if (b.multiOrders) { tables = spaces.convertToMulti(tables); }
        else {
          const r = spaces.convertToSingle(tables);
          if (r.blocked) return res.status(409).json({ error: 'Hay ventas guardadas en los espacios. Fácturalas o elimínalas antes de volver a una sola cuenta por espacio.' });
          tables = r.tables;
        }
        tablesChanged = true;
      }
      if (has('spaceNames')) {
        const r = spaces.applyNames(tables, spaces.cleanNames(b.spaceNames), multi);
        if (r.blocked) {
          return res.status(409).json({ error: 'No se pueden quitar espacios ocupados: ' + r.blocked.map(t => t.name || t.number).join(', ') + '. Factúralos primero.' });
        }
        tables = r.tables;
        tablesChanged = true;
        profile.spaceNames = spaces.cleanNames(b.spaceNames);
        profile.tablesCount = tables.length;
      }
      if (tablesChanged) await writeJSON(tablesFile, tables);

      if (has('multiOrders')) { profile.multiOrders = b.multiOrders; businesses[idx].multiOrders = b.multiOrders; }
      if (has('spaceLabel')) {
        profile.spaceLabel = spaces.txt(b.spaceLabel, 30, 'Mesa');
        businesses[idx].spaceLabel = profile.spaceLabel;
        if (!has('spaceLabelPlural')) { profile.spaceLabelPlural = profile.spaceLabel + 's'; businesses[idx].spaceLabelPlural = profile.spaceLabelPlural; }
      }
      if (has('spaceLabelPlural')) {
        profile.spaceLabelPlural = spaces.txt(b.spaceLabelPlural, 30, (profile.spaceLabel || 'Mesa') + 's');
        businesses[idx].spaceLabelPlural = profile.spaceLabelPlural;
      }
      if (has('recipesLabel')) {
        profile.recipesLabel = spaces.txt(b.recipesLabel, 30, 'Recetas');
        businesses[idx].recipesLabel = profile.recipesLabel;
      }
    }

    // Módulos que usa el negocio (Deudas, Nómina, Finanzas, Reportes, Bitácora)
    if (has('modules')) {
      profile.modules = mods.cleanModules(b.modules, profile.modules);
      businesses[idx].modules = profile.modules;
    }

    await writeJSON(BUSINESSES_FILE(), businesses);
    await writeJSON(profilePath, profile);

    // Bitácora de la franquicia: qué módulos se prendieron o apagaron y quién lo hizo
    if (moduleChange) {
      const changes = mods.REGISTRY.filter(m => moduleChange.before[m.key] !== moduleChange.state[m.key])
        .map(m => (moduleChange.state[m.key] ? '+ ' : '− ') + m.label);
      if (changes.length) await logAudit(req.params.id, { user: req.user.name || req.user.username, role: req.user.role, action: 'modulos',
        summary: 'Módulos de la franquicia cambiados por el superadmin: ' + changes.join(', ') });
    }

    res.json({ ...businesses[idx], cartaOnline: profile.cartaOnline === true });
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
    // Pedidos en línea: borrar pedidos, salidas del bolsillo Domicilios y reiniciar la numeración (D-DC01…)
    await writeJSON(path.join(bizDir, 'pedidos.json'), []);
    await writeJSON(path.join(bizDir, 'domicilios.json'), []);
    await writeJSON(path.join(bizDir, 'pedidos-counter.json'), {});

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
      require('../services/docStore').close(target); // soltar la base de datos del negocio antes de borrar su carpeta
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
