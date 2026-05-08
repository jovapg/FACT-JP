/**
 * middleware/auth.js — Middleware de autenticación JWT
 *
 * Proporciona funciones de middleware para Express:
 *   - authenticate:      verifica el token JWT en el header Authorization
 *   - requireRole:       verifica que el usuario tenga un rol específico
 *   - requireSuperAdmin: verifica que el usuario sea superadmin
 *   - signToken:         genera un nuevo token JWT con los datos del usuario
 *
 * El token se espera en el header: Authorization: Bearer <token>
 * Para rutas de descarga directa (PDF, Excel), los routers inyectan
 * el token desde ?token= query param ANTES de llamar a authenticate.
 */

const jwt = require('jsonwebtoken');

// Si no está configurado en .env se usa una clave por defecto (insegura en producción)
const JWT_SECRET = process.env.JWT_SECRET || 'facjp-secret-key-change-in-production';
if (!process.env.JWT_SECRET) {
  console.warn('[ADVERTENCIA] JWT_SECRET no está configurado en .env — usando clave por defecto. Cambia esto antes de producción.');
}

/**
 * Verifica el token JWT del header Authorization.
 * Si el token es válido, agrega `req.user` con los datos del usuario
 * (id, username, role, name, businessId).
 * Si no hay token o es inválido, responde 401.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extrae el token de "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Disponible en todos los handlers siguientes
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware de autorización por rol.
 * Se usa después de `authenticate`. Acepta uno o más roles como argumentos.
 * Ejemplo: requireRole('superadmin', 'admin')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Middleware específico para rutas exclusivas de superadmin.
 * Más explícito que requireRole('superadmin').
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin access required' });
  }
  next();
}

/**
 * Genera un token JWT firmado con los datos del usuario.
 * Por defecto expira en 8 horas (duración de un turno de trabajo).
 */
function signToken(payload, expiresIn = '8h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Validación multi-tenant: verifica que el usuario autenticado
 * tenga acceso al negocio indicado en :businessId de la URL.
 *
 * Reglas:
 *   - superadmin → acceso a cualquier negocio
 *   - admin / cajero → solo al negocio codificado en su JWT (req.user.businessId)
 *
 * Debe usarse DESPUÉS de `authenticate` ya que depende de req.user.
 *
 * Ejemplo de uso: router.get('/', authenticate, requireBusinessAccess, handler)
 */
function requireBusinessAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  // El superadmin puede acceder a cualquier negocio
  if (req.user.role === 'superadmin') {
    return next();
  }
  // Para admin y cajero: el businessId de la URL debe coincidir con el del token
  if (req.user.businessId && req.user.businessId === req.params.businessId) {
    return next();
  }
  return res.status(403).json({ error: 'Access denied to this business' });
}

module.exports = { authenticate, requireRole, requireSuperAdmin, signToken, requireBusinessAccess };
