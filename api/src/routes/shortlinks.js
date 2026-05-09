/**
 * routes/shortlinks.js — Links cortos para PDFs de facturas
 *
 * Genera códigos cortos de 8 caracteres que apuntan a una factura específica.
 * Permite compartir el PDF por WhatsApp con una URL limpia en vez del JWT largo.
 *
 * shortlinks.json (en la raíz de DATA_PATH):
 *   { "xK9mN2pQ": { "businessId": "...", "invoiceId": "...", "expiresAt": "..." } }
 *
 * Rutas:
 *   POST /api/:businessId/invoices/:id/shortlink → crea/reutiliza código corto (auth requerida)
 *   GET  /f/:code                                → sirve el PDF (público, sin auth)
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const crypto = require('crypto');
const path = require('path');
const { readJSON, writeJSON, getDataPath, getBusinessPath } = require('../services/fileStorage');
const { authenticate } = require('../middleware/auth');
const { generateInvoicePDF } = require('../services/pdfGenerator');

const shortlinksFile = () => path.join(getDataPath(), 'shortlinks.json');
const EXPIRE_DAYS = 30;

/** Genera un código único de 8 caracteres URL-safe */
function genCode() {
  return crypto.randomBytes(6).toString('base64url');  // 6 bytes = 8 chars base64url exacto
}

/**
 * POST /api/:businessId/invoices/:id/shortlink
 * Crea un código corto para la factura. Si ya existía uno válido lo reutiliza.
 * Retorna: { code, url }
 */
router.post('/invoices/:id/shortlink', authenticate, async (req, res) => {
  try {
    const { businessId } = req.params;
    const invoiceId = req.params.id;

    const links = await readJSON(shortlinksFile()) || {};

    // Reutilizar código existente si aún no venció
    const existing = Object.entries(links).find(
      ([, v]) => v.businessId === businessId && v.invoiceId === invoiceId && new Date(v.expiresAt) > new Date()
    );
    if (existing) {
      const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
      return res.json({ code: existing[0], url: `${origin}/f/${existing[0]}` });
    }

    // Crear nuevo código, asegurando unicidad
    let code;
    do { code = genCode(); } while (links[code]);

    links[code] = {
      businessId,
      invoiceId,
      expiresAt: new Date(Date.now() + EXPIRE_DAYS * 864e5).toISOString()
    };

    await writeJSON(shortlinksFile(), links);

    const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
    res.json({ code, url: `${origin}/f/${code}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Manejador público del link corto: GET /f/:code
 * Decodifica el código, busca la factura y sirve el PDF sin requerir auth.
 * Se registra en server.js como ruta pública.
 */
async function handleShortlink(req, res) {
  try {
    const links = await readJSON(shortlinksFile()) || {};
    const entry = links[req.params.code];

    if (!entry) return res.status(404).json({ error: 'Link no encontrado o expirado' });
    if (new Date(entry.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'Este link expiró' });
    }

    const salesPath = path.join(getBusinessPath(entry.businessId), 'sales.json');
    const profilePath = path.join(getBusinessPath(entry.businessId), 'profile.json');
    const sales = await readJSON(salesPath) || [];
    const sale = sales.find(s => s.id === entry.invoiceId);
    if (!sale) return res.status(404).json({ error: 'Factura no encontrada' });

    const business = await readJSON(profilePath) || {};
    generateInvoicePDF(sale, business, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { router, handleShortlink };
