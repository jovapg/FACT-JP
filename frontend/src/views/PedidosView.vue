<template>
  <PageLayout title="Pedidos en línea">
    <div class="pv">
      <!-- Barra superior -->
      <div class="pv-top">
        <div class="pv-tabs">
          <button :class="{ on: tab === 'pedidos' }" @click="tab = 'pedidos'">Pedidos <span v-if="pending.length" class="pv-n">{{ pending.length }}</span></button>
          <button v-if="!readOnly" :class="{ on: tab === 'carta' }" @click="tab = 'carta'; loadCarta()">Carta</button>
        </div>
        <div class="pv-actions">
          <button class="pv-chip" :class="{ on: soundOn }" @click="pend.toggleSound()">{{ soundOn ? '🔔 Sonido' : '🔕 Sin sonido' }}</button>
          <button class="pv-chip" title="Escucha cómo suena un pedido nuevo" @click="pend.testSound()">🔊 Probar sonido</button>
          <button v-if="!readOnly" class="pv-chip" @click="copyLink">🔗 Copiar link de la carta</button>
        </div>
      </div>

      <!-- Sin turno de caja abierto los pedidos entran, pero no se pueden facturar -->
      <div v-if="shiftOpen === false && !readOnly" class="pv-noshift">
        <span>⚠️ <b>No hay turno de caja abierto.</b> Los pedidos siguen entrando y se pueden confirmar y entregar, pero <b>no se pueden facturar</b> hasta que abras el turno.</span>
        <router-link to="/shifts" class="pv-btn main">Abrir turno</router-link>
      </div>

      <!-- Estado de la tienda -->
      <div v-if="carta && !readOnly" class="pv-store">
        <label class="pv-sw"><input type="checkbox" :checked="carta.settings.open" @change="setSetting({ open: $event.target.checked })" /><span>{{ carta.settings.open ? 'Abierto' : 'Cerrado' }}</span></label>
        <label class="pv-sw"><input type="checkbox" :checked="carta.settings.paused" @change="setSetting({ paused: $event.target.checked })" /><span>Pausar pedidos</span></label>
      </div>

      <!-- ── PEDIDOS ── -->
      <template v-if="tab === 'pedidos'">
        <!-- Mini tablero (pedidos de hoy). Toca una tarjeta para filtrar la lista. -->
        <div class="pv-stats">
          <button v-for="s in stats" :key="s.key" type="button" :class="['pv-stat', 'k-' + s.key, { on: statusFilter === s.key }]" @click="toggleFilter(s.key)">
            <b>{{ s.n }}</b><span>{{ s.label }}</span><small v-if="s.sum !== undefined">{{ money(s.sum) }}</small>
          </button>
        </div>
        <div v-if="statusFilter" class="pv-filterbar">
          <span>Filtrando: <b>{{ stats.find(s => s.key === statusFilter)?.label }}</b></span>
          <button type="button" class="pv-chip on" @click="clearFilter">✕ Ver todos</button>
        </div>

        <h3 class="pv-h">Pedidos en curso ({{ shown.length }})</h3>
        <p v-if="loaded && !shown.length" class="pv-empty">No hay pedidos en curso. Cuando llegue uno, suena aquí.</p>

        <article v-for="p in shown" :key="p.id" :class="['pv-card', 's-' + p.status, p.status === 'entregado' && 's-porfact']">
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
              <template v-if="isOpen(p) && !readOnly">
                <span v-if="carta?.settings.deliveryPerKm" class="pv-km" :title="'Tarifa: ' + money(carta.settings.deliveryPerKm) + ' por km'">
                  <input type="number" min="0" step="0.1" placeholder="km" @input="setKm(p, $event.target.value)" /> km ×
                  {{ money(carta.settings.deliveryPerKm) }} =
                </span>
                <input type="number" min="0" step="500" :value="feeInput[p.id] ?? (p.deliveryFee ?? '')" placeholder="$" @input="feeInput[p.id] = $event.target.value" />
              </template>
              <b v-else>{{ money(p.deliveryFee) }}</b>
            </div>
            <div class="tot"><span>Total</span><b>{{ money(totalOf(p)) }}</b></div>
            <small v-if="p.status !== 'entregado'">{{ p.payment === 'efectivo' ? '💵 Dice que paga en efectivo' + (p.cashFor ? ' · con ' + money(p.cashFor) + (p.cashFor >= totalOf(p) ? ' · devuelve ' + money(p.cashFor - totalOf(p)) : '') : '') : '🏦 Dice que paga por transferencia' }}</small>
            <small v-else>Entregado {{ ago(p.deliveredAt || p.updatedAt) }}<template v-if="p.deliveredBy"> por {{ p.deliveredBy }}</template></small>
          </div>

          <footer v-if="canAct(p)">
            <!-- ¿Cómo te pagaron? (obligatorio al entregar; al facturar ya viene fijado) -->
            <div v-if="p.status === 'en_camino' || p.status === 'entregado' || !readOnly" :class="['pv-pay', needPay === p.id && 'warn']">
              <span>{{ p.status === 'entregado' ? 'Método de pago' : '¿Cómo te pagaron?' }}</span>
              <button :class="{ on: payOf(p) === 'efectivo' }" @click="payInput[p.id] = 'efectivo'">💵 Efectivo</button>
              <button :class="{ on: payOf(p) === 'transferencia' }" @click="payInput[p.id] = 'transferencia'">🏦 Transferencia</button>
            </div>
            <button v-if="p.status === 'entregado'" class="pv-btn main" :disabled="busy === p.id" @click="facturar(p)">Facturar · {{ money(totalOf(p)) }}</button>
            <button v-else class="pv-btn main" :disabled="busy === p.id" @click="advance(p)">{{ actionLabel(p) }}</button>
            <!-- Atajo para admin/caja: marcar entregado sin pasar por los estados intermedios (exige método de pago) -->
            <button v-if="!readOnly && ['por_confirmar', 'pendiente', 'en_preparacion'].includes(p.status)" class="pv-btn ok" :disabled="busy === p.id" @click="advance(p, 'entregado')">✓ Marcar entregado</button>
            <a v-if="!readOnly && p.status !== 'entregado'" class="pv-btn wa" :href="waLink(p)" target="_blank" rel="noopener">WhatsApp al cliente</a>
            <button v-if="!readOnly && p.status !== 'entregado'" class="pv-btn danger" :disabled="busy === p.id" @click="cancel(p)">Cancelar</button>
          </footer>
        </article>

        <!-- ── HISTORIAL ── -->
        <h3 class="pv-h">Historial<small v-if="domisHoy" class="pv-hcount"> · 🛵 {{ domisHoy }} domicilio{{ domisHoy === 1 ? '' : 's' }} entregado{{ domisHoy === 1 ? '' : 's' }} hoy</small></h3>
        <p v-if="loaded && !history.length" class="pv-empty">Todavía no hay pedidos facturados, cancelados o vencidos.</p>
        <div v-if="history.length" class="pv-hist">
          <div v-for="p in history" :key="p.id" class="pv-hrow">
            <div class="pv-hmain">
              <b>#{{ p.code }}</b> {{ p.customer.name }}
              <small>{{ dateTime(p.createdAt) }} · {{ p.mode === 'recoger' ? '🏪 Recoger' : '🛵 Domicilio' + (domiNum[p.id] ? ' #' + domiNum[p.id] : '') }}<template v-if="p.status === 'entregado'"> · {{ p.payment === 'efectivo' ? '💵' : '🏦' }} {{ p.payment }}</template></small>
            </div>
            <div class="pv-hside">
              <b>{{ money(p.subtotal + (Number(p.deliveryFee) || 0)) }}</b>
              <span :class="['pv-badge', 'h-' + p.status]">{{ p.status === 'entregado' ? 'Facturado ' + (p.invoiceNumber || '') : STATE[p.status] }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- ── CARTA ── -->
      <template v-else-if="carta">
        <section v-if="isAdmin" class="pv-set">
          <h3>Ajustes</h3>
          <label>WhatsApp del negocio <input v-model="set.whatsapp" inputmode="tel" placeholder="3001234567" /></label>
          <label>Domicilio gratis desde ($) <input v-model.number="set.freeDeliveryFrom" type="number" min="0" step="1000" /></label>
          <label>Dirección del negocio (la ve el cliente) <input v-model="set.address" maxlength="160" /></label>
          <label>Horario (texto visible al cliente) <input v-model="set.hours" maxlength="220" placeholder="Todos los días de 7 am a 8 pm" /></label>
          <div class="pv-two">
            <label>Recibir pedidos desde <input v-model="set.openFrom" type="time" /></label>
            <label>hasta <input v-model="set.openTo" type="time" /></label>
          </div>
          <small class="pv-hint">Fuera de esa hora la carta se ve cerrada sola. Déjalo vacío para no limitar por hora. Los días sin servicio (el primer día hábil de la semana, festivos) se manejan con el interruptor <b>Abierto</b> de arriba.</small>
          <label>Tarifa por kilómetro del domicilio ($) <input v-model.number="set.deliveryPerKm" type="number" min="0" step="100" /></label>
          <label>Texto del domicilio (lo ve el cliente) <input v-model="set.deliveryNote" maxlength="220" /></label>
          <label>Datos para transferir (separa con ·) <input v-model="set.bankInfo" maxlength="160" placeholder="BBVA · Llave: @tullave" /></label>
          <small class="pv-hint">El QR de pago se sube en Configuración y aparece solo en la carta cuando el cliente escoge transferencia.</small>
          <label class="chk"><input type="checkbox" v-model="set.pickup" /> Permitir “recoger en el local”</label>
          <button class="pv-btn main" @click="saveSettings">Guardar ajustes</button>
        </section>

        <section v-if="isAdmin" class="pv-set">
          <h3>Inventario</h3>
          <small class="pv-hint">Crea en el inventario los productos de la carta. Lo que se <b>prepara al momento</b> (presas, combos, desayunos, fritos…) queda <b>sin control de stock</b>, siempre disponible. Lo <b>empacado</b> (bebidas, papas, snacks, pasteles) queda con <b>stock 0</b>: sale agotado hasta que cargues cuánto tienes. Al facturar, el stock baja solo. No duplica los que ya existan.</small>
          <button class="pv-btn main" :disabled="syncing" @click="syncInventory">{{ syncing ? 'Registrando…' : '📦 Registrar productos en inventario' }}</button>
        </section>

        <CartaEditor v-if="isAdmin" :carta="carta" @reload="loadCarta" />

        <template v-if="!isAdmin">
        <h3 class="pv-h">Productos</h3>
        <p class="pv-hint">Marca <b>Agotado</b> lo que se acabó: desaparece del pedido al instante.</p>
        <div v-for="c in carta.categories" :key="c.id" class="pv-cat">
          <h4>{{ c.name }}</h4>
          <div v-for="p in carta.products.filter(x => x.categoryId === c.id)" :key="p.id" class="pv-prow">
            <span :class="{ off: !p.active }">{{ p.name }}</span>
            <input v-if="isAdmin" class="pv-price" type="number" min="0" step="100" :value="p.price" @change="savePrice(p, $event.target.value)" />
            <b v-else>{{ money(p.price) }}</b>
            <label class="pv-sw sm"><input type="checkbox" :checked="p.soldOut" @change="patch(p, { soldOut: $event.target.checked })" /><span>Agotado</span></label>
            <label v-if="isAdmin" class="pv-sw sm"><input type="checkbox" :checked="p.active" @change="patch(p, { active: $event.target.checked })" /><span>Visible</span></label>
            <label v-if="isAdmin" class="pv-sw sm" title="Sale en “Los más pedidos” de la carta (necesita foto)"><input type="checkbox" :checked="p.featured" @change="patch(p, { featured: $event.target.checked })" /><span>Más pedido</span></label>
          </div>
        </div>
        </template>
        <section v-if="isAdmin" class="pv-set">
          <h3>Precio de bebidas y adiciones (en todos los combos)</h3>
          <div v-for="n in extraNames" :key="n" class="pv-prow">
            <span>{{ n }}</span>
            <input class="pv-price" type="number" min="0" step="100" :value="extraPrice(n)" @change="saveExtra(n, $event.target.value)" />
          </div>
        </section>
      </template>
      <p v-else-if="tab === 'carta'" class="pv-empty">Cargando…</p>

      <InvoiceDone v-if="doneSale" :sale="doneSale" :phone="donePhone" @close="doneSale = null" />
    </div>
  </PageLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, inject } from 'vue'
