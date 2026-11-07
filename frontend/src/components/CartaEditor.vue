<template>
  <section class="ce">
    <div class="ce-head">
      <h3>Productos y categorías</h3>
      <div class="ce-btns">
        <button class="ce-btn" @click="openCat(null)">+ Categoría</button>
        <button class="ce-btn main" :disabled="!cats.length" @click="openProduct(null, cats[0])">+ Producto</button>
      </div>
    </div>
    <p class="ce-hint">Crea, edita, ordena o borra lo que se vende. <b>Agotado</b> y <b>Visible</b> se cambian al instante. Después de crear productos nuevos, toca <b>📦 Registrar productos en inventario</b> para controlar su stock.</p>

    <p v-if="!cats.length" class="ce-empty">Todavía no hay categorías. Crea la primera (por ejemplo "Combos" o "Bebidas") y luego agrega productos.</p>

    <div v-for="(cat, ci) in cats" :key="cat.id" class="ce-cat">
      <header>
        <div class="ce-cname"><b>{{ cat.emoji || '' }} {{ cat.name }}</b> <small>{{ productsOf(cat).length }} producto(s)<template v-if="cat.group"> · grupo "{{ cat.group }}"</template></small></div>
        <div class="ce-acts">
          <button class="ce-ic" title="Subir" :disabled="ci === 0" @click="moveCat(ci, -1)">▲</button>
          <button class="ce-ic" title="Bajar" :disabled="ci === cats.length - 1" @click="moveCat(ci, 1)">▼</button>
          <button class="ce-ic" title="Editar categoría" @click="openCat(cat)">✎</button>
          <button class="ce-ic" title="Borrar categoría" @click="delCat(cat)">🗑</button>
          <button class="ce-btn" @click="openProduct(null, cat)">+ Producto</button>
        </div>
      </header>

      <div v-for="(p, pi) in productsOf(cat)" :key="p.id" class="ce-row">
        <div class="ce-pn" :class="{ off: !p.active }">{{ p.name }}<small v-if="p.description">{{ p.description }}</small>
          <small v-if="(p.groups || []).length" class="ce-opts">{{ p.groups.map(g => g.name).join(' · ') }}</small></div>
        <input class="ce-price" type="number" min="0" step="100" :value="p.price" @change="quick(p, { price: Number($event.target.value) })" />
        <label class="ce-sw"><input type="checkbox" :checked="p.soldOut" @change="quick(p, { soldOut: $event.target.checked })" /><span>Agotado</span></label>
        <label class="ce-sw"><input type="checkbox" :checked="p.active" @change="quick(p, { active: $event.target.checked })" /><span>Visible</span></label>
        <div class="ce-acts">
          <button class="ce-ic" title="Subir" :disabled="pi === 0" @click="moveProduct(cat, pi, -1)">▲</button>
          <button class="ce-ic" title="Bajar" :disabled="pi === productsOf(cat).length - 1" @click="moveProduct(cat, pi, 1)">▼</button>
          <button class="ce-ic" title="Editar" @click="openProduct(p)">✎</button>
          <button class="ce-ic" title="Borrar" @click="delProduct(p)">🗑</button>
        </div>
      </div>
      <p v-if="!productsOf(cat).length" class="ce-empty small">Sin productos todavía.</p>
    </div>

    <!-- ── Categoría ── -->
    <div v-if="catForm" class="modal-overlay" @click.self="catForm = null">
      <div class="modal ce-modal narrow">
        <div class="modal-header"><h3 class="modal-title">{{ catForm.id ? 'Editar categoría' : 'Nueva categoría' }}</h3><button class="btn-close" @click="catForm = null">×</button></div>
        <div class="modal-body">
          <div class="form-group"><label class="form-label">Nombre</label><input v-model="catForm.name" class="form-control" maxlength="40" placeholder="Ej: Combos, Bebidas, Postres" /></div>
          <div class="form-group"><label class="form-label">Ícono (un emoji, opcional)</label>
            <input v-model="catForm.emoji" class="form-control" maxlength="4" placeholder="🍗" />
            <div class="ce-emojis"><button v-for="e in EMOJIS" :key="e" type="button" @click="catForm.emoji = e">{{ e }}</button></div></div>
          <div class="form-group"><label class="form-label">Juntar en un solo botón del menú (opcional)</label>
            <input v-model="catForm.group" class="form-control" maxlength="30" placeholder="Ej: Bebidas (varias categorías con el mismo nombre se juntan)" /></div>
          <p v-if="err" class="ce-err">{{ err }}</p>
        </div>
        <div class="modal-footer"><button class="btn btn-outline" @click="catForm = null">Cancelar</button><button class="btn btn-primary" :disabled="saving" @click="saveCat">Guardar</button></div>
      </div>
    </div>

    <!-- ── Producto ── -->
    <div v-if="form" class="modal-overlay" @click.self="form = null">
      <div class="modal ce-modal">
        <div class="modal-header"><h3 class="modal-title">{{ form.id ? 'Editar producto' : 'Nuevo producto' }}</h3><button class="btn-close" @click="form = null">×</button></div>
        <div class="modal-body ce-body">
          <div class="grid grid-2">
            <div class="form-group" style="grid-column:1/-1"><label class="form-label">Nombre</label><input v-model="form.name" class="form-control" maxlength="80" placeholder="Ej: Muslo, Coca-Cola 400 ml" /></div>
            <div class="form-group"><label class="form-label">Precio ($)</label><input v-model.number="form.price" type="number" min="0" step="100" class="form-control" /></div>
            <div class="form-group"><label class="form-label">Categoría</label>
              <select v-model="form.categoryId" class="form-control"><option v-for="c in cats" :key="c.id" :value="c.id">{{ c.name }}</option></select></div>
            <div class="form-group" style="grid-column:1/-1"><label class="form-label">Descripción corta (una línea)</label><input v-model="form.description" class="form-control" maxlength="160" placeholder="Ej: Presa, papa y arepa" /></div>
            <div class="form-group" style="grid-column:1/-1"><label class="ce-check"><input type="checkbox" v-model="form.alcohol" /> Lleva licor (pide confirmar que el cliente es mayor de 18)</label></div>
          </div>

          <div class="ce-gh">Opciones que escoge el cliente</div>
          <p class="ce-hint">Por ejemplo asado o apanado, las salsas, las adiciones y las bebidas. Son opcionales.</p>

          <div v-for="(g, gi) in form.groups" :key="g._k" class="ce-group">
            <div class="ce-g1">
              <input v-model="g.name" class="form-control" maxlength="40" placeholder="Nombre del grupo (Ej: Preparación)" />
              <select v-model="g.type" class="form-control" @change="onType(g)">
                <option value="one">Escoge UNA (asado o apanado)</option>
                <option value="many">Escoge VARIAS (salsas)</option>
                <option value="qty">Con cantidades (adiciones, bebidas)</option>
              </select>
              <button type="button" class="ce-ic" title="Quitar grupo" @click="form.groups.splice(gi, 1)">🗑</button>
            </div>
            <div class="ce-g2">
              <label v-if="g.type === 'one'" class="ce-check"><input type="checkbox" v-model="g.required" /> Obligatorio</label>
              <label v-if="g.type === 'many'" class="ce-check">Máximo <input v-model.number="g.max" type="number" min="1" max="20" class="ce-mini" /></label>
              <label v-if="g.type === 'qty'" class="ce-check"><input type="checkbox" v-model="g.collapsed" /> Se muestra cerrado (desplegable)</label>
              <div v-if="g.type === 'qty'" class="ce-seg">
                <button type="button" :class="{ on: g.mode === 'source' }" @click="g.mode = 'source'">Tomar de la carta</button>
                <button type="button" :class="{ on: g.mode === 'manual' }" @click="g.mode = 'manual'">Escribir a mano</button>
              </div>
            </div>

            <div v-if="g.mode === 'source'" class="ce-src">
              <p class="ce-hint">Las opciones salen de los productos de las categorías que marques. Si cambias un precio o agotas un producto, cambia en todos los combos.</p>
              <label v-for="c in cats" :key="c.id" class="ce-check"><input type="checkbox" :checked="g.source.includes(c.id)" @change="toggleSrc(g, c.id)" /> {{ c.name }} <small>({{ productsOf(c).length }})</small></label>
            </div>
            <div v-else class="ce-opts-edit">
              <details v-if="g.options.length > 12" :open="g._open" @toggle="g._open = $event.target.open"><summary>{{ g.options.length }} opciones (tocar para editar)</summary></details>
              <template v-if="g.options.length <= 12 || g._open">
                <div v-for="(o, oi) in g.options" :key="oi" class="ce-opt">
                  <input v-model="o.name" class="form-control" maxlength="60" placeholder="Opción" />
                  <input v-model.number="o.price" type="number" min="0" step="100" class="form-control" :placeholder="g.type === 'qty' ? 'Precio' : 'Suma ($)'" />
                  <button type="button" class="ce-ic" @click="g.options.splice(oi, 1)">✕</button>
                </div>
              </template>
              <button type="button" class="ce-btn" @click="g.options.push({ name: '', price: 0 }); g._open = true">+ Opción</button>
              <small v-if="g.type !== 'qty'" class="ce-hint2">En "Suma" pon lo que cuesta de más esa opción (0 si no cambia el precio).</small>
            </div>
          </div>

          <div class="ce-addg">
            <button type="button" class="ce-btn" @click="addGroup('one')">+ Escoger una</button>
            <button type="button" class="ce-btn" @click="addGroup('many')">+ Escoger varias</button>
            <button type="button" class="ce-btn" @click="addGroup('qty')">+ Cantidades</button>
            <select v-if="copyList.length" class="form-control ce-copy" v-model="copyPick" @change="copyGroup">
              <option value="">Copiar opciones de otro producto…</option>
              <option v-for="c in copyList" :key="c.key" :value="c.key">{{ c.label }}</option>
            </select>
          </div>
          <p v-if="err" class="ce-err">{{ err }}</p>
        </div>
        <div class="modal-footer"><button class="btn btn-outline" @click="form = null">Cancelar</button><button class="btn btn-primary" :disabled="saving" @click="saveProduct">{{ saving ? 'Guardando…' : 'Guardar producto' }}</button></div>
      </div>
    </div>
  </section>
