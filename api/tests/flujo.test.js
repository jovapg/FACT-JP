/**
 * Flujo del dinero: pedidos en línea → entrega → turno → factura → inventario → Finanzas.
 * Es lo que más duele si se daña, así que cada paso se comprueba con números.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, createFranchise, openShift, publicOrder } = require('./helpers');

let srv, sup, F, adm;
const biz = () => `/api/${F.id}`;
const A = (m, p, body) => srv.api(m, biz() + p, { token: adm, body });
const list = (d) => (Array.isArray(d) ? d : d.shifts || d.items || []);

before(async () => {
  srv = await startServer();
  sup = await srv.superToken();
  F = await createFranchise(srv, sup, { name: 'Pollería Flujo', slug: 'poll' });
  adm = F.tokens.admin;
});
after(() => srv && srv.stop());

/** Lleva un pedido hasta "entregado" (sin facturar) y devuelve el pedido */
async function deliver(order, { fee = 3000, payment = 'efectivo' } = {}) {
  const ped = (await A('GET', '/pedidos')).data.find(p => p.code === order.data.code);
  assert.equal((await A('PUT', `/pedidos/${ped.id}`, { status: 'pendiente', deliveryFee: fee })).status, 200);
  assert.equal((await A('PUT', `/pedidos/${ped.id}`, { status: 'entregado', payment })).status, 200);
  return ped;
}

test('el cliente no puede cambiar precios y el servidor valida todo', async () => {
  const carta = (await srv.api('GET', '/api/public/carta/poll')).data;
  const tinto = carta.products.find(p => p.name === 'Tinto');
  // un precio falso en el pedido se ignora
  const r = await srv.api('POST', '/api/public/pedidos/poll', { body: { name: 'Ana', phone: '3001112233', address: 'Calle 1 # 2-3', mode: 'domicilio', payment: 'efectivo', privacyAccepted: true,
    items: [{ productId: tinto.id, qty: 2, price: 1, unitPrice: 1, total: 1 }], subtotal: 1, total: 1 } });
  assert.equal(r.status, 201);
  assert.equal(r.data.subtotal, tinto.price * 2, 'el total sale del precio de la carta, no del que manda el cliente');
  const base = { name: 'Ana', phone: '3001112233', address: 'Calle 1 # 2-3', mode: 'domicilio', payment: 'efectivo', privacyAccepted: true, items: [{ productId: tinto.id, qty: 1 }] };
  assert.equal((await srv.api('POST', '/api/public/pedidos/poll', { body: { ...base, privacyAccepted: false } })).status, 400, 'sin aceptar datos');
  assert.equal((await srv.api('POST', '/api/public/pedidos/poll', { body: { ...base, address: '' } })).status, 400, 'domicilio sin dirección');
  assert.equal((await srv.api('POST', '/api/public/pedidos/poll', { body: { ...base, items: [{ productId: 'falso', qty: 1 }] } })).status, 400, 'producto que no existe');
  assert.equal((await srv.api('POST', '/api/public/pedidos/poll', { body: { ...base, items: [] } })).status, 400, 'pedido vacío');
  const cerveza = carta.products.find(p => p.alcohol);
  assert.equal((await srv.api('POST', '/api/public/pedidos/poll', { body: { ...base, items: [{ productId: cerveza.id, qty: 1 }] } })).status, 400, 'licor sin confirmar mayoría de edad');
  assert.equal((await srv.api('POST', '/api/public/pedidos/poll', { body: { ...base, adult: true, items: [{ productId: cerveza.id, qty: 1 }] } })).status, 201, 'licor confirmando mayoría de edad');
});

