/**
 * services/excelGenerator.js — Generación de reportes Excel (ExcelJS)
 *
 * Genera archivos .xlsx para descargar desde el módulo de reportes.
 * Los archivos se envían como stream directamente al response de Express.
 *
 * Funciones exportadas:
 *
 *   generateSalesReport(sales, business, fromDate, toDate, res)
 *     Genera un Excel con 3 hojas:
 *       - "Reporte de Ventas": tabla con todas las ventas del período
 *       - "Resumen": agrupado por método de pago con porcentajes
 *       - "Productos Vendidos": ranking de productos por total vendido
 *
 *   generateRentabilidadReport(data, business, fromDate, toDate, period, res)
 *     Genera un Excel con hasta 5 hojas:
 *       - "Rentabilidad": resumen ejecutivo (ingresos, egresos, ganancia neta)
 *       - "Ventas": detalle de todas las ventas con descuentos
 *       - "Compras": detalle de compras a proveedores
 *       - "Nómina": pagos a empleados (proveedores tipo=empleado)
 *       - "Arriendo y Créditos": otros egresos clasificados
 */

const ExcelJS = require('exceljs');

/** Formatea número como moneda COP para usar en celdas de texto (no numérico) */
function formatCOP(amount) {
  return Number(amount).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
}

async function generateSalesReport(sales, business, fromDate, toDate, res) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'facJp';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Reporte de Ventas');

  // Title
  sheet.mergeCells('A1:G1');
  sheet.getCell('A1').value = `Reporte de Ventas - ${business.name || 'facJp'}`;
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  sheet.mergeCells('A2:G2');
  const dateRange = fromDate && toDate
    ? `Período: ${fromDate} al ${toDate}`
    : `Generado: ${new Date().toLocaleDateString('es-CO')}`;
  sheet.getCell('A2').value = dateRange;
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  // NIT info
  if (business.nit) {
    sheet.mergeCells('A3:G3');
    sheet.getCell('A3').value = `NIT: ${business.nit} | ${business.address || ''} | ${business.city || ''}`;
    sheet.getCell('A3').alignment = { horizontal: 'center' };
  }

  sheet.addRow([]);

  // Headers
  const headerRow = sheet.addRow(['#', 'Factura', 'Fecha', 'Mesa', 'Cajero', 'Método de Pago', 'Total']);
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
    cell.alignment = { horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Column widths
  sheet.columns = [
    { key: 'num', width: 5 },
    { key: 'invoice', width: 18 },
    { key: 'date', width: 20 },
    { key: 'table', width: 10 },
    { key: 'cashier', width: 15 },
    { key: 'payment', width: 18 },
    { key: 'total', width: 15 }
  ];

  let totalAmount = 0;
  sales.forEach((sale, idx) => {
    const row = sheet.addRow([
      idx + 1,
      sale.invoiceNumber || '',
      new Date(sale.createdAt).toLocaleString('es-CO'),
      sale.tableNumber || '',
      sale.cashier || '',
      sale.paymentMethod || '',
      sale.total || 0
    ]);

    row.getCell(7).numFmt = '"$"#,##0';
    if (idx % 2 === 0) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      });
    }
    row.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } }
      };
    });
    totalAmount += sale.total || 0;
  });

  // Total row
  sheet.addRow([]);
  const totalRow = sheet.addRow(['', '', '', '', '', 'TOTAL VENTAS:', totalAmount]);
  totalRow.getCell(6).font = { bold: true };
  totalRow.getCell(7).font = { bold: true };
  totalRow.getCell(7).numFmt = '"$"#,##0';

  // Summary sheet
  const summarySheet = workbook.addWorksheet('Resumen');

  summarySheet.mergeCells('A1:D1');
  summarySheet.getCell('A1').value = 'Resumen por Método de Pago';
  summarySheet.getCell('A1').font = { bold: true, size: 12 };

  const paymentSummary = {};
  sales.forEach(sale => {
    const method = sale.paymentMethod || 'otro';
    if (!paymentSummary[method]) paymentSummary[method] = { count: 0, total: 0 };
    paymentSummary[method].count++;
    paymentSummary[method].total += sale.total || 0;
  });

  summarySheet.addRow([]);
  const sumHeader = summarySheet.addRow(['Método', 'Cantidad', 'Total', '% del Total']);
  sumHeader.eachCell(cell => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3498DB' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });

  Object.entries(paymentSummary).forEach(([method, data]) => {
    const pct = totalAmount > 0 ? ((data.total / totalAmount) * 100).toFixed(1) : 0;
    summarySheet.addRow([method, data.count, data.total, `${pct}%`]);
  });

  summarySheet.addRow([]);
  summarySheet.addRow(['TOTAL', sales.length, totalAmount, '100%']);

  summarySheet.columns = [
    { width: 20 }, { width: 12 }, { width: 15 }, { width: 12 }
  ];

  // Product summary sheet
  const productSheet = workbook.addWorksheet('Productos Vendidos');
  productSheet.mergeCells('A1:C1');
  productSheet.getCell('A1').value = 'Resumen por Producto';
  productSheet.getCell('A1').font = { bold: true, size: 12 };

  const productSummary = {};
  sales.forEach(sale => {
    (sale.items || []).forEach(item => {
      const name = item.name || item.recipeName || 'Sin nombre';
      if (!productSummary[name]) productSummary[name] = { qty: 0, total: 0 };
      productSummary[name].qty += item.qty || item.quantity || 1;
      productSummary[name].total += (item.qty || item.quantity || 1) * (item.price || 0);
    });
  });

  productSheet.addRow([]);
  const prodHeader = productSheet.addRow(['Producto', 'Cantidad Vendida', 'Total']);
  prodHeader.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27AE60' } };
  });

  Object.entries(productSummary)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([name, data]) => {
      productSheet.addRow([name, data.qty, data.total]);
    });

  productSheet.columns = [{ width: 30 }, { width: 18 }, { width: 15 }];

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="reporte-ventas-${Date.now()}.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
}

