/**
 * Recetas con insumos: un insumo "sin control de stock" (en 0 a propósito) NO debe marcar la receta como agotada.
 * Caso real: "Pollo entero" (receta) usa el insumo "Pollo entero asado" (sin control) y el servidor la rechazaba como agotada.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, createFranchise, openShift } = require('./helpers');

let srv, F;
before(async () => {
  srv = await startServer();
  F = await createFranchise(srv, await srv.superToken(), { name: 'Pollo Recetas', slug: 'recetas-x', template: 'bar' });
  await openShift(srv, F.tokens.cajero, F.id, 0);
});
after(async () => { if (srv) await srv.stop(); });
const A = (tok, m, u, b) => srv.api(m, `/api/${F.id}${u}`, { token: F.tokens[tok], body: b });
const insumo = async (name, extra) => (await A('admin', 'POST', '/inventory', { name, salePrice: 0, ...extra })).data;
const receta = async (name, ingredients) => (await A('admin', 'POST', '/recipes', { name, price: 20000, category: 'Platos', ingredients })).data;
const vender = (r) => A('cajero', 'POST', '/sales', { items: [{ recipeId: r.id, name: r.name, price: 20000, qty: 2 }], paymentMethod: 'efectivo', total: 40000, cashier: 'Caja' });
const stockDe = async (id) => (await A('admin', 'GET', '/inventory')).data.find(i => i.id === id).stock;

test('receta con insumo SIN control de stock en 0: se puede facturar y el insumo no se mueve', async () => {
  const ins = await insumo('Pollo entero asado', { stock: 0, noStock: true });
  const r = await receta('Pollo entero', [{ inventoryId: ins.id, quantity: 1 }]);
  const res = await vender(r);
  assert.equal(res.status, 201, JSON.stringify(res.data));
  assert.equal(await stockDe(ins.id), 0, 'no se resta ni queda negativo');
});

test('receta con insumo que SÍ controla stock en 0: sigue bloqueando como agotada', async () => {
  const ins = await insumo('Papa francesa insumo', { stock: 0, noStock: false });
  const r = await receta('Deditos prueba', [{ inventoryId: ins.id, quantity: 1 }]);
  const res = await vender(r);
  assert.equal(res.status, 400); assert.match(res.data.error, /agotado.*Deditos prueba/i);
});

test('receta con insumo que controla stock y tiene existencias: factura y descuenta; y mezcla de insumos', async () => {
  const conStock = await insumo('Harina', { stock: 10, noStock: false });
  const sinControl = await insumo('Sal', { stock: 0, noStock: true });
  const r = await receta('Pastel mixto', [{ inventoryId: conStock.id, quantity: 2 }, { inventoryId: sinControl.id, quantity: 1 }]);
  const res = await vender(r);
  assert.equal(res.status, 201, JSON.stringify(res.data));
  assert.equal(await stockDe(conStock.id), 6, '2 vendidos × 2 de harina = 4 menos');
  assert.equal(await stockDe(sinControl.id), 0, 'el insumo sin control no se toca');
  // si el que controla se acaba, la receta se bloquea aunque el otro no controle
  await A('admin', 'PUT', `/inventory/${conStock.id}`, { ...(await A('admin', 'GET', '/inventory')).data.find(i => i.id === conStock.id), stock: 0 });
  assert.equal((await vender(r)).status, 400);
});

test('editar la factura de una receta con insumo sin control no le inventa stock', async () => {
  const ins = await insumo('Consome base', { stock: 0, noStock: true });
  const r = await receta('Consomé prueba', [{ inventoryId: ins.id, quantity: 1 }]);
  const v = (await vender(r)).data.sale;
  const e = await A('admin', 'PUT', `/sales/${v.id}`, { items: [{ recipeId: r.id, name: r.name, price: 20000, qty: 1 }], paymentMethod: 'efectivo', total: 20000 });
  assert.equal(e.status, 200, JSON.stringify(e.data));
  assert.equal(await stockDe(ins.id), 0, 'sigue en 0: nunca se le suma ni resta a un insumo sin control');
});
