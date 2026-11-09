/**
 * Regla de caja: sin turno abierto no se factura, no se fía y no se abona.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, createFranchise, openShift } = require('./helpers');

let srv, F, T;
before(async () => {
  srv = await startServer();
  const sup = await srv.superToken();
  F = await createFranchise(srv, sup, { name: 'Bar Turno', slug: 'turno-x', template: 'bar' });
  T = F.tokens.cajero;
});
after(async () => { if (srv) await srv.stop(); });

const venta = { items: [{ name: 'Cerveza', price: 5000, qty: 1 }], paymentMethod: 'efectivo', total: 5000, cashier: 'Caja' };

test('sin turno abierto: no se puede facturar, fiar ni abonar', async () => {
  const d = await srv.api('POST', `/api/${F.id}/debtors`, { token: T, body: { name: 'Cliente Fiado', phone: '3001112233' } });
  assert.ok([200, 201].includes(d.status), 'crear el cliente de fiado (no mueve plata) sí se puede: ' + JSON.stringify(d.data));
  const id = d.data.id;

  const s = await srv.api('POST', `/api/${F.id}/sales`, { token: T, body: venta });
  assert.equal(s.status, 409); assert.equal(s.data.code, 'NO_OPEN_SHIFT');

  const c = await srv.api('POST', `/api/${F.id}/debtors/${id}/charge`, { token: T, body: { amount: 8000, description: 'Fiado' } });
  assert.equal(c.status, 409); assert.equal(c.data.code, 'NO_OPEN_SHIFT');

  const p = await srv.api('POST', `/api/${F.id}/debtors/${id}/payment`, { token: T, body: { amount: 1000, paymentMethod: 'efectivo' } });
  assert.equal(p.status, 409);

  const lista = (await srv.api('GET', `/api/${F.id}/sales`, { token: T })).data;
  assert.equal((Array.isArray(lista) ? lista : lista.sales || []).length, 0, 'no quedó ninguna venta guardada');
  const deuda = (await srv.api('GET', `/api/${F.id}/debtors`, { token: T })).data.find(x => x.id === id);
  assert.equal(deuda.balance ?? 0, 0, 'el fiado rechazado no dejó deuda');
});

test('con turno abierto todo funciona y entra al turno', async () => {
  await openShift(srv, T, F.id, 10000);
  const s = await srv.api('POST', `/api/${F.id}/sales`, { token: T, body: venta });
  assert.equal(s.status, 201, JSON.stringify(s.data));
  const turno = (await srv.api('GET', `/api/${F.id}/shifts/current`, { token: T })).data;
  assert.equal((turno.shift || turno).salesCount, 1);

  const d = (await srv.api('GET', `/api/${F.id}/debtors`, { token: T })).data[0];
  const c = await srv.api('POST', `/api/${F.id}/debtors/${d.id}/charge`, { token: T, body: { amount: 8000, description: 'Fiado' } });
  assert.ok([200, 201].includes(c.status), JSON.stringify(c.data));
  const p = await srv.api('POST', `/api/${F.id}/debtors/${d.id}/payment`, { token: T, body: { amount: 3000, paymentMethod: 'efectivo' } });
  assert.ok([200, 201].includes(p.status), JSON.stringify(p.data));
});
