/**
 * Lista de facturas paginada: lo más reciente primero (por páginas), búsqueda en todo el historial.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, createFranchise, escribirDoc } = require('./helpers');

let srv, F, T;
before(async () => {
  srv = await startServer();
  F = await createFranchise(srv, await srv.superToken(), { name: 'Bar Facturas', slug: 'fact-x', template: 'bar' });
  T = F.tokens.admin;
  const ventas = Array.from({ length: 25 }, (_, i) => ({ id: 'v' + i, invoiceNumber: `FA-${String(i + 1).padStart(4, '0')}-2026`,
    createdAt: new Date(Date.UTC(2026, 10, 1, 12, i)).toISOString(), total: 1000 + i, cashier: i === 7 ? 'Marta Rios' : 'Caja', paymentMethod: 'efectivo',
    items: [{ name: i === 3 ? 'Empanada 100% especial_' : 'Papa', qty: 1, price: 1000 }] }));
  escribirDoc(srv.dataDir, F.id, 'sales.json', JSON.stringify(ventas));
});
after(async () => { if (srv) await srv.stop(); });
const get = (qs) => srv.api('GET', `/api/${F.id}/invoices${qs}`, { token: T });

test('trae las más recientes primero por páginas y avisa si hay más', async () => {
  const p1 = await get('?limit=10');
  assert.equal(p1.data.length, 10);
  assert.equal(p1.data[9].id, 'v24', 'la lista viene en orden cronológico y termina en la más reciente');
  assert.equal(p1.data[0].id, 'v15');
  assert.equal(p1.headers.get('x-has-more'), '1');
  const p2 = await get('?limit=10&before=' + encodeURIComponent(p1.data[0].createdAt));
  assert.deepEqual(p2.data.map(x => x.id), Array.from({ length: 10 }, (_, i) => 'v' + (5 + i)));
  const p3 = await get('?limit=10&before=' + encodeURIComponent(p2.data[0].createdAt));
  assert.equal(p3.data.length, 5); assert.equal(p3.headers.get('x-has-more'), '0');
});

test('la búsqueda mira todo el historial (número, cajero, productos) y trata % y _ como texto', async () => {
  assert.deepEqual((await get('?q=FA-0008')).data.map(x => x.id), ['v7']);
  assert.deepEqual((await get('?q=marta')).data.map(x => x.id), ['v7']);
  assert.deepEqual((await get('?q=' + encodeURIComponent('100%'))).data.map(x => x.id), ['v3']);
  assert.deepEqual((await get('?q=' + encodeURIComponent('especial_'))).data.map(x => x.id), ['v3']);
  assert.equal((await get('?q=nadie-asi')).data.length, 0);
});

test('sin parámetros trae hasta 300 y el PDF/detalle de una factura sigue funcionando', async () => {
  assert.equal((await get('')).data.length, 25);
  assert.equal((await srv.api('GET', `/api/${F.id}/sales/v3`, { token: T })).data.id, 'v3');
  assert.equal((await srv.api('GET', `/api/${F.id}/invoices/v3/pdf`, { token: T })).status, 200);
});