</template>

<script setup>
/**
 * CartaEditor.vue — Editor de la carta para el admin: categorías, productos y opciones.
 * Los cambios de precio, agotado y visible se guardan al instante; crear/editar abre una ventana.
 */
import { ref, computed, inject } from 'vue'
import api from '../services/api.js'
import { useAuthStore } from '../stores/auth.js'

const props = defineProps({ carta: { type: Object, required: true } })
const emit = defineEmits(['reload'])
const auth = useAuthStore()
const toast = inject('toast', () => {})
const base = () => `/api/${auth.currentBusiness.id}/carta`

const EMOJIS = ['🍗', '🍔', '🍕', '🌮', '🍟', '🥗', '🍳', '🥟', '🍲', '🍰', '🍪', '☕', '🥤', '🍺', '💧', '🛒']
const saving = ref(false)
const err = ref('')
const catForm = ref(null)
const form = ref(null)
const copyPick = ref('')
let seq = 1

const cats = computed(() => [...(props.carta.categories || [])].sort((a, b) => a.order - b.order))
const productsOf = (cat) => (props.carta.products || []).filter(p => p.categoryId === cat.id).sort((a, b) => a.order - b.order)
const msg = (e, fb) => e.response?.data?.error || fb

// ── Cambios rápidos (precio, agotado, visible) ──
async function quick(p, body) {
  try { Object.assign(p, (await api.put(`${base()}/products/${p.id}`, body)).data) }
  catch (e) { toast(msg(e, 'No se pudo guardar'), 'error'); emit('reload') }
}

