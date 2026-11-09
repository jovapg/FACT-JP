/**
 * Borrar una franquicia: se va con todo (carpeta y base de datos) y las demás siguen intactas.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startServer, createFranchise, openShift } = require('./helpers');

let srv;
before(async () => { srv = await startServer(); });
after(async () => { if (srv) await srv.stop(); });

test('borrar una franquicia (con su base abierta) la quita y deja intactas a las otras', async () => {
  const sup = await srv.superToken();
  const A = await createFranchise(srv, sup, { name: 'Borrar Esta', slug: 'borrar-a', template: 'bar' });
  const B = await createFranchise(srv, sup, { name: 'Dejar Esta', slug: 'borrar-b', template: 'bar' });
  await openShift(srv, A.tokens.cajero, A.id, 0); await openShift(srv, B.tokens.cajero, B.id, 0);
  const v = { items: [{ name: 'X', price: 5000, qty: 1 }], paymentMethod: 'efectivo', total: 5000, cashier: 'Caja' };
  assert.equal((await srv.api('POST', `/api/${A.id}/sales`, { token: A.tokens.cajero, body: v })).status, 201);
  assert.equal((await srv.api('POST', `/api/${B.id}/sales`, { token: B.tokens.cajero, body: v })).status, 201);

  const del = await srv.api('DELETE', `/api/businesses/${A.id}`, { token: sup });
  assert.equal(del.status, 200, JSON.stringify(del.data));
  assert.equal(fs.existsSync(path.join(srv.dataDir, A.id)), false, 'la carpeta (con su base de datos) ya no existe');
  const lista = (await srv.api('GET', '/api/businesses', { token: sup })).data;
  assert.equal(lista.some(b => b.id === A.id), false);
  assert.equal(lista.some(b => b.id === B.id), true);
  assert.equal((await srv.api('GET', `/api/${B.id}/sales`, { token: B.tokens.cajero })).data.length, 1, 'la otra franquicia sigue con su venta');
  assert.equal((await srv.api('GET', '/api/health/deep')).status, 200);
});