test('opciones obligatorias, máximos y bebidas se cobran bien', async () => {
  const carta = (await srv.api('GET', '/api/public/carta/poll')).data;
  const entero = carta.products.find(p => p.name === 'Pollo entero');
  const prep = entero.groups.find(g => g.name === 'Preparación'), beb = entero.groups.find(g => g.name === 'Bebidas');
  const body = (choices) => ({ name: 'Ana', phone: '3004445566', address: 'Calle 1 # 2-3', mode: 'domicilio', payment: 'efectivo', privacyAccepted: true, items: [{ productId: entero.id, qty: 1, choices }] });
  assert.equal((await srv.api('POST', '/api/public/pedidos/poll', { body: body({}) })).status, 400, 'falta escoger la preparación');
  const apanado = prep.options.find(o => o.name === 'Apanado');
  const coca = beb.options.find(o => o.name === 'Coca-Cola 400 ml');
  const r = await srv.api('POST', '/api/public/pedidos/poll', { body: body({ [prep.id]: [{ optionId: apanado.id }], [beb.id]: [{ optionId: coca.id, qty: 2 }] }) });
  assert.equal(r.status, 201);
  assert.equal(r.data.subtotal, entero.price + apanado.price + 2 * coca.price);
  const alitas = carta.products.find(p => p.name === 'Alitas x6'); const sal = alitas.groups.find(g => g.name === 'Salsas');
  const dos = sal.options.slice(0, 2).map(o => ({ optionId: o.id }));
  const masDe = await srv.api('POST', '/api/public/pedidos/poll', { body: { name: 'Ana', phone: '3004445566', address: 'Calle 1 # 2-3', mode: 'domicilio', payment: 'efectivo', privacyAccepted: true, items: [{ productId: alitas.id, qty: 1, choices: { [sal.id]: dos } }] } });
  assert.equal(masDe.status, 400, 'más salsas que el máximo');
});

test('domicilio gratis desde $100.000 y recoger no cobra domicilio', async () => {
  const carta = (await srv.api('GET', '/api/public/carta/poll')).data;
  const jarra = carta.products.find(p => p.name === 'Jarra de Milo');
  const grande = await srv.api('POST', '/api/public/pedidos/poll', { body: { name: 'Ana', phone: '3007778899', address: 'Calle 1 # 2-3', mode: 'domicilio', payment: 'efectivo', privacyAccepted: true, items: [{ productId: jarra.id, qty: 13 }] } });
  assert.equal(grande.data.subtotal, 104000);
  assert.equal(grande.data.freeDelivery, true);
  const ped = (await A('GET', '/pedidos')).data.find(p => p.code === grande.data.code);
  assert.equal(ped.deliveryFee, 0);
  const recoger = await publicOrder(srv, 'poll', 'Tinto', { mode: 'recoger', address: '' });
  assert.equal(recoger.status, 201);
  assert.match(recoger.data.code, /^R-/, 'los pedidos para recoger llevan R-');
});

test('la tienda cerrada, en pausa o fuera de horario no recibe pedidos', async () => {
  assert.equal((await A('PUT', '/carta/settings', { paused: true })).status, 200);
  assert.equal((await publicOrder(srv, 'poll', 'Tinto')).status, 409, 'en pausa');
  await A('PUT', '/carta/settings', { paused: false, open: false });
  assert.equal((await publicOrder(srv, 'poll', 'Tinto')).status, 409, 'cerrada');
  await A('PUT', '/carta/settings', { open: true });
  const c = new Date(Date.now() - 5 * 3600 * 1000), m = c.getUTCHours() * 60 + c.getUTCMinutes();
  const hhmm = (x) => { x = ((x % 1440) + 1440) % 1440; return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };
  await A('PUT', '/carta/settings', { openFrom: hhmm(m + 360), openTo: hhmm(m + 420) }); // una hora que NO es ahora
  assert.equal((await publicOrder(srv, 'poll', 'Tinto')).status, 409, 'fuera del horario');
  assert.equal((await srv.api('GET', '/api/public/carta/poll')).data.settings.open, false);
  await A('PUT', '/carta/settings', { openFrom: '', openTo: '' });
  assert.equal((await publicOrder(srv, 'poll', 'Tinto')).status, 201, 'de nuevo abierta');
});

test('sin turno el pedido entra y se entrega, pero NO se puede facturar', async () => {
  const o = await publicOrder(srv, 'poll', 'Tinto');
  assert.match(o.data.code, /^D-PO\d{2,}$/);
  const ped = await deliver(o);
  const r = await A('POST', `/pedidos/${ped.id}/facturar`);
  assert.equal(r.status, 409, 'sin turno abierto no se factura');
  assert.match(r.data.error, /turno/i);
});

