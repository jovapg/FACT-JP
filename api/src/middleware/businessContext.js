/**
 * middleware/businessContext.js — Middleware de contexto de negocio
 *
 * Carga el perfil del negocio correspondiente al `:businessId` de la URL
 * y lo adjunta a `req.business` para que los handlers lo puedan usar
 * sin tener que volver a leer el archivo.
 *
 * Si el negocio no existe devuelve 404 inmediatamente.
 * Actualmente este middleware es opcional (no se usa en todas las rutas
 * porque cada handler lee el perfil directamente cuando lo necesita).
 */

const { readJSON, getBusinessPath } = require('../services/fileStorage');
const path = require('path');

/**
 * Lee el profile.json del negocio indicado en req.params.businessId
 * y lo almacena en req.business. Si no existe, responde 404.
 */
async function businessContext(req, res, next) {
  const { businessId } = req.params;
  if (!businessId) return next(); // Si no hay businessId en la URL, continuar sin contexto

  try {
    const profilePath = path.join(getBusinessPath(businessId), 'profile.json');
    const profile = await readJSON(profilePath);
    if (!profile) {
      return res.status(404).json({ error: 'Business not found' });
    }
    req.business = profile; // Disponible como req.business en el handler
    next();
  } catch {
    return res.status(404).json({ error: 'Business not found' });
  }
}

module.exports = { businessContext };
