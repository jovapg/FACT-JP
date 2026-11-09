/**
 * tests/helpers.js — Base de las pruebas automáticas
 *
 * Cada archivo de prueba arranca el servidor REAL en un puerto libre, con una carpeta de datos temporal vacía
 * (nunca toca datos reales), y lo habla por HTTP como lo haría la app. Se borra todo al terminar.
 *
 * Correr:  cd api && npm test
 */
const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SA_USER = 'superadmin';
const SA_PASS = 'Prueba-Super-1234';
let counter = 0;

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });
}

/** Arranca el servidor. extraEnv permite pasar variables (p. ej. las del almacenamiento externo de prueba). */
async function startServer(extraEnv = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'facjp-test-'));
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), DATA_PATH: dataDir, JWT_SECRET: 'secreto-solo-para-pruebas', SUPERADMIN_PASSWORD: SA_PASS,
      NODE_ENV: 'test', B2_KEY_ID: '', B2_APP_KEY: '', B2_BUCKET: '', B2_ENDPOINT: '', BACKUP_KEY: '', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  child.stdout.on('data', d => { log += d; }); child.stderr.on('data', d => { log += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* aún arrancando */ }
    if (child.exitCode !== null) throw new Error('El servidor se cerró al arrancar:\n' + log);
    await new Promise(r => setTimeout(r, 100));
  }
  // El superadmin se crea al arrancar: esperar a que se pueda entrar con él (sirve igual con archivos o con base de datos)
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.16.${i >> 8}.${i & 255}` }, body: JSON.stringify({ username: SA_USER, password: SA_PASS }) });
      if (r.status === 200) break;
    } catch { /* aún arrancando */ }
    await new Promise(r => setTimeout(r, 100));
  }

  /** Llamada HTTP. Cada una sale con una IP distinta para no chocar con los límites por IP. */
  async function api(method, url, { token, body, headers = {}, raw } = {}) {
    const h = { 'X-Forwarded-For': `10.${(counter >> 16) & 255}.${(counter >> 8) & 255}.${++counter & 255}`, ...headers };
    if (token) h.Authorization = 'Bearer ' + token;
    let payload;
    const sinCuerpo = ['GET', 'HEAD'].includes(method.toUpperCase());
    if (!sinCuerpo && raw !== undefined) payload = raw; else if (!sinCuerpo && body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(base + url, { method, headers: h, body: payload });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  }
  const login = async (username, password) => {
    const r = await api('POST', '/api/auth/login', { body: { username, password } });
    if (r.status !== 200) throw new Error(`Login de ${username} falló: ${r.status} ${JSON.stringify(r.data)}`);
    return r.data.token;
  };
  const stop = async () => {
    child.kill();
    await new Promise(r => { child.once('exit', r); setTimeout(r, 2000); });
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* Windows puede tardar en soltar archivos */ }
  };
  return { base, dataDir, api, login, stop, getLog: () => log, superToken: () => login(SA_USER, SA_PASS) };
}

/** Crea una franquicia con el asistente (como lo hace el superadmin) y devuelve sus datos y tokens de sus usuarios */
async function createFranchise(srv, superToken, { name, slug, template = 'polleria', users, extra = {} }) {
  const defaults = users || [
    { name: 'Admin', username: `${slug}-admin`, password: 'Clave-Admin-1', role: 'admin' },
    { name: 'Caja', username: `${slug}-caja`, password: 'Clave-Caja-1', role: 'cajero' }
  ];
  const r = await srv.api('POST', '/api/businesses', { token: superToken, body: { name, slug, invoicePrefix: slug.slice(0, 2).toUpperCase(), template, users: defaults,
    cartaSettings: { whatsapp: '3001234567', openFrom: '', openTo: '' }, ...extra } });
  if (r.status !== 201) throw new Error('No se pudo crear la franquicia: ' + JSON.stringify(r.data));
  const tokens = {};
  for (const u of defaults) tokens[u.role] = await srv.login(u.username, u.password);
  return { id: r.data.id, slug, name, tokens, users: defaults };
}

/** Abre un turno de caja (si no hay uno) */
async function openShift(srv, token, bizId, openingCash = 0) {
  const r = await srv.api('POST', `/api/${bizId}/shifts/open`, { token, body: { openingCash } });
  if (![200, 201, 400].includes(r.status)) throw new Error('No se pudo abrir el turno: ' + JSON.stringify(r.data));
  return r.data;
}

/** Hace un pedido público de un producto por nombre y devuelve la respuesta */
async function publicOrder(srv, slug, productName, extra = {}) {
  const carta = (await srv.api('GET', `/api/public/carta/${slug}`)).data;
  const p = carta.products.find(x => x.name === productName);
  if (!p) throw new Error('Producto no encontrado en la carta: ' + productName);
  const phone = '31' + String(10000000 + Math.floor(Math.random() * 89999999));
  return srv.api('POST', `/api/public/pedidos/${slug}`, { body: { name: 'Cliente Prueba', phone, address: 'Calle 1 # 2-3', mode: 'domicilio', payment: 'efectivo',
    privacyAccepted: true, items: [{ productId: p.id, qty: 1 }], ...extra } });
}

/**
 * Leer / escribir un documento de un negocio directamente en el disco (como si alguien tocara los datos por fuera de la app).
 * Funciona con los dos motores: archivo .json o la base negocio.db de ese negocio.
 */
const sqliteMode = () => (process.env.STORAGE_ENGINE || 'json').toLowerCase() === 'sqlite';
// En SQLite se usa el MISMO código del motor (no una copia): así las pruebas guardan exactamente como la app.
function leerDoc(dataDir, bizId, name) {
  if (!sqliteMode()) return fs.readFileSync(path.join(dataDir, bizId, name), 'utf8');
  const ds = require('../src/services/docStore');
  const dir = path.resolve(dataDir, bizId);
  try { const t = ds.readDoc({ dir, name }); if (t === null) throw new Error('No existe ' + name); return t; } finally { ds.close(dir); }
}
function escribirDoc(dataDir, bizId, name, text) {
  if (!sqliteMode()) { fs.writeFileSync(path.join(dataDir, bizId, name), text); return; }
  const ds = require('../src/services/docStore');
  const dir = path.resolve(dataDir, bizId);
  try { ds.writeDoc({ dir, name }, text); } finally { ds.close(dir); }
}

module.exports = { leerDoc, escribirDoc, sqliteMode, startServer, createFranchise, openShift, publicOrder, SA_USER, SA_PASS };
