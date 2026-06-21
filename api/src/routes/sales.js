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
 *   PUT  /api/:businessId/sales/:id    → editar factura, ajusta stock (no cajero)
 *   GET  /api/:businessId/sales/:id    → obtener una venta por ID
 */

const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams: true necesario para :businessId
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, getBusinessPath } = require('../services/fileStorage');
const { authenticate } = require('../middleware/auth');
const { deductFromSale, restoreFromSale, findOutOfStockItems } = require('../services/inventoryService');
const { logAudit, cop } = require('../services/audit');

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

    // Bloquear la venta si algún producto está agotado (stock en cero)
    const outOfStock = await findOutOfStockItems(req.params.businessId, items);
    if (outOfStock.length > 0) {
      return res.status(400).json({
        error: `Producto agotado, stock en ceros: ${outOfStock.join(', ')}. No se puede facturar.`
      });
    }

    const profile = await readJSON(profilePath(req.params.businessId)) || {};
    const invoiceNumber = generateInvoiceNumber(profile);

    // Normalizar cada ítem: cantidad, descuento por producto y bolsillo (área).
    // El descuento ahora es POR PRODUCTO (botón "agregar descuento" bajo cada ítem).
    const normItems = items.map(item => {
      const qty = item.qty || item.quantity || 1;
      const price = Number(item.price) || 0;
      const itemDiscount = Math.max(0, Number(item.discount) || 0);
      const area = item.area === 'restaurante' ? 'restaurante' : 'bar';
      return { ...item, qty, price, discount: itemDiscount, area };
    });

    // Subtotal = suma de precio × cantidad (sin descuentos)
    const subtotal = normItems.reduce((sum, i) => sum + (i.qty * i.price), 0);
    // Descuento total = suma de los descuentos de cada producto
    const itemDiscountSum = normItems.reduce((sum, i) => sum + i.discount, 0);
    // Compatibilidad: si no hay descuentos por ítem pero llega un descuento global, se usa ese
    const appliedDiscount = itemDiscountSum > 0 ? itemDiscountSum : (Number(discount) || 0);
    const finalTotal = total !== undefined ? Number(total) : Math.max(0, subtotal - appliedDiscount);

    // Separar el dinero por bolsillo (Bar / Restaurante).
    // El neto de cada producto = (precio × cantidad) − su descuento, sumado a su bolsillo.
    const totalsByArea = { bar: 0, restaurante: 0 };
    normItems.forEach(i => {
      const net = Math.max(0, (i.qty * i.price) - i.discount);
      totalsByArea[i.area] += net;
    });
    // Si el descuento vino global (legado), se reparte proporcional al peso de cada bolsillo
    if (itemDiscountSum === 0 && appliedDiscount > 0 && subtotal > 0) {
      const grossByArea = { bar: 0, restaurante: 0 };
      normItems.forEach(i => { grossByArea[i.area] += i.qty * i.price; });
      totalsByArea.bar = Math.max(0, grossByArea.bar - appliedDiscount * (grossByArea.bar / subtotal));
      totalsByArea.restaurante = Math.max(0, grossByArea.restaurante - appliedDiscount * (grossByArea.restaurante / subtotal));
    }
    totalsByArea.bar = Math.round(totalsByArea.bar);
    totalsByArea.restaurante = Math.round(totalsByArea.restaurante);

    const sale = {
      id: uuidv4(),
      invoiceNumber,
      tableId: tableId || null,
      tableNumber: tableNumber || null,
      items: normItems,
      subtotal,
      discount: appliedDiscount,
      total: finalTotal,
      totalsByArea,        // { bar, restaurante } — cuánto de esta factura es de cada bolsillo
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

/**
 * PUT /sales/:id — Edita una factura ya realizada (corrección del admin).
 *
 * Solo admin/superadmin. Permite cambiar items (cantidades, quitar/agregar),
 * método de pago y cliente, y recalcula subtotal/descuento/total/bolsillos.
 * Ajusta el inventario por la diferencia: devuelve el stock de los items
 * viejos y descuenta el de los nuevos.
 *
 * No se pueden editar facturas de tipo 'pago_fiado' (esas se corrigen desde
 * el panel de Deudas, porque su stock se descontó al registrar el fiado).
 *
 * Body: { items, paymentMethod?, client?, discount?, total? }
 * Respuesta: { sale, inventoryAlerts }
 */
router.put('/sales/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'cajero') return res.status(403).json({ error: 'Forbidden' });

    const sales = await readJSON(salesPath(req.params.businessId)) || [];
    const idx = sales.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Factura no encontrada' });

    const oldSale = sales[idx];
    if (oldSale.paymentMethod === 'pago_fiado') {
      return res.status(400).json({
        error: 'Esta factura proviene de un pago de fiado. Edítala desde el panel de Deudas.'
      });
    }

    const { items, paymentMethod, client, discount, total } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'La factura debe tener al menos un producto' });
    }

    // Normalizar items (misma lógica que al crear la venta)
    const normItems = items.map(item => {
      const qty = item.qty || item.quantity || 1;
      const price = Number(item.price) || 0;
      const itemDiscount = Math.max(0, Number(item.discount) || 0);
      const area = item.area === 'restaurante' ? 'restaurante' : 'bar';
      return { ...item, qty, price, discount: itemDiscount, area };
    });

    const subtotal = normItems.reduce((sum, i) => sum + (i.qty * i.price), 0);
    const itemDiscountSum = normItems.reduce((sum, i) => sum + i.discount, 0);
    const appliedDiscount = itemDiscountSum > 0 ? itemDiscountSum : (Number(discount) || 0);
    const finalTotal = total !== undefined ? Number(total) : Math.max(0, subtotal - appliedDiscount);

    const totalsByArea = { bar: 0, restaurante: 0 };
    normItems.forEach(i => {
      const net = Math.max(0, (i.qty * i.price) - i.discount);
      totalsByArea[i.area] += net;
    });
    if (itemDiscountSum === 0 && appliedDiscount > 0 && subtotal > 0) {
      const grossByArea = { bar: 0, restaurante: 0 };
      normItems.forEach(i => { grossByArea[i.area] += i.qty * i.price; });
      totalsByArea.bar = Math.max(0, grossByArea.bar - appliedDiscount * (grossByArea.bar / subtotal));
      totalsByArea.restaurante = Math.max(0, grossByArea.restaurante - appliedDiscount * (grossByArea.restaurante / subtotal));
    }
    totalsByArea.bar = Math.round(totalsByArea.bar);
    totalsByArea.restaurante = Math.round(totalsByArea.restaurante);

    // Ajustar inventario: devolver lo viejo, descontar lo nuevo
    let inventoryAlerts = [];
    try {
      if (Array.isArray(oldSale.items) && oldSale.items.length > 0) {
        await restoreFromSale(req.params.businessId, oldSale.items);
      }
      const result = await deductFromSale(req.params.businessId, normItems);
      inventoryAlerts = result.alerts || [];
    } catch (invErr) {
      console.error('Inventory adjust on invoice edit:', invErr);
    }

    // Actualizar la factura conservando id, número, fecha y cajero originales
    sales[idx] = {
      ...oldSale,
      items: normItems,
      subtotal,
      discount: appliedDiscount,
      total: finalTotal,
      totalsByArea,
      paymentMethod: paymentMethod || oldSale.paymentMethod,
      client: client !== undefined ? client : oldSale.client,
      editedAt: new Date().toISOString(),
      editedBy: req.user.name || req.user.username
    };

    await writeJSON(salesPath(req.params.businessId), sales);

    await logAudit(req.params.businessId, {
      user: req.user.name || req.user.username, role: req.user.role, action: 'edit_invoice',
      summary: `Editó la factura ${oldSale.invoiceNumber} (total ${cop(oldSale.total)} → ${cop(finalTotal)})`
    });

    res.json({ sale: sales[idx], inventoryAlerts });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Internal server error' });
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