import PageLayout from '../components/PageLayout.vue'
import InvoiceDone from '../components/InvoiceDone.vue'
import CartaEditor from '../components/CartaEditor.vue'
import api from '../services/api.js'
import { useAuthStore } from '../stores/auth.js'
import { usePedidos } from '../composables/usePedidos.js'

const auth = useAuthStore()
const toast = inject('toast', () => {})
const pend = usePedidos()
const { pedidos, pending, active, loaded, soundOn } = pend
const tab = ref('pedidos')
const needPay = ref('')      // pedido al que le falta escoger el método de pago (se resalta)
const shiftOpen = ref(null)  // null = aún no se sabe; false = no hay turno abierto
const doneSale = ref(null)  // factura recién creada (se muestra para enviarla)
const donePhone = ref('')
const statusFilter = ref('')
const payInput = reactive({})
const carta = ref(null)
const set = reactive({ whatsapp: '', freeDeliveryFrom: 0, hours: '', pickup: true, address: '', bankInfo: '', deliveryNote: '', deliveryPerKm: 0, openFrom: '', openTo: '' })
const feeInput = reactive({})
const busy = ref('')
const now = ref(Date.now())
let tick = null
let shiftTimer = null

// El domiciliario solo mira: sin botones, sin carta, sin valores editables
const readOnly = computed(() => auth.user?.role === 'domiciliario')
const isAdmin = computed(() => auth.user?.role === 'admin' || auth.user?.role === 'superadmin')
const base = () => `/api/${auth.currentBusiness.id}`
const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO')

