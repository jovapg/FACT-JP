/**
 * Desplegable "Calientes y jugos" junto al de "Bebidas": sale de la categoría en vivo, se cobra bien y llega a las cartas ya guardadas.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, createFranchise, leerDoc, escribirDoc } = require('./helpers');

let srv, F;
before(async () => { srv = await startServer(); F = await createFranchise(srv, await srv.superToken(), { name: 'Pollo Calientes', slug: 'calientes', template: 'polleria' }); });
after(async () => { if (srv) await srv.stop(); });
const A = (m, u, b) => srv.api(m, `/api/${F.id}${u}`, { token: F.tokens.admin, body: b });
const pub = async () => (await srv.api('GET', '/api/public/carta/calientes')).data;

test('en una carta nueva, todo producto con desplegable de Bebidas trae también el de Calientes y jugos, justo después', async () => {
  const c = await pub();
  const conBebidas = c.products.filter(p => p.groups.some(g => g.name === 'Bebidas'));
  assert.ok(conBebidas.length >= 20);
  for (const p of conBebidas) {
    const nombres = p.groups.map(g => g.name);
    assert.equal(nombres.indexOf('Calientes y jugos'), nombres.indexOf('Bebidas') + 1, p.name + ': va justo después de Bebidas');
    const g = p.groups.find(x => x.name === 'Calientes y jugos');
    assert.equal(g.type, 'qty'); assert.equal(g.collapsed, true);
  }
  const opts = conBebidas[0].groups.find(g => g.name === 'Calientes y jugos').options.map(o => o.name);
  assert.deepEqual(opts, ['Tinto', 'Perico', 'Café con leche', 'Milo', 'Jarra de Milo', 'Chocolate en agua', 'Chocolate en leche', 'Jugo en agua', 'Jugo en leche']);
});

test('una carta ya guardada SIN el desplegable lo recibe una sola vez, sin tocar el resto', async () => {
  const carta = JSON.parse(leerDoc(srv.dataDir, F.id, 'carta.json'));
  for (const p of carta.products) p.groups = (p.groups || []).filter(g => g.name !== 'Calientes y jugos');
  delete carta.hotDrinksVersion;
  const antes = JSON.stringify(carta.products.map(p => [p.name, p.price, (p.groups || []).filter(g => g.name !== 'Calientes y jugos').map(g => g.name)]));
  escribirDoc(srv.dataDir, F.id, 'carta.json', JSON.stringify(carta));
  const c = await pub();
  assert.ok(c.products.filter(p => p.groups.some(g => g.name === 'Calientes y jugos')).length >= 20, 'la carta vieja lo recibió al leerla');
  const guardada = JSON.parse(leerDoc(srv.dataDir, F.id, 'carta.json'));
  assert.equal(guardada.hotDrinksVersion, 1);
  const despues = JSON.stringify(guardada.products.map(p => [p.name, p.price, (p.groups || []).filter(g => g.name !== 'Calientes y jugos').map(g => g.name)]));
  assert.equal(despues, antes, 'nombres, precios y demás grupos quedaron igual');
  await pub(); await pub();
  const g2 = JSON.parse(leerDoc(srv.dataDir, F.id, 'carta.json'));
  for (const p of g2.products) assert.ok(p.groups.filter(g => g.name === 'Calientes y jugos').length <= 1, p.name + ' no se duplica');
});

test('si la dueña quita el desplegable de un producto, no se lo vuelven a poner', async () => {
  const carta = (await A('GET', '/carta')).data;
  const p = carta.products.find(x => x.name === 'Pollo entero');
  const sin = p.groups.filter(g => g.name !== 'Calientes y jugos');
  assert.equal((await A('PUT', `/carta/products/${p.id}`, { groups: sin })).status, 200);
  await pub();
  const otra = (await pub()).products.find(x => x.name === 'Pollo entero');
  assert.equal(otra.groups.some(g => g.name === 'Calientes y jugos'), false);
});

test('se cobra con el precio actual y un precio cambiado en la categoría vale en todos los combos', async () => {
  const c = await pub();
  const combo = c.products.find(p => p.name === 'Combo personal pechuga');
  const g = combo.groups.find(x => x.name === 'Calientes y jugos');
  const prep = combo.groups.find(x => x.name === 'Preparación');
  const pedir = (nombre, qty) => srv.api('POST', '/api/public/pedidos/calientes', { body: { name: 'Ana', phone: '3001112233', address: 'Calle 1 # 2-3', mode: 'domicilio', payment: 'efectivo', privacyAccepted: true,
    items: [{ productId: combo.id, qty: 1, choices: { [prep.id]: [{ optionId: prep.options[0].id, qty: 1 }], [g.id]: [{ optionId: g.options.find(o => o.name === nombre).id, qty }] } }] } });
  const base = combo.price;
  assert.equal((await pedir('Milo', 2)).data.subtotal, base + 2 * 4000);
  assert.equal((await pedir('Tinto', 1)).data.subtotal, base + 1500);
  const cartaAdm = (await A('GET', '/carta')).data;
  const milo = cartaAdm.products.find(p => p.name === 'Milo');
  await A('PUT', `/carta/products/${milo.id}`, { price: 4500 });
  assert.equal((await pedir('Milo', 2)).data.subtotal, base + 2 * 4500, 'el precio nuevo vale en el desplegable');
  await A('PUT', `/carta/products/${milo.id}`, { soldOut: true });
  assert.equal((await pedir('Milo', 1)).status, 400, 'si se agota, no se puede pedir como extra');
});

test('Presa, papa y arepa: la preparación es solo apanado (nueva carta y carta ya guardada); Combo personal conserva las dos', async () => {
  const prepOf = (c, nombre) => c.products.find(p => p.name === nombre).groups.find(g => g.name === 'Preparación').options.map(o => o.name);
  let c = await pub();
  for (const n of ['Ala', '2 alas', 'Muslo', '3 muslos', 'Contramuslo', 'Pechuga']) assert.deepEqual(prepOf(c, n), ['Apanado'], n);
  assert.deepEqual(prepOf(c, 'Combo personal pechuga'), ['Asado', 'Apanado'], 'el combo personal no cambia');
  assert.deepEqual(prepOf(c, '¼ de pollo (muslo y contramuslo)'), ['Asado', 'Apanado']);
  // carta ya guardada (con Asado): se corrige al leerla, una sola vez
  const carta = JSON.parse(leerDoc(srv.dataDir, F.id, 'carta.json'));
  const cat = carta.categories.find(x => x.name === 'Presa, papa y arepa');
  for (const p of carta.products.filter(x => x.categoryId === cat.id)) p.groups.find(g => g.name === 'Preparación').options = [{ id: 'a1', name: 'Asado', price: 0 }, { id: 'a2', name: 'Apanado', price: 0 }];
  delete carta.presaVersion;
  escribirDoc(srv.dataDir, F.id, 'carta.json', JSON.stringify(carta));
  c = await pub();
  for (const n of ['Ala', 'Pechuga']) assert.deepEqual(prepOf(c, n), ['Apanado'], n + ' (carta vieja)');
  assert.equal(JSON.parse(leerDoc(srv.dataDir, F.id, 'carta.json')).presaVersion, 1);
  // si la dueña vuelve a agregar Asado a mano, no se lo quitan otra vez
  const adm = (await A('GET', '/carta')).data; const ala = adm.products.find(p => p.name === 'Ala');
  const g = ala.groups.map(x => x.name === 'Preparación' ? { ...x, options: [...x.options, { name: 'Asado', price: 0 }] } : x);
  assert.equal((await A('PUT', `/carta/products/${ala.id}`, { groups: g })).status, 200);
  await pub(); assert.deepEqual(prepOf(await pub(), 'Ala').sort(), ['Apanado', 'Asado']);
});

test('un pedido de una presa con la única opción (Apanado) se acepta y queda registrada la preparación', async () => {
  const c = await pub();
  const p = c.products.find(x => x.name === 'Pechuga'); const g = p.groups.find(x => x.name === 'Preparación');
  const apanado = g.options.find(o => o.name === 'Apanado');
  const r = await srv.api('POST', '/api/public/pedidos/calientes', { body: { name: 'Ana', phone: '3001112233', address: 'Calle 1 # 2-3', mode: 'domicilio', payment: 'efectivo', privacyAccepted: true,
    items: [{ productId: p.id, qty: 1, choices: { [g.id]: [{ optionId: apanado.id, qty: 1 }] } }] } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.ok(JSON.stringify(r.data.lines).includes('Apanado'), 'el pedido dice Apanado');
  const sin = await srv.api('POST', '/api/public/pedidos/calientes', { body: { name: 'Ana', phone: '3001112234', address: 'Calle 1 # 2-3', mode: 'domicilio', payment: 'efectivo', privacyAccepted: true, items: [{ productId: p.id, qty: 1 }] } });
  assert.equal(sin.status, 400, 'sin escoger preparación el servidor sigue exigiéndola');
});