// ── Categorías ──
function openCat(c) { err.value = ''; catForm.value = c ? { id: c.id, name: c.name, emoji: c.emoji || '', group: c.group || '' } : { id: null, name: '', emoji: '', group: '' } }
async function saveCat() {
  saving.value = true; err.value = ''
  try {
    const f = catForm.value
    if (f.id) await api.put(`${base()}/categories/${f.id}`, { name: f.name, emoji: f.emoji, group: f.group })
    else await api.post(`${base()}/categories`, { name: f.name, emoji: f.emoji, group: f.group })
    catForm.value = null; emit('reload'); toast('Categoría guardada', 'success')
  } catch (e) { err.value = msg(e, 'No se pudo guardar') } finally { saving.value = false }
}
async function delCat(c) {
  if (!window.confirm(`¿Borrar la categoría "${c.name}"?`)) return
  try { await api.delete(`${base()}/categories/${c.id}`); emit('reload'); toast('Categoría borrada', 'success') }
  catch (e) { toast(msg(e, 'No se pudo borrar'), 'error') }
}
async function moveCat(i, d) {
  const ids = cats.value.map(c => c.id); const j = i + d; if (j < 0 || j >= ids.length) return
  ;[ids[i], ids[j]] = [ids[j], ids[i]]
  try { await api.post(`${base()}/categories/reorder`, { ids }); emit('reload') } catch (e) { toast(msg(e, 'No se pudo ordenar'), 'error') }
}

