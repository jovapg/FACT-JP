/**
 * services/pdfGenerator.js — Generación de PDF de facturas (ticket térmico 80mm)
 *
 * Genera el PDF de una factura en formato de impresora térmica de 80mm.
 * El ancho de página es 226px (equivalente a 80mm en puntos de PDFKit).
 *
 * Diseño del ticket:
 *   ┌────────────────────────┐
 *   │   NOMBRE DEL NEGOCIO   │  ← encabezado centrado
 *   │   NIT / Dirección      │
 *   ├────────────────────────┤
 *   │  Factura #: FAC-0001   │  ← datos de la factura
 *   │  Fecha / Cajero / Mesa │
 *   ├────────────────────────┤
 *   │ Producto  Cant P.Unit Total │  ← tabla de ítems
 *   │ ...                    │
 *   ├────────────────────────┤
 *   │  Subtotal:    $XX.XXX  │
 *   │  Descuento: - $X.XXX   │  (solo si hay descuento)
 *   │  (Precios incluyen IVA)│
 *   │  Método de pago: ...   │
 *   ├────────────────────────┤
 *   │  TOTAL:       $XX.XXX  │
 *   ├────────────────────────┤
 *   │  ¡Gracias por su visita!│
 *   └────────────────────────┘
 *
 * La altura de la página es dinámica: BASE_HEIGHT + (número de ítems × PER_ITEM)
 * para evitar espacios en blanco o texto cortado según la cantidad de productos.
 */

const PDFDocument = require('pdfkit');

/**
 * Formatea un número como precio en pesos colombianos.
 * Ejemplo: 15000 → '$15.000'
 */
function formatCOP(amount) {
  return '$' + Number(amount).toLocaleString('es-CO');
}

/**
 * Convierte una fecha ISO a formato DD/MM/YYYY.
 * Ejemplo: '2026-03-31T10:00:00Z' → '31/03/2026'
 */