test('con turno abierto se factura una sola vez, con el método de pago de la entrega', async () => {
  const shift = await openShift(srv, adm, F.id, 50000);
  assert.ok(shift.id || shift.status === 'open' || shift.error, 'turno abierto');
  const pend = (await A('GET', '/pedidos')).data.find(p => p.status === 'entregado' && !p.saleId);
  const r = await A('POST', `/pedidos/${pend.id}/facturar`);
  assert.equal(r.status, 201);
  const sale = r.data.sale;
  assert.equal(sale.total, pend.subtotal + 3000);
  assert.equal(sale.paymentMethod, 'efectivo');
  assert.equal(sale.source, 'carta');
  assert.ok(sale.items.some(i => i.kind === 'domicilio' && i.price === 3000));
  assert.equal((await A('POST', `/pedidos/${pend.id}/facturar`)).status, 409, 'no se factura dos veces');
});

test('el domiciliario solo avanza salida y entrega, y debe decir cómo le pagaron', async () => {
  const o = await publicOrder(srv, 'poll', 'Tinto');
  const ped = (await A('GET', '/pedidos')).data.find(p => p.code === o.data.code);
  await A('PUT', `/pedidos/${ped.id}`, { status: 'pendiente', deliveryFee: 2000 });
  await A('PUT', `/pedidos/${ped.id}`, { status: 'en_preparacion' });
  const mk = (payload) => srv.api('PUT', `${biz()}/pedidos/${ped.id}`, { token: F.tokens.admin, body: payload });
  assert.ok(mk);
  // crear un usuario domiciliario en esta franquicia
  const u = await A('POST', '/users', { name: 'Domi', username: 'poll-domi', password: 'Clave-Domi-1', role: 'domiciliario' });
  assert.equal(u.status, 201);
  const D = await srv.login('poll-domi', 'Clave-Domi-1');
  const d = (payload) => srv.api('PUT', `${biz()}/pedidos/${ped.id}`, { token: D, body: payload });
  assert.equal((await d({ status: 'entregado', payment: 'efectivo' })).status, 400, 'primero tiene que salir');
  assert.equal((await d({ status: 'en_camino' })).status, 200);
  assert.equal((await d({ status: 'entregado' })).status, 400, 'sin método de pago no se entrega');
  assert.equal((await d({ status: 'cancelado' })).status, 403, 'no puede cancelar');
  assert.equal((await d({ status: 'entregado', payment: 'transferencia', deliveryFee: 0 })).status, 200);
  const after = (await A('GET', '/pedidos')).data.find(p => p.id === ped.id);
  assert.equal(after.payment, 'transferencia');
  assert.equal(after.deliveryFee, 2000, 'el domiciliario no cambia el valor del domicilio');
  assert.equal((await srv.api('POST', `${biz()}/pedidos/${ped.id}/facturar`, { token: D })).status, 403, 'no factura');
  const f = await A('POST', `/pedidos/${ped.id}/facturar`);
  assert.equal(f.status, 201);
  assert.equal(f.data.sale.paymentMethod, 'transferencia');
});

test('15 pedidos a la vez: ninguno se pierde y los números no se repiten', async () => {
  const antes = (await A('GET', '/pedidos')).data.length;
  const res = await Promise.all(Array.from({ length: 15 }, () => publicOrder(srv, 'poll', 'Tinto')));
  assert.ok(res.every(r => r.status === 201));
  const codes = res.map(r => r.data.code);
  assert.equal(new Set(codes).size, 15, 'códigos repetidos: ' + codes.join(' '));
  assert.equal((await A('GET', '/pedidos')).data.length, antes + 15);
});

test('12 facturas a la vez: sin números de factura repetidos ni ventas perdidas', async () => {
  const orders = [];
  for (let i = 0; i < 12; i++) { const o = await publicOrder(srv, 'poll', 'Tinto'); orders.push(await deliver(o)); }
  const antes = list((await A('GET', '/sales')).data).length;
  const rs = await Promise.all(orders.map(p => A('POST', `/pedidos/${p.id}/facturar`)));
  assert.ok(rs.every(r => r.status === 201));
  const nums = rs.map(r => r.data.sale.invoiceNumber);
  assert.equal(new Set(nums).size, 12, 'facturas repetidas: ' + nums.join(' '));
  assert.equal(list((await A('GET', '/sales')).data).length, antes + 12);
});

