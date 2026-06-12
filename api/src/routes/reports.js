/**
 * routes/reports.js — Reportes de ventas y rentabilidad
 *
 * Provee los datos agregados para los módulos de análisis del negocio.
 * Las rutas de exportación Excel requieren el token como ?token= query param
 * (usando el middleware tokenFromQuery) para que el navegador pueda
 * iniciar la descarga directamente desde un enlace <a>.
 *
 * Rutas:
 *   GET /api/:businessId/reports/sales                → resumen de ventas (con filtros)
 *   GET /api/:businessId/reports/export/excel         → exportar ventas a Excel
 *   GET /api/:businessId/reports/rentabilidad         → cálculo de rentabilidad
 *   GET /api/:businessId/reports/rentabilidad/excel   → exportar rentabilidad a Excel
 *
 * El reporte de rentabilidad calcula:
 *   Ventas netas - (compras + nómina + arriendo + créditos) = GANANCIA NETA
 *
 * Los egresos por categoría se obtienen de los pagos a proveedores
 * filtrando por el campo `tipo` de cada proveedor.
 */

const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams: true necesario para :businessId
const path = require('path');
const { readJSON, getBusinessPath } = require('../services/fileStorage');
const { authenticate } = require('../middleware/auth');
const { generateSalesReport, generateRentabilidadReport } = require('../services/excelGenerator');

const salesPath = (id) => path.join(getBusinessPath(id), 'sales.json');
const purchasesPath = (id) => path.join(getBusinessPath(id), 'purchases.json');
const suppliersPath = (id) => path.join(getBusinessPath(id), 'suppliers.json');
const profilePath = (id) => path.join(getBusinessPath(id), 'profile.json');
const shiftsPath = (id) => path.join(getBusinessPath(id), 'shifts.json');

