/**
 * routes/invoices.js — Consulta y generación de PDF de facturas
 *
 * Las facturas son las mismas ventas (sales.json) vistas desde la
 * perspectiva del cliente. Este router provee:
 *   - Listado de todas las facturas del negocio
 *   - Generación del PDF de una factura específica
 *
 * El PDF se genera con PDFKit en formato de impresora térmica de 80mm
 * (226px de ancho). El endpoint de PDF requiere el token JWT en el header
 * Authorization (el frontend lo pide con axios y lo abre como blob).
 *
 * Rutas:
 *   GET /api/:businessId/invoices               → listar todas las facturas
 *   GET /api/:businessId/invoices/:id/pdf       → descargar/ver PDF de factura
 */

const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams: true necesario para :businessId
const path = require('path');
const { readJSON, getBusinessPath, collection } = require('../services/fileStorage');
const { authenticate } = require('../middleware/auth');
const { generateInvoicePDF } = require('../services/pdfGenerator');

const salesPath = (id) => path.join(getBusinessPath(id), 'sales.json');
const profilePath = (id) => path.join(getBusinessPath(id), 'profile.json');

/**
 * GET /invoices — Facturas del negocio (son las mismas ventas), las MÁS RECIENTES primero por páginas.
 *   ?limit=300         cuántas traer (máx. 1000)
 *   ?before=<fecha ISO> las anteriores a esa fecha (para "cargar más antiguas")
 *   ?q=texto           busca en todo el historial (número, cajero, mesa, cliente, productos...)
 * Responde la lista en orden cronológico (la más antigua primero) y el encabezado X-Has-More=1 si hay más.
 */
router.get('/invoices', authenticate, async (req, res) => {
  try {
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 300));
    const o = { desc: true, limit: limit + 1 };
    const before = req.query.before ? new Date(req.query.before).getTime() : null;
    if (before && !Number.isNaN(before)) o.toTs = before - 1;
    const q = String(req.query.q || '').trim();
    if (q) o.like = q.slice(0, 80);
    const rows = collection(req.params.businessId, 'sales.json').query(o);
    const hasMore = rows.length > limit;
    res.set('X-Has-More', hasMore ? '1' : '0');
    res.set('Access-Control-Expose-Headers', 'X-Has-More');
    res.json(rows.slice(0, limit).reverse());
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /invoices/:id/pdf — Genera y devuelve el PDF de una factura.
 *
 * Requiere el token JWT en el header Authorization (llamada desde axios).
 * Ya no se acepta por la URL (?token=).
 *
 * El PDF es generado por pdfGenerator.js con el diseño de ticket
 * térmico 80mm e incluye datos del negocio, ítems, descuento y total.
 */
router.get('/invoices/:id/pdf',
  authenticate,
  async (req, res) => {
    try {
      const sale = collection(req.params.businessId, 'sales.json').get(req.params.id);
      if (!sale) return res.status(404).json({ error: 'Invoice not found' });

      // Cargar perfil del negocio para el encabezado del PDF (nombre, NIT, dirección)
      const business = await readJSON(profilePath(req.params.businessId)) || {};
      generateInvoicePDF(sale, business, res);
    } catch (err) {
      console.error(err); res.status(500).json({ error: "Internal server error" });
    }
  }
);

module.exports = router;
