/**
 * services/audit.js — Bitácora de cambios (auditoría)
 *
 * Registra acciones sensibles (editar/eliminar facturas, fiados, abonos y
 * compras) en audit.json, con quién y cuándo. Sirve para que el dueño tenga
 * control sobre lo que hacen los cajeros/administradores.
 *
 * El archivo se mantiene acotado (últimas MAX_ENTRIES) para no crecer sin límite.
 */

const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, getBusinessPath } = require('./fileStorage');

const auditPath = (id) => path.join(getBusinessPath(id), 'audit.json');
const MAX_ENTRIES = 2000;

/** Formatea un número como pesos colombianos (para los resúmenes legibles) */
function cop(v) { return '$' + Number(v || 0).toLocaleString('es-CO'); }

/**
 * Registra una entrada en la bitácora. Nunca lanza error (la auditoría no debe
 * romper la operación principal).
 * @param {string} businessId
 * @param {{user?:string, role?:string, action?:string, summary?:string}} entry
 */
async function logAudit(businessId, { user, role, action, summary } = {}) {
  try {
    let log = await readJSON(auditPath(businessId)) || [];
    log.push({
      id: uuidv4(),
      date: new Date().toISOString(),
      user: user || 'desconocido',
      role: role || '',
      action: action || '',
      summary: summary || ''
    });
    if (log.length > MAX_ENTRIES) log = log.slice(log.length - MAX_ENTRIES);
    await writeJSON(auditPath(businessId), log);
  } catch (e) {
    console.error('[audit] Error guardando bitácora:', e);
  }
}

/** Devuelve la bitácora del negocio, más reciente primero */
async function getAudit(businessId) {
  const log = await readJSON(auditPath(businessId)) || [];
  return [...log].reverse();
}

module.exports = { logAudit, getAudit, cop };
