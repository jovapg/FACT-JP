/**
 * Pago de nómina desde la caja / Finanzas: queda a nombre del trabajador en Nómina (día + horas extra), sin contarse dos veces.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, createFranchise, openShift } = require('./helpers');

test('pago de nómina: efectivo sale de la caja, banco del banco; el día queda pagado y las horas extra aparte; Finanzas no lo cuenta doble', async () => {
  const srv = await startServer();
  try {
    const F = await createFranchise(srv, await srv.superToken(), { name: 'Nomina Caja', slug: 'nomina-caja', template: 'polleria' });
    const A = (m, p, body) => srv.api(m, `/api/${F.id}${p}`, { token: F.tokens.admin, body });
    const C = (m, p, body) => srv.api(m, `/api/${F.id}${p}`, { token: F.tokens.cajero, body });
    await srv.api('PUT', `/api/businesses/${F.id}/settings`, { token: await srv.superToken(), body: { moduleKeys: { nom: true } } });
    await openShift(srv, F.tokens.admin, F.id, 100000);
    const turno = (await A('GET', '/shifts/current')).data;

    const er = await C('GET', '/payroll/employees'); const emps = er.data; if (!Array.isArray(emps)) throw new Error(er.status + ' ' + JSON.stringify(er.data));
    const maria = emps.find(e => e.name === 'Caja');
    assert.ok(maria, 'la lista trae a los usuarios del negocio (aunque sea cajero quien consulta)');

    assert.equal((await C('POST', `/shifts/${turno.id}/expense`, { category: 'nomina', dayAmount: 65000 })).status, 400, 'sin trabajador no se acepta');
    const ef = await C('POST', `/shifts/${turno.id}/expense`, { category: 'nomina', employeeId: maria.id, dayAmount: 65000, overtime: 10000, overtimeHours: 2, bucket: 'efectivo', description: 'turno de noche' });
    assert.equal(ef.status, 200, JSON.stringify(ef.data));
    assert.equal(ef.data.totalExpenses, 75000, 'la caja baja por el día + horas extra');
    const bn = await A('POST', `/shifts/${turno.id}/expense`, { category: 'nomina', employeeId: maria.id, dayAmount: 0, overtime: 5000, bucket: 'banco' });
    assert.equal(bn.status, 200);
    assert.equal(bn.data.totalExpenses, 75000, 'lo pagado por banco no sale de la caja');

    const nom = (await A('GET', '/payroll')).data;
    const dia = nom.entries.filter(e => e.employeeId === maria.id);
    assert.equal(dia.length, 1, 'se creó el día (aprobado) una sola vez');
    assert.equal(dia[0].status, 'aprobado'); assert.equal(dia[0].amount, 65000);
    assert.equal(nom.payments.length, 2);
    const pagos = nom.payments;
    assert.equal(pagos.reduce((a, p) => a + (p.extraBar || 0) + (p.extraRest || 0), 0), 15000, 'horas extra 10.000 + 5.000');
    assert.equal(pagos.reduce((a, p) => a + p.amountBar + p.amountRest, 0), 80000);
    // el saldo de días queda en 0 (lo extra no cuenta como deuda de días)
    const pagoDia = pagos.reduce((a, p) => a + p.amountBar + p.amountRest - (p.extraBar || 0) - (p.extraRest || 0), 0);
    assert.equal(dia[0].amount - pagoDia, 0);

    // Finanzas: el efectivo sale por el turno (al cerrarlo) y el banco por Nómina; sin duplicar
    await A('POST', `/shifts/${turno.id}/close`, { closingCash: 0 });
    const fin = (await A('GET', '/finance')).data;
    const noms = fin.movements.filter(m => m.kind === 'nomina');
    assert.equal(noms.reduce((a, m) => a + m.amount, 0), 80000, 'Finanzas cuenta 80.000 una sola vez');
    assert.equal(noms.filter(m => m.bucket === 'banco').reduce((a, m) => a + m.amount, 0), 5000);
    assert.ok(noms.every(m => /Nómina: /.test(m.label) && /Caja/.test(m.label)), 'con el nombre del trabajador');

    // movimiento manual de nómina con trabajador: también queda en Nómina
    const man = await A('POST', '/finance/manual', { type: 'egreso', category: 'nomina', bucket: 'banco', amount: 30000, employeeId: maria.id, dayAmount: 0, overtime: 30000, description: 'extras del sábado' });
    assert.equal(man.status, 201, JSON.stringify(man.data));
    const nom2 = (await A('GET', '/payroll')).data;
    assert.equal(nom2.payments.length, 3);
    assert.equal(nom2.payments.reduce((a, p) => a + (p.extraBar || 0) + (p.extraRest || 0), 0), 45000);
    assert.equal((await A('POST', '/finance/manual', { type: 'egreso', category: 'nomina', bucket: 'banco', amount: 1000, employeeId: 'no-existe', dayAmount: 1000 })).status, 400);
  } finally { await srv.stop(); }
});
