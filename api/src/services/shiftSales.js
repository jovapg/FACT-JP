/**
 * services/shiftSales.js — Cómo una venta afecta los totales del turno de caja
 *
 * Lo comparten las ventas normales (routes/sales.js) y los abonos de deuda
 * (routes/debtors.js): cada abono genera una venta, así que entra al turno y a
 * Finanzas por el mismo camino que cualquier otra venta.
 */

const path = require('path');
const { readJSON, writeJSON, getBusinessPath } = require('./fileStorage');

const shiftsPath = (id) => path.join(getBusinessPath(id), 'shifts.json');

/** Clasifica una forma de pago en su bucket: 💵 efectivo o 🏦 banco */
function bucketOf(method) {
  const m = (method || '').toLowerCase();
  return (m === 'transferencia' || m === 'tarjeta' || m === 'banco') ? 'banco' : 'efectivo';
}

/**
 * Ajusta los totales del turno al que pertenece una venta cuando ésta se edita
 * (cambió el total y/o el método de pago). Revierte la contribución vieja y aplica
 * la nueva, en el turno cuyo rango de fechas contiene la venta (abierto o cerrado).
 * Si el turno está cerrado, recalcula también el desglose de Finanzas y el cuadre.
 */
async function adjustShiftForSaleEdit(businessId, oldSale, newSale) {
  try {
    const shifts = await readJSON(shiftsPath(businessId)) || [];
    const t = new Date(oldSale.createdAt).getTime();
    const idx = shifts.findIndex(s => {
      const from = new Date(s.openedAt).getTime();
      const to = s.closedAt ? new Date(s.closedAt).getTime() : Infinity;
      return !isNaN(from) && t >= from && t <= to;
    });
    if (idx === -1) return; // la venta no pertenece a ningún turno
    const sh = shifts[idx];
    const isEf = (m) => (m || '').toLowerCase() === 'efectivo';
    const oA = oldSale.totalsByArea || { bar: oldSale.total || 0, restaurante: 0 };
    const nA = newSale.totalsByArea || { bar: newSale.total || 0, restaurante: 0 };

    sh.totalSales      = (sh.totalSales || 0) - (oldSale.total || 0) + (newSale.total || 0);
    sh.totalCashSales  = (sh.totalCashSales || 0) - (isEf(oldSale.paymentMethod) ? oldSale.total : 0) + (isEf(newSale.paymentMethod) ? newSale.total : 0);
    sh.totalOtherSales = (sh.totalOtherSales || 0) - (!isEf(oldSale.paymentMethod) ? oldSale.total : 0) + (!isEf(newSale.paymentMethod) ? newSale.total : 0);
    const prev = sh.salesByArea || { bar: 0, restaurante: 0 };
    sh.salesByArea = {
      bar: (prev.bar || 0) - (oA.bar || 0) + (nA.bar || 0),
      restaurante: (prev.restaurante || 0) - (oA.restaurante || 0) + (nA.restaurante || 0)
    };

    // Turno cerrado: ajustar el desglose de Finanzas (área × efectivo/banco) y el cuadre
    if (sh.status === 'closed' && sh.incomeByAreaBucket) {
      const bO = bucketOf(oldSale.paymentMethod), bN = bucketOf(newSale.paymentMethod);
      const ib = sh.incomeByAreaBucket;
      ib.bar[bO] = (ib.bar[bO] || 0) - (oA.bar || 0);
      ib.restaurante[bO] = (ib.restaurante[bO] || 0) - (oA.restaurante || 0);
      ib.bar[bN] = (ib.bar[bN] || 0) + (nA.bar || 0);
      ib.restaurante[bN] = (ib.restaurante[bN] || 0) + (nA.restaurante || 0);
    }
    if (sh.status === 'closed') {
      sh.expectedCash = (sh.openingCash || 0) + (sh.totalCashSales || 0) - (sh.totalWithdrawals || 0) - (sh.totalExpenses || 0);
      sh.difference = (sh.closingCash || 0) - sh.expectedCash;
    }

    await writeJSON(shiftsPath(businessId), shifts);
  } catch (err) {
    console.error('[sales] Error ajustando turno al editar venta:', err);
  }
}

/**
 * Acumula los totales de la venta en el turno activo (si existe uno abierto).
 * Se llama después de guardar la venta exitosamente.
 * Errores aquí NO cancelan la venta — el turno es informativo, no bloqueante.
 *
 * @param {string} businessId
 * @param {Object} sale - La venta recién creada
 */
async function updateActiveShift(businessId, sale) {
  try {
    const shifts = await readJSON(shiftsPath(businessId)) || [];
    const idx = shifts.findIndex(s => s.status === 'open');
    if (idx === -1) return; // Sin turno abierto, nada que actualizar

    const isEfectivo = (sale.paymentMethod || '').toLowerCase() === 'efectivo';
    shifts[idx].salesCount     = (shifts[idx].salesCount || 0) + 1;
    shifts[idx].totalSales     = (shifts[idx].totalSales || 0) + sale.total;
    shifts[idx].totalCashSales = (shifts[idx].totalCashSales || 0) + (isEfectivo ? sale.total : 0);
    shifts[idx].totalOtherSales= (shifts[idx].totalOtherSales || 0) + (isEfectivo ? 0 : sale.total);

    // Acumular ventas por bolsillo (Bar / Restaurante) en el turno activo
    const tba = sale.totalsByArea || { bar: 0, restaurante: 0 };
    const prev = shifts[idx].salesByArea || { bar: 0, restaurante: 0 };
    shifts[idx].salesByArea = {
      bar: (prev.bar || 0) + (tba.bar || 0),
      restaurante: (prev.restaurante || 0) + (tba.restaurante || 0)
    };

    await writeJSON(shiftsPath(businessId), shifts);
  } catch (err) {
    console.error('[shifts] Error actualizando turno activo:', err);
  }
}

/**
 * Quita una venta del turno al que pertenece (cuando se elimina, por ejemplo al
 * borrar un abono). Revierte los totales y descuenta 1 del contador de ventas.
 */
async function removeSaleFromShift(businessId, sale) {
  const zeroed = { ...sale, total: 0, totalsByArea: { bar: 0, restaurante: 0 } };
  await adjustShiftForSaleEdit(businessId, sale, zeroed);
  try {
    const shifts = await readJSON(shiftsPath(businessId)) || [];
    const t = new Date(sale.createdAt).getTime();
    const idx = shifts.findIndex(s => {
      const from = new Date(s.openedAt).getTime();
      const to = s.closedAt ? new Date(s.closedAt).getTime() : Infinity;
      return !isNaN(from) && t >= from && t <= to;
    });
    if (idx === -1) return;
    shifts[idx].salesCount = Math.max(0, (shifts[idx].salesCount || 0) - 1);
    await writeJSON(shiftsPath(businessId), shifts);
  } catch (err) {
    console.error('[shiftSales] Error descontando la venta del turno:', err);
  }
}

module.exports = { bucketOf, adjustShiftForSaleEdit, updateActiveShift, removeSaleFromShift };