// GET /api/:businessId/reports/sales
router.get('/reports/sales', authenticate, async (req, res) => {
  try {
    let sales = await readJSON(salesPath(req.params.businessId)) || [];
    const { period, date, from, to } = req.query;

    if (date) {
      const day = new Date(date);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      sales = sales.filter(s => {
        const sd = new Date(s.createdAt);
        return sd >= day && sd < nextDay;
      });
    } else if (from || to) {
      if (from) sales = sales.filter(s => new Date(s.createdAt) >= new Date(from));
      if (to) {
        const toDate = new Date(to);
        toDate.setDate(toDate.getDate() + 1);
        sales = sales.filter(s => new Date(s.createdAt) < toDate);
      }
    } else if (period) {
      const now = new Date();
      if (period === 'day') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        sales = sales.filter(s => new Date(s.createdAt) >= today);
      } else if (period === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        sales = sales.filter(s => new Date(s.createdAt) >= weekAgo);
      } else if (period === 'month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        sales = sales.filter(s => new Date(s.createdAt) >= monthStart);
      }
    }

    const totalRevenue = sales.reduce((sum, s) => sum + (s.total || 0), 0);

    // Group by payment method
    const byPayment = {};
    sales.forEach(s => {
      const m = s.paymentMethod || 'otro';
      byPayment[m] = (byPayment[m] || 0) + (s.total || 0);
    });

    // Group by day
    const byDay = {};
    sales.forEach(s => {
      const day = s.createdAt.slice(0, 10);
      if (!byDay[day]) byDay[day] = { count: 0, total: 0 };
      byDay[day].count++;
      byDay[day].total += s.total || 0;
    });

    // Top products
    const products = {};
    sales.forEach(s => {
      (s.items || []).forEach(item => {
        const name = item.name || item.recipeName || 'Sin nombre';
        if (!products[name]) products[name] = { qty: 0, total: 0 };
        products[name].qty += item.qty || item.quantity || 1;
        products[name].total += (item.qty || item.quantity || 1) * (item.price || 0);
      });
    });

    const topProducts = Object.entries(products)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    res.json({
      sales,
      summary: {
        count: sales.length,
        totalRevenue,
        byPayment,
        byDay,
        topProducts
      }
    });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

function tokenFromQuery(req, res, next) {
  if (req.query.token && !req.headers['authorization']) {
    req.headers['authorization'] = `Bearer ${req.query.token}`;
  }
  next();
}

// GET /api/:businessId/reports/export/excel
router.get('/reports/export/excel', tokenFromQuery, authenticate, async (req, res) => {
  try {
    let sales = await readJSON(salesPath(req.params.businessId)) || [];
    const { from, to } = req.query;

    if (from) sales = sales.filter(s => new Date(s.createdAt) >= new Date(from));
    if (to) {
      const toDate = new Date(to);
      toDate.setDate(toDate.getDate() + 1);
      sales = sales.filter(s => new Date(s.createdAt) < toDate);
    }

    const business = await readJSON(profilePath(req.params.businessId)) || {};
    await generateSalesReport(sales, business, from, to, res);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/:businessId/reports/rentabilidad
router.get('/reports/rentabilidad', authenticate, async (req, res) => {
  try {
    const { period, from, to } = req.query;
    const now = new Date();

    function filterByRange(items, dateField) {
      let filtered = items;
      if (from) filtered = filtered.filter(i => new Date(i[dateField]) >= new Date(from));
      if (to) {
        const toDate = new Date(to);
        toDate.setDate(toDate.getDate() + 1);
        filtered = filtered.filter(i => new Date(i[dateField]) < toDate);
      }
      if (!from && !to && period) {
        if (period === 'day') {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          filtered = filtered.filter(i => new Date(i[dateField]) >= today);
        } else if (period === 'week') {
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          filtered = filtered.filter(i => new Date(i[dateField]) >= weekAgo);
        } else if (period === 'month') {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          filtered = filtered.filter(i => new Date(i[dateField]) >= monthStart);
        }
      }
      return filtered;
    }

    const allSales = await readJSON(salesPath(req.params.businessId)) || [];
    const allPurchases = await readJSON(purchasesPath(req.params.businessId)) || [];
    const suppliers = await readJSON(suppliersPath(req.params.businessId)) || [];
    const allShifts = await readJSON(shiftsPath(req.params.businessId)) || [];

    const sales = filterByRange(allSales, 'createdAt');
    const purchases = filterByRange(allPurchases, 'date');

    // Retiros de caja
    const allWithdrawals = allShifts.flatMap(s => s.withdrawals || []);
    const retirosTotal = filterByRange(allWithdrawals, 'date').reduce((s, w) => s + (w.amount || 0), 0);

    // Gastos de caja menor
    const allExpenses = allShifts.flatMap(s => s.expenses || []);
    const gastosTotal = filterByRange(allExpenses, 'date').reduce((s, e) => s + (e.amount || 0), 0);

    // Ingresos
    const ventasBruto = sales.reduce((s, x) => s + (x.total || 0), 0);
    const descuentos = sales.reduce((s, x) => s + (x.discount || 0), 0);
    const ventasNetas = ventasBruto - descuentos;

    // Egresos - purchases
    const compras = purchases.reduce((s, x) => s + (x.total || 0), 0);

    // Egresos - supplier payments filtered by date
    let nominaTotal = 0, arriendo = 0, creditos = 0;
    for (const sup of suppliers) {
      for (const p of (sup.payments || [])) {
        const pDate = new Date(p.date);
        let inRange = true;
        if (from && pDate < new Date(from)) inRange = false;
        if (to) {
          const toDate = new Date(to);
          toDate.setDate(toDate.getDate() + 1);
          if (pDate >= toDate) inRange = false;
        }
        if (!from && !to && period) {
          if (period === 'day') {
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (pDate < today) inRange = false;
          } else if (period === 'week') {
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            if (pDate < weekAgo) inRange = false;
          } else if (period === 'month') {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            if (pDate < monthStart) inRange = false;
          }
        }
        if (!inRange) continue;
        const tipo = sup.tipo || 'proveedor';
        if (tipo === 'empleado') nominaTotal += p.amount || 0;
        else if (tipo === 'arriendo') arriendo += p.amount || 0;
        else if (tipo === 'credito') creditos += p.amount || 0;
      }
    }

    const totalEgresos = compras + nominaTotal + arriendo + creditos + retirosTotal + gastosTotal;
    const gananciaNeta = ventasNetas - totalEgresos;

    res.json({
      ingresos: { ventasBruto, descuentos, ventasNetas },
      egresos: { compras, nomina: nominaTotal, arriendo, creditos, retiros: retirosTotal, gastos: gastosTotal, total: totalEgresos },
      gananciaNeta,
      salesCount: sales.length,
      purchasesCount: purchases.length
    });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/:businessId/reports/rentabilidad/excel
router.get('/reports/rentabilidad/excel', tokenFromQuery, authenticate, async (req, res) => {
  try {
    const { period, from, to } = req.query;
    const now = new Date();

    function filterByRange(items, dateField) {
      let filtered = items;
      if (from) filtered = filtered.filter(i => new Date(i[dateField]) >= new Date(from));
      if (to) {
        const toDate = new Date(to);
        toDate.setDate(toDate.getDate() + 1);
        filtered = filtered.filter(i => new Date(i[dateField]) < toDate);
      }
      if (!from && !to && period) {
        if (period === 'day') {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          filtered = filtered.filter(i => new Date(i[dateField]) >= today);
        } else if (period === 'week') {
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          filtered = filtered.filter(i => new Date(i[dateField]) >= weekAgo);
        } else if (period === 'month') {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          filtered = filtered.filter(i => new Date(i[dateField]) >= monthStart);
        }
      }
      return filtered;
    }

    const allSales = await readJSON(salesPath(req.params.businessId)) || [];
    const allPurchases = await readJSON(purchasesPath(req.params.businessId)) || [];
    const suppliers = await readJSON(suppliersPath(req.params.businessId)) || [];
    const allShifts = await readJSON(shiftsPath(req.params.businessId)) || [];
    const business = await readJSON(profilePath(req.params.businessId)) || {};

    const sales = filterByRange(allSales, 'createdAt');
    const purchases = filterByRange(allPurchases, 'date');

    // Retiros de caja
    const allWithdrawals = allShifts.flatMap(s => s.withdrawals || []);
    const retirosDetail = filterByRange(allWithdrawals, 'date');
    const retirosTotal = retirosDetail.reduce((s, w) => s + (w.amount || 0), 0);

    // Gastos de caja menor
    const allExpenses = allShifts.flatMap(s => s.expenses || []);
    const gastosDetail = filterByRange(allExpenses, 'date');
    const gastosTotal = gastosDetail.reduce((s, e) => s + (e.amount || 0), 0);

    const ventasBruto = sales.reduce((s, x) => s + (x.total || 0), 0);
    const descuentos = sales.reduce((s, x) => s + (x.discount || 0), 0);
    const ventasNetas = ventasBruto - descuentos;
    const compras = purchases.reduce((s, x) => s + (x.total || 0), 0);

    let nominaTotal = 0, arriendo = 0, creditos = 0;
    const nominaDetail = [], arriendoDetail = [], creditoDetail = [];

    for (const sup of suppliers) {
      for (const p of (sup.payments || [])) {
        const pDate = new Date(p.date);
        let inRange = true;
        if (from && pDate < new Date(from)) inRange = false;
        if (to) {
          const toDate = new Date(to);
          toDate.setDate(toDate.getDate() + 1);
          if (pDate >= toDate) inRange = false;
        }
        if (!from && !to && period) {
          if (period === 'day') {
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (pDate < today) inRange = false;
          } else if (period === 'week') {
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            if (pDate < weekAgo) inRange = false;
          } else if (period === 'month') {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            if (pDate < monthStart) inRange = false;
          }
        }
        if (!inRange) continue;
        const tipo = sup.tipo || 'proveedor';
        const detail = { supplier: sup.name, date: p.date, amount: p.amount, method: p.method, notes: p.notes };
        if (tipo === 'empleado') { nominaTotal += p.amount || 0; nominaDetail.push(detail); }
        else if (tipo === 'arriendo') { arriendo += p.amount || 0; arriendoDetail.push(detail); }
        else if (tipo === 'credito') { creditos += p.amount || 0; creditoDetail.push(detail); }
      }
    }

    const totalEgresos = compras + nominaTotal + arriendo + creditos + retirosTotal + gastosTotal;
    const gananciaNeta = ventasNetas - totalEgresos;

    const data = {
      ingresos: { ventasBruto, descuentos, ventasNetas },
      egresos: { compras, nomina: nominaTotal, arriendo, creditos, retiros: retirosTotal, gastos: gastosTotal, total: totalEgresos },
      gananciaNeta, sales, purchases, nominaDetail, arriendoDetail, creditoDetail, retirosDetail, gastosDetail
    };

    await generateRentabilidadReport(data, business, from, to, period, res);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/:businessId/reports/cierre — Estado del día por bolsillo (Bar / Restaurante)
 *
 * Separa el dinero de un período entre los dos bolsillos:
 *   - Ventas de cada bolsillo (desde sale.totalsByArea)
 *   - Compras/gastos de cada bolsillo (purchase.area)
 *   - Neto = ventas − compras, por bolsillo
 *
 * Query params: ?date=YYYY-MM-DD  |  ?from=&to=  |  ?period=day|week|month
 * Por defecto (sin params) usa el día de hoy.
 */
router.get('/reports/cierre', authenticate, async (req, res) => {
  try {
    const { date, from, to, period } = req.query;
    const now = new Date();

    // Rango por defecto: hoy
    let start, end;
    if (date) {
      start = new Date(date);
      end = new Date(date); end.setDate(end.getDate() + 1);
    } else if (from || to) {
      start = from ? new Date(from) : new Date(0);
      end = to ? new Date(to) : new Date(8640000000000000);
      if (to) end.setDate(end.getDate() + 1);
    } else if (period === 'week') {
      start = new Date(now); start.setDate(start.getDate() - 7); end = new Date(now);
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now);
    } else {
      // hoy
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(start); end.setDate(end.getDate() + 1);
    }

    const inRange = (d) => { const x = new Date(d); return x >= start && x < end; };

    // Calcula el split por bolsillo de una venta (con respaldo para ventas viejas sin totalsByArea)
    const saleAreaTotals = (sale) => {
      if (sale.totalsByArea) return sale.totalsByArea;
      const t = { bar: 0, restaurante: 0 };
      (sale.items || []).forEach(i => {
        const qty = i.qty || i.quantity || 1;
        const price = i.price || 0;
        const disc = i.discount || 0;
        const area = i.area === 'restaurante' ? 'restaurante' : 'bar';
        t[area] += Math.max(0, qty * price - disc);
      });
      return t;
    };

    const allSales = await readJSON(salesPath(req.params.businessId)) || [];
    const allPurchases = await readJSON(purchasesPath(req.params.businessId)) || [];

    const sales = allSales.filter(s => inRange(s.createdAt));
    const purchases = allPurchases.filter(p => inRange(p.date));

    const ventas = { bar: 0, restaurante: 0 };
    sales.forEach(s => {
      const t = saleAreaTotals(s);
      ventas.bar += t.bar || 0;
      ventas.restaurante += t.restaurante || 0;
    });

    const compras = { bar: 0, restaurante: 0 };
    purchases.forEach(p => {
      const area = p.area === 'restaurante' ? 'restaurante' : 'bar';
      compras[area] += p.total || 0;
    });

    const bolsillo = (k) => ({
      ventas: Math.round(ventas[k]),
      compras: Math.round(compras[k]),
      neto: Math.round(ventas[k] - compras[k])
    });

    res.json({
      rango: { desde: start.toISOString(), hasta: end.toISOString() },
      bar: bolsillo('bar'),
      restaurante: bolsillo('restaurante'),
      total: {
        ventas: Math.round(ventas.bar + ventas.restaurante),
        compras: Math.round(compras.bar + compras.restaurante),
        neto: Math.round((ventas.bar + ventas.restaurante) - (compras.bar + compras.restaurante))
      },
      salesCount: sales.length,
      purchasesCount: purchases.length
    });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
