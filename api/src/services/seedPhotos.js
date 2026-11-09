/**
 * services/seedPhotos.js — Fotos de productos que viajan con la aplicación
 *
 * Carpeta:  api/seed-photos/<slug-del-negocio>/manifest.json  + las fotos (.webp ya reducidas a tamaño de carta)
 * manifest: { "slug": "deli-combos", "photos": [ { "file": "deditos.webp", "products": ["Deditos"] }, ... ] }
 *
 * Al arrancar, para el negocio con ese slug, cada foto se copia a su carpeta de datos y se asigna a los productos del
 * inventario con ese nombre. Reglas de seguridad:
 *   - NUNCA pisa una foto que el negocio ya tenga (si la subieron a mano, se respeta).
 *   - Si un producto todavía no existe en el inventario, se salta y se intenta de nuevo en el próximo arranque.
 *   - Es repetible: volver a correrlo no cambia nada.
 */
const fs = require('fs');
const path = require('path');
const { readJSON, writeJSON, getBusinessPath, getDataPath, ensureBusinessDir } = require('./fileStorage');

const SEED_DIR = path.join(__dirname, '../../seed-photos');
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Aplica las fotos de una carpeta de semillas a UN negocio. Devuelve { set, skippedHasPhoto, missing } */
async function applyToBusiness(businessId, manifest, dir) {
  const invPath = path.join(getBusinessPath(businessId), 'inventory.json');
  const inv = await readJSON(invPath);
  const out = { set: 0, skippedHasPhoto: 0, missing: [] };
  if (!Array.isArray(inv) || !inv.length) { out.missing = manifest.photos.flatMap(p => p.products); return out; }
  const byName = new Map(inv.map(i => [norm(i.name), i]));
  ensureBusinessDir(businessId);
  let changed = false;
  for (const photo of manifest.photos) {
    const src = path.join(dir, photo.file);
    if (!fs.existsSync(src)) continue;
    for (const name of photo.products) {
      const item = byName.get(norm(name));
      if (!item) { out.missing.push(name); continue; }
      if (item.imageUrl) { out.skippedHasPhoto++; continue; }
      const fileName = `${item.id}.webp`;
      fs.copyFileSync(src, path.join(getBusinessPath(businessId), fileName));
      item.imageUrl = `/uploads/${businessId}/${fileName}?v=${Date.now()}`;
      out.set++; changed = true;
    }
  }
  if (changed) await writeJSON(invPath, inv);
  return out;
}

/** Recorre las carpetas de semillas y las aplica a los negocios con ese slug. Nunca lanza error. */
async function run(seedDir = SEED_DIR) {
  try {
    if (!fs.existsSync(seedDir)) return [];
    const businesses = await readJSON(path.join(getDataPath(), 'businesses.json')) || [];
    const results = [];
    for (const d of fs.readdirSync(seedDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const dir = path.join(seedDir, d.name);
      let manifest; try { manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); } catch { continue; }
      if (!manifest || !Array.isArray(manifest.photos)) continue;
      const biz = businesses.find(b => b.slug === (manifest.slug || d.name));
      if (!biz) continue;
      const r = await applyToBusiness(biz.id, manifest, dir);
      results.push({ slug: biz.slug, ...r });
      if (r.set) console.log(`[fotos] ${biz.slug}: ${r.set} foto(s) asignadas a productos` + (r.missing.length ? ` (faltan en el inventario: ${[...new Set(r.missing)].join(', ')})` : ''));
    }
    return results;
  } catch (e) { console.error('[fotos] no se pudieron montar las fotos de semilla:', e.message); return []; }
}

module.exports = { run, applyToBusiness };