const STATE = { por_confirmar: 'Por confirmar', pendiente: 'Confirmado', en_preparacion: 'En preparación', en_camino: 'En camino', entregado: 'Entregado', cancelado: 'Cancelado', vencido: 'Vencido' }
const stateLabel = (p) => {
  if (p.status === 'entregado') return p.saleId ? 'Facturado' : 'Entregado · por facturar'
  return (p.mode === 'recoger' && p.status === 'en_camino') ? 'Listo para recoger' : STATE[p.status]
}
// En curso = en proceso + entregados que faltan por facturar
const isOpen = (p) => ['por_confirmar', 'pendiente', 'en_preparacion', 'en_camino'].includes(p.status) || (p.status === 'entregado' && !p.saleId)
// Qué puede hacer quien mira: el domiciliario solo "salí" y "entregado" en domicilios ya en preparación o en camino
const canAct = (p) => readOnly.value ? (p.mode === 'domicilio' && ['en_preparacion', 'en_camino'].includes(p.status)) : isOpen(p)

const shown = computed(() => pedidos.value.filter(p => isOpen(p) && (!statusFilter.value || bucketOf(p) === statusFilter.value)))
const history = computed(() => pedidos.value.filter(p => !isOpen(p) && (!statusFilter.value || bucketOf(p) === statusFilter.value)).slice(0, 60))
const totalOf = (p) => p.subtotal + (Number(feeInput[p.id] ?? p.deliveryFee) || 0)
const payOf = (p) => payInput[p.id] ?? (p.status === 'entregado' ? p.payment : '')

