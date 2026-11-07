/**
 * services/users.js — Usuarios de los negocios (compartido por el asistente de franquicias y server.js)
 */
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, getDataPath, getBusinessPath } = require('./fileStorage');

const ASSIGNABLE_ROLES = ['admin', 'cajero', 'domiciliario'];

/** El nombre de usuario es único en TODO el sistema (así el login sabe a qué negocio entra) */
async function usernameTaken(username, exceptUserId = null) {
  const wanted = String(username || '').trim().toLowerCase();
  const superadmin = await readJSON(path.join(getDataPath(), 'superadmin.json'));
  if (superadmin && String(superadmin.username).toLowerCase() === wanted) return true;
  const businesses = await readJSON(path.join(getDataPath(), 'businesses.json')) || [];
  for (const b of businesses) {
    const list = await readJSON(path.join(getBusinessPath(b.id), 'users.json'));
    if (Array.isArray(list) && list.some(u => u.id !== exceptUserId && String(u.username).toLowerCase() === wanted)) return true;
  }
  return false;
}

/** Crea un usuario en un negocio. Devuelve el usuario sin contraseña. */
async function addUser(businessId, { name, username, password, role }) {
  const file = path.join(getBusinessPath(businessId), 'users.json');
  const users = await readJSON(file) || [];
  const user = { id: uuidv4(), name: String(name || username).trim(), username: String(username).trim(), role, password: await bcrypt.hash(password, 10) };
  users.push(user);
  await writeJSON(file, users);
  const { password: _omit, ...safe } = user;
  return safe;
}

module.exports = { ASSIGNABLE_ROLES, usernameTaken, addUser };
