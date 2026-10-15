/**
 * scripts/check-vue-imports.js — Revisiones que se ejecutan antes de `npm run build`
 *
 * 1) Que cada función de Vue usada (computed, ref, watch…) esté importada de 'vue'.
 *    Si falta, la compilación pasa igual pero la pantalla se rompe al abrirla
 *    (ReferenceError). Esto pasó en Configuración.
 *
 * 2) Que ningún estilo use `:global(html.dark) .clase`. En este Vue se compila MAL: queda
 *    solo `html.dark`, se pierde `.clase` y la regla pinta la página entera. La forma
 *    correcta es `:global(html.dark .clase)`, con todo el selector adentro.
 *
 * Si encuentra un problema, el build se detiene.
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

// ── 1) Imports de Vue ──
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

// ── 2) Selectores :global mal escritos ──
const BAD_GLOBAL = /:global\([^)]*\)\s+[.#\w\[:]/;
for (const f of files.filter(x => x.endsWith('.vue'))) {
  const blocks = fs.readFileSync(f, 'utf8').match(/<style[^>]*>[\s\S]*?<\/style>/g) || [];
  for (const block of blocks) {
    const bad = block.match(BAD_GLOBAL);
    if (bad) {
      console.error(`✗ Selector :global mal escrito en ${path.relative(ROOT, f)}: "${bad[0]}". Usa :global(html.dark .clase) con todo adentro.`);
      problems++;
    }
  }
}

if (problems) {
  console.error(`\n${problems} problema(s). Corrígelos y vuelve a compilar.`);
  process.exit(1);
}
console.log('✓ Imports de Vue y estilos :global correctos');
