/**
 * Módulos de cada franquicia (asistente, dependencias, bloqueos) y editor de carta.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, createFranchise } = require('./helpers');

let srv, sup, F, adm, T;
const A = (m, p, body) => srv.api(m, `/api/${F.id}${p}`, { token: adm, body });

before(async () => {
  srv = await startServer();
  sup = await srv.superToken();
  F = await createFranchise(srv, sup, { name: 'Pollería Módulos', slug: 'mod' });
  adm = F.tokens.admin;
  T = await createFranchise(srv, sup, { name: 'Tienda Módulos', slug: 'tien', template: 'tienda' });
});
after(() => srv && srv.stop());

const state = async (id) => (await srv.api('GET', `/api/businesses/${id}/modules`, { token: sup })).data;

test('la lista de módulos y las plantillas están completas', async () => {
  const r = (await srv.api('GET', '/api/businesses/registry', { token: adm })).data;
  assert.deepEqual(r.modules.map(m => m.key).sort(), ['aud', 'bol', 'carta', 'fiado', 'fin', 'multi', 'nom', 'rec', 'rep']);
  assert.deepEqual(r.templates.map(t => t.id).sort(), ['bar', 'campo', 'polleria', 'tienda']);
  assert.ok(r.base.length >= 5);
});

test('cada plantilla deja los módulos que dice', async () => {
  const p = await state(F.id);
  assert.equal(p.carta, true); assert.equal(p.bol, true); assert.equal(p.fin, true);
  assert.equal(p.nom, false); assert.equal(p.fiado, false);
  const t = await state(T.id);
  assert.equal(t.carta, false); assert.equal(t.fin, true);
  assert.equal((await srv.api('GET', '/api/public/carta/tien')).status, 404);
});

test('las dependencias se respetan: apagar Finanzas apaga el bolsillo; prender el bolsillo prende lo que necesita', async () => {
  let r = await srv.api('PUT', `/api/businesses/${F.id}/settings`, { token: sup, body: { moduleKeys: { fin: false } } });
  assert.equal(r.status, 200);
  let s = await state(F.id); assert.equal(s.fin, false); assert.equal(s.bol, false);
  assert.equal((await A('GET', '/finance/domicilios')).status, 403, 'el bolsillo queda bloqueado en el servidor');
  r = await srv.api('PUT', `/api/businesses/${F.id}/settings`, { token: sup, body: { moduleKeys: { bol: true } } });
  s = await state(F.id); assert.equal(s.bol, true); assert.equal(s.fin, true); assert.equal(s.carta, true);
  // en una tienda, prender el bolsillo prende también la carta
  await srv.api('PUT', `/api/businesses/${T.id}/settings`, { token: sup, body: { moduleKeys: { bol: true } } });
  const t = await state(T.id); assert.equal(t.carta, true); assert.equal(t.bol, true);
  assert.equal((await srv.api('GET', '/api/public/carta/tien')).status, 200, 'al prender la carta se crea y se publica');
  await srv.api('PUT', `/api/businesses/${T.id}/settings`, { token: sup, body: { moduleKeys: { carta: false } } });
  assert.equal((await state(T.id)).bol, false, 'apagar la carta apaga el bolsillo');
});

test('un módulo apagado se bloquea aunque alguien escriba la ruta a mano', async () => {
  await srv.api('PUT', `/api/businesses/${F.id}/settings`, { token: sup, body: { moduleKeys: { rep: true, aud: false } } });
  assert.equal((await A('GET', '/audit')).status, 403);
  await srv.api('PUT', `/api/businesses/${F.id}/settings`, { token: sup, body: { moduleKeys: { aud: true } } });
  assert.equal((await A('GET', '/audit')).status, 200);
});

test('el admin ve sus módulos pero no los cambia, y no ve los de otra franquicia', async () => {
  assert.equal((await srv.api('GET', `/api/businesses/${F.id}/modules`, { token: adm })).status, 200);
  assert.equal((await srv.api('GET', `/api/businesses/${T.id}/modules`, { token: adm })).status, 403);
  assert.equal((await srv.api('PUT', `/api/businesses/${F.id}/settings`, { token: adm, body: { moduleKeys: { nom: true } } })).status, 403);
  // y el perfil no deja que el admin se prenda módulos a mano
  const prof = (await A('GET', '/profile')).data;
  const r = await A('PUT', '/profile', { ...prof, cartaOnline: false, modules: { ...prof.modules, payroll: true }, usesRecipes: true });
  assert.equal(r.status, 200);
  assert.equal(r.data.cartaOnline, prof.cartaOnline, 'cartaOnline no lo cambia el admin');
  assert.equal(r.data.modules.payroll, prof.modules.payroll);
  assert.equal(r.data.usesRecipes, prof.usesRecipes);
});

test('crear una franquicia con datos malos no deja nada a medias', async () => {
  const antes = (await srv.api('GET', '/api/businesses', { token: sup })).data.length;
  const mal = await srv.api('POST', '/api/businesses', { token: sup, body: { name: 'Mala', slug: 'mala', template: 'polleria',
    users: [{ name: 'x', username: 'mod-admin', password: 'Clave-1234', role: 'admin' }] } });
  assert.equal(mal.status, 409, 'usuario repetido');
  assert.equal((await srv.api('POST', '/api/businesses', { token: sup, body: { name: 'Mala', slug: 'mala', template: 'bar', users: [{ name: 'x', username: 'nuevo-domi', password: 'Clave-1234', role: 'domiciliario' }] } })).status, 400, 'domiciliario sin pedidos en línea');
  assert.equal((await srv.api('POST', '/api/businesses', { token: sup, body: { name: 'Mala', slug: 'mala', template: 'bar', users: [{ name: 'x', username: 'ab', password: 'Clave-1234', role: 'admin' }] } })).status, 400, 'usuario muy corto');
  assert.equal((await srv.api('POST', '/api/businesses', { token: sup, body: { name: 'Mala', slug: 'mala', template: 'bar', users: [{ name: 'x', username: 'usuario-ok', password: '123', role: 'admin' }] } })).status, 400, 'contraseña corta');
  assert.equal((await srv.api('POST', '/api/businesses', { token: sup, body: { name: 'Mala', slug: 'mala', template: 'polleria', cartaSettings: { whatsapp: '123' } } })).status, 400, 'WhatsApp inválido');
  assert.equal((await srv.api('GET', '/api/businesses', { token: sup })).data.length, antes);
});

test('una carta nueva no hereda los datos de contacto de Deli-Combos', async () => {
  const c = (await srv.api('GET', '/api/public/carta/mod')).data;
  const s = JSON.stringify(c);
  for (const dato of ['3225660214', 'Juancho Polo', 'bbva3012767185', 'Santa Elena']) assert.ok(!s.includes(dato), 'no debe traer: ' + dato);
  assert.equal(c.settings.whatsapp, '573001234567');
});

// ───────────────────────── Editor de carta ─────────────────────────

test('categorías: crear, no repetir, renombrar y proteger las que tienen productos', async () => {
  const c = await A('POST', '/carta/categories', { name: 'Postres', emoji: '🍰' });
  assert.equal(c.status, 201);
  assert.equal((await A('POST', '/carta/categories', { name: 'postres' })).status, 409);
  assert.equal((await A('POST', '/carta/categories', { name: 'a' })).status, 400);
  assert.equal((await A('PUT', `/carta/categories/${c.data.id}`, { name: 'Dulces' })).data.name, 'Dulces');
  const p = await A('POST', '/carta/products', { name: 'Flan', price: 4500, categoryId: c.data.id });
  assert.equal(p.status, 201);
  assert.equal((await A('DELETE', `/carta/categories/${c.data.id}`)).status, 409, 'con productos no se borra');
  await A('DELETE', `/carta/products/${p.data.id}`);
  assert.equal((await A('DELETE', `/carta/categories/${c.data.id}`)).status, 200);
});

test('productos: nombres únicos, validación y opciones', async () => {
  const cat = (await A('POST', '/carta/categories', { name: 'Platos' })).data;
  const mk = (b) => A('POST', '/carta/products', { categoryId: cat.id, ...b });
  assert.equal((await mk({ name: 'Arepa', price: 3000 })).status, 201);
  assert.equal((await mk({ name: 'AREPA', price: 1 })).status, 409, 'nombre repetido (sin importar mayúsculas)');
  assert.equal((await A('POST', '/carta/products', { name: 'Sin categoría', price: 1 })).status, 400);
  assert.equal((await mk({ name: 'Sin opciones', price: 1, groups: [{ name: 'Vacío', type: 'many', options: [] }] })).status, 400);
  assert.equal((await mk({ name: 'Tipo malo', price: 1, groups: [{ name: 'Raro', type: 'zzz', options: [{ name: 'x', price: 0 }] }] })).status, 400);
  const ok = await mk({ name: 'Relleno', price: 5000, groups: [{ name: 'Sabor', type: 'one', required: true, options: [{ name: 'Pollo', price: 0 }, { name: 'Carne', price: 1000 }] }] });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.groups[0].options.length, 2); assert.ok(ok.data.groups[0].options[0].id);
});

test('bebidas "desde la carta": las opciones se calculan en vivo y se cobran con el precio actual', async () => {
  const carta = (await A('GET', '/carta')).data;
  const bebidas = (await A('POST', '/carta/categories', { name: 'Gaseosas' })).data;
  const coca = (await A('POST', '/carta/products', { name: 'Coca-Cola', price: 3500, categoryId: bebidas.id })).data;
  const sprite = (await A('POST', '/carta/products', { name: 'Sprite', price: 3000, categoryId: bebidas.id })).data;
  const cat = carta.categories.find(c => c.name === 'Platos') || (await A('GET', '/carta')).data.categories.find(c => c.name === 'Platos');
  const plato = (await A('POST', '/carta/products', { name: 'Combo prueba', price: 10000, categoryId: cat.id,
    groups: [{ name: 'Bebidas', type: 'qty', collapsed: true, source: { categories: [bebidas.id] } }] })).data;
  let pub = (await srv.api('GET', '/api/public/carta/mod')).data;
  let g = pub.products.find(p => p.name === 'Combo prueba').groups[0];
  assert.deepEqual(g.options.map(o => o.name).sort(), ['Coca-Cola', 'Sprite']);
  const order = async () => srv.api('POST', '/api/public/pedidos/mod', { body: { name: 'Ana', phone: '3001112233', address: 'Calle 1 # 2-3', mode: 'domicilio', payment: 'efectivo', privacyAccepted: true,
    items: [{ productId: plato.id, qty: 1, choices: { [g.id]: [{ optionId: g.options.find(o => o.name === 'Coca-Cola').id, qty: 2 }] } }] } });
  assert.equal((await order()).data.subtotal, 10000 + 2 * 3500);
  await A('PUT', `/carta/products/${coca.id}`, { price: 4000 });
  assert.equal((await order()).data.subtotal, 10000 + 2 * 4000, 'el precio nuevo vale en todos los combos');
  await A('PUT', `/carta/products/${coca.id}`, { soldOut: true });
  assert.equal((await order()).status, 400, 'si se agota la bebida, no se puede pedir en el combo');
  assert.equal((await A('DELETE', `/carta/categories/${bebidas.id}`)).status, 409, 'no se borra una categoría que alimenta unas opciones');
  assert.ok(sprite.id);
});

test('ocultar, ordenar y borrar productos', async () => {
  const carta = (await A('GET', '/carta')).data;
  const cat = carta.categories.find(c => c.name === 'Platos');
  const prods = carta.products.filter(p => p.categoryId === cat.id).sort((a, b) => a.order - b.order);
  const [a, b] = prods;
  assert.equal((await A('PUT', `/carta/products/${a.id}`, { active: false })).status, 200);
  assert.ok(!(await srv.api('GET', '/api/public/carta/mod')).data.products.some(p => p.id === a.id), 'un producto oculto no sale en la carta pública');
  assert.equal((await srv.api('POST', '/api/public/pedidos/mod', { body: { name: 'Ana', phone: '3001112233', address: 'Calle 1 # 2-3', mode: 'domicilio', payment: 'efectivo', privacyAccepted: true, items: [{ productId: a.id, qty: 1 }] } })).status, 400, 'tampoco se puede pedir');
  await A('POST', '/carta/products/reorder', { ids: [b.id, a.id] });
  const orden = (await A('GET', '/carta')).data.products.filter(p => p.id === a.id || p.id === b.id).sort((x, y) => x.order - y.order).map(p => p.id);
  assert.deepEqual(orden, [b.id, a.id]);
  assert.equal((await A('DELETE', `/carta/products/${a.id}`)).status, 200);
  assert.equal((await A('DELETE', `/carta/products/${a.id}`)).status, 404);
});

test('el editor de carta solo lo usa el admin', async () => {
  const caja = F.tokens.cajero;
  const carta = (await A('GET', '/carta')).data;
  for (const [m, p, b] of [['POST', '/carta/categories', { name: 'Hack' }], ['POST', '/carta/products', { name: 'Hack', price: 1, categoryId: carta.categories[0].id }],
    ['DELETE', `/carta/products/${carta.products[0].id}`], ['POST', '/carta/products/reorder', { ids: [] }], ['POST', '/carta/sync-inventory']]) {
    assert.equal((await srv.api(m, `/api/${F.id}${p}`, { token: caja, body: b })).status, 403, m + ' ' + p);
  }
});
