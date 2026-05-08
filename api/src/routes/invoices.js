/**
 * routes/invoices.js — Consulta y generación de PDF de facturas
 *
 * Las facturas son las mismas ventas (sales.json) vistas desde la
 * perspectiva del cliente. Este router provee:
 *   - Listado de todas las facturas del negocio
 *   - Generación del PDF de una factura específica
 *
 * El PDF se genera con PDFKit en formato de impresora térmica de 80mm
 * (226px de ancho). El endpoint de PDF acepta el token JWT tanto en
 * el header Authorization como en el query param ?token=, lo que
 * permite abrirlo directamente desde una pestaña del navegador.
 *
 * Rutas:
 *   GET /api/:businessId/invoices               → listar todas las facturas
 *   GET /api/:businessId/invoices/:id/pdf       → descargar/ver PDF de factura
 */

const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams: true necesario para :businessId
const path = require('path');
const { readJSON, getBusinessPath } = require('../services/fileStorage');
const { authenticate } = require('../middleware/auth');
const { generateInvoicePDF } = require('../services/pdfGenerator');

const salesPath = (id) => path.join(getBusinessPath(id), 'sales.json');
const profilePath = (id) => path.join(getBusinessPath(id), 'profile.json');

/** GET /invoices — Lista todas las ventas del negocio (son las mismas facturas) */
router.get('/invoices', authenticate, async (req, res) => {
  try {
    const sales = await readJSON(salesPath(req.params.businessId)) || [];
    res.json(sales);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /invoices/:id/pdf — Genera y devuelve el PDF de una factura.
 *
 * Acepta el token JWT de dos formas:
 *   1. Header: Authorization: Bearer <token>  (llamada programática desde axios)
 *   2. Query:  ?token=<token>                 (enlace directo en el navegador)
 *
 * El middleware intermedio convierte el query param a header antes de
 * que `authenticate` lo verifique, manteniendo la seguridad.
 *
 * El PDF es generado por pdfGenerator.js con el diseño de ticket
 * térmico 80mm e incluye datos del negocio, ítems, descuento y total.
 */
router.get('/invoices/:id/pdf',
  // Middleware: convierte ?token= a header Authorization si no viene en el header
  (req, res, next) => {
    if (req.query.token && !req.headers['authorization']) {
      req.headers['authorization'] = `Bearer ${req.query.token}`;
    }
    next();
  },
  authenticate,
  async (req, res) => {
    try {
      const sales = await readJSON(salesPath(req.params.businessId)) || [];
      const sale = sales.find(s => s.id === req.params.id);
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
