/**
 * Venta manual con domicilio: el cobro sale completo en una sola factura y el domicilio llega a su bolsillo.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, createFranchise, openShift } = require('./helpers');

let srv, F, T, A;
before(async () => {
  srv = await startServer();
  F = await createFranchise(srv, await srv.superToken(), { name: 'Pollo Domi Manual', slug: 'domi-manual', template: 'polleria' });
  T = F.tokens.cajero; A = F.tokens.admin;
  await openShift(srv, T, F.id, 0);
});
after(async () => { if (srv) await srv.stop(); });

test('una venta manual con línea de domicilio guarda el total completo, no toca el inventario y suma al turno', async () => {
  // un producto de inventario llamado "Domicilio" y en cero NO debe bloquear ni descontar la línea de domicilio
  const inv = await srv.api('POST', `/api/${F.id}/inventory`, { token: A, body: { name: 'Domicilio', salePrice: 1, stock: 0 } });
  assert.equal(inv.status, 201);
  const venta = { items: [
    { name: 'Pechuga especial', price: 10000, qty: 2 },
    { name: 'Domicilio', price: 3000, qty: 1, discount: 0, area: 'bar', kind: 'domicilio', recipeId: '__domicilio' }
  ], paymentMethod: 'efectivo', total: 23000, cashier: 'Caja', client: 'Doña Marta' };
  const r = await srv.api('POST', `/api/${F.id}/sales`, { token: T, body: venta });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.sale.total, 23000);
  assert.equal(r.data.sale.items.find(i => i.kind === 'domicilio').price, 3000);
  const stock = (await srv.api('GET', `/api/${F.id}/inventory`, { token: A })).data.find(i => i.name === 'Domicilio');
  assert.equal(stock.stock, 0, 'el inventario no se movió (sigue en 0, no quedó negativo)');
  const turno = (await srv.api('GET', `/api/${F.id}/shifts/current`, { token: T })).data;
  const sh = turno.shift || turno;
  assert.equal(sh.totalSales, 23000); assert.equal(sh.totalDomicilios, 3000, 'el turno separa lo que fue domicilio');
});

test('al cerrar el turno, el domicilio de la venta manual entra al bolsillo Domicilios', async () => {
  const turno = (await srv.api('GET', `/api/${F.id}/shifts/current`, { token: T })).data;
  const id = (turno.shift || turno).id;
  assert.equal((await srv.api('POST', `/api/${F.id}/shifts/${id}/close`, { token: T, body: { closingCash: 23000 } })).status, 200);
  const dom = (await srv.api('GET', `/api/${F.id}/finance/domicilios`, { token: A })).data;
  const texto = JSON.stringify(dom);
  assert.ok(texto.includes('3000'), 'el bolsillo muestra los $3.000 del domicilio: ' + texto.slice(0, 300));
});

test('la factura aparece en el historial con su línea de domicilio', async () => {
  const lista = (await srv.api('GET', `/api/${F.id}/invoices`, { token: A })).data;
  assert.equal(lista.length, 1);
  assert.equal(lista[0].items.filter(i => i.kind === 'domicilio').length, 1);
});
