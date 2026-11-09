/**
 * Pruebas de las colecciones (ventas / pedidos). Se ejecutan con los dos motores (archivos JSON y SQLite):
 * el comportamiento tiene que ser idéntico.
 */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

module.exports = function suite(engine) {
  const DIR = fs.mkdtempSync(path.join(os.tmpdir(), `facjp-filas-${engine}-`));
  process.env.DATA_PATH = DIR;
  process.env.STORAGE_ENGINE = engine;
  const st = require('../src/services/fileStorage');
  after(() => { try { require('../src/services/docStore').closeAll(); fs.rmSync(DIR, { recursive: true, force: true }); } catch { /* Windows */ } });

  const biz = 'negocio-x';
  const venta = (n, extra = {}) => ({ id: 'v' + n, createdAt: new Date(Date.UTC(2026, 10, 1 + n, 15)).toISOString(), total: 1000 * n, ...extra });

  test(`[${engine}] insertar, leer, orden de llegada y contar`, () => {
    const c = st.collection(biz, 'sales.json');
    assert.deepEqual(c.all(), []);
    for (const n of [3, 1, 2]) c.insert(venta(n));
    assert.deepEqual(c.all().map(x => x.id), ['v3', 'v1', 'v2'], 'se conserva el orden en que se guardaron');
    assert.equal(c.count(), 3);
    assert.equal(c.get('v1').total, 1000);
    assert.equal(c.get('no-existe'), null);
  });

  test(`[${engine}] actualizar una fila no cambia su lugar; borrar la quita`, () => {
    const c = st.collection(biz, 'sales.json');
    c.upsert({ ...venta(1), total: 777, nota: 'editada' });
    assert.deepEqual(c.all().map(x => x.id), ['v3', 'v1', 'v2']);
    assert.equal(c.get('v1').total, 777);
    assert.equal(c.remove('v3'), true);
    assert.equal(c.remove('v3'), false);
    assert.deepEqual(c.all().map(x => x.id), ['v1', 'v2']);
  });

  test(`[${engine}] consulta por rango de fechas, estado, límite y orden`, () => {
    const c = st.collection(biz, 'pedidos.json');
    const d = (n) => Date.UTC(2026, 10, n, 12);
    const p = (n, status) => ({ id: 'p' + n, status, createdAt: new Date(d(n)).toISOString() });
    [p(1, 'entregado'), p(2, 'pendiente'), p(3, 'vencido'), p(4, 'pendiente'), p(5, 'entregado')].forEach(x => c.insert(x));
    assert.deepEqual(c.query({ fromTs: d(2), toTs: d(4) }).map(x => x.id), ['p2', 'p3', 'p4']);
    assert.deepEqual(c.query({ statuses: ['pendiente'] }).map(x => x.id), ['p2', 'p4']);
    assert.deepEqual(c.query({ notStatuses: ['entregado', 'vencido'] }).map(x => x.id), ['p2', 'p4']);
    assert.deepEqual(c.query({ desc: true, limit: 2 }).map(x => x.id), ['p5', 'p4']);
    assert.deepEqual(c.query({ fromTs: d(9) }), []);
  });

  test(`[${engine}] el código que lee y guarda "toda la lista" sigue funcionando (compatibilidad)`, async () => {
    const f = path.join(st.getBusinessPath(biz), 'sales.json');
    const lista = await st.readJSON(f);
    assert.deepEqual(lista.map(x => x.id), ['v1', 'v2']);
    lista.push(venta(9)); lista[0].total = 5;
    await st.writeJSON(f, lista);
    const c = st.collection(biz, 'sales.json');
    assert.deepEqual(c.all().map(x => x.id), ['v1', 'v2', 'v9']);
    assert.equal(c.get('v1').total, 5);
    await st.writeJSON(f, lista.filter(x => x.id !== 'v2')); // quitar uno
    assert.deepEqual(c.all().map(x => x.id), ['v1', 'v9']);
  });

  test(`[${engine}] los respaldos ven las ventas como el documento de siempre`, () => {
    const docs = st.listBusinessDocs(biz);
    assert.deepEqual(JSON.parse(docs['sales.json']).map(x => x.id), ['v1', 'v9']);
    assert.ok(docs['pedidos.json']);
  });

  if (engine === 'sqlite') {
    test('[sqlite] un negocio con ventas en el documento viejo se convierte a filas una sola vez, sin perder ni reordenar nada', async () => {
      const id = 'negocio-viejo';
      const dir = path.join(DIR, id); fs.mkdirSync(dir, { recursive: true });
      const viejas = Array.from({ length: 500 }, (_, i) => venta(i % 28, { id: 'old' + i }));
      fs.writeFileSync(path.join(dir, 'sales.json'), JSON.stringify(viejas, null, 2));
      fs.writeFileSync(path.join(dir, 'pedidos.json'), JSON.stringify([{ id: 'q1', status: 'pendiente', createdAt: new Date().toISOString() }]));
      fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify({ name: 'Viejo' }));
      const c = st.collection(id, 'sales.json');
      assert.deepEqual(c.all().map(x => x.id), viejas.map(x => x.id));
      assert.deepEqual(c.all(), viejas, 'mismos datos exactos');
      assert.equal(st.collection(id, 'pedidos.json').count(), 1);
      assert.deepEqual(await st.readJSON(path.join(dir, 'profile.json')), { name: 'Viejo' });
      // los archivos originales quedan intactos
      assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'sales.json'), 'utf8')).length, 500);
      // ya no existe como documento aparte (una sola verdad)
      const { DatabaseSync } = require('node:sqlite');
      require('../src/services/docStore').close(path.resolve(dir));
      const db = new DatabaseSync(path.join(dir, 'negocio.db'));
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM docs WHERE name = 'sales.json'").get().n, 0);
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM rows WHERE coll = 'sales'").get().n, 500);
      db.close();
    });

    test('[sqlite] una base que YA estaba en SQLite con ventas/pedidos como documento (estado de producción hoy) se convierte a filas al abrir', async () => {
      const id = 'negocio-prod';
      const dir = path.join(DIR, id); fs.mkdirSync(dir, { recursive: true });
      // Se arma la base exactamente como la dejó la versión anterior: tablas docs y meta, sin tabla rows
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(path.join(dir, 'negocio.db'));
      db.exec('CREATE TABLE docs (name TEXT PRIMARY KEY, json TEXT NOT NULL, updated TEXT NOT NULL); CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
      const ahora = Date.now();
      const ventas = Array.from({ length: 300 }, (_, i) => venta(i % 20, { id: 'prod' + i, total: 1000 + i }));
      const pedidos = [
        { id: 'a', status: 'entregado', saleId: 'prod1', createdAt: new Date(ahora).toISOString() },
        { id: 'b', status: 'entregado', createdAt: new Date(ahora).toISOString() },
        { id: 'c', status: 'pendiente', createdAt: new Date(ahora).toISOString() }];
      const put = db.prepare('INSERT INTO docs (name, json, updated) VALUES (?, ?, ?)');
      put.run('sales.json', JSON.stringify(ventas, null, 2), 'x'); put.run('pedidos.json', JSON.stringify(pedidos, null, 2), 'x');
      put.run('profile.json', JSON.stringify({ name: 'Prod' }), 'x'); put.run('inventory.json', '[{"id":"i1","name":"Pollo"}]', 'x');
      db.prepare("INSERT INTO meta (k, v) VALUES ('imported', 'x')").run();
      db.close();
      // Un JSON viejo suelto en la carpeta NO debe pisar lo que ya está en la base
      fs.writeFileSync(path.join(dir, 'sales.json'), '[]');

      const c = st.collection(id, 'sales.json');
      assert.deepEqual(c.all(), ventas, 'las 300 ventas, iguales y en el mismo orden');
      const p = st.collection(id, 'pedidos.json');
      assert.deepEqual(p.query({ statuses: ['entregado'] }).map(x => x.id), ['b'], 'el entregado SIN factura queda "por facturar"');
      assert.deepEqual(p.query({ statuses: ['facturado'] }).map(x => x.id), ['a'], 'el entregado CON factura queda "facturado"');
      assert.deepEqual(await st.readJSON(path.join(dir, 'profile.json')), { name: 'Prod' }, 'los demás documentos intactos');
      assert.deepEqual(await st.readJSON(path.join(dir, 'inventory.json')), [{ id: 'i1', name: 'Pollo' }]);
      // y sigue funcionando después: agregar, leer, y el respaldo ve el documento de siempre
      c.insert(venta(25, { id: 'nueva' }));
      assert.equal(c.count(), 301);
      assert.equal(JSON.parse(st.listBusinessDocs(id)['sales.json']).length, 301);
      require('../src/services/docStore').close(path.resolve(dir));
      const d2 = new DatabaseSync(path.join(dir, 'negocio.db'));
      assert.equal(d2.prepare("SELECT COUNT(*) AS n FROM docs WHERE name IN ('sales.json','pedidos.json')").get().n, 0, 'ya no quedan como documento');
      d2.close();
    });

    test('[sqlite] los archivos de la raíz (franquicias, superadmin, enlaces) pasan a la base global sin tocar los originales', async () => {
      fs.writeFileSync(path.join(DIR, 'businesses.json'), JSON.stringify([{ id: 'negocio-x', name: 'Uno' }]));
      fs.writeFileSync(path.join(DIR, 'superadmin.json'), JSON.stringify({ username: 'superadmin', password: 'hash' }));
      fs.writeFileSync(path.join(DIR, 'shortlinks.json'), JSON.stringify({ abc: { businessId: 'negocio-x' } }));
      assert.deepEqual(await st.readJSON(path.join(DIR, 'businesses.json')), [{ id: 'negocio-x', name: 'Uno' }]);
      assert.equal((await st.readJSON(path.join(DIR, 'superadmin.json'))).username, 'superadmin');
      await st.writeJSON(path.join(DIR, 'businesses.json'), [{ id: 'negocio-x', name: 'Renombrado' }]);
      assert.equal((await st.readJSON(path.join(DIR, 'businesses.json')))[0].name, 'Renombrado');
      assert.equal(JSON.parse(fs.readFileSync(path.join(DIR, 'businesses.json'), 'utf8'))[0].name, 'Uno', 'el archivo original no se toca (retroceso)');
      assert.ok(fs.existsSync(path.join(DIR, 'global.db')));
      const raiz = st.listRootDocs();
      assert.deepEqual(Object.keys(raiz).sort(), ['businesses.json', 'shortlinks.json', 'superadmin.json']);
      assert.equal(JSON.parse(raiz['businesses.json'])[0].name, 'Renombrado');
      // un archivo suelto que no es .json (clave, secretos) NO se mete a la base
      assert.equal(st.docInfo(path.join(DIR, '.jwt_secret')), null);
      assert.equal(st.docInfo(path.join(DIR, 'backups', 'estado.json')), null);
    });

    test('[sqlite] la consulta por fecha usa el índice (no recorre todo el historial)', () => {
      const id = 'negocio-grande';
      const c = st.collection(id, 'sales.json');
      const lote = Array.from({ length: 3000 }, (_, i) => ({ id: 's' + i, createdAt: new Date(Date.UTC(2026, 0, 1) + i * 3600e3).toISOString(), total: i }));
      require('fs').mkdirSync(st.getBusinessPath(id), { recursive: true });
      return st.writeJSON(path.join(st.getBusinessPath(id), 'sales.json'), lote).then(() => {
      const t0 = process.hrtime.bigint();
      const r = c.query({ fromTs: Date.UTC(2026, 0, 100), toTs: Date.UTC(2026, 0, 101) });
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      assert.ok(r.length > 20 && r.length <= 25, 'devuelve solo el día pedido: ' + r.length);
      assert.ok(ms < 50, 'rápido: ' + ms + ' ms');
      });
    });
  }
};
