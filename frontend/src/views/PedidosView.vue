<template>
  <PageLayout title="Pedidos en línea">
    <div class="pv">
      <!-- Barra superior -->
      <div class="pv-top">
        <div class="pv-tabs">
          <button :class="{ on: tab === 'pedidos' }" @click="tab = 'pedidos'">Pedidos <span v-if="pending.length" class="pv-n">{{ pending.length }}</span></button>
          <button :class="{ on: tab === 'carta' }" @click="tab = 'carta'; loadCarta()">Carta</button>
        </div>
        <div class="pv-actions">
          <button class="pv-chip" :class="{ on: soundOn }" @click="pend.toggleSound()">{{ soundOn ? '🔔 Sonido' : '🔕 Sin sonido' }}</button>
          <button class="pv-chip" @click="copyLink">🔗 Copiar link de la carta</button>
        </div>
      </div>

      <!-- Estado de la tienda -->
      <div v-if="carta" class="pv-store">
        <label class="pv-sw"><input type="checkbox" :checked="carta.settings.open" @change="setSetting({ open: $event.target.checked })" /><span>{{ carta.settings.open ? 'Abierto' : 'Cerrado' }}</span></label>
        <label class="pv-sw"><input type="checkbox" :checked="carta.settings.paused" @change="setSetting({ paused: $event.target.checked })" /><span>Pausar pedidos</span></label>
      </div>

      <!-- ── PEDIDOS ── -->
      <template v-if="tab === 'pedidos'">
        <div class="pv-filter">
          <button :class="{ on: view === 'activos' }" @click="view = 'activos'">Activos ({{ active.length }})</button>
          <button :class="{ on: view === 'cerrados' }" @click="view = 'cerrados'">Entregados / cerrados</button>
        </div>

        <p v-if="loaded && !shown.length" class="pv-empty">{{ view === 'activos' ? 'No hay pedidos activos. Cuando llegue uno, suena aquí.' : 'Todavía no hay pedidos cerrados.' }}</p>

        <article v-for="p in shown" :key="p.id" :class="['pv-card', 's-' + p.status]">
          <header>
            <div>
              <b class="pv-code">#{{ p.code }}</b>
              <span class="pv-badge">{{ stateLabel(p) }}</span>
              <span v-if="p.mode === 'recoger'" class="pv-badge alt">Recoge en el local</span>
            </div>
            <small>{{ ago(p.createdAt) }}<template v-if="p.status === 'por_confirmar'"> · vence en {{ left(p.expiresAt) }}</template></small>
          </header>

          <div class="pv-cust">
            <b>{{ p.customer.name }}</b> · <a :href="'tel:' + p.customer.phone">{{ p.customer.phone }}</a>
            <div v-if="p.customer.address">📍 {{ p.customer.address }}</div>
            <div v-if="p.customer.notes" class="pv-note">“{{ p.customer.notes }}”</div>
          </div>

          <ul class="pv-lines">
            <li v-for="(l, i) in p.lines" :key="i" :class="{ extra: l.kind === 'adicion' }">
              <span>{{ l.qty }} × {{ l.name }}<small v-if="l.choices && l.choices.length"> ({{ l.choices.join(', ') }})</small><em v-if="l.note"> — “{{ l.note }}”</em></span>
              <b>{{ money(l.total) }}</b>
            </li>
          </ul>

          <div class="pv-money">
            <div><span>Subtotal</span><b>{{ money(p.subtotal) }}</b></div>
            <div v-if="p.mode === 'domicilio'" class="pv-fee">
              <span>Domicilio<template v-if="p.freeDelivery"> (gratis, compra ≥ {{ money(carta?.settings.freeDeliveryFrom || 100000) }})</template></span>
              <template v-if="isOpen(p)">
                <input type="number" min="0" step="500" :value="feeInput[p.id] ?? (p.deliveryFee ?? '')" placeholder="$" @input="feeInput[p.id] = $event.target.value" />
              </template>
              <b v-else>{{ money(p.deliveryFee) }}</b>
            </div>
            <div class="tot"><span>Total</span><b>{{ money(totalOf(p)) }}</b></div>
            <small>{{ p.payment === 'efectivo' ? '💵 Efectivo' + (p.cashFor ? ' · paga con ' + money(p.cashFor) + (p.cashFor >= totalOf(p) ? ' · devuelve ' + money(p.cashFor - totalOf(p)) : '') : '') : '🏦 Transferencia' }}</small>
          </div>

          <footer v-if="isOpen(p)">
            <button class="pv-btn main" :disabled="busy === p.id" @click="advance(p)">{{ NEXT[nextOf(p)] || '' }}</button>
            <a class="pv-btn wa" :href="waLink(p)" target="_blank" rel="noopener">WhatsApp al cliente</a>
            <button class="pv-btn danger" :disabled="busy === p.id" @click="cancel(p)">Cancelar</button>
          </footer>
          <footer v-else-if="p.invoiceNumber"><small>Factura {{ p.invoiceNumber }}</small></footer>
          <footer v-else-if="p.status === 'vencido'">
            <button class="pv-btn main" :disabled="busy === p.id" @click="advance(p, 'pendiente')">Confirmar igual</button>
          </footer>
        </article>
      </template>

      <!-- ── CARTA ── -->
      <template v-else-if="carta">
        <section v-if="isAdmin" class="pv-set">
          <h3>Ajustes</h3>
          <label>WhatsApp del negocio <input v-model="set.whatsapp" inputmode="tel" placeholder="3001234567" /></label>
          <label>Domicilio gratis desde ($) <input v-model.number="set.freeDeliveryFrom" type="number" min="0" step="1000" /></label>
          <label>Horario (texto visible al cliente) <input v-model="set.hours" maxlength="120" placeholder="Lun a Dom 11 am – 10 pm" /></label>
          <label class="chk"><input type="checkbox" v-model="set.pickup" /> Permitir “recoger en el local”</label>
          <button class="pv-btn main" @click="saveSettings">Guardar ajustes</button>
        </section>

        <h3 class="pv-h">Productos</h3>
        <p class="pv-hint">Marca <b>Agotado</b> lo que se acabó: desaparece del pedido al instante.<template v-if="isAdmin"> Toca el precio para cambiarlo.</template></p>
        <div v-for="c in carta.categories" :key="c.id" class="pv-cat">
          <h4>{{ c.name }}</h4>
          <div v-for="p in carta.products.filter(x => x.categoryId === c.id)" :key="p.id" class="pv-prow">
            <span :class="{ off: !p.active }">{{ p.name }}</span>
            <input v-if="isAdmin" class="pv-price" type="number" min="0" step="100" :value="p.price" @change="savePrice(p, $event.target.value)" />
            <b v-else>{{ money(p.price) }}</b>
            <label class="pv-sw sm"><input type="checkbox" :checked="p.soldOut" @change="patch(p, { soldOut: $event.target.checked })" /><span>Agotado</span></label>
            <label v-if="isAdmin" class="pv-sw sm"><input type="checkbox" :checked="p.active" @change="patch(p, { active: $event.target.checked })" /><span>Visible</span></label>
          </div>
        </div>
        <section v-if="isAdmin" class="pv-set">
          <h3>Precio de bebidas y adiciones (en todos los combos)</h3>
          <div v-for="n in extraNames" :key="n" class="pv-prow">
            <span>{{ n }}</span>
            <input class="pv-price" type="number" min="0" step="100" :value="extraPrice(n)" @change="saveExtra(n, $event.target.value)" />
          </div>
        </section>
      </template>
      <p v-else-if="tab === 'carta'" class="pv-empty">Cargando…</p>
    </div>
  </PageLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, inject } from 'vue'
