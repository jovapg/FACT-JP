/**
 * scripts/check-vue-imports.js — Revisa que cada función de Vue usada esté importada
 *
 * Si un archivo usa computed(), ref(), watch()… sin importarlo de 'vue', la compilación
 * pasa igual pero la pantalla se rompe al abrirla (ReferenceError). Esto pasó en
 * Configuración. Se ejecuta automáticamente antes de `npm run build`; si encuentra un
 * problema, el build se detiene.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../src');
const FNS = ['ref', 'reactive', 'computed', 'watch', 'onMounted', 'onUnmounted', 'inject', 'nextTick', 'provide', 'toRef', 'toRefs'];

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (/\.(vue|js)$/.test(e.name)) files.push(f);
  }
})(ROOT);

let problems = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  if (f.endsWith('.vue')) {
    const m = s.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    if (!m) continue;
    s = m[1];
  }
  const code = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const imported = [...code.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]vue['"]/g)]
    .flatMap(m => m[1].split(',').map(x => x.trim().split(/\s+as\s+/).pop()));
  for (const fn of FNS) {
    const used = new RegExp('(^|[^\\w.$])' + fn + '\\s*\\(').test(code);
    const declared = new RegExp('(function|const|let|var)\\s+' + fn + '\\b').test(code);
    if (used && !imported.includes(fn) && !declared) {
      console.error(`✗ Falta importar ${fn} de 'vue' en ${path.relative(ROOT, f)}`);
      problems++;
    }
  }
}

if (problems) {
  console.error(`\n${problems} problema(s). Agrega el import y vuelve a compilar.`);
  process.exit(1);
}
console.log('✓ Imports de Vue correctos');
