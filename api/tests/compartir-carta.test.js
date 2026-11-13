/**
 * Al compartir el enlace de la carta (WhatsApp, etc.) sale el logo y "Carta de <negocio>".
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, createFranchise, leerDoc, escribirDoc } = require('./helpers');

let srv, F;
before(async () => {
  srv = await startServer();
  F = await createFranchise(srv, await srv.superToken(), { name: 'Deli Prueba', slug: 'deli-share', template: 'polleria' });
});
after(async () => { if (srv) await srv.stop(); });
const pagina = (slug, headers = {}) => srv.api('GET', `/carta/${slug}`, { headers });
const meta = (html, prop) => (html.match(new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`)) || [])[1];

test('el enlace de la carta trae título, descripción y el logo como imagen (con dirección completa)', async () => {
  const perfil = JSON.parse(leerDoc(srv.dataDir, F.id, 'profile.json'));
  perfil.logo = `/uploads/${F.id}/logo.jpg`;
  escribirDoc(srv.dataDir, F.id, 'profile.json', JSON.stringify(perfil));
  const r = await pagina('deli-share', { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'miapp.example.com' });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/html/);
  const h = r.data;
  assert.match(h, /<title>Carta de Deli Prueba<\/title>/);
  assert.equal(meta(h, 'og:title'), 'Carta de Deli Prueba');
  assert.equal(meta(h, 'og:image'), `https://miapp.example.com/uploads/${F.id}/logo.jpg`, 'imagen con dirección completa (WhatsApp la exige)');
  assert.equal(meta(h, 'og:url'), 'https://miapp.example.com/carta/deli-share');
  assert.match(meta(h, 'og:description'), /Mira la carta de Deli Prueba/);
  assert.equal(meta(h, 'description'), meta(h, 'og:description'), 'la descripción normal también se actualiza');
  assert.equal((h.match(/<title>/g) || []).length, 1, 'un solo título');
  assert.ok(h.includes('<div id="app">') || h.includes('id="app"'), 'sigue siendo la app (carga la carta normal)');
});

test('sin logo usa la portada de la carta; y sin ninguna, el ícono de la app', async () => {
  const perfil = JSON.parse(leerDoc(srv.dataDir, F.id, 'profile.json')); delete perfil.logo;
  escribirDoc(srv.dataDir, F.id, 'profile.json', JSON.stringify(perfil));
  let h = (await pagina('deli-share', { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'x.example.com' })).data;
  assert.equal(meta(h, 'og:image'), 'https://x.example.com/icon-512.png');
  const carta = JSON.parse(leerDoc(srv.dataDir, F.id, 'carta.json')); carta.settings.heroImage = `/uploads/${F.id}/hero.webp?v=1`;
  escribirDoc(srv.dataDir, F.id, 'carta.json', JSON.stringify(carta));
  h = (await pagina('deli-share', { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'x.example.com' })).data;
  assert.equal(meta(h, 'og:image'), `https://x.example.com/uploads/${F.id}/hero.webp?v=1`);
});

test('un nombre con comillas o etiquetas no puede meter código en la página', async () => {
  const perfil = JSON.parse(leerDoc(srv.dataDir, F.id, 'profile.json')); perfil.name = 'Pollo "Rico" <script>alert(1)</script> & Cía';
  escribirDoc(srv.dataDir, F.id, 'profile.json', JSON.stringify(perfil));
  const h = (await pagina('deli-share')).data;
  assert.ok(!h.includes('<script>alert(1)</script>'), 'la etiqueta no se cuela');
  assert.match(h, /Carta de Pollo &quot;Rico&quot; &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; Cía/);
});

test('un enlace de una carta que no existe, o mal escrito, sigue sirviendo la app normal', async () => {
  for (const slug of ['no-existe', '..%2Fsecretos', 'a'.repeat(80)]) {
    const r = await pagina(slug);
    assert.equal(r.status, 200, slug); assert.ok(!/og:title/.test(r.data), slug + ': sin tarjeta propia');
  }
  assert.equal((await srv.api('GET', '/api/public/carta/deli-share')).data.business.name.length > 0, true);
});

test('la carta pública informa el logo para la pestaña del navegador', async () => {
  const perfil = JSON.parse(leerDoc(srv.dataDir, F.id, 'profile.json')); perfil.logo = `/uploads/${F.id}/logo.jpg`;
  escribirDoc(srv.dataDir, F.id, 'profile.json', JSON.stringify(perfil));
  assert.equal((await srv.api('GET', '/api/public/carta/deli-share')).data.business.logo, `/uploads/${F.id}/logo.jpg`);
});
