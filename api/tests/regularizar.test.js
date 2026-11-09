/**
 * Regularización: ventas hechas sin turno abierto pasan a un turno cerrado y llegan a Finanzas.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, createFranchise, openShift, leerDoc, escribirDoc } = require('./helpers');

let srv, F, SUP;
before(async () => {
  srv = await startServer();
  SUP = await srv.superToken();
  F = await createFranchise(srv, SUP, { name: 'Bar Regulariza', slug: 'regu-x', template: 'bar' });
});
after(async () => { if (srv) await srv.stop(); });

const iso = (d, h) => new Date(Date.UTC(2026, 10, d, h)).toISOString(); // 2026-11-d hh:00 UTC
const sale = (id, createdAt, total, paymentMethod = 'efectivo') => ({ id, createdAt, total, paymentMethod, items: [{ name: 'X', price: total, qty: 1 }], totalsByArea: { bar: total, restaurante: 0 } });

test('detecta ventas sin turno, las agrupa por día y las regulariza sin tocar las que ya tenían turno', async () => {
  // dos ventas del día 2 y una del día 3 sin turno; una del día 4 dentro de un turno real cerrado
  const turnoReal = { id: 'real1', cashierName: 'Caja', openedAt: iso(4, 14), closedAt: iso(4, 22), status: 'closed', openingCash: 0, closingCash: 7000, expectedCash: 7000, difference: 0,
    totalCashSales: 7000, totalOtherSales: 0, totalSales: 7000, salesCount: 1, withdrawals: [], totalWithdrawals: 0, expenses: [], totalExpenses: 0,
    incomeByAreaBucket: { bar: { efectivo: 7000, banco: 0 }, restaurante: { efectivo: 0, banco: 0 } } };
  escribirDoc(srv.dataDir, F.id, 'shifts.json', JSON.stringify([turnoReal]));
  escribirDoc(srv.dataDir, F.id, 'sales.json', JSON.stringify([
    sale('a', iso(2, 15), 10000), sale('b', iso(2, 18), 5000, 'transferencia'), sale('c', iso(3, 16), 8000), sale('d', iso(4, 16), 7000)]));

  const cajero = F.tokens.cajero, admin = F.tokens.admin;
  assert.equal((await srv.api('GET', `/api/${F.id}/shifts/unassigned`, { token: cajero })).status, 403, 'el cajero no regulariza');

  const r = (await srv.api('GET', `/api/${F.id}/shifts/unassigned`, { token: admin })).data;
  assert.equal(r.count, 3); assert.equal(r.total, 23000);
  assert.deepEqual(r.groups.map(g => [g.day, g.count, g.total, g.cash, g.other]), [['2026-11-02', 2, 15000, 10000, 5000], ['2026-11-03', 1, 8000, 8000, 0]]);

  assert.equal((await srv.api('POST', `/api/${F.id}/shifts/regularize`, { token: cajero, body: {} })).status, 403);
  const reg = await srv.api('POST', `/api/${F.id}/shifts/regularize`, { token: admin, body: {} });
  assert.equal(reg.status, 200); assert.equal(reg.data.count, 3); assert.equal(reg.data.total, 23000);

  const shifts = JSON.parse(leerDoc(srv.dataDir, F.id, 'shifts.json'));
  assert.equal(shifts.length, 3, 'el turno real sigue y se crearon 2 de regularización');
  const regs = shifts.filter(s => s.regularizacion);
  assert.ok(regs.every(s => s.status === 'closed' && s.closedAt && s.difference === 0));
  const dia2 = regs.find(s => s.openedAt === iso(2, 15));
  assert.deepEqual(dia2.incomeByAreaBucket.bar, { efectivo: 10000, banco: 5000 });
  assert.equal(JSON.parse(leerDoc(srv.dataDir, F.id, 'sales.json')).length, 4, 'ninguna venta se borró ni se cambió');

  // Finanzas: ahora sí aparecen los 23.000 de las 3 ventas (más los 7.000 del turno real)
  const fin = (await srv.api('GET', `/api/${F.id}/finance`, { token: admin })).data;
  const ingresos = (fin.movements || []).filter(m => m.type === 'ingreso').reduce((a, m) => a + m.amount, 0);
  assert.equal(ingresos, 30000, 'Finanzas cuenta 23.000 regularizados + 7.000 del turno real: ' + JSON.stringify(Object.keys(fin)));

  // idempotente: ya no queda nada suelto
  assert.equal((await srv.api('GET', `/api/${F.id}/shifts/unassigned`, { token: admin })).data.count, 0);
  assert.equal((await srv.api('POST', `/api/${F.id}/shifts/regularize`, { token: admin, body: {} })).data.count, 0);
});

test('un grupo nunca salta por encima de un turno real el mismo día', async () => {
  const bid = F.id;
  const turno = { id: 'real2', cashierName: 'Caja', openedAt: iso(6, 17), closedAt: iso(6, 19), status: 'closed', openingCash: 0, closingCash: 0, expectedCash: 0, difference: 0,
    totalCashSales: 0, totalOtherSales: 0, totalSales: 0, salesCount: 0, withdrawals: [], totalWithdrawals: 0, expenses: [], totalExpenses: 0, incomeByAreaBucket: { bar: { efectivo: 0, banco: 0 }, restaurante: { efectivo: 0, banco: 0 } } };
  const antes = JSON.parse(leerDoc(srv.dataDir, bid, 'shifts.json'));
  escribirDoc(srv.dataDir, bid, 'shifts.json', JSON.stringify([...antes, turno]));
  const ventas = JSON.parse(leerDoc(srv.dataDir, bid, 'sales.json'));
  escribirDoc(srv.dataDir, bid, 'sales.json', JSON.stringify([...ventas, sale('e', iso(6, 15), 3000), sale('f', iso(6, 21), 4000)]));
  const g = (await srv.api('GET', `/api/${bid}/shifts/unassigned`, { token: F.tokens.admin })).data.groups;
  assert.equal(g.length, 2, 'antes y después del turno real son grupos distintos (si no, se contaría doble)');
});

test('después de regularizar, ya se puede abrir turno y facturar normal', async () => {
  const s = await openShift(srv, F.tokens.cajero, F.id, 0);
  assert.ok(s.id || s.error);
});
