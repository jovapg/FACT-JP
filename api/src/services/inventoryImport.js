/**
 * services/inventoryImport.js — Carga masiva de productos al inventario
 *
 * Recibe una lista (pegada desde Excel, un CSV o un .xlsx), reconoce las columnas por su nombre, valida cada fila
 * y arma un PLAN: qué se crea, qué ya existe (se salta o actualiza su precio) y qué trae errores.
 * Nada se guarda hasta que quien administra confirma (ver routes/inventory.js).
 *
 * Columnas que reconoce (en cualquier orden, con o sin tildes, mayúsculas o minúsculas):
 *   nombre | producto            (obligatoria)
 *   categoria | categoría        (por defecto "general")
 *   precio | precio de venta | valor | pvp
 *   costo | costo de compra
 *   stock | cantidad | existencias | inventario
 *   unidad | und
 *   area | área                  (bar | restaurante)
 *   minimo | stock minimo
 *   control | controla stock | "sin stock" (sí/no)
 * Si la primera línea no trae encabezados se asume el orden: nombre, categoría, precio.
 */

const MAX_ROWS = 1000;

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const HEADERS = {
  name: ['nombre', 'producto', 'articulo', 'item', 'descripcion'],
  category: ['categoria', 'tipo', 'grupo', 'linea', 'familia'],
  salePrice: ['precio', 'precio de venta', 'precio venta', 'valor', 'pvp', 'vr', 'valor venta'],
  cost: ['costo', 'costo de compra', 'precio de compra', 'precio compra', 'costo unitario'],
  stock: ['stock', 'cantidad', 'existencias', 'inventario', 'unidades', 'cant'],
  unit: ['unidad', 'und', 'medida', 'unidad de medida'],
  area: ['area', 'bolsillo'],
  minStock: ['minimo', 'stock minimo', 'stock min', 'min'],
  control: ['control', 'controla stock', 'control de stock', 'controlar stock', 'maneja stock'],
  noControl: ['sin stock', 'sin control', 'no controlar stock', 'no controla stock', 'servicio']
};

/** Detecta el separador mirando la primera línea: tabulación (pegado desde Excel), punto y coma o coma */
function detectDelimiter(text) {
  const first = text.split(/\r?\n/).find(l => l.trim()) || '';
  if (first.includes('\t')) return '\t';
  if ((first.match(/;/g) || []).length >= 1) return ';';
  return ',';
}

/** Lector de CSV/TSV con comillas ("a, b") y comillas dobles escapadas ("") */
function parseDelimited(text) {
  const delim = detectDelimiter(text);
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; rows.push(row); row = []; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

/** Lee la primera hoja de un .xlsx (con exceljs) y la devuelve como filas de texto */
async function parseXlsx(buffer) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells = [];
    for (let c = 1; c <= row.cellCount; c++) {
      const v = row.getCell(c).value;
      cells.push(v == null ? '' : typeof v === 'object' ? String(v.result ?? v.text ?? (v.richText ? v.richText.map(t => t.text).join('') : '') ?? '') : String(v));
    }
    rows.push(cells);
  });
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

