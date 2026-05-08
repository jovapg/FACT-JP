/**
 * routes/sales.js — Creación y consulta de ventas (facturas)
 *
 * Una venta es el evento de cobrar el pedido de una mesa.
 * Al crear una venta:
 *   1. Se genera un número de factura secuencial (FAC-0001-2026)
 *   2. Se guarda la venta con subtotal, descuento y total final
 *   3. Se incrementa el contador de facturas del perfil del negocio
 *   4. Se descuentan los ingredientes del inventario (deductFromSale)
 *   5. Se libera la mesa (se borra su pedido)
 *
 * Las ventas soportan filtros por fecha para los reportes.
 *
 * Rutas:
 *   GET  /api/:businessId/sales        → listar ventas con filtros opcionales
 *   POST /api/:businessId/sales        → crear nueva venta (facturar)
 *   GET  /api/:businessId/sales/:id    → obtener una venta por ID
 */

const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams: true necesario para :businessId
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, getBusinessPath } = require('../services/fileStorage');
const { authenticate } = require('../middleware/auth');
const { deductFromSale } = require('../services/inventoryService');

const salesPath   = (id) => path.join(getBusinessPath(id), 'sales.json');
const tablesPath  = (id) => path.join(getBusinessPath(id), 'tables.json');
const profilePath = (id) => path.join(getBusinessPath(id), 'profile.json');
const shiftsPath  = (id) => path.join(getBusinessPath(id), 'shifts.json');

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

    await writeJSON(shiftsPath(businessId), shifts);
  } catch (err) {
    console.error('[shifts] Error actualizando turno activo:', err);
  }
}

/**
 * Genera el número de factura usando el prefijo del negocio y el contador actual.
 * Formato: FAC-0001-2026 (prefijo-contador-año)
 * El contador se incrementa DESPUÉS de guardar la venta para evitar facturas
 * con número duplicado si hay un error al guardar.
 */
function generateInvoiceNumber(profile) {
  const prefix = profile.invoicePrefix || 'FAC';
  const counter = String((profile.invoiceCounter || 0) + 1).padStart(4, '0');
  const year = new Date().getFullYear();
  return `${prefix}-${counter}-${year}`;
}

/**
 * GET /sales — Lista ventas con filtros opcionales de fecha.
 * Query params:
 *   ?date=2026-03-31        → ventas de un día específico
 *   ?from=2026-03-01&to=2026-03-31  → rango de fechas
 *   ?period=day|week|month  → período relativo al día actual
 */
router.get('/sales', authenticate, async (req, res) => {
  try {
    let sales = await readJSON(salesPath(req.params.businessId)) || [];

    const { from, to, date, period } = req.query;

    if (date) {
      // Filtro por día exacto: desde las 00:00 hasta las 23:59 del día indicado
      const day = new Date(date);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      sales = sales.filter(s => {
        const sd = new Date(s.createdAt);
        return sd >= day && sd < nextDay;
      });
    } else if (from || to) {
      // Filtro por rango de fechas personalizado
      if (from) {
        const fromDate = new Date(from);
        sales = sales.filter(s => new Date(s.createdAt) >= fromDate);
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setDate(toDate.getDate() + 1); // Incluye todo el día 'to'
        sales = sales.filter(s => new Date(s.createdAt) < toDate);
      }
    } else if (period) {
      // Filtro por período relativo
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

    res.json(sales);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /sales — Crea una nueva venta (factura).
 *
 * Body esperado:
 *   { tableId, tableNumber, items, paymentMethod, cashier, notes, client, discount, total }
 *
 * El `total` puede venir del frontend (ya con descuento aplicado) o se calcula aquí.
 * El contador de facturas se incrementa DESPUÉS de guardar para evitar duplicados.
 * Retorna { sale, inventoryAlerts } — las alertas son ítems que quedaron con stock bajo.
 */
router.post('/sales', authenticate, async (req, res) => {
  try {
    const { tableId, tableNumber, items, paymentMethod, cashier, notes, client, discount, total } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items in sale' });
    }

    const profile = await readJSON(profilePath(req.params.businessId)) || {};
    const invoiceNumber = generateInvoiceNumber(profile);

    // Calcular subtotal sumando precio × cantidad de cada ítem
    const subtotal = items.reduce((sum, item) => sum + ((item.qty || item.quantity || 1) * (item.price || 0)), 0);
    const appliedDiscount = Number(discount) || 0;
    // Si el frontend envía el total ya calculado, se usa ese; si no, se calcula aquí
    const finalTotal = total !== undefined ? Number(total) : Math.max(0, subtotal - appliedDiscount);

    const sale = {
      id: uuidv4(),
      invoiceNumber,
      tableId: tableId || null,
      tableNumber: tableNumber || null,
      items,
      subtotal,
      discount: appliedDiscount,
      total: finalTotal,
      paymentMethod: paymentMethod || 'efectivo',
      cashier: cashier || req.user.name || req.user.username,
      client: client || '',
      notes: notes || '',
      createdAt: new Date().toISOString()
    };

    // Guardar la venta primero
    const sales = await readJSON(salesPath(req.params.businessId)) || [];
    sales.push(sale);
    await writeJSON(salesPath(req.params.businessId), sales);

    // Incrementar contador de facturas DESPUÉS de guardar exitosamente
    // (evita que un error deje el contador adelantado sin venta guardada)
    profile.invoiceCounter = (profile.invoiceCounter || 0) + 1;
    await writeJSON(profilePath(req.params.businessId), profile);

    // Registrar la venta en el turno activo (si hay uno abierto)
    await updateActiveShift(req.params.businessId, sale);

    // Descontar ingredientes del inventario y obtener alertas de stock bajo
    let inventoryAlerts = [];
    try {
      const result = await deductFromSale(req.params.businessId, items);
      inventoryAlerts = result.alerts || [];
    } catch (invErr) {
      console.error('Inventory deduction error:', invErr);
      // El error de inventario NO debe cancelar la venta ya guardada
    }

    // Liberar la mesa automáticamente después de facturar
    if (tableId) {
      const tables = await readJSON(tablesPath(req.params.businessId)) || [];
      const idx = tables.findIndex(t => t.id === tableId);
      if (idx !== -1) {
        tables[idx].status = 'libre';
        tables[idx].order = null;
        await writeJSON(tablesPath(req.params.businessId), tables);
      }
    }

    res.status(201).json({ sale, inventoryAlerts });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /sales/:id — Obtiene una venta específica por ID */
router.get('/sales/:id', authenticate, async (req, res) => {
  try {
    const sales = await readJSON(salesPath(req.params.businessId)) || [];
    const sale = sales.find(s => s.id === req.params.id);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    res.json(sale);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
