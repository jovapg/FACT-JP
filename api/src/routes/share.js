/**
 * routes/share.js — Tarjeta al compartir el enlace de la carta (WhatsApp, Facebook, Telegram...)
 *
 * Quien recibe el enlace ve: logo del negocio + "Carta de <negocio>" + una frase corta.
 * Esas aplicaciones NO ejecutan la pantalla (Vue): leen el HTML tal como lo entrega el servidor. Por eso,
 * para /carta/<slug> se entrega el mismo index.html de la app pero con el título y las etiquetas "Open Graph" de ese negocio.
 * Si el negocio no existe o algo falla, se entrega la página normal (la app muestra "carta no disponible").
 */
const fs = require('fs');
const path = require('path');
const { readJSON, getBusinessPath, getDataPath } = require('../services/fileStorage');

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,60}$/i;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let cache = { file: '', mtime: 0, html: '' };
function indexHtml(distPath) {
  const file = path.join(distPath, 'index.html');
  const mtime = fs.statSync(file).mtimeMs;
  if (cache.file !== file || cache.mtime !== mtime) cache = { file, mtime, html: fs.readFileSync(file, 'utf8') };
  return cache.html;
}

/** Fabrica el manejador de GET /carta/:slug; distPath = carpeta con el index.html compilado */
function shareCarta(distPath) {
  return async (req, res, next) => {
    try {
      const slug = String(req.params.slug || '');
      if (!SLUG_RE.test(slug)) return next();
      const list = await readJSON(path.join(getDataPath(), 'businesses.json')) || [];
      const biz = list.find(b => b.slug === slug && b.active !== false);
      if (!biz) return next();
      const profile = await readJSON(path.join(getBusinessPath(biz.id), 'profile.json')) || {};
      const carta = await readJSON(path.join(getBusinessPath(biz.id), 'carta.json'));
      if (!carta || (carta.settings && carta.settings.enabled === false)) return next();

      const name = String(profile.name || biz.name || '').trim().slice(0, 80) || 'Carta';
      const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
      const host = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim();
      const base = `${proto}://${host}`;
      const abs = (u) => (/^https?:\/\//i.test(u) ? u : base + (String(u).startsWith('/') ? '' : '/') + u);
      // Imagen: el logo del negocio; si no tiene, la portada de la carta; y si tampoco, el ícono de la app
      const image = abs(profile.logo || (carta.settings && carta.settings.heroImage) || '/icon-512.png');
      const title = `Carta de ${name}`;
      const desc = `Mira la carta de ${name} y haz tu pedido a domicilio o para recoger en el local.`;
      const url = `${base}/carta/${slug}`;

      const tags = [
        `<meta property="og:type" content="website" />`,
        `<meta property="og:site_name" content="${esc(name)}" />`,
        `<meta property="og:title" content="${esc(title)}" />`,
        `<meta property="og:description" content="${esc(desc)}" />`,
        `<meta property="og:image" content="${esc(image)}" />`,
        `<meta property="og:image:alt" content="${esc('Logo de ' + name)}" />`,
        `<meta property="og:url" content="${esc(url)}" />`,
        `<meta property="og:locale" content="es_CO" />`,
        `<meta name="twitter:card" content="summary" />`,
        `<meta name="twitter:title" content="${esc(title)}" />`,
        `<meta name="twitter:description" content="${esc(desc)}" />`,
        `<meta name="twitter:image" content="${esc(image)}" />`
      ].join('\n    ');

      let html = indexHtml(distPath);
      html = html.replace(/<title>[^<]*<\/title>/i, () => `<title>${esc(title)}</title>`);
      html = html.replace(/<meta name="description"[^>]*>/i, () => `<meta name="description" content="${esc(desc)}" />`);
      html = html.includes('</head>') ? html.replace('</head>', () => `    ${tags}\n  </head>`) : html;
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=300'); // los cambios de logo o nombre se ven en pocos minutos
      res.send(html);
    } catch (e) { next(); }
  };
}

module.exports = { shareCarta };
