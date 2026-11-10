<template>
  <div class="pc">
    <!-- Cargando / error -->
    <div v-if="loading" class="pc-center">Cargando la carta…</div>
    <div v-else-if="error" class="pc-center">
      <h2>No pudimos abrir la carta</h2>
      <p>{{ error }}</p>
      <button class="pc-btn" @click="load">Reintentar</button>
    </div>

    <template v-else>
      <!-- Encabezado -->
      <header class="pc-head">
        <div class="pc-brand">
          <div class="pc-logo">🍗</div>
          <div>
            <h1>{{ data.business.name }}</h1>
            <p v-if="data.settings.address">📍 {{ data.settings.address }}</p>
            <p v-if="shortHours || data.settings.hours">🕒 {{ shortHours || 'Horarios' }}
              <button v-if="data.settings.hours" class="pc-more" @click="showInfo = !showInfo">{{ showInfo ? 'Ocultar' : 'Ver más' }}</button></p>
          </div>
        </div>
        <span :class="['pc-state', canOrder ? 'ok' : 'off']">{{ stateText }}</span>
      </header>

      <div v-if="showInfo" class="pc-info">
        <p v-if="data.settings.welcome">{{ data.settings.welcome }}</p>
        <p>{{ data.settings.hours }}</p>
        <p v-if="data.settings.deliveryNote">🛵 {{ data.settings.deliveryNote }}</p>
      </div>

      <div v-if="!canOrder" class="pc-warn">
        {{ data.settings.outOfHours ? 'Estamos fuera del horario de pedidos (' + data.settings.openFrom + ' a ' + data.settings.openTo + ').' : data.settings.paused ? 'Pausamos los pedidos por un momento.' : 'Estamos cerrados.' }}
        Puedes ver la carta; los pedidos se reciben cuando estemos atendiendo.
      </div>

      <!-- Buscador -->
      <div class="pc-searchbar">
        <input v-model="q" class="pc-search" type="search" placeholder="🔍 Buscar en la carta (ej: coca, alitas, desayuno)" />
      </div>

      <main class="pc-list">
        <!-- Inicio: categorías como botones grandes -->
        <template v-if="!q.trim() && !cur">
          <div v-if="data.settings.heroImage" class="pc-hero" :style="{ backgroundImage: 'url(' + data.settings.heroImage + ')' }" role="img" :aria-label="'Pollo asado de ' + data.business.name"></div>
          <template v-if="featured.length">
            <h2 class="pc-h">Los más pedidos</h2>
            <div class="pc-feat">
              <button v-for="p in featured" :key="p.id" class="pc-fcard" :disabled="p.soldOut" @click="openProduct(p)">
                <span class="pc-fimg" :style="{ backgroundImage: 'url(' + p.image + ')' }"></span>
                <b>{{ p.name }}</b>
                <small v-if="p.soldOut" class="pc-sold">Agotado</small><small v-else>{{ money(p.price) }}</small>
              </button>
            </div>
          </template>
          <h2 class="pc-h">¿Qué se te antoja?</h2>
          <div class="pc-tiles">
            <button v-for="(g, i) in groups" :key="g.id" class="pc-tile" :style="tileStyle(g, i)" @click="openGroup(g)">
              <span class="pc-tile-emoji">{{ g.emoji }}</span>
              <b>{{ g.name }}</b>
              <small>{{ g.count }} producto{{ g.count === 1 ? '' : 's' }}</small>
            </button>
          </div>
        </template>

        <!-- Dentro de una categoría o con búsqueda -->
        <template v-else>
          <button v-if="!q.trim()" class="pc-back" @click="backHome">← Categorías</button>
          <h2 class="pc-h">{{ q.trim() ? results + ' resultado' + (results === 1 ? '' : 's') : cur.emoji + ' ' + cur.name }}</h2>
          <p v-if="q.trim() && !results" class="pc-empty">No encontramos eso. Prueba con otra palabra.</p>
          <section v-for="sec in sections" :key="sec.title">
            <h3 v-if="sec.title" class="pc-subh">{{ sec.title }}</h3>
            <button v-for="p in sec.products" :key="p.id" class="pc-prod" :disabled="p.soldOut" @click="openProduct(p)">
              <span :class="['pc-thumb', p.image && 'photo']" :style="p.image ? { backgroundImage: 'url(' + p.image + ')' } : null">{{ p.image ? '' : emojiOf(p) }}</span>
              <div class="pc-prod-info">
                <b>{{ p.name }}</b>
                <small v-if="p.description" class="pc-desc">{{ p.description }}</small>
              </div>
              <div class="pc-prod-price">
                <span v-if="p.soldOut" class="pc-sold">Agotado</span>
                <template v-else><strong>{{ money(p.price) }}</strong><span class="pc-add">+</span></template>
              </div>
            </button>
          </section>
        </template>
        <p class="pc-foot">Precios con IVA e impuestos incluidos. El domicilio se cotiza aparte.</p>
      </main>

      <!-- Barra del carrito -->
      <button v-if="cart.length" class="pc-bar" @click="showCart = true">
        <span class="pc-bar-n">{{ cartCount }}</span>
        <span>Ver mi pedido</span>
        <strong>{{ money(cartSubtotal) }}</strong>
      </button>
    </template>

    <!-- Hoja de producto -->
    <div v-if="sel" class="pc-sheet-bg" @click.self="sel = null">
      <div class="pc-sheet" role="dialog" aria-modal="true">
        <div class="pc-sheet-top">
          <div><h3>{{ sel.product.name }}</h3><small>{{ sel.product.description }}</small></div>
          <button class="pc-x" aria-label="Cerrar" @click="sel = null">✕</button>
        </div>
        <div class="pc-sheet-body">
          <div v-for="g in sel.product.groups" :key="g.id" class="pc-group">
            <div :class="['pc-group-h', g.type === 'qty' && 'tap']" @click="g.type === 'qty' && toggleOpen(g)">
              <b>{{ g.type === 'qty' ? (isOpen(g) ? '▾ ' : '▸ ') : '' }}{{ g.name }}<em v-if="g.type === 'qty' && qtyCount(g)" class="pc-count">{{ qtyCount(g) }} elegida{{ qtyCount(g) === 1 ? '' : 's' }}</em></b>
              <span v-if="g.type === 'one'" :class="['pc-tag', g.required && 'req']">{{ g.required ? 'Obligatorio · escoge 1' : 'Escoge 1' }}</span>
              <span v-else-if="g.type === 'many'" class="pc-tag">Hasta {{ g.max }}</span>
              <span v-else class="pc-tag">Opcional</span>
            </div>
            <template v-if="g.type === 'one'">
              <label v-for="o in g.options" :key="o.id" class="pc-row">
                <input type="radio" :name="g.id" :value="o.id" v-model="sel.pick[g.id]" />
                <span>{{ o.name }}</span><em v-if="o.price">+{{ money(o.price) }}</em>
              </label>
            </template>
            <template v-else-if="g.type === 'many'">
              <label v-for="o in g.options" :key="o.id" class="pc-row">
                <input type="checkbox" :checked="sel.pick[g.id].includes(o.id)" @change="toggleMany(g, o.id, $event)" />
                <span>{{ o.name }}</span><em v-if="o.price">+{{ money(o.price) }}</em>
              </label>
            </template>
            <template v-else-if="isOpen(g)">
              <input v-if="g.options.length > 10" v-model="sel.search[g.id]" type="search" class="pc-dsearch" placeholder="🔍 Buscar bebida (ej: coca, agua, cerveza)" />
              <p v-if="!optsOf(g).length" class="pc-empty">No encontramos esa bebida.</p>
              <template v-for="(o, i) in optsOf(g)" :key="o.id">
                <div v-if="o.section && (i === 0 || optsOf(g)[i - 1].section !== o.section)" class="pc-sec">{{ o.section }}</div>
                <div :class="['pc-row', 'qty', o.soldOut && 'off']">
                  <span>{{ o.name }}<small v-if="o.note" class="pc-onote">{{ o.note }}</small></span>
                  <em v-if="!o.soldOut">{{ money(o.price) }}</em><em v-else class="pc-soldtag">Agotado</em>
                  <div class="pc-step">
                    <button :disabled="!sel.pick[g.id][o.id]" @click="step(g, o, -1)">−</button>
                    <b>{{ sel.pick[g.id][o.id] || 0 }}</b>
                    <button :disabled="o.soldOut" @click="step(g, o, 1)">+</button>
                  </div>
                </div>
              </template>
            </template>
          </div>
          <label class="pc-group">
            <div class="pc-group-h"><b>Nota para este producto</b><span class="pc-tag">Opcional</span></div>
            <input v-model="sel.note" class="pc-in" maxlength="140" placeholder="Ej: sin cebolla, bien doradito" />
          </label>
        </div>
        <p v-if="sel.err" class="pc-err">{{ sel.err }}</p>
        <div class="pc-sheet-foot">
          <div class="pc-step big">
            <button :disabled="sel.qty <= 1" @click="sel.qty--">−</button><b>{{ sel.qty }}</b><button @click="sel.qty = Math.min(50, sel.qty + 1)">+</button>
          </div>
          <button class="pc-btn grow" @click="addToCart">Agregar · {{ money(selTotal) }}</button>
        </div>
      </div>
    </div>

    <!-- Hoja del pedido -->
    <div v-if="showCart" class="pc-sheet-bg" @click.self="showCart = false">
      <div class="pc-sheet tall" role="dialog" aria-modal="true">
        <div class="pc-sheet-top">
          <h3>Tu pedido</h3>
          <button class="pc-x" aria-label="Cerrar" @click="showCart = false">✕</button>
        </div>

        <div v-if="done" class="pc-sheet-body pc-done">
          <div class="pc-ok">✓</div>
          <h3>¡Pedido recibido!</h3>
          <p class="pc-code">#{{ done.code }}</p>
          <p>Para confirmarlo, <b>envíanos tu pedido por WhatsApp</b>. Así te pedimos tu ubicación y te decimos el valor del domicilio.
            Si pasan 15 minutos sin confirmar, el pedido se cancela solo.</p>
          <div v-if="done.payment === 'transferencia' && (bankLines.length || data.settings.paymentQr)" class="pc-bank">
            <b>Datos para transferir</b>
            <div v-for="l in bankLines" :key="l">{{ l }}</div>
            <img v-if="data.settings.paymentQr" :src="data.settings.paymentQr" alt="QR para pagar" class="pc-qr" />
          </div>
          <a class="pc-btn wa" :href="waLink(done)" target="_blank" rel="noopener">Enviar por WhatsApp</a>
          <button class="pc-link" @click="finish">Hacer otro pedido</button>
        </div>

        <template v-else>
          <div class="pc-sheet-body">
            <div v-for="(l, i) in cart" :key="l.key" class="pc-line">
              <div class="pc-line-main">
                <b>{{ l.qty }} × {{ l.product.name }}</b>
                <small v-if="lineChoices(l)">{{ lineChoices(l) }}</small>
                <small v-for="x in lineExtras(l)" :key="x">+ {{ x }}</small>
                <small v-if="l.note" class="note">“{{ l.note }}”</small>
              </div>
              <div class="pc-line-side">
                <strong>{{ money(lineTotal(l)) }}</strong>
                <button class="pc-link red" @click="cart.splice(i, 1)">Quitar</button>
              </div>
            </div>

            <div class="pc-total"><span>Subtotal</span><strong>{{ money(cartSubtotal) }}</strong></div>

            <!-- Domicilio -->
            <div :class="['pc-dom', free && form.mode === 'domicilio' && 'free']">
              <template v-if="form.mode === 'recoger'">Recoges en el local: sin costo de domicilio.</template>
              <template v-else-if="free">🎉 ¡Domicilio gratis en este pedido!</template>
              <template v-else-if="threshold">
                <b>El valor de tu pedido no incluye el domicilio.</b> Te pediremos tu ubicación por WhatsApp para calcularlo.
                Te faltan <b>{{ money(threshold - cartSubtotal) }}</b> para domicilio gratis.
                <div class="pc-prog"><i :style="{ width: Math.min(100, cartSubtotal / threshold * 100) + '%' }"></i></div>
              </template>
              <template v-else><b>El valor de tu pedido no incluye el domicilio.</b> Te pediremos tu ubicación por WhatsApp para calcularlo.</template>
            </div>

            <p v-if="form.mode === 'domicilio' && data.settings.deliveryNote" class="pc-dnote">🛵 {{ data.settings.deliveryNote }}</p>

            <!-- Datos -->
            <div v-if="data.settings.pickup" class="pc-seg">
              <button :class="{ on: form.mode === 'domicilio' }" @click="form.mode = 'domicilio'">🛵 Domicilio</button>
              <button :class="{ on: form.mode === 'recoger' }" @click="form.mode = 'recoger'">🏪 Recoger</button>
            </div>
            <input v-model="form.name" class="pc-in" maxlength="60" placeholder="Tu nombre" autocomplete="name" />
            <input v-model="form.phone" class="pc-in" inputmode="tel" maxlength="15" placeholder="Tu celular" autocomplete="tel" />
            <input v-if="form.mode === 'domicilio'" v-model="form.address" class="pc-in" maxlength="160" placeholder="Dirección y barrio" autocomplete="street-address" />
            <input v-model="form.notes" class="pc-in" maxlength="200" placeholder="Indicaciones (opcional)" />

            <div class="pc-seg">
              <button :class="{ on: form.payment === 'efectivo' }" @click="form.payment = 'efectivo'">💵 Efectivo</button>
              <button :class="{ on: form.payment === 'transferencia' }" @click="form.payment = 'transferencia'">🏦 Transferencia</button>
            </div>
            <input v-if="form.payment === 'efectivo'" v-model="form.cashFor" class="pc-in" inputmode="numeric" maxlength="9" placeholder="¿Con cuánto pagas? (opcional)" />
            <div v-else class="pc-bank">
              <b>Datos para transferir</b>
              <div v-for="l in bankLines" :key="l">{{ l }}</div>
              <img v-if="data.settings.paymentQr" :src="data.settings.paymentQr" alt="QR para pagar" class="pc-qr" />
              <small>Haz la transferencia al recibir tu pedido y envía el comprobante por WhatsApp.</small>
            </div>

            <label v-if="hasAlcohol" class="pc-check"><input type="checkbox" v-model="form.adult" /> Confirmo que soy mayor de 18 años (licor).</label>
            <label class="pc-check"><input type="checkbox" v-model="form.privacy" />
              Autorizo el uso de mis datos (nombre, celular, dirección) solo para atender este pedido, según la Ley 1581 de 2012.</label>
          </div>
          <p v-if="formErr" class="pc-err">{{ formErr }}</p>
          <div class="pc-sheet-foot">
            <button class="pc-btn grow" :disabled="sending || !canOrder || !cart.length" @click="send">
              {{ sending ? 'Enviando…' : canOrder ? 'Enviar pedido · ' + money(cartSubtotal) : 'No estamos recibiendo pedidos' }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * PublicCarta.vue — Carta interactiva para clientes (sin login).
 * Usa fetch directo (no el cliente `api`): esta página no debe mandar token ni
 * redirigir al login si algo responde 401.
 * Los precios que se ven aquí son solo informativos: el servidor los recalcula.
 */
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const slug = route.params.slug
const API = '/api/public'

const loading = ref(true)
const error = ref('')
const data = ref(null)
const q = ref('')            // buscador
const cur = ref(null)         // categoría abierta (null = menú de inicio)
const showInfo = ref(false)
const sel = ref(null)
const showCart = ref(false)
const sending = ref(false)
const formErr = ref('')
const done = ref(null)
const cart = ref([])
const form = reactive({ mode: 'domicilio', name: '', phone: '', address: '', notes: '', payment: 'efectivo', cashFor: '', adult: false, privacy: false })

const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO')
const lsGet = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const lsSet = (k, v) => { try { localStorage.setItem(k, v) } catch { /* sin almacenamiento: no pasa nada */ } }

// ── Carga ──
async function load() {
  loading.value = true; error.value = ''
  try {
    const r = await fetch(`${API}/carta/${encodeURIComponent(slug)}`, { cache: 'no-store' })
    if (!r.ok) throw new Error(r.status === 404 ? 'Esta carta no existe o no está disponible.' : 'Intenta de nuevo en un momento.')
    data.value = await r.json()
    restore()
  } catch (e) { error.value = e.message } finally { loading.value = false }
}
let timer = null
onMounted(() => { load(); timer = setInterval(refreshState, 60000); window.addEventListener('popstate', onPop) })
onUnmounted(() => { clearInterval(timer); window.removeEventListener('popstate', onPop) })

/** Cada minuto actualiza abierto/pausado/agotados sin recargar la página */
async function refreshState() {
  if (!data.value || sel.value || sending.value) return
  try {
    const r = await fetch(`${API}/carta/${encodeURIComponent(slug)}`, { cache: 'no-store' })
    if (r.ok) data.value = await r.json()
  } catch { /* sin internet: se queda con lo que tiene */ }
}

// Pedido en curso y datos del cliente se recuerdan en el teléfono
function restore() {
  try {
    const saved = JSON.parse(lsGet('dc_form_' + slug) || '{}')
    for (const k of ['name', 'phone', 'address']) if (saved[k]) form[k] = saved[k]
    const c = JSON.parse(lsGet('dc_cart_' + slug) || '[]')
    const ids = new Map(data.value.products.map(p => [p.id, p]))
    cart.value = c.filter(l => ids.has(l.productId)).map(l => ({ ...l, product: ids.get(l.productId) }))
  } catch { /* datos viejos o dañados: se ignoran */ }
}
function persist() {
  lsSet('dc_cart_' + slug, JSON.stringify(cart.value.map(({ product, ...l }) => l)))
  lsSet('dc_form_' + slug, JSON.stringify({ name: form.name, phone: form.phone, address: form.address }))
}

// ── Derivados ──
const cats = computed(() => (data.value?.categories || []).filter(c => data.value.products.some(p => p.categoryId === c.id)))
const productsOf = (id) => data.value.products.filter(p => p.categoryId === id)

// ── Menú de categorías ──
const DRINK_CATS = ['Aguas', 'Gaseosas y jugos', 'Gaseosas grandes', 'Energizantes, té e hidratantes', 'Cervezas']
function emojiFor(name) {
  const n = String(name).toLowerCase()
  if (/bebida|gaseosa|jugo/.test(n)) return '🥤'
  if (/agua/.test(n)) return '💧'
  if (/cerveza/.test(n)) return '🍺'
  if (/energ/.test(n)) return '⚡'
  if (/desayuno/.test(n)) return '🍳'
  if (/consom/.test(n)) return '🍲'
  if (/alita/.test(n)) return '🔥'
  if (/adicion/.test(n)) return '🍟'
  if (/frito/.test(n)) return '🥟'
  if (/caliente/.test(n)) return '☕'
  if (/papa|snack/.test(n)) return '🥔'
  if (/pastel|galleta|chicle|dulce/.test(n)) return '🍪'
  if (/combo|compartir/.test(n)) return '🍱'
  return '🍗'
}
// Las categorías con el mismo "grupo" (ej: Aguas, Gaseosas, Cervezas → "Bebidas") se juntan en un solo botón.
// Las cartas viejas, sin grupo, juntan las bebidas por su nombre.
const groups = computed(() => {
  const out = [], byGroup = {}
  for (const c of cats.value) {
    const count = productsOf(c.id).length
    const gname = c.group || (DRINK_CATS.includes(c.name) ? 'Bebidas' : '')
    if (gname) {
      if (!byGroup[gname]) { byGroup[gname] = { id: 'g:' + gname, name: gname, emoji: c.emoji || emojiFor(gname), cats: [], count: 0 }; out.push(byGroup[gname]) }
      byGroup[gname].cats.push(c); byGroup[gname].count += count
      continue
    }
    out.push({ id: c.id, name: c.name, emoji: c.emoji || emojiFor(c.name), cats: [c], count })
  }
  return out
})
const catEmoji = computed(() => Object.fromEntries(cats.value.map(c => [c.id, c.emoji || emojiFor(c.group || c.name)])))
const emojiOf = (p) => catEmoji.value[p.categoryId] || '🍗'
const TILE = [['#ffedd5', '#7c2d12'], ['#fef3c7', '#78350f'], ['#fee2e2', '#7f1d1d'], ['#dcfce7', '#14532d'], ['#fef9c3', '#713f12'], ['#e0f2fe', '#0c4a6e'], ['#fae8ff', '#701a75'], ['#ccfbf1', '#134e4a']]
// Mosaicos parejos y de color (sin fotos): las fotos se ven en "Los más pedidos" y dentro de cada categoría
function tileStyle(g, i) {
  const [bg, fg] = TILE[i % TILE.length]
  return { background: bg, color: fg }
}
// "Los más pedidos": productos destacados que tienen foto (máx. 8)
const featured = computed(() => data.value.products.filter(p => p.featured && p.image).slice(0, 8))
// Lo que se muestra: resultados de búsqueda o los productos de la categoría abierta
const norm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const sections = computed(() => {
  if (q.value.trim()) {
    const words = norm(q.value).split(/\s+/).filter(Boolean)
    return [{ title: '', products: data.value.products.filter(p => words.every(w => norm(p.name + ' ' + (p.description || '')).includes(w))) }]
  }
  return cur.value ? cur.value.cats.map(c => ({ title: cur.value.cats.length > 1 ? c.name : '', products: productsOf(c.id) })) : []
})
const results = computed(() => sections.value.reduce((a, s2) => a + s2.products.length, 0))
function openGroup(g) {
  cur.value = g; q.value = ''
  try { history.pushState({ ...(history.state || {}), pcCat: g.id }, '') } catch { /* sin historial */ }
  window.scrollTo(0, 0)
}
function backHome() {
  if (history.state && history.state.pcCat) history.back()
  else cur.value = null
}
const onPop = () => { cur.value = null; window.scrollTo(0, 0) }   // el botón "atrás" del celular vuelve al menú
// "7:00 am – 8:00 pm" a partir del horario de pedidos
const shortHours = computed(() => {
  const f = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); if (!m) return ''; const h = +m[1]; return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'am' : 'pm'}` }
  const a = f(data.value?.settings.openFrom), b = f(data.value?.settings.openTo)
  return a && b ? `${a} – ${b}` : ''
})
const canOrder = computed(() => !!data.value && data.value.settings.open && !data.value.settings.paused)
const stateText = computed(() => !data.value.settings.open ? 'Cerrado' : data.value.settings.paused ? 'Pedidos en pausa' : 'Abierto')
const bankLines = computed(() => String(data.value?.settings.bankInfo || '').split('·').map(x => x.trim()).filter(Boolean))
const threshold = computed(() => data.value?.settings.freeDeliveryFrom || 0)

// ── Producto ──
function openProduct(p) {
  const pick = {}
  for (const g of p.groups) pick[g.id] = g.type === 'one' ? '' : g.type === 'many' ? [] : {}
  sel.value = { product: p, pick, qty: 1, note: '', err: '', open: {}, search: {} }
}
// Desplegables (bebidas, adiciones): cerrados o abiertos según la carta; el cliente los abre al tocarlos
// Opciones de un desplegable (bebidas) filtradas por lo que se escribe en su buscador
function optsOf(g) {
  const words = norm(sel.value.search[g.id] || '').split(/s+/).filter(Boolean)
  return words.length ? g.options.filter(o => words.every(w => norm(o.name + ' ' + (o.section || '')).includes(w))) : g.options
}
const isOpen = (g) => sel.value.open[g.id] ?? !g.collapsed
const toggleOpen = (g) => { sel.value.open[g.id] = !isOpen(g) }
const qtyCount = (g) => Object.values(sel.value.pick[g.id] || {}).reduce((a, n) => a + n, 0)
function toggleMany(g, id, ev) {
  const arr = sel.value.pick[g.id]
  const i = arr.indexOf(id)
  if (i >= 0) { arr.splice(i, 1); sel.value.err = ''; return }
  if (g.max && arr.length >= g.max) {
    if (ev?.target) ev.target.checked = false // la casilla no debe quedar marcada si no se agregó
    sel.value.err = `En ${g.name} puedes escoger hasta ${g.max}.`; return
  }
  arr.push(id); sel.value.err = ''
}
function step(g, o, d) {
  if (o.soldOut && d > 0) return
  const m = sel.value.pick[g.id]
  const n = Math.max(0, Math.min(20, (m[o.id] || 0) + d))
  if (n) m[o.id] = n; else delete m[o.id]
}
function choicesOf(product, pick) {
  const out = {}
  for (const g of product.groups) {
    const v = pick[g.id]
    if (g.type === 'one') out[g.id] = v ? [{ optionId: v }] : []
    else if (g.type === 'many') out[g.id] = v.map(optionId => ({ optionId }))
    else out[g.id] = Object.entries(v).map(([optionId, qty]) => ({ optionId, qty }))
  }
  return out
}
function priceOf(product, choices, qty) {
  let unit = product.price, extras = 0
  for (const g of product.groups) for (const c of choices[g.id] || []) {
    const o = g.options.find(x => x.id === c.optionId)
    if (!o) continue
    if (g.type === 'qty') extras += o.price * c.qty
    else unit += o.price
  }
  return (unit + extras) * qty
}
const selTotal = computed(() => sel.value ? priceOf(sel.value.product, choicesOf(sel.value.product, sel.value.pick), sel.value.qty) : 0)

function addToCart() {
  const s = sel.value
  for (const g of s.product.groups) if (g.type === 'one' && g.required && !s.pick[g.id]) { s.err = `Escoge una opción de ${g.name}.`; return }
  cart.value.push({ key: Date.now() + Math.random(), productId: s.product.id, product: s.product, qty: s.qty,
    choices: choicesOf(s.product, s.pick), note: s.note.trim() })
  sel.value = null
  persist()
}

// ── Carrito ──
const lineTotal = (l) => priceOf(l.product, l.choices, l.qty)
const cartSubtotal = computed(() => cart.value.reduce((s, l) => s + lineTotal(l), 0))
const cartCount = computed(() => cart.value.reduce((s, l) => s + l.qty, 0))
const free = computed(() => threshold.value > 0 && cartSubtotal.value >= threshold.value)
const hasAlcohol = computed(() => cart.value.some(l => l.product.alcohol || l.product.groups.some(g => (l.choices[g.id] || []).some(c => g.options.find(o => o.id === c.optionId)?.alcohol))))
function optName(l, g, id) { return g.options.find(o => o.id === id)?.name }
function lineChoices(l) {
  return l.product.groups.filter(g => g.type !== 'qty').flatMap(g => (l.choices[g.id] || []).map(c => optName(l, g, c.optionId))).filter(Boolean).join(', ')
}
function lineExtras(l) {
  return l.product.groups.filter(g => g.type === 'qty').flatMap(g => (l.choices[g.id] || []).map(c => `${c.qty * l.qty} ${optName(l, g, c.optionId)}`))
}

// ── Envío ──
async function send() {
  formErr.value = ''
  if (form.name.trim().length < 2) return (formErr.value = 'Escribe tu nombre.')
  if (form.phone.replace(/\D/g, '').length < 7) return (formErr.value = 'Escribe un celular válido.')
  if (form.mode === 'domicilio' && form.address.trim().length < 5) return (formErr.value = 'Escribe tu dirección.')
  if (hasAlcohol.value && !form.adult) return (formErr.value = 'Para pedir licor confirma que eres mayor de 18 años.')
  if (!form.privacy) return (formErr.value = 'Debes aceptar el uso de tus datos para enviar el pedido.')
  sending.value = true
  persist() // recuerda nombre, celular y dirección para el próximo pedido
  try {
    const r = await fetch(`${API}/pedidos/${encodeURIComponent(slug)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name, phone: form.phone, address: form.address, notes: form.notes, mode: form.mode,
        payment: form.payment, cashFor: form.cashFor, adult: form.adult, privacyAccepted: form.privacy,
        items: cart.value.map(l => ({ productId: l.productId, qty: l.qty, choices: l.choices, note: l.note }))
      })
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { formErr.value = j.error || 'No pudimos enviar tu pedido.'; if (r.status === 400) refreshAfterError(); return }
    done.value = { ...j, name: form.name, address: form.address, payment: form.payment, cashFor: form.cashFor, notes: form.notes }
    cart.value = []; persist()
  } catch { formErr.value = 'Sin conexión. Revisa tu internet e intenta de nuevo.' } finally { sending.value = false }
}
async function refreshAfterError() { sending.value = false; await refreshState() }
function finish() { done.value = null; showCart.value = false }