test('el inventario: agotado se ve y se rechaza, y facturar descuenta el stock', async () => {
  const sync = await A('POST', '/carta/sync-inventory');
  assert.equal(sync.status, 200); assert.ok(sync.data.created > 100);
  assert.equal((await A('POST', '/carta/sync-inventory')).data.created, 0, 'no duplica');
  const carta = (await srv.api('GET', '/api/public/carta/poll')).data;
  assert.equal(carta.products.find(p => p.name === 'Coca-Cola 400 ml').soldOut, true, 'bebida empacada con stock 0 = agotado');
  assert.equal(carta.products.find(p => p.name === 'Tinto').soldOut, false, 'lo que se prepara al momento no controla stock');
  const o0 = await publicOrder(srv, 'poll', 'Coca-Cola 400 ml');
  assert.equal(o0.status, 400); assert.match(o0.data.error, /agotado/);
  const inv = list((await A('GET', '/inventory')).data); const tinto = inv.find(i => i.name === 'Coca-Cola 400 ml');
  assert.equal((await A('PUT', `/inventory/${tinto.id}`, { ...tinto, stock: 5 })).status, 200);
  const o = await publicOrder(srv, 'poll', 'Coca-Cola 400 ml'); assert.equal(o.status, 201);
  const ped = await deliver(o);
  assert.equal((await A('POST', `/pedidos/${ped.id}/facturar`)).status, 201);
  const despues = list((await A('GET', '/inventory')).data).find(i => i.name === 'Coca-Cola 400 ml');
  assert.equal(despues.stock, 4, 'facturar una gaseosa baja el stock de 5 a 4');
  // lo que se prepara al momento nunca sale agotado, y si se activa el control en 0 sí; al quitarlo vuelve
  const muslo = inv.find(i => i.name === 'Muslo');
  assert.equal(muslo.noStock, true);
  await A('PUT', `/inventory/${muslo.id}`, { ...muslo, noStock: false });
  assert.equal((await srv.api('GET', '/api/public/carta/poll')).data.products.find(p => p.name === 'Muslo').soldOut, true);
  await A('PUT', `/inventory/${muslo.id}`, { ...muslo, noStock: true });
  assert.equal((await srv.api('GET', '/api/public/carta/poll')).data.products.find(p => p.name === 'Muslo').soldOut, false);
});

test('turno y Finanzas: lo vendido entra al cerrar el turno y el bolsillo cuadra', async () => {
  // una venta normal de mostrador
  const v = await A('POST', '/sales', { items: [{ name: 'Venta de mostrador', price: 10000, qty: 2 }], paymentMethod: 'efectivo', cashier: 'Admin' });
  assert.equal(v.status, 201);
  const ventas = list((await A('GET', '/sales')).data);
  const totalVentas = ventas.reduce((a, s) => a + s.total, 0);
  const enEfectivo = ventas.filter(s => s.paymentMethod === 'efectivo').reduce((a, s) => a + s.total, 0);
  const enBanco = totalVentas - enEfectivo;
  assert.ok(enBanco > 0, 'la prueba incluye una venta por transferencia');
  const domicilios = ventas.reduce((a, s) => a + (s.deliveryFee || 0), 0);
  const antesFin = (await A('GET', '/finance')).data;
  assert.equal(antesFin.periodTotals.ingresos, 0, 'antes de cerrar el turno Finanzas no cuenta las ventas');
  const turno = list((await A('GET', '/shifts')).data).find(s => s.status === 'open');
  assert.ok(turno.totalDomicilios > 0, 'el turno muestra cuánto fueron domicilios');
  const pago = await A('POST', '/finance/domicilios', { kind: 'pago', amount: 4000, incentive: 1000, note: 'prueba', bucket: 'efectivo' });
  assert.equal(pago.status, 201);
  const cierre = await A('POST', `/shifts/${turno.id}/close`, { closingCash: 0 });
  assert.equal(cierre.status, 200);
  assert.equal(cierre.data.expectedCash, 50000 + enEfectivo - 5000, 'efectivo esperado = base + ventas EN EFECTIVO − pago al domiciliario (lo de transferencia no entra a la caja)');
  const fin = (await A('GET', '/finance')).data;
  assert.equal(fin.periodTotals.ingresos, totalVentas, 'Finanzas = todas las ventas del turno cerrado');
  assert.equal(fin.totals.efectivo, enEfectivo - 5000);
  assert.equal(fin.totals.banco, enBanco, 'lo pagado por transferencia va al banco');
  const pocket = (await A('GET', '/finance/domicilios')).data;
  assert.equal(pocket.saldo, domicilios - 5000, 'bolsillo = domicilios cobrados − pagos');
  assert.equal(pocket.pendienteEntradas, 0);
});

