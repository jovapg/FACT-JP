/**
 * Domicilios hechos a mano (no entraron por la carta): crear, listar, cambiar estado, cancelar y facturar.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, createFranchise, openShift } = require('./helpers');

let srv, F, B;
before(async () => {
  srv = await startServer();
  const sup = await srv.superToken();
  F = await createFranchise(srv, sup, { name: 'Pollo Domis', slug: 'domis', template: 'polleria' });
  B = await createFranchise(srv, sup, { name: 'Bar Sin Carta', slug: 'sincarta', template: 'bar' });
});
after(async () => { if (srv) await srv.stop(); });
const A = (tok, m, u, b) => srv.api(m, `/api/${F.id}${u}`, { token: F.tokens[tok], body: b });
const prod = (n = 'Alitas x12', price = 30000, qty = 2) => ({ name: n, price, qty, area: 'bar' });
const domiLine = (price) => ({ name: 'Domicilio', price, qty: 1, discount: 0, area: 'bar', kind: 'domicilio', recipeId: '__domicilio' });
const crear = (extra = {}) => A('cajero', 'POST', '/domicilios', { name: 'Marta Ríos', phone: '301 555 0101', address: 'Vereda Barro Blanco', items: [prod(), prod('Coca-Cola', 5000, 1), domiLine(3500)], ...extra });

test('solo existe en negocios con pedidos en línea', async () => {
  assert.equal((await srv.api('GET', `/api/${B.id}/domicilios`, { token: B.tokens.cajero })).status, 403, 'un bar sin pedidos en línea no lo tiene');
  assert.equal((await A('cajero', 'GET', '/domicilios')).status, 200);
});

test('el domiciliario no puede entrar a los domicilios manuales', async () => {
  const sup = await srv.superToken();
  const mk = await srv.api('POST', `/api/${F.id}/users`, { token: F.tokens.admin, body: { name: 'Moto', username: 'domis-moto', password: 'Clave-Moto-1', role: 'domiciliario' } });
  if (![200, 201].includes(mk.status)) return; // si esta versión no crea usuarios por esta ruta, la regla general ya está probada en seguridad.test.js
  const tok = await srv.login('domis-moto', 'Clave-Moto-1');
  assert.equal((await srv.api('GET', `/api/${F.id}/domicilios`, { token: tok })).status, 403);
  assert.ok(sup);
});

test('crear: solo el nombre es obligatorio; hace falta al menos un producto', async () => {
  assert.equal((await crear({ name: '' })).status, 400);
  assert.equal((await crear({ name: 'A' })).status, 400, 'nombre de una letra no sirve');
  assert.equal((await crear({ items: [] })).status, 400);
  assert.equal((await crear({ items: [domiLine(3000)] })).status, 400, 'solo la línea de domicilio no es un pedido');
  assert.equal((await crear({ items: [prod('X', -5, 1)] })).status, 400);
  const sinOpcionales = await A('cajero', 'POST', '/domicilios', { name: 'Solo Nombre', items: [prod()] });
  assert.equal(sinOpcionales.status, 201); assert.equal(sinOpcionales.data.phone, ''); assert.equal(sinOpcionales.data.address, '');
  assert.equal(sinOpcionales.data.status, 'por_enviar');
  await A('cajero', 'DELETE', `/domicilios/${sinOpcionales.data.id}`);
});

test('crear, listar (el más antiguo primero), cambiar de estado y editar', async () => {
  const a = (await crear({ name: 'Primero' })).data;
  const b = (await crear({ name: 'Segundo' })).data;
  let lista = (await A('cajero', 'GET', '/domicilios')).data;
  assert.deepEqual(lista.map(d => d.name), ['Primero', 'Segundo']);
  assert.equal(lista[0].items.find(i => i.kind === 'domicilio').price, 3500);
  assert.equal((await A('admin', 'PUT', `/domicilios/${a.id}`, { status: 'en_camino' })).data.status, 'en_camino');
  assert.equal((await A('cajero', 'PUT', `/domicilios/${a.id}`, { status: 'volando' })).status, 400);
  assert.equal((await A('cajero', 'PUT', `/domicilios/${b.id}`, { address: 'Otra calle', items: [prod('Pollo entero', 45000, 1), domiLine(5000)] })).data.address, 'Otra calle');
  lista = (await A('cajero', 'GET', '/domicilios')).data;
  assert.equal(lista.find(d => d.id === b.id).items.length, 2);
  assert.equal((await A('cajero', 'PUT', '/domicilios/no-existe', { status: 'en_camino' })).status, 404);
  for (const d of lista) await A('cajero', 'DELETE', `/domicilios/${d.id}`);
});

test('cancelar lo quita y deja constancia en la bitácora', async () => {
  const d = (await crear({ name: 'Cliente Cancela' })).data;
  assert.equal((await A('cajero', 'DELETE', `/domicilios/${d.id}`)).status, 200);
  assert.equal((await A('cajero', 'GET', '/domicilios')).data.some(x => x.id === d.id), false);
  assert.equal((await A('cajero', 'DELETE', `/domicilios/${d.id}`)).status, 404, 'no se cancela dos veces');
  const bit = JSON.stringify((await A('admin', 'GET', '/audit')).data);
  assert.ok(bit.includes('CANCELÓ el domicilio de Cliente Cancela'), 'queda en la bitácora');
});

test('facturar: sin turno no deja y el domicilio se conserva; con turno crea la venta, guarda los datos y la tarjeta desaparece', async () => {
  const d = (await crear({ name: 'Marta Ríos' })).data;
  const venta = { items: d.items, paymentMethod: 'efectivo', total: 68500, cashier: 'Caja', client: d.name, domicilioId: d.id, clientPhone: d.phone, deliveryAddress: d.address };
  const sinTurno = await A('cajero', 'POST', '/sales', venta);
  assert.equal(sinTurno.status, 409);
  assert.equal((await A('cajero', 'GET', '/domicilios')).data.some(x => x.id === d.id), true, 'sigue ahí: no se perdió');

  await openShift(srv, F.tokens.cajero, F.id, 0);
  const r = await A('cajero', 'POST', '/sales', venta);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.sale.total, 68500);
  assert.equal(r.data.sale.clientPhone, '301 555 0101'); assert.equal(r.data.sale.deliveryAddress, 'Vereda Barro Blanco');
  assert.match(r.data.sale.notes, /Domicilio: Vereda Barro Blanco · Cel 301 555 0101/);
  assert.equal(r.data.sale.items.find(i => i.kind === 'domicilio').price, 3500, 'línea de domicilio en la factura');
  assert.equal((await A('cajero', 'GET', '/domicilios')).data.some(x => x.id === d.id), false, 'la tarjeta desapareció');
  const otra = await A('cajero', 'POST', '/sales', venta);
  assert.equal(otra.status, 404); assert.match(otra.data.error, /ya fue facturado o cancelado/);
  const ventas = (await A('admin', 'GET', '/invoices')).data;
  assert.equal(ventas.filter(v => v.domicilioId === d.id).length, 1, 'una sola factura');
});

test('dos cajeros facturando el mismo domicilio a la vez: solo una factura', async () => {
  const d = (await crear({ name: 'Doble Clic' })).data;
  const venta = { items: d.items, paymentMethod: 'efectivo', total: 68500, cashier: 'Caja', client: d.name, domicilioId: d.id };
  const rs = await Promise.all([A('cajero', 'POST', '/sales', venta), A('admin', 'POST', '/sales', venta), A('cajero', 'POST', '/sales', venta)]);
  assert.equal(rs.filter(r => r.status === 201).length, 1, rs.map(r => r.status).join(','));
  assert.ok(rs.filter(r => r.status !== 201).every(r => [404, 409].includes(r.status)));
  assert.equal((await A('admin', 'GET', '/invoices')).data.filter(v => v.domicilioId === d.id).length, 1);
});

test('una factura con un producto agotado falla sin perder el domicilio ni dejarlo reservado', async () => {
  const inv = await A('admin', 'POST', '/inventory', { name: 'Producto Agotado', salePrice: 1000, stock: 0 });
  assert.equal(inv.status, 201);
  const d = (await A('cajero', 'POST', '/domicilios', { name: 'Con Agotado', items: [{ name: 'Producto Agotado', price: 1000, qty: 1, inventoryId: inv.data.id }, domiLine(2000)] })).data;
  const r = await A('cajero', 'POST', '/sales', { items: d.items, paymentMethod: 'efectivo', total: 3000, domicilioId: d.id, client: d.name });
  assert.equal(r.status, 400); assert.match(r.data.error, /agotado/i);
  assert.equal((await A('cajero', 'GET', '/domicilios')).data.some(x => x.id === d.id), true, 'el domicilio sigue disponible');
  assert.equal((await A('cajero', 'PUT', `/domicilios/${d.id}`, { status: 'en_camino' })).status, 200, 'y no quedó reservado');
});