import PageLayout from '../components/PageLayout.vue'
import api from '../services/api.js'
import { useAuthStore } from '../stores/auth.js'
import { usePedidos } from '../composables/usePedidos.js'

const auth = useAuthStore()
const toast = inject('toast', () => {})
const pend = usePedidos()
const { pedidos, pending, active, loaded, soundOn } = pend
const tab = ref('pedidos')
const view = ref('activos')
const carta = ref(null)
const set = reactive({ whatsapp: '', freeDeliveryFrom: 0, hours: '', pickup: true })
const feeInput = reactive({})
const busy = ref('')
const now = ref(Date.now())
let tick = null

const isAdmin = computed(() => auth.user?.role === 'admin' || auth.user?.role === 'superadmin')
const base = () => `/api/${auth.currentBusiness.id}`
const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO')

const STATE = { por_confirmar: 'Por confirmar', pendiente: 'Pendiente', en_preparacion: 'En preparación', en_camino: 'En camino', entregado: 'Entregado', cancelado: 'Cancelado', vencido: 'Vencido' }
const NEXT = { pendiente: 'Confirmar pedido', en_preparacion: 'Empezar a preparar', en_camino: 'Sale a domicilio', listo: 'Listo para recoger', entregado: 'Entregado y facturar' }
const stateLabel = (p) => (p.mode === 'recoger' && p.status === 'en_camino') ? 'Listo para recoger' : STATE[p.status]
const isOpen = (p) => ['por_confirmar', 'pendiente', 'en_preparacion', 'en_camino'].includes(p.status)