async function generateRentabilidadReport(data, business, fromDate, toDate, period, res) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'facJp';
  workbook.created = new Date();

  const periodLabel = fromDate && toDate
    ? `${fromDate} al ${toDate}`
    : period === 'day' ? 'Hoy'
    : period === 'week' ? 'Esta semana'
    : period === 'month' ? 'Este mes'
    : new Date().toLocaleDateString('es-CO');

  // ── Sheet 1: Resumen Rentabilidad ──────────────────────
  const sheet = workbook.addWorksheet('Rentabilidad');
  sheet.columns = [{ width: 32 }, { width: 20 }, { width: 20 }];

  function addTitle(text, color) {
    const row = sheet.addRow([text]);
    row.getCell(1).font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    sheet.mergeCells(`A${row.number}:C${row.number}`);
    row.getCell(1).alignment = { horizontal: 'center' };
  }

  function addRow(label, value, bold, color) {
    const row = sheet.addRow([label, '', value]);
    if (bold) { row.getCell(1).font = { bold: true }; row.getCell(3).font = { bold: true }; }
    if (color) {
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      sheet.mergeCells(`A${row.number}:B${row.number}`);
    } else {
      sheet.mergeCells(`A${row.number}:B${row.number}`);
    }
    row.getCell(3).numFmt = '"$"#,##0';
    return row;
  }

  // Header
  sheet.mergeCells('A1:C1');
  sheet.getCell('A1').value = `Reporte de Rentabilidad - ${business.name || 'facJp'}`;
  sheet.getCell('A1').font = { bold: true, size: 15 };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  sheet.mergeCells('A2:C2');
  sheet.getCell('A2').value = `Período: ${periodLabel}`;
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  sheet.addRow([]);

  // INGRESOS
  addTitle('INGRESOS', 'FF27AE60');
  addRow('Ventas brutas', data.ingresos.ventasBruto, false);
  if (data.ingresos.descuentos > 0) addRow('(-) Descuentos aplicados', data.ingresos.descuentos, false);
  addRow('Ventas netas', data.ingresos.ventasNetas, true, 'FFD5F5E3');

  sheet.addRow([]);

  // EGRESOS
  addTitle('EGRESOS', 'FFE74C3C');
  addRow('Compras a proveedores', data.egresos.compras, false);
  addRow('Nómina empleados', data.egresos.nomina, false);
  addRow('Arriendo', data.egresos.arriendo, false);
  addRow('Créditos', data.egresos.creditos, false);
  if (data.egresos.retiros > 0) addRow('Retiros de caja', data.egresos.retiros, false);
  if (data.egresos.gastos > 0) addRow('Gastos de caja menor', data.egresos.gastos, false);
  addRow('Total egresos', data.egresos.total, true, 'FFFDE8E8');

  sheet.addRow([]);

  // GANANCIA
  const gananciaColor = data.gananciaNeta >= 0 ? 'FF27AE60' : 'FFE74C3C';
  const gananciaRow = sheet.addRow(['GANANCIA NETA', '', data.gananciaNeta]);
  gananciaRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  gananciaRow.getCell(3).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  gananciaRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: gananciaColor } };
  });
  sheet.mergeCells(`A${gananciaRow.number}:B${gananciaRow.number}`);
  gananciaRow.getCell(3).numFmt = '"$"#,##0';

  // ── Sheet 2: Detalle Ventas ────────────────────────────
  const salesSheet = workbook.addWorksheet('Ventas');
  salesSheet.columns = [{ width: 5 }, { width: 18 }, { width: 20 }, { width: 10 }, { width: 15 }, { width: 18 }, { width: 15 }, { width: 12 }];

  const sh = salesSheet.addRow(['#', 'Factura', 'Fecha', 'Mesa', 'Cajero', 'Método', 'Descuento', 'Total']);
  sh.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
  });

  data.sales.forEach((s, i) => {
    const row = salesSheet.addRow([
      i + 1, s.invoiceNumber || '', new Date(s.createdAt).toLocaleString('es-CO'),
      s.tableNumber || '', s.cashier || '', s.paymentMethod || '', s.discount || 0, s.total || 0
    ]);
    row.getCell(7).numFmt = '"$"#,##0';
    row.getCell(8).numFmt = '"$"#,##0';
  });

  const stRow = salesSheet.addRow(['', '', '', '', '', '', 'TOTAL:', data.sales.reduce((s, x) => s + (x.total || 0), 0)]);
  stRow.getCell(7).font = { bold: true };
  stRow.getCell(8).font = { bold: true };
  stRow.getCell(8).numFmt = '"$"#,##0';

  // ── Sheet 3: Detalle Compras ───────────────────────────
  const purchSheet = workbook.addWorksheet('Compras');
  purchSheet.columns = [{ width: 5 }, { width: 20 }, { width: 20 }, { width: 30 }, { width: 15 }];

  const ph = purchSheet.addRow(['#', 'Fecha', 'Proveedor', 'Notas', 'Total']);
  ph.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE67E22' } };
  });

  data.purchases.forEach((p, i) => {
    const row = purchSheet.addRow([i + 1, new Date(p.date).toLocaleString('es-CO'), p.supplierId || '', p.notes || '', p.total || 0]);
    row.getCell(5).numFmt = '"$"#,##0';
  });

  // ── Sheet 4: Nómina ───────────────────────────────────
  if (data.nominaDetail.length > 0) {
    const nomSheet = workbook.addWorksheet('Nómina');
    nomSheet.columns = [{ width: 5 }, { width: 25 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 25 }];
    const nh = nomSheet.addRow(['#', 'Empleado', 'Fecha', 'Monto', 'Método', 'Notas']);
    nh.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8E44AD' } };
    });
    data.nominaDetail.forEach((p, i) => {
      const row = nomSheet.addRow([i + 1, p.supplier, new Date(p.date).toLocaleString('es-CO'), p.amount || 0, p.method || '', p.notes || '']);
      row.getCell(4).numFmt = '"$"#,##0';
    });
  }

  // ── Sheet 5: Retiros de Caja ──────────────────────────
  if (data.retirosDetail && data.retirosDetail.length > 0) {
    const retSheet = workbook.addWorksheet('Retiros de Caja');
    retSheet.columns = [{ width: 5 }, { width: 20 }, { width: 30 }, { width: 20 }];
    const rh = retSheet.addRow(['#', 'Fecha', 'Motivo', 'Monto']);
    rh.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A0A00' } };
    });
    data.retirosDetail.forEach((w, i) => {
      const row = retSheet.addRow([i + 1, new Date(w.date).toLocaleString('es-CO'), w.reason || 'Retiro de caja', w.amount || 0]);
      row.getCell(4).numFmt = '"$"#,##0';
    });
    const rtTotal = retSheet.addRow(['', '', 'TOTAL:', data.retirosDetail.reduce((s, w) => s + (w.amount || 0), 0)]);
    rtTotal.getCell(3).font = { bold: true };
    rtTotal.getCell(4).font = { bold: true };
    rtTotal.getCell(4).numFmt = '"$"#,##0';
  }

  // ── Sheet 6: Gastos de caja menor ─────────────────────
  if (data.gastosDetail && data.gastosDetail.length > 0) {
    const gastSheet = workbook.addWorksheet('Gastos Caja Menor');
    gastSheet.columns = [{ width: 5 }, { width: 20 }, { width: 30 }, { width: 20 }];
    const gh = gastSheet.addRow(['#', 'Fecha', 'Descripción', 'Monto']);
    gh.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF78350F' } };
    });
    data.gastosDetail.forEach((e, i) => {
      const row = gastSheet.addRow([i + 1, new Date(e.date).toLocaleString('es-CO'), e.description || e.reason || '', e.amount || 0]);
      row.getCell(4).numFmt = '"$"#,##0';
    });
    const gtRow = gastSheet.addRow(['', '', 'TOTAL:', data.gastosDetail.reduce((s, e) => s + (e.amount || 0), 0)]);
    gtRow.getCell(3).font = { bold: true };
    gtRow.getCell(4).font = { bold: true };
    gtRow.getCell(4).numFmt = '"$"#,##0';
  }

  // ── Sheet 7: Arriendo & Créditos ──────────────────────
  const otherPayments = [...data.arriendoDetail.map(p => ({ ...p, tipo: 'Arriendo' })), ...data.creditoDetail.map(p => ({ ...p, tipo: 'Crédito' }))];
  if (otherPayments.length > 0) {
    const otherSheet = workbook.addWorksheet('Arriendo y Créditos');
    otherSheet.columns = [{ width: 5 }, { width: 15 }, { width: 25 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 25 }];
    const oh = otherSheet.addRow(['#', 'Tipo', 'Nombre', 'Fecha', 'Monto', 'Método', 'Notas']);
    oh.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2980B9' } };
    });
    otherPayments.forEach((p, i) => {
      const row = otherSheet.addRow([i + 1, p.tipo, p.supplier, new Date(p.date).toLocaleString('es-CO'), p.amount || 0, p.method || '', p.notes || '']);
      row.getCell(5).numFmt = '"$"#,##0';
    });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="rentabilidad-${Date.now()}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

module.exports = { generateSalesReport, generateRentabilidadReport };
