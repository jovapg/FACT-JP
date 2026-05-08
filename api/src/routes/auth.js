/**
 * routes/auth.js — Rutas de autenticación
 *
 * Maneja el login, logout, consulta del usuario actual y
 * cambio de contraseña. Es el único router que NO usa mergeParams
 * porque no tiene :businessId en la URL.
 *
 * Al arrancar el servidor, auto-crea el superadmin si no existe
 * (usuario: superadmin / contraseña: Admin2026!).
 *
 * Rutas:
 *   POST /api/auth/login           → login con usuario y contraseña
 *   POST /api/auth/logout          → logout (solo invalida en cliente)
 *   GET  /api/auth/me              → datos del usuario autenticado
 *   POST /api/auth/change-password → cambia la contraseña del usuario actual
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, getDataPath, getBusinessPath, ensureBusinessDir } = require('../services/fileStorage');
const { signToken, authenticate } = require('../middleware/auth');

/**
 * Crea el usuario superadmin con contraseña hasheada si no existe.
 * Se ejecuta una sola vez al importar el módulo.
 * Credenciales iniciales: superadmin / Admin2026!
 */
async function initSuperAdmin() {
  const superadminPath = path.join(getDataPath(), 'superadmin.json');
  const existing = await readJSON(superadminPath);
  if (!existing) {
    const hashed = await bcrypt.hash('Admin2026!', 10);
    await writeJSON(superadminPath, {
      id: uuidv4(),
      username: 'superadmin',
      password: hashed,
      role: 'superadmin',
      name: 'Super Administrador'
    });
  }
}

initSuperAdmin();

/**
 * POST /api/auth/login
 *
 * Flujo:
 * 1. Intenta autenticar como superadmin (busca en superadmin.json)
 * 2. Si no es superadmin, busca en los usuarios de cada negocio
 * 3. Genera un JWT firmado con los datos del usuario
 * 4. Retorna token, usuario y lista de negocios accesibles
 *
 * El frontend usa la lista de negocios para decidir si muestra
 * el selector de negocios o va directo al dashboard.
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password, businessId } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Verificar si es el superadmin
    const superadminPath = path.join(getDataPath(), 'superadmin.json');
    const superadmin = await readJSON(superadminPath);

    if (superadmin && superadmin.username === username) {
      const valid = await bcrypt.compare(password, superadmin.password);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const businessesPath = path.join(getDataPath(), 'businesses.json');
      const businesses = await readJSON(businessesPath) || [];

      const token = signToken({
        id: superadmin.id,
        username: superadmin.username,
        role: 'superadmin',
        name: superadmin.name
      });

      return res.json({
        token,
        user: { id: superadmin.id, username: superadmin.username, role: 'superadmin', name: superadmin.name },
        businesses // El superadmin ve todos los negocios
      });
    }

    // Buscar en usuarios de negocios
    const businessesPath = path.join(getDataPath(), 'businesses.json');
    const businesses = await readJSON(businessesPath) || [];

    let foundUser = null;
    let foundBusiness = null;

    // Si se especificó businessId, solo buscar en ese negocio (más rápido)
    const searchBusinesses = businessId ? businesses.filter(b => b.id === businessId) : businesses;

    for (const biz of searchBusinesses) {
      const usersPath = path.join(getBusinessPath(biz.id), 'users.json');
      const users = await readJSON(usersPath) || [];
      const user = users.find(u => u.username === username);
      if (user) {
        const valid = await bcrypt.compare(password, user.password);
        if (valid) {
          foundUser = user;
          foundBusiness = biz;
          break;
        }
      }
    }

    if (!foundUser) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // El usuario de negocio solo ve su propio negocio
    const userBusinesses = businesses.filter(b => b.id === foundBusiness.id);

    const token = signToken({
      id: foundUser.id,
      username: foundUser.username,
      role: foundUser.role,
      name: foundUser.name,
      businessId: foundBusiness.id
    });

    res.json({
      token,
      user: { id: foundUser.id, username: foundUser.username, role: foundUser.role, name: foundUser.name, businessId: foundBusiness.id },
      businesses: userBusinesses,
      currentBusiness: foundBusiness // Auto-selecciona el negocio en el frontend
    });

  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/auth/logout
 * El JWT es stateless, el logout real ocurre en el cliente (borra el token).
 * Este endpoint solo confirma la operación.
 */
router.post('/logout', authenticate, (req, res) => {
  res.json({ success: true, message: 'Logged out' });
});

/**
 * GET /api/auth/me
 * Retorna los datos del usuario autenticado (decodificados del JWT).
 */
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

/**
 * POST /api/auth/change-password
 * Cambia la contraseña del usuario actual verificando primero la contraseña actual.
 * Funciona tanto para superadmin como para usuarios de negocio.
 */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both passwords required' });
    }

    if (req.user.role === 'superadmin') {
      // Cambiar contraseña del superadmin
      const superadminPath = path.join(getDataPath(), 'superadmin.json');
      const superadmin = await readJSON(superadminPath);
      const valid = await bcrypt.compare(currentPassword, superadmin.password);
      if (!valid) return res.status(401).json({ error: 'Current password incorrect' });
      superadmin.password = await bcrypt.hash(newPassword, 10);
      await writeJSON(superadminPath, superadmin);
    } else {
      // Cambiar contraseña de usuario de negocio
      const usersPath = path.join(getBusinessPath(req.user.businessId), 'users.json');
      const users = await readJSON(usersPath) || [];
      const idx = users.findIndex(u => u.id === req.user.id);
      if (idx === -1) return res.status(404).json({ error: 'User not found' });
      const valid = await bcrypt.compare(currentPassword, users[idx].password);
      if (!valid) return res.status(401).json({ error: 'Current password incorrect' });
      users[idx].password = await bcrypt.hash(newPassword, 10);
      await writeJSON(usersPath, users);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
