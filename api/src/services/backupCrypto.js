/**
 * services/backupCrypto.js — Cifrado de los respaldos que salen de Railway
 *
 * AES-256-GCM (viene incluido en Node, no cuesta nada). Formato del archivo cifrado:
 *   "FJBK1" (5 bytes) + vector (12) + sello de autenticidad (16) + datos cifrados
 * Si la clave es incorrecta o el archivo se alteró, el descifrado falla (no entrega basura).
 *
 * La clave: 32 bytes al azar, escritos como 64 letras/números. Se toma de la variable BACKUP_KEY de Railway
 * o, si no existe, del archivo .backup_key del volumen (que la app crea la primera vez y MUESTRA UNA SOLA VEZ).
 * Quien tenga el respaldo y la clave puede leer los datos; sin la clave, nadie, ni siquiera nosotros.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDataPath } = require('./fileStorage');

const MAGIC = Buffer.from('FJBK1');
const keyFile = () => path.join(getDataPath(), '.backup_key');

/** "ABCD-1234-…" o 64 letras/números → Buffer de 32 bytes (o null si no es una clave válida) */
function parseKey(s) {
  const hex = String(s || '').replace(/[^0-9a-fA-F]/g, '');
  return hex.length === 64 ? Buffer.from(hex, 'hex') : null;
}
const formatKey = (buf) => buf.toString('hex').match(/.{8}/g).join('-');

function getKey() {
  const env = parseKey(process.env.BACKUP_KEY);
  if (env) return env;
  try { return parseKey(fs.readFileSync(keyFile(), 'utf8')); } catch { return null; }
}

/** Crea la clave la primera vez y la devuelve formateada. Falla si ya existe una. */
function generateKey() {
  if (getKey()) throw new Error('Ya existe una clave de respaldos. No se puede crear otra (los respaldos viejos dejarían de abrirse).');
  const k = crypto.randomBytes(32);
  fs.mkdirSync(path.dirname(keyFile()), { recursive: true });
  fs.writeFileSync(keyFile(), k.toString('hex'), { mode: 0o600 });
  return formatKey(k);
}

const isEncrypted = (buf) => buf.length > 33 && buf.subarray(0, 5).equals(MAGIC);

function encrypt(buf, key) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), enc]);
}

function decrypt(buf, key) {
  if (!isEncrypted(buf)) throw new Error('Este archivo no es un respaldo cifrado de facJp');
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(5, 17));
    d.setAuthTag(buf.subarray(17, 33));
    return Buffer.concat([d.update(buf.subarray(33)), d.final()]);
  } catch {
    throw new Error('La clave es incorrecta o el archivo está dañado');
  }
}

module.exports = { parseKey, formatKey, getKey, generateKey, isEncrypted, encrypt, decrypt };
