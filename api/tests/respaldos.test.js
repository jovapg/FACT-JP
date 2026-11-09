/**
 * Respaldos: cifrado, subida al almacenamiento externo (de mentira, local), comprobación y restauración.
 * Lo que se prueba aquí es lo que te salva el día que se pierdan datos.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { startServer, createFranchise, leerDoc, escribirDoc } = require('./helpers');
const crypto_ = require('../src/services/backupCrypto');

// ── Almacenamiento externo de mentira (imita lo básico de S3) ──
function mockS3() {
  const store = new Map();
  const server = http.createServer((req, res) => {
    const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
      const body = Buffer.concat(chunks); const u = new URL(req.url, 'http://x');
      if (!/^AWS4-HMAC-SHA256/.test(req.headers.authorization || '')) { res.writeHead(403); return res.end('<Error>sin firma</Error>'); }
      const parts = u.pathname.split('/').filter(Boolean); const bucket = parts.shift(); const key = decodeURIComponent(parts.join('/'));
      if (bucket !== 'mi-bucket') { res.writeHead(404); return res.end('<Error>NoSuchBucket</Error>'); }
      if (req.method === 'PUT') { store.set(key, body); res.writeHead(200); return res.end(); }
      if (req.method === 'DELETE') { store.delete(key); res.writeHead(204); return res.end(); }
      if (req.method === 'GET' && u.searchParams.get('list-type')) {
        const p = u.searchParams.get('prefix') || '';
        const xml = '<ListBucketResult><IsTruncated>false</IsTruncated>' + [...store].filter(([k]) => k.startsWith(p)).map(([k, v]) => `<Contents><Key>${k}</Key><Size>${v.length}</Size><LastModified>2026-11-09T12:00:00.000Z</LastModified></Contents>`).join('') + '</ListBucketResult>';
        res.writeHead(200, { 'content-type': 'application/xml' }); return res.end(xml);
      }
      if (req.method === 'GET') { if (!store.has(key)) { res.writeHead(404); return res.end('<Error>NoSuchKey</Error>'); } res.writeHead(200); return res.end(store.get(key)); }
      res.writeHead(400); res.end();
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ store, port: server.address().port, close: () => server.close() })));
}

let s3, srv, sup, A, B, KEY;
const SA = (m, p, body) => srv.api(m, p, { token: sup, body });

before(async () => {
  s3 = await mockS3();
  srv = await startServer({ B2_KEY_ID: 'id', B2_APP_KEY: 'secreto', B2_BUCKET: 'mi-bucket', B2_ENDPOINT: `http://127.0.0.1:${s3.port}` });
  sup = await srv.superToken();
  A = await createFranchise(srv, sup, { name: 'Pollería Respaldo', slug: 'resp-a' });
  B = await createFranchise(srv, sup, { name: 'Bar Respaldo', slug: 'resp-b', template: 'bar' });
  // datos para comprobar que se restauran
  await srv.api('POST', `/api/${A.id}/inventory`, { token: A.tokens.admin, body: { name: 'Producto de prueba A', salePrice: 5000, stock: 7 } });
  await srv.api('POST', `/api/${B.id}/inventory`, { token: B.tokens.admin, body: { name: 'Producto de prueba B', salePrice: 9000, stock: 3 } });
});
after(async () => { if (srv) await srv.stop(); if (s3) s3.close(); });

const readInv = (id) => JSON.parse(leerDoc(srv.dataDir, id, 'inventory.json'));

test('el cifrado: ida y vuelta, clave equivocada y archivo alterado', () => {
  const key = Buffer.alloc(32, 7); const texto = Buffer.from('datos de clientes: Ana 3001112233');
  const enc = crypto_.encrypt(texto, key);
  assert.ok(crypto_.isEncrypted(enc));
  assert.ok(!enc.toString('utf8').includes('Ana'), 'el archivo cifrado no deja ver el texto');
  assert.equal(crypto_.decrypt(enc, key).toString(), texto.toString());
  assert.throws(() => crypto_.decrypt(enc, Buffer.alloc(32, 9)), /incorrecta|dañado/);
  const roto = Buffer.from(enc); roto[roto.length - 1] ^= 1;
  assert.throws(() => crypto_.decrypt(roto, key), /incorrecta|dañado/);
  assert.equal(crypto_.encrypt(texto, key).equals(enc), false, 'cada cifrado usa un vector distinto');
  assert.ok(crypto_.parseKey(crypto_.formatKey(key)).equals(key), 'la clave escrita con guiones se lee igual');
  assert.equal(crypto_.parseKey('abc'), null);
});

test('solo el superadmin toca los respaldos', async () => {
  for (const [m, p] of [['GET', '/api/backups'], ['POST', '/api/backups'], ['POST', '/api/backups/key'], ['POST', '/api/backups/offsite/run'], ['GET', '/api/backups/offsite/list'],
    ['POST', '/api/backups/inspect'], ['POST', '/api/backups/restore']]) {
    assert.equal((await srv.api(m, p, { token: A.tokens.admin, body: {} })).status, 403, m + ' ' + p);
    assert.equal((await srv.api(m, p, { body: {} })).status, 401, m + ' ' + p + ' sin sesión');
  }
});

test('sin clave no se sube nada; la clave se crea una sola vez', async () => {
  const st = (await SA('GET', '/api/backups')).data;
  assert.equal(st.offsite.configured, true); assert.equal(st.offsite.keyReady, false);
  const r = await SA('POST', '/api/backups/offsite/run');
  assert.equal(r.status, 502); assert.match(r.data.error, /clave/i);
  const k = await SA('POST', '/api/backups/key');
  assert.equal(k.status, 201); assert.match(k.data.key, /^[0-9a-f]{8}(-[0-9a-f]{8}){7}$/);
  KEY = k.data.key;
  assert.equal((await SA('POST', '/api/backups/key')).status, 409, 'no se puede crear otra clave');
});

test('probar la conexión, subir cifrado y comprobar', async () => {
  assert.equal((await SA('POST', '/api/backups/offsite/test')).status, 200);
  const run = await SA('POST', '/api/backups/offsite/run');
  assert.equal(run.status, 201);
  const items = (await SA('GET', '/api/backups/offsite/list')).data.items;
  assert.equal(items.length, 1);
  assert.match(items[0].key, /^backups\/backup-.*\.json\.gz\.enc$/);
  const objeto = s3.store.get(items[0].key);
  assert.ok(crypto_.isEncrypted(objeto), 'lo que sale de la app está cifrado');
  const texto = objeto.toString('latin1');
  for (const secreto of ['Pollería Respaldo', 'Producto de prueba A', '3001234567']) assert.ok(!texto.includes(secreto), 'no se debe leer: ' + secreto);
  const v = await SA('POST', '/api/backups/offsite/verify');
  assert.equal(v.status, 200); assert.ok(v.data.files > 5);
  const estado = (await SA('GET', '/api/backups')).data.offsite;
  assert.equal(estado.last.ok, true); assert.equal(estado.verify.ok, true);
});

test('una conexión mala se avisa claro', async () => {
  const mal = await startServer({ B2_KEY_ID: 'id', B2_APP_KEY: 'x', B2_BUCKET: 'otro-bucket', B2_ENDPOINT: `http://127.0.0.1:${s3.port}` });
  try {
    const t = await mal.superToken();
    const r = await mal.api('POST', '/api/backups/offsite/test', { token: t });
    assert.equal(r.status, 502); assert.match(r.data.error, /404|respondió/);
  } finally { await mal.stop(); }
});

test('abrir un respaldo: clave equivocada, mal escrita o buena', async () => {
  const name = (await SA('GET', '/api/backups/offsite/list')).data.items[0].key;
  const abrir = (key) => SA('POST', '/api/backups/inspect', { source: 'offsite', name, key });
  assert.equal((await abrir('00000000-00000000-00000000-00000000-00000000-00000000-00000000-00000000')).status, 400);
  const corta = await abrir(KEY.slice(0, -4));
  assert.equal(corta.status, 400); assert.match(corta.data.error, /formato/);
  const ok = await abrir(KEY);
  assert.equal(ok.status, 200);
  const nombres = ok.data.summary.businesses.map(b => b.name).sort();
  assert.deepEqual(nombres, ['Bar Respaldo', 'Pollería Respaldo']);
  assert.equal((await SA('POST', '/api/backups/inspect', { source: 'offsite', name: '../../etc/passwd', key: KEY })).status, 400, 'nombres raros se rechazan');
});

test('restaurar UNA franquicia vuelve sus datos y no toca las otras', async () => {
  await SA('POST', '/api/backups/offsite/run'); // respaldo con el estado actual
  const name = (await SA('GET', '/api/backups/offsite/list')).data.items[0].key;
  const antesB = leerDoc(srv.dataDir, B.id, 'inventory.json');
  // daño: se borra el inventario de A y se cambia el de B
  escribirDoc(srv.dataDir, A.id, 'inventory.json', '[]');
  escribirDoc(srv.dataDir, B.id, 'inventory.json', JSON.stringify([{ id: 'x', name: 'Cambio posterior', stock: 1 }]));
  assert.equal(readInv(A.id).length, 0);
  const abierto = (await SA('POST', '/api/backups/inspect', { source: 'offsite', name, key: KEY })).data;
  assert.equal((await SA('POST', '/api/backups/restore', { token: abierto.token, scope: [A.id] })).status, 400, 'sin confirmar no restaura');
  assert.equal((await SA('POST', '/api/backups/restore', { token: abierto.token, scope: ['no-existe'], confirm: 'RESTAURAR' })).status, 400);
  const r = await SA('POST', '/api/backups/restore', { token: abierto.token, scope: [A.id], confirm: 'RESTAURAR' });
  assert.equal(r.status, 200);
  assert.ok(r.data.safetyBackup, 'se guardó un respaldo de seguridad antes');
  assert.equal(readInv(A.id).some(i => i.name === 'Producto de prueba A'), true, 'A volvió');
  assert.equal(readInv(B.id)[0].name, 'Cambio posterior', 'B NO se tocó');
  assert.notEqual(leerDoc(srv.dataDir, B.id, 'inventory.json'), antesB);
  assert.equal((await SA('POST', '/api/backups/restore', { token: abierto.token, scope: [A.id], confirm: 'RESTAURAR' })).status, 410, 'cada apertura sirve una sola vez');
  const bit = JSON.parse(leerDoc(srv.dataDir, A.id, 'audit.json'));
  assert.ok(bit.some(e => e.action === 'restauracion'), 'la restauración queda en la bitácora');
  // la franquicia sigue funcionando
  const nuevo = await srv.login(A.users[0].username, A.users[0].password);
  assert.equal((await srv.api('GET', `/api/${A.id}/inventory`, { token: nuevo })).status, 200);
});

test('restaurar el respaldo de seguridad deshace una restauración equivocada', async () => {
  const lista = (await SA('GET', '/api/backups')).data.backups;
  const seguridad = lista[0]; // el más nuevo es el de seguridad creado justo antes de restaurar
  const abierto = (await SA('POST', '/api/backups/inspect', { source: 'local', name: seguridad.name })).data;
  assert.equal((await SA('POST', '/api/backups/restore', { token: abierto.token, scope: [B.id], confirm: 'RESTAURAR' })).status, 200);
  assert.equal(readInv(B.id)[0].name, 'Cambio posterior', 'volvió al estado que había antes de restaurar');
});

test('subir un archivo de respaldo (descargado) y abrirlo', async () => {
  const lista = (await SA('GET', '/api/backups')).data.backups;
  const dl = await fetch(`${srv.base}/api/backups/${lista[0].name}/download`, { headers: { Authorization: 'Bearer ' + sup } });
  const archivo = Buffer.from(await dl.arrayBuffer());
  const r = await srv.api('POST', '/api/backups/inspect-upload', { token: sup, raw: archivo, headers: { 'Content-Type': 'application/octet-stream' } });
  assert.equal(r.status, 200); assert.ok(r.data.summary.businesses.length >= 2);
  const basura = await srv.api('POST', '/api/backups/inspect-upload', { token: sup, raw: Buffer.from('esto no es un respaldo'), headers: { 'Content-Type': 'application/octet-stream' } });
  assert.equal(basura.status, 400); assert.match(basura.data.error, /respaldo válido/);
});

test('los respaldos incluyen las fotos y no incluyen secretos de arranque', async () => {
  fs.writeFileSync(path.join(srv.dataDir, A.id, 'foto_prueba.webp'), Buffer.from('RIFFxxxxWEBPfake'));
  const r = await SA('POST', '/api/backups');
  assert.equal(r.status, 201); assert.ok(r.data.photoCount >= 1);
  const zlib = require('zlib');
  const payload = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(srv.dataDir, 'backups', r.data.name))).toString());
  assert.ok(payload.blobs[`${A.id}/foto_prueba.webp`]);
  const todo = JSON.stringify(payload);
  assert.ok(!todo.includes('secreto-solo-para-pruebas'), 'la clave de sesiones no entra al respaldo');
  assert.ok(!Object.keys(payload.files).some(k => k.startsWith('backups/') || k.includes('.backup_key')));
});