// Grupo del tablero al que pertenece un pedido
function bucketOf(p) {
  if (p.status === 'entregado') return p.saleId ? 'facturado' : 'porfacturar'
  if (p.status === 'cancelado' || p.status === 'vencido') return 'cerrado'
  if (p.status === 'en_preparacion') return 'preparacion'
  if (p.status === 'en_camino') return 'camino'
  if (p.status === 'pendiente') return 'confirmado'
  return 'porconfirmar'
}
const todayStr = ref(new Date().toDateString())   // cambia solo al pasar la medianoche
const isToday = (iso) => new Date(iso).toDateString() === todayStr.value
function toggleFilter(k) { statusFilter.value = statusFilter.value === k ? '' : k }
function clearFilter() { statusFilter.value = '' }
// Mini tablero: pedidos de hoy (lo que sigue en curso se cuenta aunque venga de ayer)
const stats = computed(() => {
  const rows = [
    { key: 'porconfirmar', label: 'Por confirmar' }, { key: 'confirmado', label: 'Confirmados' },
    { key: 'preparacion', label: 'En preparación' }, { key: 'camino', label: 'En camino' },
    { key: 'porfacturar', label: 'Por facturar' }, { key: 'facturado', label: 'Facturados hoy' },
    { key: 'cerrado', label: 'Cancelados / vencidos' }
  ].map(r => ({ ...r, n: 0, sum: undefined }))
  const by = Object.fromEntries(rows.map(r => [r.key, r]))
  for (const p of pedidos.value) {
    const k = bucketOf(p)
    const open = isOpen(p)
    if (!open && !isToday(p.createdAt)) continue
    by[k].n++
    if (k === 'porfacturar' || k === 'facturado') by[k].sum = (by[k].sum || 0) + p.subtotal + (Number(p.deliveryFee) || 0)
  }
  return rows.filter(r => !(readOnly.value && ['porfacturar', 'facturado', 'cerrado'].includes(r.key)))
})