function formatDate(isoDate) {
  const d = new Date(isoDate);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/**
 * Genera el PDF de una factura y lo envía directamente al response (streaming).
 *
 * @param {Object} sale     - Datos de la venta (items, totales, cliente, etc.)
 * @param {Object} business - Perfil del negocio (nombre, NIT, dirección, etc.)
 * @param {Object} res      - Response de Express (destino del stream)
 */
function generateInvoicePDF(sale, business, res) {
  const PAGE_WIDTH = 226;    // Ancho de página en puntos (≈ 80mm)
  const MARGIN = 20;         // Margen izquierdo y derecho
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 186px de área de contenido

  // Altura dinámica según cantidad de ítems para evitar espacios sobrantes
  const itemCount = (sale.items || []).length;
  const BASE_HEIGHT = 370;   // Altura mínima para cabecera + totales + pie
  const PER_ITEM = 22;       // Altura por cada ítem de la lista
  const pageHeight = BASE_HEIGHT + itemCount * PER_ITEM;

  const doc = new PDFDocument({ margin: MARGIN, size: [PAGE_WIDTH, pageHeight] });

  // El PDF se envía como stream directamente al cliente (sin guardar en disco)
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="factura-${sale.invoiceNumber}.pdf"`);
  doc.pipe(res);

  // ── Posiciones de columnas en la tabla de ítems ──────────────────────────
  // Todas las columnas deben caber entre x=20 y x=206 (MARGIN a PAGE_WIDTH-MARGIN)
  const col1 = MARGIN;  // Nombre del producto: x=20, ancho=88
  const col2 = 110;     // Cantidad:            x=110, ancho=20
  const col3 = 132;     // Precio unitario:     x=132, ancho=36
  const col4 = 170;     // Total por línea:     x=170, ancho=36 (termina en 206)

  // ── ENCABEZADO — Nombre y datos del negocio ──────────────────────────────
  doc.fontSize(13).font('Helvetica-Bold')
    .text(business.name || 'facJp', MARGIN, MARGIN, { width: CONTENT_WIDTH, align: 'center' });
  doc.fontSize(7).font('Helvetica');
  if (business.nit)     doc.text(`NIT: ${business.nit}`,     { width: CONTENT_WIDTH, align: 'center' });
  if (business.address) doc.text(business.address,           { width: CONTENT_WIDTH, align: 'center' });
  if (business.city)    doc.text(business.city,              { width: CONTENT_WIDTH, align: 'center' });
  if (business.phone)   doc.text(`Tel: ${business.phone}`,   { width: CONTENT_WIDTH, align: 'center' });

  doc.moveDown(0.4);
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).stroke(); // Línea separadora
  doc.moveDown(0.3);

  // ── INFORMACIÓN DE LA FACTURA ────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(8)
    .text(`Factura de Venta #: ${sale.invoiceNumber}`, { width: CONTENT_WIDTH, align: 'center' });
  doc.font('Helvetica').fontSize(7);
  doc.text(`Fecha: ${formatDate(sale.createdAt)}`,  { width: CONTENT_WIDTH, align: 'center' });
  if (sale.client)      doc.text(`Cliente: ${sale.client}`,       { width: CONTENT_WIDTH, align: 'center' });
  if (sale.cashier)     doc.text(`Cajero: ${sale.cashier}`,       { width: CONTENT_WIDTH, align: 'center' });
  if (sale.tableNumber) doc.text(`Mesa: ${sale.tableNumber}`,     { width: CONTENT_WIDTH, align: 'center' });
  if (sale.notes)       doc.text(`Nota: ${sale.notes}`,           { width: CONTENT_WIDTH, align: 'center' });

  doc.moveDown(0.3);
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).stroke();
  doc.moveDown(0.3);

  // ── CABECERA DE LA TABLA DE ÍTEMS ────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(7);
  const headerY = doc.y;
  doc.text('Producto',  col1, headerY, { width: 88,  lineBreak: false });
  doc.text('Cant',      col2, headerY, { width: 20,  lineBreak: false, align: 'right' });
  doc.text('P.Unit',    col3, headerY, { width: 36,  lineBreak: false, align: 'right' });
  doc.text('Total',     col4, headerY, { width: 36,  align: 'right' });

  doc.moveDown(0.2);
  // Línea punteada para separar cabecera de ítems
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).dash(2, { space: 2 }).stroke().undash();
  doc.moveDown(0.2);

  // ── FILAS DE ÍTEMS ───────────────────────────────────────────────────────
  doc.font('Helvetica').fontSize(7);
  for (const item of (sale.items || [])) {
    const qty = item.qty || item.quantity || 1;
    const lineTotal = qty * (item.price || 0);
    const y = doc.y;
    // Cada columna se posiciona con coordenada y absoluta para evitar que
    // el cursor de PDFKit se desplace entre columnas
    doc.text(item.name || item.recipeName || '', col1, y, { width: 88,  lineBreak: false });
    doc.text(String(qty),                        col2, y, { width: 20,  lineBreak: false, align: 'right' });
    doc.text(formatCOP(item.price || 0),         col3, y, { width: 36,  lineBreak: false, align: 'right' });
    doc.text(formatCOP(lineTotal),               col4, y, { width: 36,  align: 'right' });
    doc.moveDown(0.8); // Espacio entre filas
  }

  doc.moveDown(0.2);
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).stroke();
  doc.moveDown(0.3);

  // ── SUBTOTAL / DESCUENTO / MÉTODO DE PAGO ───────────────────────────────
  doc.font('Helvetica').fontSize(8);
  let y = doc.y;
  // Subtotal — se usa MARGIN como coordenada x explícita para centrar correctamente
  doc.text('Subtotal:',                          col1, y, { width: 100, lineBreak: false });
  doc.text(formatCOP(sale.subtotal || sale.total || 0), col1 + 100, y, { width: CONTENT_WIDTH - 100, align: 'right' });
  doc.moveDown(0.4);

  // Descuento (solo si hay descuento aplicado)
  if (sale.discount > 0) {
    y = doc.y;
    doc.text('Descuento:',             col1, y, { width: 100, lineBreak: false });
    doc.text(`- ${formatCOP(sale.discount)}`, col1 + 100, y, { width: CONTENT_WIDTH - 100, align: 'right' });
    doc.moveDown(0.4);
  }

  // Nota legal de IVA incluido
  doc.fontSize(6).text('(Precios incluyen IVA)', MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center' });
  doc.moveDown(0.3);

  // Método de pago (si está disponible)
  if (sale.paymentMethod) {
    doc.fontSize(7).text(`Método de pago: ${sale.paymentMethod}`, MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center' });
    doc.moveDown(0.3);
  }

  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).stroke();
  doc.moveDown(0.3);

  // ── TOTAL FINAL ──────────────────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(11);
  y = doc.y;
  doc.text('TOTAL:', col1, y, { width: 100, lineBreak: false });
  doc.text(formatCOP(sale.total || 0), col1 + 100, y, { width: CONTENT_WIDTH - 100, align: 'right' });
  doc.moveDown(0.5);

  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).stroke();
  doc.moveDown(0.5);

  // ── PIE DE PÁGINA ────────────────────────────────────────────────────────
  doc.font('Helvetica').fontSize(8)
    .text('¡Gracias por su visita!', MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center' });
  doc.fontSize(6)
    .text('facJp - Sistema de Facturación', MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center' });

  doc.end(); // Finaliza el stream y envía el PDF al cliente
}

module.exports = { generateInvoicePDF };
