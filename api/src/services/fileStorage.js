/**
 * services/fileStorage.js — Capa de persistencia en archivos JSON
 *
 * Reemplaza una base de datos. Todos los datos se guardan como archivos
 * .json en el directorio configurado en DATA_PATH (por defecto ./src/data).
 *
 * Estructura de directorios:
 *   data/
 *     superadmin.json          ← credenciales del superadmin
 *     businesses.json          ← lista de negocios/franquicias
 *     <businessId>/
 *       profile.json           ← configuración del negocio
 *       users.json             ← usuarios del negocio
 *       inventory.json         ← inventario de insumos
 *       recipes.json           ← recetas y menú
 *       tables.json            ← estado de las mesas
 *       sales.json             ← historial de ventas
 *       purchases.json         ← historial de compras
 *       suppliers.json         ← proveedores, empleados, arriendos, créditos
 *
 * Todas las funciones son async para mantener compatibilidad con código
 * que podría migrar a una base de datos real en el futuro.
 */

const fs = require('fs');
const path = require('path');

// Directorio raíz de los datos.
// Prioridad: 1) variable de entorno DATA_PATH, 2) volumen Railway en /storage,
// 3) ruta local por defecto (desarrollo).
function detectDataPath() {
  if (process.env.DATA_PATH) return process.env.DATA_PATH;
  try {
    if (fs.existsSync('/storage')) return '/storage';
  } catch {}
  return path.join(__dirname, '../data');
}
const DATA_PATH = detectDataPath();

/** Retorna la ruta absoluta del directorio de datos */
function getDataPath() {
  return DATA_PATH;
}

/**
 * Retorna la ruta del directorio de un negocio específico.
 *
 * Prevención de path traversal: el businessId solo puede contener
 * caracteres alfanuméricos, guiones y guiones bajos (formato UUID).
 * Esto bloquea intentos como '../../etc/passwd' o '../superadmin.json'
 * que podrían escapar del directorio data/ y leer archivos del servidor.
 */
function getBusinessPath(businessId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(businessId)) {
    throw new Error('BusinessId inválido: solo se permiten caracteres alfanuméricos y guiones');
  }
  return path.join(DATA_PATH, businessId);
}

/**
 * Crea el directorio del negocio si no existe.
 * Se llama cuando se crea un negocio nuevo.
 */
function ensureBusinessDir(businessId) {
  const dir = getBusinessPath(businessId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Crea un directorio si no existe.
 * Versión genérica de ensureBusinessDir para cualquier ruta.
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Lee y parsea un archivo JSON.
 * Retorna null si el archivo no existe o tiene un error de parseo
 * (en lugar de lanzar excepción, para simplificar el manejo de errores).
 */
async function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Guarda un objeto/array como JSON formateado en el archivo indicado.
 * Crea el directorio padre si no existe.
 */
async function writeJSON(filePath, data) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Agrega un ítem al final del array en el archivo JSON.
 * Si el archivo no existe, lo crea con el ítem como primer elemento.
 */
async function appendToJSON(filePath, item) {
  const existing = await readJSON(filePath) || [];
  existing.push(item);
  await writeJSON(filePath, existing);
  return existing;
}

/**
 * Actualiza un ítem específico del array en el archivo JSON,
 * identificado por su campo `id`. Retorna null si no lo encuentra.
 */
async function updateInJSON(filePath, id, updates) {
  const items = await readJSON(filePath) || [];
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...updates };
  await writeJSON(filePath, items);
  return items[idx];
}

/**
 * Elimina un ítem del array en el archivo JSON por su campo `id`.
 * Retorna false si el ítem no existía, true si fue eliminado.
 */
async function deleteFromJSON(filePath, id) {
  let items = await readJSON(filePath) || [];
  const before = items.length;
  items = items.filter(i => i.id !== id);
  if (items.length === before) return false; // No se encontró el ítem
  await writeJSON(filePath, items);
  return true;
}

module.exports = {
  getDataPath,
  getBusinessPath,
  ensureBusinessDir,
  ensureDir,
  readJSON,
  writeJSON,
  appendToJSON,
  updateInJSON,
  deleteFromJSON
};
