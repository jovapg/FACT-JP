/**
 * services/restoreService.js — Restaurar un respaldo (una franquicia o todas)
 *
 * Antes de escribir nada se crea un respaldo de seguridad de lo que hay ahora, por si hace falta volver atrás.
 * Restaurar UNA franquicia solo toca los archivos y fotos de esa franquicia (y su línea en businesses.json):
 * las demás no se mueven. Restaurar TODO reemplaza todos los archivos que traiga el respaldo.
 * Cada archivo se escribe completo o no se escribe (se arma aparte y se renombra).
 */
const fs = require('fs');
const path = require('path');
const { getDataPath } = require('./fileStorage');
const { createBackup } = require('./backupService');
const { logAudit } = require('./audit');

const ID_RE = /^[a-zA-Z0-9_-]+$/;
const parse = (text, fb) => { try { return JSON.parse(text); } catch { return fb; } };
const count = (files, rel) => { const v = parse(files[rel], null); return Array.isArray(v) ? v.length : 0; };

/** Resumen de lo que trae un respaldo, por franquicia */
function summarize(payload) {
  const files = payload.files, blobs = payload.blobs || {};
  const list = parse(files['businesses.json'], []);
  const businesses = (Array.isArray(list) ? list : []).filter(b => b && ID_RE.test(String(b.id))).map(b => {
    const sales = parse(files[`${b.id}/sales.json`], []);
    const last = Array.isArray(sales) && sales.length ? sales.map(s => s.createdAt).sort().pop() : null;
    return {
      id: b.id, name: b.name, slug: b.slug,
      sales: count(files, `${b.id}/sales.json`), pedidos: count(files, `${b.id}/pedidos.json`),
      products: count(files, `${b.id}/inventory.json`), users: count(files, `${b.id}/users.json`),
      photos: Object.keys(blobs).filter(k => k.startsWith(b.id + '/')).length, lastSale: last
    };
  });
  return { createdAt: payload.createdAt, version: payload.version, files: Object.keys(files).length, photos: Object.keys(blobs).length, businesses };
}

function writeAtomic(dest, data) {
  const st = require('./fileStorage');
  if (st.docInfo(dest)) { st.writeText(dest, String(data)); return; } // documento de un negocio: va a su base de datos
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = dest + '.restore-tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, dest); // el temporal termina en .restore-tmp (se limpia solo si queda de una falla)
}

/**
 * Restaura. scope: 'all' o lista de ids de franquicias.
 * Devuelve { safetyBackup, files, photos, businesses }.
 */
async function restore(payload, scope, who = 'superadmin') {
  const root = path.resolve(getDataPath());
  const files = payload.files, blobs = payload.blobs || {};
  const bundleBiz = parse(files['businesses.json'], []);
  const all = scope === 'all';
  const ids = all ? bundleBiz.map(b => b.id) : (Array.isArray(scope) ? scope.map(String) : []);
  if (!all && !ids.length) throw new Error('Escoge qué franquicias restaurar');
  for (const id of ids) {
    if (!ID_RE.test(id)) throw new Error('Identificador de franquicia no válido');
    if (!bundleBiz.some(b => b.id === id)) throw new Error('Una de las franquicias no está en ese respaldo');
  }

  // 1) Respaldo de seguridad de lo que hay AHORA
  const safety = createBackup();

  // 2) Escribir
  const wanted = (rel) => all || ids.some(id => rel.startsWith(id + '/'));
  let nf = 0, np = 0;
  const safe = (rel) => {
    const dest = path.resolve(root, rel);
    if (dest !== root && !dest.startsWith(root + path.sep)) throw new Error('Ruta sospechosa en el respaldo: ' + rel);
    if (rel.split('/')[0] === 'backups') throw new Error('El respaldo trae una ruta no permitida: ' + rel);
    return dest;
  };
  for (const [rel, text] of Object.entries(files)) {
    if (!wanted(rel)) continue;
    if (!all && rel === 'businesses.json') continue; // la lista se arma aparte
    writeAtomic(safe(rel), text); nf++;
  }
  for (const [rel, b64] of Object.entries(blobs)) {
    if (!wanted(rel)) continue;
    writeAtomic(safe(rel), Buffer.from(b64, 'base64')); np++;
  }

  // 3) Al restaurar solo algunas, su línea en la lista de franquicias vuelve a ser la del respaldo
  if (!all) {
    const file = path.join(root, 'businesses.json');
    const cur = parse(require('./fileStorage').readText(file) || '[]', []);
    for (const id of ids) {
      const fromBundle = bundleBiz.find(b => b.id === id);
      const i = cur.findIndex(b => b.id === id);
      if (i >= 0) cur[i] = fromBundle; else cur.push(fromBundle);
    }
    writeAtomic(file, JSON.stringify(cur, null, 2)); nf++;
  }

  // 4) Dejar constancia en la bitácora de cada franquicia restaurada
  for (const id of ids) {
    try {
      await logAudit(id, { user: who, role: 'superadmin', action: 'restauracion',
        summary: `Se restauraron los datos desde el respaldo del ${new Date(payload.createdAt).toLocaleString('es-CO')}. Se guardó antes un respaldo de seguridad (${safety.name}).` });
    } catch { /* la bitácora no debe frenar la restauración */ }
  }
  return { safetyBackup: safety.name, files: nf, photos: np, businesses: ids };
}

module.exports = { summarize, restore };
