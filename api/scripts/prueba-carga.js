/**
 * Prueba de carga: un negocio con mucho historial. Mide lo que hace la gente todos los días.
 *
 *   node scripts/prueba-carga.js [ventas] [pedidos]        (por defecto 60000 y 20000)
 *   STORAGE_ENGINE=sqlite node scripts/prueba-carga.js     (compara con el otro motor)
 */
const path = require('path');
const { startServer, createFranchise, openShift, escribirDoc } = require(path.join(__dirname, '../tests/helpers'));

const N_VENTAS = Number(process.argv[2]) || 60000;
const N_PEDIDOS = Number(process.argv[3]) || 20000;

(async () => {
  const engine = (process.env.STORAGE_ENGINE || 'json').toLowerCase();
  const srv = await startServer();
  const sup = await srv.superToken();
  const F = await createFranchise(srv, sup, { name: 'Carga', slug: 'carga-x', template: 'polleria' });
  const day = 86400000, t0 = Date.now() - 200 * day;

  // Historial: ventas y pedidos repartidos en 200 días
  const ventas = Array.from({ length: N_VENTAS }, (_, i) => ({
    id: 'old-' + i, invoiceNumber: `FA-${String(i + 1).padStart(5, '0')}-2026`, createdAt: new Date(t0 + (i / N_VENTAS) * 199 * day).toISOString(),
    total: 15000 + (i % 9000), subtotal: 15000, paymentMethod: i % 3 ? 'efectivo' : 'transferencia', cashier: 'Caja', client: 'Cliente ' + (i % 500),
    items: [{ name: 'Pechuga', qty: 1, price: 10000, area: 'bar' }, { name: 'Papa', qty: 2, price: 2500, area: 'bar' }], totalsByArea: { bar: 15000, restaurante: 0 }, source: 'carta', deliveryFee: 2500 }));
  const estados = ['facturado', 'cancelado', 'vencido'];
  const pedidos = Array.from({ length: N_PEDIDOS }, (_, i) => {
    const e = estados[i % 3];
    return { id: 'ped-' + i, code: 'D-DC' + i, status: e === 'facturado' ? 'entregado' : e, saleId: e === 'facturado' ? 'old-' + i : undefined, mode: 'domicilio', payment: 'efectivo',
      customer: { name: 'Cliente ' + i, phone: '3001112233', address: 'Calle 1 # 2-3' }, lines: [{ name: 'Pechuga', qty: 1, price: 10000 }], subtotal: 10000, deliveryFee: 2500,
      createdAt: new Date(t0 + (i / N_PEDIDOS) * 199 * day).toISOString(), updatedAt: new Date().toISOString(), expiresAt: new Date(t0).toISOString() };
  });
  console.log(`Motor: ${engine} · cargando ${N_VENTAS} ventas y ${N_PEDIDOS} pedidos…`);
  const ti = Date.now();
  escribirDoc(srv.dataDir, F.id, 'sales.json', JSON.stringify(ventas));
  escribirDoc(srv.dataDir, F.id, 'pedidos.json', JSON.stringify(pedidos));
  console.log(`  carga lista en ${((Date.now() - ti) / 1000).toFixed(1)} s`);

  const T = F.tokens.cajero, A = F.tokens.admin;
  await openShift(srv, T, F.id, 0);
  const tiempo = async (nombre, fn, n = 5) => {
    const ms = [];
    for (let i = 0; i < n; i++) { const t = process.hrtime.bigint(); const r = await fn(i); ms.push(Number(process.hrtime.bigint() - t) / 1e6); if (r && r.status >= 400) { console.log('   ⚠', nombre, r.status, JSON.stringify(r.data).slice(0, 120)); break; } }
    ms.sort((a, b) => a - b);
    console.log(`  ${nombre.padEnd(52)} mediana ${ms[Math.floor(ms.length / 2)].toFixed(0).padStart(5)} ms   peor ${ms[ms.length - 1].toFixed(0).padStart(5)} ms`);
  };

  const lista = (await srv.api('GET', `/api/${F.id}/carta`, { token: A })).data;
  console.log('Operaciones del día a día:');
  await tiempo('(referencia) ruta trivial: GET /profile', () => srv.api('GET', `/api/${F.id}/profile`, { token: T }), 8);
  await tiempo('(referencia) salud: GET /api/health', () => srv.api('GET', '/api/health'), 8);
  await tiempo('Facturar una venta (POST /sales)', () => srv.api('POST', `/api/${F.id}/sales`, { token: T, body: { items: [{ name: 'Pechuga', price: 10000, qty: 1 }], paymentMethod: 'efectivo', total: 10000, cashier: 'Caja' } }), 8);
  await tiempo('Pantalla de Pedidos (GET /pedidos, cada 10 s)', () => srv.api('GET', `/api/${F.id}/pedidos`, { token: T }), 8);
  await tiempo('Lista de Facturas (GET /invoices, 300 más recientes)', () => srv.api('GET', `/api/${F.id}/invoices`, { token: T }), 5);
  await tiempo('Buscar una factura en todo el historial', () => srv.api('GET', `/api/${F.id}/invoices?q=FA-30000`, { token: T }), 3);
  await tiempo('Ventas de hoy (GET /sales?period=day)', () => srv.api('GET', `/api/${F.id}/sales?period=day`, { token: T }), 5);
  await tiempo('Reporte de ventas del mes', () => srv.api('GET', `/api/${F.id}/reports/sales?period=month`, { token: A }), 3);
  await tiempo('Finanzas diario (GET /finance/daily)', () => srv.api('GET', `/api/${F.id}/finance/daily`, { token: A }), 3);
  const cur = (await srv.api('GET', `/api/${F.id}/shifts/current`, { token: T })).data;
  const sid = (cur.shift || cur).id;
  await tiempo('Cerrar el turno (suma las ventas del turno)', () => srv.api('POST', `/api/${F.id}/shifts/${sid}/close`, { token: T, body: { closingCash: 0 } }), 1);
  console.log('\nTamaño en disco:', (require('fs').readdirSync(path.join(srv.dataDir, F.id)).map(n => [n, require('fs').statSync(path.join(srv.dataDir, F.id, n)).size]).filter(x => x[1] > 1e5).map(x => `${x[0]} ${(x[1] / 1048576).toFixed(1)} MB`).join(' · ')));
  const perf = srv.getLog().split(String.fromCharCode(10)).filter(x => x.includes('[perf]')).slice(0, 4); if (perf.length) console.log(perf.join(String.fromCharCode(10)));
  await srv.stop();
})().catch(e => { console.error(e); process.exit(1); });