function nextOf(p) {
  if (p.status === 'por_confirmar') return 'pendiente'
  if (p.status === 'pendiente') return 'en_preparacion'
  if (p.status === 'en_preparacion') return 'en_camino'
  return 'entregado'
}
function actionLabel(p) {
  const n = nextOf(p)
  if (readOnly.value) return n === 'en_camino' ? 'Salí con el pedido' : 'Entregado'
  if (n === 'pendiente') return 'Confirmar pedido'
  if (n === 'en_preparacion') return 'Empezar a preparar'
  if (n === 'en_camino') return p.mode === 'domicilio' ? 'Sale a domicilio' : 'Listo para recoger'
  return 'Entregado'
}
// Domicilios entregados, numerados dentro de su día (1 = el primero del día)
const domiNum = computed(() => {
  const byDay = {}, out = {}
  const list = pedidos.value.filter(p => p.status === 'entregado' && p.mode === 'domicilio').sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  for (const p of list) { const d = new Date(p.createdAt).toDateString(); byDay[d] = (byDay[d] || 0) + 1; out[p.id] = byDay[d] }
  return out
})
const domisHoy = computed(() => pedidos.value.filter(p => p.status === 'entregado' && p.mode === 'domicilio' && isToday(p.createdAt)).length)
const dateTime = (iso) => new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function ago(iso) {
  const m = Math.max(0, Math.round((now.value - new Date(iso).getTime()) / 60000))
  return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : `hace ${Math.floor(m / 60)} h`
}
function left(iso) {
  const s = Math.max(0, Math.round((new Date(iso).getTime() - now.value) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Domicilio = kilómetros × tarifa por km (se puede ajustar a mano en el campo de valor) */
function setKm(p, km) {
  const n = Number(km)
  if (!km || Number.isNaN(n)) { delete feeInput[p.id]; return }
  feeInput[p.id] = String(Math.round(n * (carta.value?.settings.deliveryPerKm || 0)))
}
async function advance(p, forced) {
  const target = forced || nextOf(p)
  const body = { status: target }
  if (!readOnly.value && p.mode === 'domicilio') {
    const v = feeInput[p.id] ?? p.deliveryFee
    if (v === '' || v === null || v === undefined) { toast('Escribe el valor del domicilio (0 si es gratis).', 'warning'); return }
    body.deliveryFee = Number(v)
  }
  if (target === 'entregado') {
    if (!payOf(p)) {
      // Se resalta el selector para que se vea qué falta
      needPay.value = p.id; setTimeout(() => { needPay.value = '' }, 2500)
      toast('Primero toca cómo te pagaron: Efectivo o Transferencia.', 'warning'); return
    }
    body.payment = payOf(p)
  }
  busy.value = p.id
  try {
    await pend.update(p.id, body)
    if (target === 'entregado') toast(readOnly.value ? 'Entrega registrada' : 'Entregado: ahora falta facturar', 'success')
  } catch (e) { toast(e.response?.data?.error || 'No se pudo actualizar el pedido (' + (e.message || 'sin conexión') + ')', 'error') }
  finally { busy.value = '' }
}
/** Crea la factura con el método de pago fijado en la entrega (se puede corregir antes de facturar) */
async function facturar(p) {
  busy.value = p.id
  try {
    const fee = feeInput[p.id], pay = payOf(p)
    if ((fee !== undefined && fee !== '' && Number(fee) !== Number(p.deliveryFee)) || pay !== p.payment) {
      await api.put(`${base()}/pedidos/${p.id}`, { ...(fee !== undefined && fee !== '' ? { deliveryFee: Number(fee) } : {}), payment: pay })
    }
    const { data } = await api.post(`${base()}/pedidos/${p.id}/facturar`)
    await pend.refresh()
    // Igual que al facturar una venta normal: se abre la factura para enviarla por WhatsApp / PDF
    doneSale.value = data.sale
    donePhone.value = p.customer.phone
  } catch (e) { toast(e.response?.data?.error || 'No se pudo facturar', 'error') }
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
    shiftOpen.value = data.shiftOpen
    Object.assign(set, { whatsapp: data.settings.whatsapp.replace(/^57/, ''), freeDeliveryFrom: data.settings.freeDeliveryFrom, hours: data.settings.hours, pickup: data.settings.pickup,
      address: data.settings.address || '', bankInfo: data.settings.bankInfo || '', deliveryNote: data.settings.deliveryNote || '',
      deliveryPerKm: data.settings.deliveryPerKm || 0, openFrom: data.settings.openFrom || '', openTo: data.settings.openTo || '' })
  } catch { toast('No se pudo cargar la carta', 'error') }
}
async function setSetting(body) {
  try { const { data } = await api.put(`${base()}/carta/settings`, body); carta.value.settings = data }
  catch (e) { toast(e.response?.data?.error || 'No se pudo guardar', 'error'); await loadCarta() }
}
const syncing = ref(false)
async function syncInventory() {
  if (!window.confirm('¿Registrar la carta en el inventario? Lo empacado (bebidas, papas, snacks) quedará con stock 0 = agotado hasta que cargues stock; lo que se prepara al momento queda sin control de stock.')) return
  syncing.value = true
  try {
    const { data } = await api.post(`${base()}/carta/sync-inventory`)
    toast(`Inventario listo: ${data.created} productos nuevos (${data.free} sin control de stock, ${data.controlled} con stock 0 por cargar), ${data.linked} enlazados`, 'success')
  } catch (e) { toast(e.response?.data?.error || 'No se pudo registrar en inventario', 'error') }
  finally { syncing.value = false }
}
async function saveSettings() {
  try {
    const { data } = await api.put(`${base()}/carta/settings`, { whatsapp: set.whatsapp, freeDeliveryFrom: set.freeDeliveryFrom, hours: set.hours, pickup: set.pickup,
      address: set.address, bankInfo: set.bankInfo, deliveryNote: set.deliveryNote, deliveryPerKm: set.deliveryPerKm, openFrom: set.openFrom, openTo: set.openTo })
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

// Revisa cada 20 s si el turno sigue abierto (no toca los ajustes que estén en edición)
async function refreshShift() {
  if (readOnly.value) return
  try { shiftOpen.value = (await api.get(`${base()}/carta`)).data.shiftOpen } catch { /* sin conexión */ }
}
onMounted(() => {
  shiftTimer = setInterval(refreshShift, 20000)
  pend.start()
  if (!readOnly.value) loadCarta()
  tick = setInterval(() => { now.value = Date.now(); todayStr.value = new Date().toDateString() }, 1000)
})
onUnmounted(() => { clearInterval(tick); clearInterval(shiftTimer) })
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
.pv-btn.main { background: #f59e0b; color: #1a0a00; flex: 1; min-width: 150px; } .pv-btn.wa { background: #16a34a; } .pv-btn.danger { background: #7f1d1d; } .pv-btn.ok { background: #16a34a; }
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
.pv-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(105px, 1fr)); gap: 8px; }
.pv-stat { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 12px; padding: 10px 8px; display: flex; flex-direction: column; align-items: center; gap: 2px; cursor: pointer; font-family: inherit; }
.pv-stat b { font-size: 24px; line-height: 1; } .pv-stat span { font-size: 11px; color: var(--text-secondary); text-align: center; } .pv-stat small { font-size: 11px; font-weight: 700; color: var(--success); }
.pv-stat.on { outline: 2px solid #f59e0b; }
.pv-stat.k-porconfirmar b { color: #ef4444; } .pv-stat.k-confirmado b { color: #f59e0b; } .pv-stat.k-preparacion b { color: #3b82f6; }
.pv-stat.k-camino b { color: #8b5cf6; } .pv-stat.k-porfacturar b { color: #06b6d4; } .pv-stat.k-facturado b { color: #22c55e; }
.pv-card.s-porfact { border-left-color: #06b6d4; }
.pv-filterbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; border: 1px solid #f59e0b; border-radius: 12px; background: var(--surface); font-size: 14px; }
.pv-hcount { font-weight: 600; color: var(--text-secondary); font-size: 13px; }
.pv-noshift { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 14px; border-radius: 12px; border: 1px solid #f59e0b; background: rgba(245,158,11,.12); font-size: 14px; }
.pv-noshift .pv-btn { flex: none; min-width: 0; }
.pv-km { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-secondary); }
.pv-km input { width: 62px; padding: 6px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); }
.pv-two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pv-link { background: none; border: 0; color: #f59e0b; font-weight: 700; cursor: pointer; padding: 0; }
.pv-pay { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; width: 100%; font-size: 13px; color: var(--text-secondary); }
.pv-pay button { border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 999px; padding: 7px 12px; font-weight: 600; font-size: 13px; cursor: pointer; }
.pv-pay button.on { background: #22c55e; border-color: #22c55e; color: #fff; }
.pv-pay.warn { outline: 2px solid #ef4444; outline-offset: 4px; border-radius: 8px; }
.pv-hist { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--surface); }
.pv-hrow { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 14px; }
.pv-hrow:last-child { border-bottom: 0; }
.pv-hmain small { display: block; color: var(--text-secondary); font-size: 12px; }
.pv-hside { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex: none; }
.pv-badge.h-entregado { background: #166534; color: #fff; } .pv-badge.h-cancelado, .pv-badge.h-vencido { background: #7f1d1d; color: #fff; }
</style>