// ── Productos ──
async function moveProduct(cat, i, d) {
  const ids = productsOf(cat).map(p => p.id); const j = i + d; if (j < 0 || j >= ids.length) return
  ;[ids[i], ids[j]] = [ids[j], ids[i]]
  try { await api.post(`${base()}/products/reorder`, { ids }); emit('reload') } catch (e) { toast(msg(e, 'No se pudo ordenar'), 'error') }
}
async function delProduct(p) {
  if (!window.confirm(`¿Borrar "${p.name}" de la carta? (Si solo quieres esconderlo, desmarca "Visible".)`)) return
  try { await api.delete(`${base()}/products/${p.id}`); emit('reload'); toast('Producto borrado', 'success') }
  catch (e) { toast(msg(e, 'No se pudo borrar'), 'error') }
}

const newGroup = (type) => ({ _k: ++seq, id: null, name: '', type, required: type === 'one', max: 2, collapsed: type === 'qty', mode: type === 'qty' ? 'source' : 'manual',
  source: [], options: type === 'qty' ? [] : [{ name: '', price: 0 }, { name: '', price: 0 }], _open: false })
function fromServer(g) {
  return { _k: ++seq, id: g.id, name: g.name, type: g.type, required: !!g.required, max: g.max || 2, collapsed: !!g.collapsed, mode: g.source ? 'source' : 'manual',
    source: g.source ? [...g.source.categories] : [], options: (g.options || []).map(o => ({ ...o })), _open: false }
}
function toServer(g) {
  const out = { id: g.id || undefined, name: g.name, type: g.type }
  if (g.type === 'one') out.required = g.required
  if (g.type === 'many') out.max = g.max
  if (g.type === 'qty') out.collapsed = g.collapsed
  if (g.type === 'qty' && g.mode === 'source') out.source = { categories: g.source }
  else out.options = g.options.filter(o => String(o.name).trim()).map(o => ({ ...o, price: Number(o.price) || 0 }))
  return out
}
function openProduct(p, cat) {
  err.value = ''; copyPick.value = ''
  form.value = p
    ? { id: p.id, name: p.name, description: p.description || '', price: p.price, categoryId: p.categoryId, alcohol: !!p.alcohol, groups: (p.groups || []).map(fromServer) }
    : { id: null, name: '', description: '', price: 0, categoryId: cat?.id || cats.value[0]?.id, alcohol: false, groups: [] }
}
function addGroup(type) { form.value.groups.push(newGroup(type)) }
function onType(g) { if (g.type === 'qty') { g.mode = g.mode === 'source' || !g.options.length ? 'source' : 'manual' } else { g.mode = 'manual'; if (!g.options.length) g.options = [{ name: '', price: 0 }, { name: '', price: 0 }] } }
function toggleSrc(g, id) { const i = g.source.indexOf(id); if (i >= 0) g.source.splice(i, 1); else g.source.push(id) }

// Copiar un grupo de opciones de otro producto (con ids nuevos)
const copyList = computed(() => {
  const out = []
  for (const p of props.carta.products || []) for (const g of p.groups || []) {
    if (p.id === form.value?.id) continue
    out.push({ key: p.id + '|' + g.id, label: `${p.name} · ${g.name}`, p, g })
  }
  return out.slice(0, 200)
})
function copyGroup() {
  const it = copyList.value.find(c => c.key === copyPick.value); copyPick.value = ''
  if (!it) return
  const g = fromServer(it.g); g.id = null; g.options = g.options.map(({ id, ...o }) => o)
  form.value.groups.push(g)
}

