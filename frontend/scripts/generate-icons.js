/**
 * Genera los íconos PNG para el PWA (192x192 y 512x512)
 * desde el favicon.svg existente.
 * Uso: node scripts/generate-icons.js
 */
const sharp = require('sharp');
const path = require('path');

const svgPath = path.join(__dirname, '../public/favicon.svg');
const outDir = path.join(__dirname, '../public');

async function generate() {
  await sharp(svgPath).resize(192, 192).png().toFile(path.join(outDir, 'icon-192.png'));
  console.log('✓ icon-192.png');
  await sharp(svgPath).resize(512, 512).png().toFile(path.join(outDir, 'icon-512.png'));
  console.log('✓ icon-512.png');
  await sharp(svgPath).resize(180, 180).png().toFile(path.join(outDir, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png');
  console.log('Íconos generados en public/');
}

generate().catch(console.error);