/** Número en formato colombiano o normal: "$12.000", "12,000", "12000", "1.250,50" */
function parseMoney(v) {
  let s = String(v ?? '').trim().replace(/[$\s]/g, '');
  if (s === '') return { value: 0, empty: true };
  if (!/^[\d.,]+$/.test(s)) return { error: true };
  const dots = (s.match(/\./g) || []).length, commas = (s.match(/,/g) || []).length;
  if (dots && commas) { // el último separador es el decimal
    const dec = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    s = dec === ',' ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (dots > 1 || commas > 1) s = s.replace(/[.,]/g, '');                      // 1.250.000
  else if (dots === 1 || commas === 1) {
    const sep = dots ? '.' : ',', [a, b] = s.split(sep);
    s = (b.length === 3 && a.length >= 1) ? a + b : a + '.' + b;                        // 12.000 → 12000 · 12,5 → 12.5
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? { value: n } : { error: true };
}

const yes = (v) => ['si', 'sí', 's', 'yes', 'y', 'true', '1', 'x'].includes(norm(v));
const no = (v) => ['no', 'n', 'false', '0'].includes(norm(v));

/** Convierte las filas crudas en filas con campos conocidos (detectando encabezados) */
function mapRows(raw) {
  if (!raw.length) return { rows: [], headerFound: false };
  const first = raw[0].map(norm);
  const idx = {};
  for (const [field, names] of Object.entries(HEADERS)) {
    const i = first.findIndex(h => names.includes(h));
    if (i !== -1 && !Object.values(idx).includes(i)) idx[field] = i;
  }
  const headerFound = idx.name !== undefined;
  let body = raw;
  if (headerFound) body = raw.slice(1);
  else { idx.name = 0; idx.category = 1; idx.salePrice = 2; } // sin encabezado: nombre, categoría, precio
  const rows = body.map((r, k) => {
    const o = { line: k + (headerFound ? 2 : 1) };
    for (const [f, i] of Object.entries(idx)) o[f] = r[i] === undefined ? '' : String(r[i]).trim();
    return o;
  });
  return { rows, headerFound };
}

/**
 * Arma el plan.
 *  existing: inventario actual del negocio
 *  options:  { control: 'con' | 'sin' (stock por defecto de los nuevos), updatePrices: bool, area: 'bar'|'restaurante' }
 * Devuelve { rows:[{line,name,category,salePrice,cost,stock,unit,area,minStock,noStock,status,message,id?}], counts }
 *  status: nuevo | existe | actualiza | duplicado | error
 */
function plan(rawRows, existing, options = {}) {
  const { rows, headerFound } = mapRows(rawRows);
  if (rows.length > MAX_ROWS) throw new Error(`Máximo ${MAX_ROWS} productos por carga (trae ${rows.length}). Divide la lista en partes.`);
  const defaultNoStock = options.control === 'sin';
  const defaultArea = options.area === 'restaurante' ? 'restaurante' : 'bar';
  const byName = new Map(existing.map(i => [norm(i.name), i]));
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const name = r.name.replace(/\s+/g, ' ').trim();
    const row = { line: r.line, name, status: 'nuevo', message: '' };
    const fail = (m) => { row.status = 'error'; row.message = m; out.push(row); };
    if (!name) { if ([r.category, r.salePrice, r.cost, r.stock].every(x => !x)) continue; fail('Falta el nombre'); continue; }
    if (name.length > 100) { fail('El nombre es muy largo (máx. 100)'); continue; }
    const price = parseMoney(r.salePrice), cost = parseMoney(r.cost), stock = parseMoney(r.stock), min = parseMoney(r.minStock);
    if (price.error) { fail(`Precio no válido: "${r.salePrice}"`); continue; }
    if (cost.error) { fail(`Costo no válido: "${r.cost}"`); continue; }
    if (stock.error) { fail(`Stock no válido: "${r.stock}"`); continue; }
    if (min.error) { fail(`Mínimo no válido: "${r.minStock}"`); continue; }
    Object.assign(row, {
      category: (r.category || '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'general',
      salePrice: price.value, cost: cost.value, stock: stock.value, minStock: min.value,
      unit: (r.unit || '').trim().slice(0, 20) || 'unidad',
      area: norm(r.area) === 'restaurante' ? 'restaurante' : (norm(r.area) === 'bar' ? 'bar' : defaultArea)
    });
    // control de stock: la columna manda; si no viene, lo que se escogió para toda la carga
    let noStock = defaultNoStock;
    if (r.noControl !== undefined && r.noControl !== '') noStock = yes(r.noControl) ? true : (no(r.noControl) ? false : noStock);
    if (r.control !== undefined && r.control !== '') noStock = yes(r.control) ? false : (no(r.control) ? true : noStock);
    row.noStock = noStock;

    const key = norm(name);
    if (seen.has(key)) { row.status = 'duplicado'; row.message = 'Repetido en la lista (se usa el primero)'; out.push(row); continue; }
    seen.add(key);
    const ex = byName.get(key);
    if (ex) {
      row.id = ex.id;
      if (options.updatePrices && row.salePrice > 0 && row.salePrice !== ex.salePrice) { row.status = 'actualiza'; row.message = `Cambia el precio de $${ex.salePrice || 0} a $${row.salePrice}`; }
      else { row.status = 'existe'; row.message = 'Ya está en el inventario'; }
    }
    out.push(row);
  }
  const counts = { nuevo: 0, existe: 0, actualiza: 0, duplicado: 0, error: 0 };
  for (const r of out) counts[r.status]++;
  return { rows: out, counts, headerFound, total: out.length };
}

/** Caracter de reemplazo (aparece si un CSV viene en otra codificación) y quitar la marca BOM del inicio */
const BAD_CHAR = String.fromCharCode(0xFFFD);
const stripBom = (s) => (s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s);

module.exports = { BAD_CHAR, stripBom, parseDelimited, parseXlsx, parseMoney, mapRows, plan, norm, MAX_ROWS };
