/**
 * Importar lista de productos: formatos de precio, encabezados, repetidos, errores y permisos.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const imp = require('../src/services/inventoryImport');
const { startServer, createFranchise } = require('./helpers');

test('precios en formato colombiano y normal', () => {
  const v = (x) => imp.parseMoney(x).value;
  assert.equal(v('$12.000'), 12000); assert.equal(v('12,000'), 12000); assert.equal(v('12000'), 12000);
  assert.equal(v('1.250.000'), 1250000); assert.equal(v('1.250,50'), 1250.5); assert.equal(v('12,5'), 12.5); assert.equal(v(''), 0);
  assert.ok(imp.parseMoney('doce mil').error); assert.ok(imp.parseMoney('-5').error);
});

test('reconoce encabezados en cualquier orden y con tildes; sin encabezado asume nombre, categoría, precio', () => {
  const a = imp.plan(imp.parseDelimited('Precio de venta\tProducto\tCategoría\tCantidad\n4500\tPastel de pollo\tFritos\t10'), []);
  assert.deepEqual([a.rows[0].name, a.rows[0].category, a.rows[0].salePrice, a.rows[0].stock], ['Pastel de pollo', 'Fritos', 4500, 10]);
  const b = imp.plan(imp.parseDelimited('Empanada;Fritos;$700\nPapa criolla;Verduras;2.500'), []);
  assert.equal(b.headerFound, false); assert.deepEqual(b.rows.map(r => [r.name, r.salePrice]), [['Empanada', 700], ['Papa criolla', 2500]]);
  const c = imp.plan(imp.parseDelimited('nombre,categoria,precio\n"Jugo, grande",Bebidas,"6,000"'), []);
  assert.deepEqual([c.rows[0].name, c.rows[0].salePrice], ['Jugo, grande', 6000]);
});

test('marca repetidos, existentes y errores; no inventa datos', () => {
  const existing = [{ id: 'e1', name: 'Pastel de Pollo', salePrice: 4000 }];
  const p = imp.plan(imp.parseDelimited('Nombre\tCategoría\tPrecio\nPastel de pollo\tFritos\t4500\nGalleta\tDulces\t1.000\ngalleta\tDulces\t1.200\nMalo\tX\tabc\n\t\t\nSin precio\tX\t'), existing, { updatePrices: true });
  assert.deepEqual(p.rows.map(r => r.status), ['actualiza', 'nuevo', 'duplicado', 'error', 'nuevo']);
  assert.equal(p.rows.find(r => r.name === 'Sin precio').salePrice, 0);
  assert.deepEqual(p.counts, { nuevo: 2, existe: 0, actualiza: 1, duplicado: 1, error: 1 });
  assert.equal(imp.plan(imp.parseDelimited('Pastel de pollo\tFritos\t4500'), existing).rows[0].status, 'existe', 'sin pedir actualizar, solo se salta');
  assert.throws(() => imp.plan(Array.from({ length: 1001 }, (_, i) => ['P' + i, 'x', '1']), []), /Máximo 1000/);
});

let srv, F;
before(async () => { srv = await startServer(); F = await createFranchise(srv, await srv.superToken(), { name: 'Bar Import', slug: 'imp-x', template: 'bar' }); });
after(async () => { if (srv) await srv.stop(); });

test('por la ruta: vista previa no guarda, confirmar guarda una vez, el cajero no puede, y no duplica al repetir', async () => {
  const text = 'Nombre\tCategoría\tPrecio\nPastel de pollo\tFritos\t4.500\nCerveza Águila\tCervezas\t5000\nMalo\tX\tabc';
  const call = (token, extra) => srv.api('POST', `/api/${F.id}/inventory/import`, { token, body: { text, control: 'con', ...extra } });
  assert.equal((await call(F.tokens.cajero, { dryRun: true })).status, 403);
  const prev = await call(F.tokens.admin, { dryRun: true });
  assert.equal(prev.status, 200); assert.deepEqual([prev.data.counts.nuevo, prev.data.counts.error], [2, 1]);
  assert.equal((await srv.api('GET', `/api/${F.id}/inventory`, { token: F.tokens.admin })).data.length, 0, 'la vista previa no guarda nada');
  const ok = await call(F.tokens.admin, {});
  assert.equal(ok.data.created, 2);
  const inv = (await srv.api('GET', `/api/${F.id}/inventory`, { token: F.tokens.admin })).data;
  const pastel = inv.find(i => i.name === 'Pastel de pollo');
  assert.deepEqual([pastel.salePrice, pastel.category, pastel.stock, pastel.noStock], [4500, 'Fritos', 0, false]);
  assert.equal((await call(F.tokens.admin, {})).data.created, 0, 'repetir la carga no duplica');
  const sin = await srv.api('POST', `/api/${F.id}/inventory/import`, { token: F.tokens.admin, body: { text: 'Tinto\tCalientes\t1500', control: 'sin' } });
  assert.equal((await srv.api('GET', `/api/${F.id}/inventory`, { token: F.tokens.admin })).data.find(i => i.name === 'Tinto').noStock, true, 'control "sin": siempre disponible');
  assert.equal(sin.status, 200);
  const bit = (await srv.api('GET', `/api/${F.id}/audit`, { token: F.tokens.admin })).data;
  assert.ok(JSON.stringify(bit).includes('Carga masiva'), 'queda en la bitácora');
});
