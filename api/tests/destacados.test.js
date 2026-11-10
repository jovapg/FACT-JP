/**
 * "Los más pedidos" de la carta pública: lo marca el admin, lo ve el cliente.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, createFranchise } = require('./helpers');

let srv, F;
before(async () => { srv = await startServer(); F = await createFranchise(srv, await srv.superToken(), { name: 'Pollo Destacado', slug: 'destacado', template: 'polleria' }); });
after(async () => { if (srv) await srv.stop(); });
const A = (t, m, u, b) => srv.api(m, `/api/${F.id}${u}`, { token: F.tokens[t], body: b });

test('el admin marca y desmarca "más pedido"; el cajero no; el cliente lo ve en la carta pública', async () => {
  const carta = (await A('admin', 'GET', '/carta')).data;
  const p = carta.products.find(x => x.name === 'Pollo entero');
  assert.equal((await A('cajero', 'PUT', `/carta/products/${p.id}`, { featured: true })).status, 200, 'el cajero puede entrar a la ruta...');
  let pub = (await srv.api('GET', '/api/public/carta/destacado')).data;
  assert.equal(pub.products.find(x => x.name === 'Pollo entero').featured, false, '...pero su cambio de "más pedido" no cuenta');
  assert.equal((await A('admin', 'PUT', `/carta/products/${p.id}`, { featured: true })).status, 200);
  pub = (await srv.api('GET', '/api/public/carta/destacado')).data;
  assert.equal(pub.products.find(x => x.name === 'Pollo entero').featured, true);
  assert.equal(pub.products.filter(x => x.featured).length, 1);
  assert.equal(pub.settings.heroImage, '', 'sin portada configurada viene vacío');
  await A('admin', 'PUT', `/carta/products/${p.id}`, { featured: false });
  assert.equal((await srv.api('GET', '/api/public/carta/destacado')).data.products.filter(x => x.featured).length, 0);
});