function waLink(d) {
  const lines = (d.lines || []).map(l => `• ${l.qty} ${l.name}${l.choices?.length ? ' (' + l.choices.join(', ') + ')' : ''}${l.note ? ' — ' + l.note : ''}  ${money(l.total)}`)
  const msg = [
    `Hola, soy ${d.name}. Pedido #${d.code} en ${data.value.business.name}:`, ...lines,
    `Subtotal: ${money(d.subtotal)}${d.freeDelivery ? ' (domicilio gratis)' : ' (sin domicilio)'}`,
    d.mode === 'recoger' ? 'Recojo en el local.' : `Dirección: ${d.address}`,
    `Pago: ${d.payment}${d.payment === 'efectivo' && d.cashFor ? ' (pago con ' + money(d.cashFor) + ')' : ''}`,
    d.notes ? `Nota: ${d.notes}` : ''
  ].filter(Boolean).join('\n')
  return `https://wa.me/${data.value.settings.whatsapp}?text=${encodeURIComponent(msg)}`
}
</script>

<style scoped>
.pc { --red: #c2410c; --red2: #9a3412; --amber: #f59e0b; --ink: #1c1917; --mut: #78716c; --line: #e7e5e4; --bg: #faf7f2;
  min-height: 100vh; background: var(--bg); color: var(--ink); font-family: Inter, system-ui, sans-serif; padding-bottom: 96px; }
