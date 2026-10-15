#!/usr/bin/env node
/**
 * restore-backup.js — Restaura un respaldo de facJp (.json.gz) en una carpeta.
 *
 * Uso:
 *   node restore-backup.js <archivo.json.gz> <carpeta-destino> [--force]
 *
 * Por seguridad NO escribe sobre una carpeta que ya tenga archivos, a menos que
 * se pase --force. Lo normal es restaurar a una carpeta nueva, revisar que todo
 * esté bien y luego copiarla a la carpeta de datos del servidor.
 *
 * Los respaldos solo guardan los .json (no las imágenes de logos, QR y productos).
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const force = process.argv.includes('--force');
const [file, target] = args;

if (!file || !target) {
  console.log('Uso: node restore-backup.js <archivo.json.gz> <carpeta-destino> [--force]');
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
} catch (err) {
  console.error('No se pudo leer el respaldo (¿es un archivo .json.gz de facJp?):', err.message);
  process.exit(1);
}
if (payload.app !== 'facjp' || !payload.files || typeof payload.files !== 'object') {
  console.error('Este archivo no es un respaldo válido de facJp.');
  process.exit(1);
}

const root = path.resolve(target);
if (fs.existsSync(root) && fs.readdirSync(root).length > 0 && !force) {
  console.error(`La carpeta "${root}" ya tiene archivos. Usa una carpeta nueva o agrega --force para sobrescribir.`);
  process.exit(1);
}

let written = 0;
for (const [rel, text] of Object.entries(payload.files)) {
  const dest = path.resolve(root, rel);
  // Nunca escribir fuera de la carpeta destino
  if (dest !== root && !dest.startsWith(root + path.sep)) {
    console.error('Ruta sospechosa en el respaldo, se omite:', rel);
    continue;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, text, 'utf8');
  written++;
}

console.log(`Listo: ${written} archivos restaurados en ${root}`);
console.log(`Respaldo creado el ${payload.createdAt}`);