async function saveProduct() {
  saving.value = true; err.value = ''
  try {
    const f = form.value
    const body = { name: f.name, description: f.description, price: Number(f.price) || 0, categoryId: f.categoryId, alcohol: !!f.alcohol, groups: f.groups.map(toServer) }
    if (f.id) await api.put(`${base()}/products/${f.id}`, body)
    else await api.post(`${base()}/products`, body)
    form.value = null; emit('reload'); toast('Producto guardado', 'success')
  } catch (e) { err.value = msg(e, 'No se pudo guardar el producto') } finally { saving.value = false }
}
</script>

<style scoped>
.ce { display: flex; flex-direction: column; gap: 10px; }
.ce-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.ce-head h3 { margin: 0; font-size: 16px; } .ce-btns { display: flex; gap: 6px; }
.ce-btn { border: 0; border-radius: 10px; padding: 8px 12px; font-weight: 700; font-size: 13px; cursor: pointer; color: #fff; background: #475569; } .ce-btn.main { background: #f59e0b; color: #1a0a00; } .ce-btn:disabled { opacity: .5; cursor: default; }
.ce-hint { color: var(--text-secondary); font-size: 13px; margin: 0; line-height: 1.4; } .ce-hint2 { color: var(--text-secondary); font-size: 12px; }
.ce-empty { color: var(--text-secondary); text-align: center; padding: 16px 0; margin: 0; } .ce-empty.small { padding: 6px 0; font-size: 13px; }
.ce-cat { border: 1px solid var(--border); border-radius: 12px; background: var(--surface); overflow: hidden; }
.ce-cat > header { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 12px; background: var(--surface-2); border-bottom: 1px solid var(--border); }
.ce-cname small { color: var(--text-secondary); margin-left: 6px; font-weight: 400; }
.ce-acts { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.ce-ic { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 8px; min-width: 30px; height: 30px; cursor: pointer; font-size: 13px; }
.ce-ic:disabled { opacity: .35; cursor: default; }
.ce-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.ce-row:last-child { border-bottom: 0; }
.ce-pn { flex: 1; min-width: 160px; font-size: 14px; } .ce-pn small { display: block; color: var(--text-secondary); font-size: 12px; } .ce-pn.off { text-decoration: line-through; opacity: .6; }
.ce-opts { color: var(--accent-hover) !important; }
.ce-price { width: 90px; text-align: right; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); }
.ce-sw { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer; } .ce-sw input { width: 16px; height: 16px; accent-color: #f59e0b; }
.ce-modal { max-width: 720px; width: 100%; max-height: 92vh; display: flex; flex-direction: column; } .ce-modal.narrow { max-width: 440px; }
.ce-body { overflow-y: auto; }
.ce-gh { font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--text-secondary); padding: 12px 0 4px; border-bottom: 1px solid var(--border); margin-bottom: 6px; }
.ce-group { border: 1px solid var(--border); border-radius: 12px; padding: 10px; margin: 8px 0; background: var(--surface-2); display: flex; flex-direction: column; gap: 8px; }
.ce-g1 { display: grid; grid-template-columns: 1fr 1fr auto; gap: 6px; align-items: center; }
.ce-g2 { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ce-check { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
.ce-mini { width: 54px; padding: 4px 6px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--text); }
.ce-seg { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-left: auto; }
.ce-seg button { border: 0; background: var(--surface); color: var(--text); padding: 5px 10px; font-size: 12px; cursor: pointer; } .ce-seg button.on { background: #f59e0b; color: #1a0a00; font-weight: 700; }
.ce-src { display: flex; flex-direction: column; gap: 6px; }
.ce-opts-edit { display: flex; flex-direction: column; gap: 6px; }
.ce-opt { display: grid; grid-template-columns: 1fr 110px auto; gap: 6px; }
.ce-addg { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 6px; } .ce-copy { max-width: 260px; }
.ce-emojis { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px; } .ce-emojis button { border: 1px solid var(--border); background: var(--surface-2); border-radius: 8px; width: 34px; height: 34px; font-size: 18px; cursor: pointer; }
.ce-err { color: var(--danger); font-weight: 600; font-size: 13px; margin: 8px 0 0; }
@media (max-width: 640px) { .ce-g1 { grid-template-columns: 1fr; } }
</style>
