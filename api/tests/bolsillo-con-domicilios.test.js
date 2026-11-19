/**
 * El bolsillo Domicilios (pagos) y los domicilios hechos a mano compartían domicilios.json: el bolsillo no cargaba.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, createFranchise, leerDoc, escribirDoc } = require('./helpers');

test('el bolsillo carga aunque haya domicilios a mano, y los pagos viejos mezclados se separan', async () => {
  const srv = await startServer();
  try {
    const F = await createFranchise(srv, await srv.superToken(), { name: 'Bolsillo Mix', slug: 'bolsillo-mix', template: 'polleria' });
    const mezcla = [
      { id: 'dom-1', status: 'por_enviar', name: 'Ana', items: [{ name: 'Pollo', price: 1000, qty: 1 }], createdAt: new Date().toISOString() },
      { id: 'pago-viejo', date: new Date().toISOString(), kind: 'pago', amount: 5000, base: 5000, incentive: 0, note: '', bucket: 'efectivo', by: 'x' }
    ];
    escribirDoc(srv.dataDir, F.id, 'domicilios.json', JSON.stringify(mezcla));
    const r = await srv.api('GET', `/api/${F.id}/finance/domicilios`, { token: F.tokens.admin });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.salidasDia, 5000, 'el pago viejo cuenta como salida');
    const pagos = JSON.parse(leerDoc(srv.dataDir, F.id, 'domicilio-pagos.json'));
    assert.equal(pagos.length, 1);
    const dom = JSON.parse(leerDoc(srv.dataDir, F.id, 'domicilios.json'));
    assert.deepEqual(dom.map(d => d.id), ['dom-1'], 'el domicilio a mano queda donde estaba');
    const nuevo = await srv.api('POST', `/api/${F.id}/finance/domicilios`, { token: F.tokens.admin, body: { kind: 'moto', amount: 2000, note: 'gasolina' } });
    assert.equal(nuevo.status, 201);
    assert.equal((await srv.api('GET', `/api/${F.id}/finance/domicilios`, { token: F.tokens.admin })).data.salidasDia, 7000);
  } finally { await srv.stop(); }
});
