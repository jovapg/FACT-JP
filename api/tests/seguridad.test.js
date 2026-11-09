/**
 * Seguridad: sesiones, separación entre franquicias y límites de cada rol.
 * Si alguna de estas falla, un cliente podría ver datos de otro: NO se debe subir a producción.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, createFranchise } = require('./helpers');

let srv, sup, A, B;
before(async () => {
  srv = await startServer();
  sup = await srv.superToken();
  A = await createFranchise(srv, sup, { name: 'Pollería Alfa', slug: 'alfa', users: [
    { name: 'Admin', username: 'alfa-admin', password: 'Clave-Admin-1', role: 'admin' },
    { name: 'Caja', username: 'alfa-caja', password: 'Clave-Caja-1', role: 'cajero' },
    { name: 'Domi', username: 'alfa-domi', password: 'Clave-Domi-1', role: 'domiciliario' }] });
  B = await createFranchise(srv, sup, { name: 'Tienda Beta', slug: 'beta', template: 'tienda' });
});
after(() => srv && srv.stop());

test('la app responde y el chequeo profundo ve el volumen', async () => {
  assert.equal((await srv.api('GET', '/api/health')).data.status, 'ok');
  const deep = await srv.api('GET', '/api/health/deep');
  assert.equal(deep.status, 200);
  assert.equal(deep.data.checks.escritura, 'ok');
});

test('sin sesión o con una sesión falsa no se entra a nada', async () => {
  for (const p of ['sales', 'inventory', 'finance', 'pedidos', 'users', 'profile']) {
    assert.equal((await srv.api('GET', `/api/${A.id}/${p}`)).status, 401, p + ' sin token');
    assert.equal((await srv.api('GET', `/api/${A.id}/${p}`, { token: 'abc.def.ghi' })).status, 401, p + ' token falso');
  }
});

test('el login rechaza contraseñas malas y no revela si el usuario existe', async () => {
  const bad = await srv.api('POST', '/api/auth/login', { body: { username: 'alfa-admin', password: 'x' } });
  const none = await srv.api('POST', '/api/auth/login', { body: { username: 'no-existe', password: 'x' } });
  assert.equal(bad.status, 401); assert.equal(none.status, 401);
  assert.equal(JSON.stringify(bad.data), JSON.stringify(none.data));
});

test('el admin de una franquicia NO puede abrir los datos de otra', async () => {
  // Rutas de la propia franquicia que SÍ deben abrirse, y otras que dependen de módulos apagados en esta plantilla
  const propias = ['sales', 'inventory', 'finance', 'pedidos', 'carta', 'users', 'profile', 'audit', 'shifts', 'purchases', 'finance/domicilios'];
  const conModulo = ['debtors', 'payroll'];
  for (const p of [...propias, ...conModulo]) {
    const other = await srv.api('GET', `/api/${B.id}/${p}`, { token: A.tokens.admin });
    assert.equal(other.status, 403, `GET ${p} de la OTRA franquicia debe ser 403 (fue ${other.status})`);
  }
  for (const p of propias) {
    const mine = await srv.api('GET', `/api/${A.id}/${p}`, { token: A.tokens.admin });
    assert.notEqual(mine.status, 403, `GET ${p} de la propia no debe ser 403`);
  }
  // también para escribir
  assert.equal((await srv.api('PUT', `/api/${B.id}/profile`, { token: A.tokens.admin, body: { name: 'Hackeado' } })).status, 403);
  assert.equal((await srv.api('POST', `/api/${B.id}/sales`, { token: A.tokens.admin, body: { items: [{ name: 'x', price: 1, qty: 1 }] } })).status, 403);
});

test('la lista de franquicias solo muestra la propia al admin', async () => {
  const r = await srv.api('GET', '/api/businesses', { token: A.tokens.admin });
  assert.equal(r.data.length, 1); assert.equal(r.data[0].id, A.id);
  assert.equal((await srv.api('GET', '/api/businesses', { token: sup })).data.length, 2);
});

test('lo exclusivo del superadmin está cerrado para el admin', async () => {
  const t = A.tokens.admin;
  assert.equal((await srv.api('POST', '/api/businesses', { token: t, body: { name: 'x', template: 'bar' } })).status, 403);
  assert.equal((await srv.api('DELETE', `/api/businesses/${B.id}`, { token: t })).status, 403);
  assert.equal((await srv.api('PUT', `/api/businesses/${A.id}/settings`, { token: t, body: { moduleKeys: { nom: true } } })).status, 403);
  assert.equal((await srv.api('GET', '/api/backups', { token: t })).status, 403);
  assert.equal((await srv.api('POST', '/api/backups', { token: t })).status, 403);
  assert.equal((await srv.api('GET', '/api/system-events', { token: t })).status, 403);
  assert.equal((await srv.api('POST', `/api/${A.id}/carta/load-default`, { token: t })).status, 403);
});

test('el cajero no ve Finanzas ni cambia precios de la carta', async () => {
  const t = A.tokens.cajero;
  assert.equal((await srv.api('GET', `/api/${A.id}/finance`, { token: t })).status, 403);
  // La lista de usuarios: el cajero ve nombre y rol, pero NO el usuario de acceso ni contraseñas
  const lista = (await srv.api('GET', `/api/${A.id}/users`, { token: t })).data;
  assert.ok(lista.length >= 3);
  for (const u of lista) { assert.equal(u.username, undefined); assert.equal(u.password, undefined); }
  const listaAdmin = (await srv.api('GET', `/api/${A.id}/users`, { token: A.tokens.admin })).data;
  assert.ok(listaAdmin.every(u => u.username && u.password === undefined));
  const carta = (await srv.api('GET', `/api/${A.id}/carta`, { token: t })).data;
  const p = carta.products[0];
  const price = await srv.api('PUT', `/api/${A.id}/carta/products/${p.id}`, { token: t, body: { price: 1 } });
  assert.equal(price.status, 200);
  assert.equal(price.data.price, p.price, 'el cajero no debe poder cambiar el precio');
  assert.equal((await srv.api('POST', `/api/${A.id}/carta/products`, { token: t, body: { name: 'Hack', price: 1, categoryId: carta.categories[0].id } })).status, 403);
});

test('el domiciliario solo ve pedidos', async () => {
  const t = A.tokens.domiciliario;
  assert.equal((await srv.api('GET', `/api/${A.id}/pedidos`, { token: t })).status, 200);
  for (const p of ['sales', 'inventory', 'finance', 'carta', 'users', 'shifts', 'audit']) {
    assert.equal((await srv.api('GET', `/api/${A.id}/${p}`, { token: t })).status, 403, p);
  }
  assert.equal((await srv.api('POST', `/api/${A.id}/sales`, { token: t, body: { items: [{ name: 'x', price: 1, qty: 1 }] } })).status, 403);
  assert.equal((await srv.api('GET', `/api/${B.id}/pedidos`, { token: t })).status, 403);
});

test('los usuarios no se pueden repetir entre franquicias', async () => {
  const r = await srv.api('POST', `/api/${B.id}/users`, { token: B.tokens.admin, body: { name: 'x', username: 'alfa-caja', password: 'Clave-1234', role: 'cajero' } });
  assert.equal(r.status, 409);
});

test('la carta pública solo existe en franquicias que tienen el módulo', async () => {
  assert.equal((await srv.api('GET', '/api/public/carta/alfa')).status, 200);
  assert.equal((await srv.api('GET', '/api/public/carta/beta')).status, 404);
  assert.equal((await srv.api('GET', '/api/public/carta/no-existe')).status, 404);
  // y no se filtran datos internos
  const carta = (await srv.api('GET', '/api/public/carta/alfa')).data;
  const s = JSON.stringify(carta);
  for (const prohibido of ['inventoryId', 'password', 'passwordHash', 'invoiceCounter']) assert.ok(!s.includes(prohibido), 'la carta pública no debe incluir ' + prohibido);
});
