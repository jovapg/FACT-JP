/**
 * routes/inventory.js — CRUD de inventario de insumos
 *
 * Gestiona los productos/insumos del inventario del negocio.
 * Los cajeros no tienen permiso para crear, editar ni eliminar ítems.
 *
 * Cada ítem de inventario tiene: nombre, unidad, stock, costo,
 * categoría, stock mínimo (para alertas) y fecha de creación.
 *
 * Rutas:
 *   GET    /api/:businessId/inventory              → listar todos los ítems
 *   POST   /api/:businessId/inventory              → crear nuevo ítem (admin+)
 *   PUT    /api/:businessId/inventory/:id          → actualizar ítem (admin+)
 *   DELETE /api/:businessId/inventory/:id          → eliminar ítem (admin+)
 *   PATCH  /api/:businessId/inventory/:id/adjust   → ajustar stock manualmente (admin+)
 */

const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams: true es CRÍTICO para recibir :businessId del router padre
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, getBusinessPath } = require('../services/fileStorage');
const { authenticate } = require('../middleware/auth');
const { adjustStock } = require('../services/inventoryService');
const { logAudit } = require('../services/audit');

const inventoryPath = (id) => path.join(getBusinessPath(id), 'inventory.json');

/** GET — Retorna todos los ítems de inventario del negocio */
router.get('/inventory', authenticate, async (req, res) => {
  try {
    const items = await readJSON(inventoryPath(req.params.businessId)) || [];
    res.json(items);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST — Crea un nuevo ítem en el inventario. Solo admin y superadmin.
 *
 * Body esperado:
 *   { name, unit?, stock?, cost?, category?, minStock?, supplierId?, salePrice? }
 *
 * supplierId: vincula el producto a un proveedor específico para que aparezca
 *   pre-filtrado en el modal de compras cuando se selecciona ese proveedor.
 *   Es opcional (null si no se especifica).
 *
 * salePrice: campo ignorado aquí; solo lo usa el frontend para crear la receta
 *   de menú automáticamente cuando la categoría tiene autoRecipe = true.
 */
router.post('/inventory', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const items = await readJSON(inventoryPath(req.params.businessId)) || [];
    const newItem = {
      id: uuidv4(),
      name: req.body.name,
      unit: req.body.unit || 'unidad',
      stock: Number(req.body.stock) || 0,
      cost: Number(req.body.cost) || 0,
      category: req.body.category || 'general',
      area: req.body.area === 'restaurante' ? 'restaurante' : 'bar', // Bolsillo del insumo: bar | restaurante
      minStock: Number(req.body.minStock) || 0,
      supplierId: req.body.supplierId || null,  // Vinculación proveedor-producto para filtros en compras
      salePrice: Number(req.body.salePrice) || 0,
      noStock: !!req.body.noStock,  // true = servicio / sin control de stock (nunca sale "agotado")
      createdAt: new Date().toISOString()
    };
    items.push(newItem);
    await writeJSON(inventoryPath(req.params.businessId), items);
    res.status(201).json(newItem);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/** PUT — Actualiza todos los campos de un ítem de inventario por ID */
/**
 * POST /inventory/import — Carga masiva de productos (pegados desde Excel, CSV o .xlsx).
 * Campos: text (lista pegada) o file (.xlsx/.csv/.txt) · control: 'con' | 'sin' (stock de los nuevos) · updatePrices: '1'
 *         area: 'bar' | 'restaurante' · dryRun: '1' (solo vista previa, no guarda nada)
 * Sin dryRun crea los nuevos (y actualiza precios si se pidió) en UNA sola escritura. Solo admin.
 */
const importUpload = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router.post('/inventory/import', authenticate, importUpload.single('file'), async (req, res) => {
  try {
    if (!['admin', 'superadmin'].includes(req.user.role)) return res.status(403).json({ error: 'Solo el administrador puede cargar productos' });
    const imp = require('../services/inventoryImport');
    let raw;
    if (req.file) {
      if (req.file.originalname.toLowerCase().endsWith('.xlsx')) raw = await imp.parseXlsx(req.file.buffer);
      else {
        let t = req.file.buffer.toString('utf8'); if (t.includes(imp.BAD_CHAR)) t = req.file.buffer.toString('latin1'); // CSV guardado desde Excel en Windows
        raw = imp.parseDelimited(imp.stripBom(t));
      }
    } else raw = imp.parseDelimited(imp.stripBom(String(req.body.text || '')));
    if (!raw.length) return res.status(400).json({ error: 'No encontré productos en lo que enviaste' });

    const bid = req.params.businessId;
    const items = await readJSON(inventoryPath(bid)) || [];
    const p = imp.plan(raw, items, { control: req.body.control, updatePrices: req.body.updatePrices === '1' || req.body.updatePrices === true, area: req.body.area });
    if (req.body.dryRun === '1' || req.body.dryRun === true) return res.json({ dryRun: true, ...p });

    const now = new Date().toISOString();
    let created = 0, updated = 0;
    for (const r of p.rows) {
      if (r.status === 'nuevo') {
        items.push({ id: uuidv4(), name: r.name, unit: r.unit, stock: r.stock, cost: r.cost, category: r.category, area: r.area, minStock: r.minStock,
          supplierId: null, salePrice: r.salePrice, noStock: r.noStock, createdAt: now });
        created++;
      } else if (r.status === 'actualiza') {
        const it = items.find(x => x.id === r.id); if (it) { it.salePrice = r.salePrice; updated++; }
      }
    }
    if (created || updated) await writeJSON(inventoryPath(bid), items);
    await logAudit(bid, { user: req.user.name || req.user.username, role: req.user.role, action: 'inventario_importar',
      summary: `Carga masiva de productos: ${created} nuevos, ${updated} con precio actualizado, ${p.counts.existe} ya existían, ${p.counts.error} con error` });
    res.json({ dryRun: false, created, updated, ...p });
  } catch (err) {
    if (err && String(err.message).startsWith('Máximo ')) return res.status(400).json({ error: err.message });
    console.error(err); res.status(500).json({ error: 'No se pudo leer la lista. Revisa el formato.' });
  }
});

router.put('/inventory/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const items = await readJSON(inventoryPath(req.params.businessId)) || [];
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Item not found' });
    items[idx] = { ...items[idx], ...req.body, id: req.params.id }; // Preserva el ID original
    await writeJSON(inventoryPath(req.params.businessId), items);
    res.json(items[idx]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /inventory/min-stock-zero — Pone el stock mínimo en 0 a TODOS los ítems (admin). */
router.post('/inventory/min-stock-zero', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const items = await readJSON(inventoryPath(req.params.businessId)) || [];
    let changed = 0;
    for (const it of items) {
      if ((it.minStock || 0) !== 0) changed++;
      it.minStock = 0;
    }
    await writeJSON(inventoryPath(req.params.businessId), items);
    res.json({ success: true, total: items.length, changed });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/** DELETE — Elimina un ítem de inventario por ID */
router.delete('/inventory/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    let items = await readJSON(inventoryPath(req.params.businessId)) || [];
    items = items.filter(i => i.id !== req.params.id);
    await writeJSON(inventoryPath(req.params.businessId), items);
    res.json({ success: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /inventory/:id/adjust — Ajuste manual de stock.
 * Body: { adjustment: number, reason: string }
 * `adjustment` positivo = entrada de stock, negativo = merma/salida.
 * Delega la lógica al servicio inventoryService.
 */
router.patch('/inventory/:id/adjust', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const { adjustment, reason } = req.body;
    const updated = await adjustStock(req.params.businessId, req.params.id, Number(adjustment), reason);
    if (!updated) return res.status(404).json({ error: 'Item not found' });
    res.json(updated);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /inventory/count — Conteo físico de inventario.
 * Body: { items: [{ id, counted }] }
 * Para cada ítem con conteo, fija el stock al valor contado y registra la
 * diferencia (merma/sobrante) en lastAdjustment. Devuelve el detalle de cambios.
 * Solo admin/superadmin.
 */
router.post('/inventory/count', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    const counts = Array.isArray(req.body.items) ? req.body.items : [];
    const inventory = await readJSON(inventoryPath(req.params.businessId)) || [];

    const changes = [];
    for (const c of counts) {
      if (c.counted === undefined || c.counted === null || c.counted === '') continue;
      const counted = Number(c.counted);
      if (isNaN(counted) || counted < 0) continue;
      const idx = inventory.findIndex(i => i.id === c.id);
      if (idx === -1) continue;
      const before = inventory[idx].stock || 0;
      const diff = counted - before;
      if (diff === 0) continue;
      inventory[idx].stock = counted;
      inventory[idx].lastAdjustment = { amount: diff, reason: 'Conteo físico', date: new Date().toISOString() };
      changes.push({ id: inventory[idx].id, name: inventory[idx].name, before, after: counted, diff });
    }

    if (changes.length > 0) {
      await writeJSON(inventoryPath(req.params.businessId), inventory);
      await logAudit(req.params.businessId, {
        user: req.user.name || req.user.username, role: req.user.role, action: 'inventory_count',
        summary: `Hizo conteo físico: ${changes.length} ítem(s) ajustados`
      });
    }
    res.json({ ajustados: changes.length, changes, inventory });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

// Image upload for multer - configured in server.js and passed via router
// POST /inventory/:id/image — upload product image
router.post('/inventory/:id/image', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });
    if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });

    const inventory = await readJSON(inventoryPath(req.params.businessId)) || [];
    const idx = inventory.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Producto no encontrado' });

    // La foto se reduce a un tamaño de carta (máx. 560 px, WebP): la que sube el celular pesa 3-8 MB y
    // el cliente la descargaría en su plan de datos. Si por algo no se puede reducir, solo se acepta si ya es pequeña.
    let filename = req.file.filename;
    try {
      const sharp = require('sharp');
      const dir = path.dirname(req.file.path);
      const base = path.parse(req.file.filename).name;
      const tmp = path.join(dir, base + '.tmp-' + Date.now() + '.webp');
      await sharp(req.file.path).rotate().resize({ width: 560, height: 560, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76 }).toFile(tmp);
      const finalPath = path.join(dir, base + '.webp');
      if (req.file.path !== finalPath) { try { fs.unlinkSync(req.file.path); } catch { /* ya no está */ } }
      fs.renameSync(tmp, finalPath);
      filename = base + '.webp';
    } catch (e) {
      console.error('[imagen] no se pudo reducir:', e.message);
      // Si la librería no está disponible se acepta la foto original (solo si es pequeña); si el archivo
      // no se puede leer como imagen, se rechaza.
      const sinLibreria = e.code === 'MODULE_NOT_FOUND';
      if (!sinLibreria || req.file.size > 2 * 1024 * 1024) {
        try { fs.unlinkSync(req.file.path); } catch { /* ya no está */ }
        return res.status(400).json({ error: sinLibreria ? 'La foto es muy pesada (máx 2 MB). Prueba con otra.' : 'Ese archivo no es una foto válida. Prueba con un JPG, PNG o WEBP.' });
      }
    }
    // ?v= evita que el celular siga mostrando la foto vieja cuando se reemplaza
    const imageUrl = `/uploads/${req.params.businessId}/${filename}?v=${Date.now()}`;
    inventory[idx].imageUrl = imageUrl;
    await writeJSON(inventoryPath(req.params.businessId), inventory);
    res.json({ imageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
