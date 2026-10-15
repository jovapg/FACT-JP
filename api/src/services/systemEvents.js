/**
 * services/systemEvents.js — Problemas del sistema (solo los ve el superadmin)
 *
 * Guarda en <datos>/system-events.json los problemas que no son una acción de un
 * usuario sino algo que falló por dentro: un archivo de datos dañado, un respaldo
 * que no se pudo crear, un error que tumbó el servidor. Se muestran arriba en la
 * Bitácora, solo para el superadmin, y el menú marca cuántos hay sin revisar.
 *
 * Usa fs directo (no readJSON) para no entrar en un ciclo con fileStorage, que es
 * quien reporta los archivos dañados.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDataPath } = require('./fileStorage');

const MAX_EVENTS = 200;
const file = () => path.join(getDataPath(), 'system-events.json');

function load() {
  try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { return []; }
}

function save(list) {
  fs.mkdirSync(getDataPath(), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(list, null, 2), 'utf8');
}

/**
 * Registra un problema. Nunca lanza error. Si ya hay uno igual sin revisar, no se
 * duplica: solo sube su contador y se actualiza la fecha.
 */
function recordProblem({ type, title, detail }) {
  console.error(`[PROBLEMA] ${title}: ${detail}`);
  try {
    const list = load();
    const now = new Date().toISOString();
    const dup = list.find(e => !e.resolved && e.type === type && e.detail === detail);
    if (dup) {
      dup.count = (dup.count || 1) + 1;
      dup.date = now;
    } else {
      list.push({ id: uuidv4(), date: now, type, title, detail, count: 1, resolved: false });
    }
    save(list.slice(-MAX_EVENTS));
  } catch (err) {
    console.error('[system-events] no se pudo guardar el problema:', err.message);
  }
}

/** Lista los problemas, el más reciente primero */
function listEvents() {
  return load().slice().reverse();
}

/** Marca un problema (o todos) como revisado */
function resolveEvent(id) {
  const list = load();
  const ev = list.find(e => e.id === id);
  if (!ev) return false;
  ev.resolved = true;
  ev.resolvedAt = new Date().toISOString();
  save(list);
  return true;
}

function resolveAll() {
  const list = load();
  const now = new Date().toISOString();
  for (const e of list) if (!e.resolved) { e.resolved = true; e.resolvedAt = now; }
  save(list);
}

module.exports = { recordProblem, listEvents, resolveEvent, resolveAll };