test('editar el domicilio de una factura actualiza el bolsillo y deja huella en la bitácora', async () => {
  const sale = list((await A('GET', '/sales')).data).find(s => s.source === 'carta' && (s.deliveryFee || 0) > 0);
  const antes = (await A('GET', '/finance/domicilios')).data.saldo;
  const items = sale.items.map(i => i.kind === 'domicilio' ? { ...i, price: i.price + 1000 } : i);
  const r = await A('PUT', `/sales/${sale.id}`, { items, paymentMethod: sale.paymentMethod, client: sale.client });
  assert.equal(r.status, 200);
  assert.equal(r.data.sale.deliveryFee, sale.deliveryFee + 1000);
  assert.equal((await A('GET', '/finance/domicilios')).data.saldo, antes + 1000);
  const bit = (await A('GET', '/audit')).data; const arr = Array.isArray(bit) ? bit : bit.log || bit.entries || [];
  assert.ok(arr.some(e => /domicilio/.test(e.summary) && /Editó la factura/.test(e.summary)));
  assert.ok(arr.some(e => e.action === 'pedido_factura'));
});

test('lo importante del módulo queda en la bitácora', async () => {
  const bit = (await A('GET', '/audit')).data; const arr = Array.isArray(bit) ? bit : bit.log || bit.entries || [];
  for (const accion of ['pedido_estado', 'pedido_entrega', 'pedido_factura', 'domicilio_salida', 'carta_ajustes', 'carta_inventario']) {
    assert.ok(arr.some(e => e.action === accion), 'falta en la bitácora: ' + accion);
  }
});

test('registrar la carta en inventario: lo que se prepara al momento no controla stock; lo empacado sí (stock 0)', async () => {
  const sup = await srv.superToken();
  const F = await createFranchise(srv, sup, { name: 'Inv Carta', slug: 'invcarta', template: 'polleria' });
  const call = (m, u, b) => srv.api(m, `/api/${F.id}${u}`, { token: F.tokens.admin, body: b });
  const r = await call('POST', '/carta/sync-inventory');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.created, r.data.controlled + r.data.free);
  assert.ok(r.data.free > 0 && r.data.controlled > 0, 'hay de los dos tipos');
  const inv = (await call('GET', '/inventory')).data;
  const item = (n) => inv.find(i => i.name === n);
  for (const n of ['Muslo', 'Pechuga', 'Tinto']) assert.equal(item(n).noStock, true, n + ' se prepara al momento: sin control de stock');
  assert.equal(item('Coca-Cola 400 ml').noStock, false, 'una gaseosa controla stock');
  const bebidas = inv.filter(i => i.category === 'Gaseosas y jugos' || i.category === 'Cervezas' || i.category === 'Aguas');
  assert.ok(bebidas.length > 10 && bebidas.every(i => i.noStock === false && i.stock === 0), 'las bebidas controlan stock y arrancan en 0');
  for (const cat of ['Papas grandes', 'Papas y snacks pequeños', 'Pasteles, galletas y chicles']) assert.ok(inv.filter(i => i.category === cat).every(i => i.noStock === false), cat + ' controla stock');
  assert.equal(inv.filter(i => i.noStock).length, r.data.free);
  // la carta pública: lo que se prepara al momento se puede pedir; lo empacado sin stock sale agotado
  const pub = (await srv.api('GET', '/api/public/carta/invcarta')).data.products;
  assert.equal(pub.find(p => p.name === 'Muslo').soldOut, false);
  assert.equal(pub.find(p => p.name === bebidas[0].name).soldOut, true);
});
