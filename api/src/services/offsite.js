/**
 * services/offsite.js — Almacenamiento externo de respaldos (Backblaze B2, por su API compatible con S3)
 *
 * Se configura con variables de Railway:
 *   B2_KEY_ID, B2_APP_KEY, B2_BUCKET, B2_ENDPOINT (ej: s3.us-west-004.backblazeb2.com)
 * Funciona con cualquier almacenamiento compatible con S3 (Cloudflare R2, etc.).
 * Sin las variables, todo esto queda apagado y los respaldos siguen solo en el volumen.
 */
const { AwsClient } = require('aws4fetch');

function cfg() {
  const { B2_KEY_ID, B2_APP_KEY, B2_BUCKET, B2_ENDPOINT } = process.env;
  if (!B2_KEY_ID || !B2_APP_KEY || !B2_BUCKET || !B2_ENDPOINT) return null;
  const ep = String(B2_ENDPOINT).trim().replace(/\/+$/, '');
  const host = ep.replace(/^https?:\/\//, '');
  const region = (/^s3\.([^.]+)\./.exec(host) || [])[1] || 'us-east-1';
  return { id: B2_KEY_ID.trim(), secret: B2_APP_KEY.trim(), bucket: B2_BUCKET.trim(), base: /^https?:\/\//.test(ep) ? ep : 'https://' + ep, region };
}

const isConfigured = () => !!cfg();
const enc = (key) => key.split('/').map(encodeURIComponent).join('/');

async function call(method, urlPath, body) {
  const c = cfg();
  if (!c) throw new Error('El respaldo externo no está configurado (faltan las variables B2_… en Railway)');
  const client = new AwsClient({ accessKeyId: c.id, secretAccessKey: c.secret, service: 's3', region: c.region });
  const res = await client.fetch(`${c.base}/${c.bucket}${urlPath}`, { method, body, headers: body ? { 'content-type': 'application/octet-stream' } : undefined });
  if (!res.ok) {
    const t = (await res.text().catch(() => '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200);
    throw new Error(`El almacenamiento externo respondió ${res.status}${t ? ': ' + t : ''}`);
  }
  return res;
}

const put = (key, buf) => call('PUT', '/' + enc(key), buf);
const del = (key) => call('DELETE', '/' + enc(key));
async function get(key) { return Buffer.from(await (await call('GET', '/' + enc(key))).arrayBuffer()); }

/** Lista los objetos con un prefijo: [{ key, size, lastModified }] (el más nuevo primero) */
async function list(prefix = '') {
  const out = []; let token = '';
  for (let i = 0; i < 20; i++) {
    const q = `?list-type=2&prefix=${encodeURIComponent(prefix)}${token ? '&continuation-token=' + encodeURIComponent(token) : ''}`;
    const xml = await (await call('GET', q)).text();
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const g = (t) => (new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(m[1]) || [])[1] || '';
      out.push({ key: g('Key').replace(/&amp;/g, '&'), size: Number(g('Size')) || 0, lastModified: g('LastModified') });
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? ((/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml) || [])[1] || '') : '';
    if (!token) break;
  }
  return out.sort((a, b) => (a.key < b.key ? 1 : -1));
}

module.exports = { isConfigured, put, get, del, list };