const shown = computed(() => pedidos.value.filter(p => view.value === 'activos' ? isOpen(p) : !isOpen(p)))
const totalOf = (p) => p.subtotal + (Number(feeInput[p.id] ?? p.deliveryFee) || 0)

function nextOf(p) {
  if (p.status === 'por_confirmar') return 'pendiente'
  if (p.status === 'pendiente') return 'en_preparacion'
  if (p.status === 'en_preparacion') return p.mode === 'domicilio' ? 'en_camino' : 'listo'
  return 'entregado'
}

function ago(iso) {
  const m = Math.max(0, Math.round((now.value - new Date(iso).getTime()) / 60000))
  return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : `hace ${Math.floor(m / 60)} h`
}
function left(iso) {
  const s = Math.max(0, Math.round((new Date(iso).getTime() - now.value) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

async function advance(p, forced) {
  let target = forced || nextOf(p)
  // "Listo para recoger" es el paso anterior a entregado en pedidos para recoger
  const body = {}
  if (p.mode === 'domicilio') {
    const v = feeInput[p.id] ?? p.deliveryFee
    if (v === '' || v === null || v === undefined) { toast('Escribe el valor del domicilio (0 si es gratis).', 'warning'); return }
    body.deliveryFee = Number(v)
  }
  if (target === 'listo') target = 'en_camino'
  body.status = target
  busy.value = p.id
  try {
    const r = await pend.update(p.id, body)
    if (r.sale) toast(`Factura ${r.sale.invoiceNumber} creada`, 'success')
  } catch (e) { toast(e.response?.data?.error || 'No se pudo actualizar el pedido', 'error') }
  finally { busy.value = '' }
}
async function cancel(p) {
  if (!window.confirm(`¿Cancelar el pedido #${p.code} de ${p.customer.name}?`)) return
  busy.value = p.id
  try { await pend.update(p.id, { status: 'cancelado' }) }
  catch (e) { toast(e.response?.data?.error || 'No se pudo cancelar', 'error') }
  finally { busy.value = '' }
}

/** Mensaje para el cliente con el total (y pedirle la ubicación si falta el domicilio) */
function waLink(p) {
  const fee = Number(feeInput[p.id] ?? p.deliveryFee)
  const hasFee = p.mode === 'domicilio' && !Number.isNaN(fee) && (feeInput[p.id] ?? p.deliveryFee) !== '' && (feeInput[p.id] ?? p.deliveryFee) !== null
  const lines = [`Hola ${p.customer.name}, recibimos tu pedido #${p.code}.`, `Productos: ${money(p.subtotal)}`]
  if (p.mode === 'domicilio') {
    if (hasFee) lines.push(fee === 0 ? 'Domicilio: gratis' : `Domicilio: ${money(fee)}`)
    else lines.push('¿Nos compartes tu ubicación para calcular el domicilio?')
  }
  if (p.mode !== 'domicilio' || hasFee) lines.push(`*Total a pagar: ${money(totalOf(p))}*`, '¿Lo confirmamos?')
  let ph = p.customer.phone.replace(/\D/g, '')
  if (ph.length === 10) ph = '57' + ph
  return `https://wa.me/${ph}?text=${encodeURIComponent(lines.join('\n'))}`
}

// ── Carta ──
async function loadCarta() {
  try {
    const { data } = await api.get(`${base()}/carta`)
    carta.value = data
    Object.assign(set, { whatsapp: data.settings.whatsapp.replace(/^57/, ''), freeDeliveryFrom: data.settings.freeDeliveryFrom, hours: data.settings.hours, pickup: data.settings.pickup })
  } catch { toast('No se pudo cargar la carta', 'error') }
}
async function setSetting(body) {
  try { const { data } = await api.put(`${base()}/carta/settings`, body); carta.value.settings = data }
  catch (e) { toast(e.response?.data?.error || 'No se pudo guardar', 'error'); await loadCarta() }
}
async function saveSettings() {
  try {
    const { data } = await api.put(`${base()}/carta/settings`, { whatsapp: set.whatsapp, freeDeliveryFrom: set.freeDeliveryFrom, hours: set.hours, pickup: set.pickup })
    carta.value.settings = data; toast('Ajustes guardados', 'success')
  } catch (e) { toast(e.response?.data?.error || 'No se pudo guardar', 'error') }
}
async function patch(p, body) {
  try { Object.assign(p, (await api.put(`${base()}/carta/products/${p.id}`, body)).data) }
  catch (e) { toast(e.response?.data?.error || 'No se pudo guardar', 'error'); await loadCarta() }
}
async function savePrice(p, v) { await patch(p, { price: Number(v) }); toast('Precio guardado', 'success') }

// Opciones compartidas (bebidas y adiciones): un solo precio para todos los combos
const extraNames = computed(() => {
  const s = new Set()
  for (const p of carta.value?.products || []) for (const g of p.groups || []) if (g.type === 'qty') g.options.forEach(o => s.add(o.name))
  return [...s]
})
function extraPrice(n) {
  for (const p of carta.value.products) for (const g of p.groups || []) { const o = g.type === 'qty' && g.options.find(x => x.name === n); if (o) return o.price }
  return 0
}
async function saveExtra(n, v) {
  try { await api.put(`${base()}/carta/option-price`, { name: n, price: Number(v) }); await loadCarta(); toast('Precio guardado en todos los combos', 'success') }
  catch (e) { toast(e.response?.data?.error || 'No se pudo guardar', 'error') }
}

async function copyLink() {
  const slug = auth.currentBusiness?.slug || 'deli-combos'
  const url = `${window.location.origin}/carta/${slug}`
  try { await navigator.clipboard.writeText(url); toast('Link copiado: ' + url, 'success') }
  catch { window.prompt('Copia este link:', url) }
}

onMounted(() => {
  pend.start()
  loadCarta()
  tick = setInterval(() => { now.value = Date.now() }, 1000)
})
onUnmounted(() => clearInterval(tick))
</script>

<style scoped>
.pv { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
.pv-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.pv-tabs, .pv-filter { display: flex; gap: 6px; }
.pv-tabs button, .pv-filter button, .pv-chip { border: 1px solid var(--border); background: var(--surface); color: inherit; border-radius: 999px; padding: 7px 14px; font-weight: 600; font-size: 13px; cursor: pointer; }
.pv-tabs button.on, .pv-filter button.on, .pv-chip.on { background: #f59e0b; border-color: #f59e0b; color: #1a0a00; }
.pv-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.pv-n { background: #ef4444; color: #fff; border-radius: 999px; padding: 1px 7px; font-size: 11px; margin-left: 4px; }
.pv-store { display: flex; gap: 16px; flex-wrap: wrap; padding: 10px 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
.pv-sw { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; cursor: pointer; }
.pv-sw.sm { font-size: 12px; font-weight: 500; }
.pv-sw input { width: 18px; height: 18px; accent-color: #f59e0b; }
.pv-empty, .pv-hint { color: var(--text-secondary); font-size: 14px; text-align: center; padding: 20px 0; margin: 0; }
.pv-hint { text-align: left; padding: 0; font-size: 13px; }
.pv-card { border: 1px solid var(--border); border-left: 5px solid #94a3b8; border-radius: 14px; background: var(--surface); padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.pv-card.s-por_confirmar { border-left-color: #ef4444; } .pv-card.s-pendiente { border-left-color: #f59e0b; }
.pv-card.s-en_preparacion { border-left-color: #3b82f6; } .pv-card.s-en_camino { border-left-color: #8b5cf6; }
.pv-card.s-entregado { border-left-color: #22c55e; } .pv-card.s-cancelado, .pv-card.s-vencido { opacity: .65; }
.pv-card header { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.pv-code { font-size: 22px; margin-right: 8px; }
.pv-badge { font-size: 11px; font-weight: 700; background: var(--border); color: var(--text); border-radius: 999px; padding: 3px 10px; margin-right: 4px; }
.pv-badge.alt { background: #0e7490; }
.pv-cust { font-size: 14px; line-height: 1.5; } .pv-cust a { color: inherit; } .pv-note { font-style: italic; color: var(--text-secondary); }
.pv-lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
.pv-lines li { display: flex; justify-content: space-between; gap: 10px; } .pv-lines li.extra { padding-left: 14px; color: var(--text-secondary); }
.pv-lines small, .pv-lines em { color: var(--text-secondary); font-style: normal; }
.pv-money { border-top: 1px dashed var(--border); padding-top: 8px; display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
.pv-money > div { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.pv-money .tot { font-size: 17px; } .pv-money small { color: var(--text-secondary); }
.pv-fee input { width: 110px; text-align: right; padding: 6px 8px; border-radius: 8px; border: 1px solid #f59e0b; background: var(--surface-2); color: inherit; font-weight: 700; }
.pv-card footer { display: flex; gap: 8px; flex-wrap: wrap; }
.pv-btn { border: 0; border-radius: 10px; padding: 10px 14px; font-weight: 700; font-size: 14px; cursor: pointer; text-decoration: none; color: #fff; background: #475569; }
.pv-btn.main { background: #f59e0b; color: #1a0a00; flex: 1; min-width: 150px; } .pv-btn.wa { background: #16a34a; } .pv-btn.danger { background: #7f1d1d; }
.pv-btn:disabled { opacity: .5; }
.pv-set { border: 1px solid var(--border); border-radius: 14px; padding: 14px; background: var(--surface); display: flex; flex-direction: column; gap: 10px; }
.pv-set h3, .pv-h { margin: 0; font-size: 15px; }
.pv-set label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-secondary); }
.pv-set label.chk { flex-direction: row; align-items: center; gap: 8px; }
.pv-set input:not([type=checkbox]), .pv-price { padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2); color: inherit; }
.pv-cat h4 { margin: 10px 0 4px; font-size: 13px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .04em; }
.pv-prow { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
.pv-prow > span { flex: 1; min-width: 0; } .pv-prow .off { text-decoration: line-through; opacity: .6; }
.pv-price { width: 90px; text-align: right; }
</style>