.pc * { box-sizing: border-box; }
.pc-center { padding: 80px 24px; text-align: center; color: var(--mut); }
.pc-center h2 { color: var(--ink); margin-bottom: 6px; }
.pc-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 16px; background: var(--red); color: #fff; }
.pc-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.pc-logo { width: 44px; height: 44px; border-radius: 12px; background: #fff3; display: grid; place-items: center; font-size: 24px; flex: none; }
.pc-head h1 { font-size: 19px; margin: 0; line-height: 1.1; }
.pc-head p { margin: 2px 0 0; font-size: 12px; opacity: .9; }
.pc-hours { max-width: 340px; }
.pc-group-h.tap { cursor: pointer; padding: 8px 10px; margin: 0 -4px 4px; border-radius: 10px; background: #f5f5f4; }
.pc-count { font-style: normal; font-weight: 700; font-size: 11px; background: var(--red); color: #fff; border-radius: 999px; padding: 2px 8px; margin-left: 8px; }
.pc-dsearch { position: sticky; top: 0; z-index: 3; width: 100%; border: 1px solid var(--line); background: #fff; color: var(--ink); border-radius: 10px; padding: 9px 12px; margin: 4px 0 2px; font: 400 14px Inter, system-ui, sans-serif; }
.pc-dsearch:focus { outline: 2px solid var(--amber); border-color: var(--amber); }
.pc-sec { font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--red2); padding: 12px 4px 4px; }
.pc-onote { display: block; color: var(--mut); font-size: 11px; }
.pc-dnote { margin: 0; font-size: 13px; color: #7c2d12; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 8px 12px; }
.pc-bank { border: 1px dashed var(--line); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 4px; font-size: 14px; align-items: flex-start; text-align: left; width: 100%; }
.pc-bank small { color: var(--mut); font-size: 12px; }
.pc-qr { width: 200px; max-width: 100%; align-self: center; border-radius: 8px; margin: 6px 0; background: #fff; }
.pc-state { font-size: 12px; font-weight: 700; padding: 5px 10px; border-radius: 999px; white-space: nowrap; }
.pc-state.ok { background: #16a34a; } .pc-state.off { background: #44403c; }
.pc-warn { background: #fef3c7; color: #78350f; font-size: 13px; padding: 10px 16px; border-bottom: 1px solid #fde68a; }
.pc-more { background: none; border: 0; color: #fff; text-decoration: underline; font: 600 11px Inter, system-ui, sans-serif; cursor: pointer; padding: 0 0 0 6px; opacity: .95; }
.pc-info { background: #fff; border-bottom: 1px solid var(--line); padding: 10px 16px; font-size: 13px; color: #44403c; line-height: 1.5; }
.pc-info p { margin: 0 0 4px; }
.pc-searchbar { padding: 10px 12px 0; max-width: 720px; margin: 0 auto; }
.pc-search { width: 100%; border: 1px solid var(--line); background: #fff; color: var(--ink); border-radius: 12px; padding: 11px 14px; font: 400 15px Inter, system-ui, sans-serif; }
.pc-search:focus { outline: 2px solid var(--amber); border-color: var(--amber); }
.pc-h { font-size: 18px; margin: 16px 4px 10px; }
.pc-subh { font-size: 12px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--red2); margin: 16px 4px 6px; }
.pc-hero { height: 150px; border-radius: 16px; background-size: cover; background-position: center; margin: 4px 0 14px; background-color: #fde7c8; }
.pc-feat { display: flex; gap: 10px; overflow-x: auto; padding: 2px 2px 12px; margin: 0 -2px 6px; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
.pc-feat { scrollbar-width: none; } .pc-feat::-webkit-scrollbar { display: none; }
.pc-fcard { flex: 0 0 132px; scroll-snap-align: start; border: 0; background: transparent; padding: 0; text-align: left; font-family: inherit; cursor: pointer; display: flex; flex-direction: column; gap: 3px; color: inherit; }
.pc-fcard:disabled { opacity: .55; cursor: default; }
.pc-fimg { display: block; height: 100px; border-radius: 12px; background-size: cover; background-position: center; background-color: #fde7c8; }
.pc-fcard b { font-size: 13px; line-height: 1.2; } .pc-fcard small { font-size: 12px; opacity: .8; }
.pc-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pc-tile { border: 0; border-radius: 16px; padding: 14px 12px; min-height: 108px; display: flex; flex-direction: column; justify-content: flex-end; gap: 2px; text-align: left; cursor: pointer; font-family: inherit; }
.pc-tile-emoji { font-size: 30px; line-height: 1; margin-bottom: 6px; }
.pc-tile b { font-size: 15px; line-height: 1.2; } .pc-tile small { font-size: 12px; opacity: .85; }
.pc-back { background: none; border: 0; color: var(--red); font: 700 14px Inter, system-ui, sans-serif; cursor: pointer; padding: 12px 4px 0; }
.pc-empty { color: var(--mut); text-align: center; padding: 24px 0; }
.pc-thumb { width: 46px; height: 46px; border-radius: 12px; background: #ffedd5; display: grid; place-items: center; font-size: 22px; flex: none; background-size: cover; background-position: center; }
.pc-desc { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
.pc-cats { position: sticky; top: 0; z-index: 5; display: flex; gap: 8px; overflow-x: auto; padding: 10px 12px; background: var(--bg); border-bottom: 1px solid var(--line); scrollbar-width: none; }
.pc-cats::-webkit-scrollbar { display: none; }
.pc-cats button { flex: none; border: 1px solid var(--line); background: #fff; color: var(--ink); border-radius: 999px; padding: 7px 14px; font: 600 13px Inter, system-ui, sans-serif; cursor: pointer; }
.pc-cats button.on { background: var(--red); border-color: var(--red); color: #fff; }
.pc-list { max-width: 720px; margin: 0 auto; padding: 4px 12px; }
.pc-list h2 { font-size: 16px; margin: 20px 4px 8px; scroll-margin-top: 64px; }
.pc-prod { width: 100%; display: flex; justify-content: flex-start; align-items: center; gap: 12px; text-align: left; background: #fff; color: var(--ink);
  border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; margin-bottom: 8px; cursor: pointer; font-family: inherit; }
.pc-prod:disabled { opacity: .55; cursor: not-allowed; }
.pc-prod-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.pc-prod-info b { font-size: 15px; } .pc-prod-info small { color: var(--mut); font-size: 12px; }
.pc-opt { color: var(--red) !important; font-weight: 600; }
.pc-prod-price { display: flex; align-items: center; gap: 10px; flex: none; }
.pc-prod-price strong { font-size: 15px; }
.pc-add { width: 28px; height: 28px; border-radius: 50%; background: var(--red); color: #fff; display: grid; place-items: center; font-size: 18px; font-weight: 700; }
.pc-row.off { opacity: .45; }
.pc-soldtag { font-style: normal; font-weight: 700; font-size: 12px; color: #b91c1c; }
.pc-sold { font-size: 12px; font-weight: 700; color: #b91c1c; }
.pc-foot { text-align: center; color: var(--mut); font-size: 12px; margin: 18px 0; }
.pc-bar { position: fixed; left: 12px; right: 12px; bottom: 12px; z-index: 20; max-width: 696px; margin: 0 auto; display: flex; align-items: center; gap: 10px;
  background: var(--red); color: #fff; border: 0; border-radius: 14px; padding: 14px 16px; font: 700 15px Inter, system-ui, sans-serif; cursor: pointer; box-shadow: 0 8px 24px #0004; }
.pc-bar span:nth-child(2) { flex: 1; text-align: left; }
.pc-bar-n { background: #fff; color: var(--red); border-radius: 999px; min-width: 26px; height: 26px; display: grid; place-items: center; font-size: 13px; padding: 0 6px; }
.pc-sheet-bg { position: fixed; inset: 0; z-index: 50; background: #0007; display: flex; align-items: flex-end; justify-content: center; }
.pc-sheet { width: 100%; max-width: 560px; max-height: 92vh; background: #fff; color: var(--ink); border-radius: 20px 20px 0 0; display: flex; flex-direction: column; }
.pc-sheet.tall { height: 92vh; }
.pc-sheet-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; padding: 16px 16px 8px; }
.pc-sheet-top h3 { margin: 0; font-size: 18px; } .pc-sheet-top small { color: var(--mut); }
.pc-x { border: 0; background: #f5f5f4; color: var(--ink); width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 14px; flex: none; }
.pc-sheet-body { overflow-y: auto; padding: 4px 16px 12px; display: flex; flex-direction: column; gap: 10px; }
.pc-sheet-foot { display: flex; gap: 10px; align-items: center; padding: 12px 16px 16px; border-top: 1px solid var(--line); }
.pc-group { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; }
.pc-group-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.pc-tag { font-size: 11px; font-weight: 700; background: #f5f5f4; color: var(--mut); border-radius: 999px; padding: 3px 9px; }
.pc-tag.req { background: #ffedd5; color: var(--red2); }
.pc-row { display: flex; align-items: center; gap: 10px; padding: 10px 4px; border-bottom: 1px solid #f5f5f4; font-size: 14px; cursor: pointer; }
.pc-row span { flex: 1; } .pc-row em { font-style: normal; color: var(--mut); font-size: 13px; }
.pc-row input { width: 20px; height: 20px; accent-color: var(--red); }
.pc-row.qty { cursor: default; } .pc-row.qty em { margin-right: 4px; }
.pc-step { display: inline-flex; align-items: center; gap: 10px; }
.pc-step button { width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--line); background: #fff; color: var(--ink); font-size: 17px; cursor: pointer; }
.pc-step button:disabled { opacity: .35; } .pc-step b { min-width: 18px; text-align: center; }
.pc-step.big button { width: 36px; height: 36px; }
.pc-in { width: 100%; border: 1px solid var(--line); background: #fff; color: var(--ink); border-radius: 10px; padding: 11px 12px; font: 400 15px Inter, system-ui, sans-serif; }
.pc-in:focus { outline: 2px solid var(--amber); border-color: var(--amber); }
.pc-btn { border: 0; background: var(--red); color: #fff; border-radius: 12px; padding: 13px 18px; font: 700 15px Inter, system-ui, sans-serif; cursor: pointer; text-align: center; text-decoration: none; display: inline-block; }
.pc-btn.grow { flex: 1; } .pc-btn:disabled { opacity: .5; cursor: not-allowed; }
.pc-btn.wa { background: #16a34a; display: block; width: 100%; }
.pc-link { background: none; border: 0; color: var(--mut); font: 600 13px Inter, system-ui, sans-serif; cursor: pointer; padding: 4px; }
.pc-link.red { color: #b91c1c; }
.pc-err { color: #b91c1c; font-size: 13px; font-weight: 600; margin: 0; padding: 0 16px 4px; }
.pc-line { display: flex; justify-content: space-between; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f5f5f4; }
.pc-line-main { display: flex; flex-direction: column; gap: 1px; min-width: 0; } .pc-line-main small { color: var(--mut); font-size: 12px; } .pc-line-main .note { font-style: italic; }
.pc-line-side { display: flex; flex-direction: column; align-items: flex-end; flex: none; }
.pc-total { display: flex; justify-content: space-between; font-size: 16px; padding: 6px 0; }
.pc-dom { background: #fff7ed; border: 1px solid #fed7aa; color: #7c2d12; border-radius: 12px; padding: 10px 12px; font-size: 13px; line-height: 1.4; }
.pc-dom.free { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
.pc-prog { height: 6px; background: #fed7aa; border-radius: 99px; margin-top: 8px; overflow: hidden; } .pc-prog i { display: block; height: 100%; background: var(--red); }
.pc-seg { display: flex; gap: 8px; } .pc-seg button { flex: 1; border: 1px solid var(--line); background: #fff; color: var(--ink); border-radius: 10px; padding: 10px; font: 600 14px Inter, system-ui, sans-serif; cursor: pointer; }
.pc-seg button.on { border-color: var(--red); background: #fff7ed; color: var(--red2); }
.pc-hint { font-size: 12px; color: var(--mut); margin: 0; }
.pc-check { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; color: var(--mut); line-height: 1.4; }
.pc-check input { margin-top: 2px; accent-color: var(--red); }
.pc-done { align-items: center; text-align: center; padding-top: 12px; gap: 12px; }
.pc-ok { width: 56px; height: 56px; border-radius: 50%; background: #16a34a; color: #fff; display: grid; place-items: center; font-size: 28px; }
.pc-code { font-size: 38px; font-weight: 800; color: var(--red); margin: 0; letter-spacing: 2px; }
.pc-done p { font-size: 14px; color: #44403c; margin: 0; }
</style>
