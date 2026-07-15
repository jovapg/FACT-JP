<template>
  <PageLayout :title="isAdmin ? 'Nómina' : 'Mi Nómina'">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ isAdmin ? 'Nómina del personal' : 'Mi Nómina' }}</h1>
        <p class="page-subtitle">
          {{ isAdmin ? 'Revisa, aprueba y paga los días reportados' : 'Registra tus días trabajados' }}
        </p>
      </div>
      <div class="header-actions">
        <button v-if="isAdmin" class="btn btn-outline" @click="openRates">⚙️ Tarifas</button>
        <button class="btn btn-primary" @click="openCreate">➕ Registrar día</button>
      </div>
    </div>

    <!-- ══════════ PANEL TRABAJADORA ══════════ -->
    <template v-if="!isAdmin">
      <div class="summary-grid">
        <div class="sum-card">
          <span class="sum-label">Días este mes</span>
          <span class="sum-value">{{ myStats.count }}</span>
        </div>
        <div class="sum-card">
          <span class="sum-label">Acumulado</span>
          <span class="sum-value">{{ fmtCOP(myStats.total) }}</span>
        </div>
        <div class="sum-card warn">
          <span class="sum-label">Por cobrar</span>
          <span class="sum-value">{{ fmtCOP(myStats.pending) }}</span>
        </div>
        <div class="sum-card ok">
          <span class="sum-label">Pagado</span>
          <span class="sum-value">{{ fmtCOP(myStats.paid) }}</span>
        </div>
      </div>

      <div class="card" style="padding:0;overflow:hidden">
        <div class="list-head"><h3>Mis días</h3></div>
        <div v-if="store.entries.length === 0" class="empty-state">
          <div class="empty-state-icon">📅</div>
          <p class="empty-state-text">Aún no has registrado ningún día. Toca "Registrar día".</p>
        </div>
        <div v-for="e in store.entries" :key="e.id" class="day-row">
          <div class="day-main">
            <span class="day-date">{{ fmtDate(e.date) }}</span>
            <span class="day-type">{{ typeLabel(e) }}</span>
            <span :class="['area-chip', e.area]">{{ areaLabel(e.area) }}</span>
          </div>
          <div class="day-right">
            <span class="day-amount">{{ fmtCOP(e.amount) }}</span>
            <span :class="['status-chip', e.status]">{{ statusLabel(e.status) }}</span>
            <template v-if="e.status === 'pendiente'">
              <button class="icon-btn" @click="openEdit(e)" title="Editar">✏️</button>
              <button class="icon-btn danger" @click="removeEntry(e)" title="Eliminar">🗑️</button>
            </template>
          </div>
        </div>
      </div>
    </template>

    <!-- ══════════ PANEL ADMIN ══════════ -->
    <template v-else>
      <div v-if="byEmployee.length === 0" class="empty-state">
        <div class="empty-state-icon">👥</div>
        <p class="empty-state-text">Nadie ha reportado días todavía.</p>
      </div>

      <div v-for="emp in byEmployee" :key="emp.id" class="card emp-card">
        <div class="emp-head">
          <div>
            <h3 class="emp-name">{{ emp.name }}</h3>
            <div class="emp-badges">
              <span v-if="emp.pendingCount" class="mini-badge yellow">{{ emp.pendingCount }} pendiente(s)</span>
              <span v-if="emp.approvedCount" class="mini-badge blue">{{ emp.approvedCount }} aprobado(s)</span>
            </div>
          </div>
          <div class="emp-totals">
            <div class="emp-total">
              <span class="et-label">🍺 Bar por pagar</span>
              <span class="et-val">{{ fmtCOP(emp.unpaidBar) }}</span>
            </div>
            <div class="emp-total">
              <span class="et-label">🍽️ Rest. por pagar</span>
              <span class="et-val">{{ fmtCOP(emp.unpaidRest) }}</span>
            </div>
            <div class="emp-total strong">
              <span class="et-label">Total aprobado</span>
              <span class="et-val">{{ fmtCOP(emp.approvedUnpaid) }}</span>
            </div>
          </div>
        </div>

        <div class="emp-actions">
          <button v-if="emp.pendingCount" class="btn btn-sm btn-outline" @click="approveAll(emp)">
            ✓ Aprobar todos los pendientes
          </button>
          <button v-if="emp.approvedCount" class="btn btn-sm btn-primary" @click="openPay(emp)">
            💵 Generar pago ({{ fmtCOP(emp.approvedUnpaid) }})
          </button>
        </div>

        <div class="table-wrap">
          <table class="days-table">
            <thead>
              <tr><th>Fecha</th><th>Tipo</th><th>Bolsillo</th><th class="right">Monto</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="e in emp.items" :key="e.id">
                <td>{{ fmtDate(e.date) }}</td>
                <td>{{ typeLabel(e) }}</td>
                <td><span :class="['area-chip', e.area]">{{ areaLabel(e.area) }}</span></td>
                <td class="right">{{ fmtCOP(e.amount) }}</td>
                <td><span :class="['status-chip', e.status]">{{ statusLabel(e.status) }}</span></td>
                <td class="right nowrap">
                  <button v-if="e.status === 'pendiente'" class="icon-btn" @click="approveOne(e)" title="Aprobar">✓</button>
                  <button v-if="e.status !== 'pagado'" class="icon-btn" @click="openEdit(e)" title="Editar">✏️</button>
                  <button v-if="e.status !== 'pagado'" class="icon-btn danger" @click="removeEntry(e)" title="Eliminar">🗑️</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- ══════════ MODAL CREAR / EDITAR DÍA ══════════ -->
    <div class="modal-overlay" v-if="showForm" @click.self="showForm = false">
      <div class="modal" style="max-width:520px">
        <div class="modal-header">
          <h3 class="modal-title">{{ editing ? 'Editar día' : 'Registrar día trabajado' }}</h3>
          <button class="btn-close" @click="showForm = false">×</button>
        </div>
        <div class="modal-body">
          <!-- Admin: elegir para quién es el día (él mismo, un cajero, o un trabajador por días) -->
          <div class="form-group" v-if="isAdmin && !editing">
            <label class="form-label">¿Para quién? *</label>
            <select v-model="who" class="form-control">
              <option v-for="o in employeeOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
              <option value="__new__">➕ Otro trabajador (por días)</option>
            </select>
            <input
              v-if="who === '__new__'" v-model="newName" class="form-control"
              style="margin-top:8px" placeholder="Nombre del trabajador"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Fecha *</label>
            <input v-model="form.date" type="date" class="form-control" />
          </div>

          <div class="form-group">
            <label class="form-label">¿Cuánto trabajaste? *</label>
            <div class="type-picker">
              <button
                v-for="opt in typeOptions" :key="opt.value" type="button"
                :class="['type-card', { active: form.type === opt.value }]"
                @click="form.type = opt.value"
              >
                <span class="tc-emoji">{{ opt.emoji }}</span>
                <span class="tc-label">{{ opt.label }}</span>
                <span class="tc-price">{{ opt.value === 'rato' ? fmtCOP(opt.price) + '/hora' : fmtCOP(opt.price) }}</span>
              </button>
            </div>
          </div>

          <div class="form-group" v-if="form.type === 'rato'">
            <label class="form-label">Horario (de → a)</label>
            <div class="time-row">
              <input v-model="form.from" type="time" class="form-control" />
              <span class="time-sep">→</span>
              <input v-model="form.to" type="time" class="form-control" />
            </div>
            <p class="hint" v-if="previewHours > 0">{{ previewHours }} h × {{ fmtCOP(activeRates.hora) }}</p>
          </div>

          <div class="form-group">
            <label class="form-label">¿Dónde trabajaste? *</label>
            <div class="area-picker">
              <button type="button" :class="['area-option','bar',{active:form.area==='bar'}]" @click="form.area='bar'">🍺 Bar</button>
              <button type="button" :class="['area-option','restaurante',{active:form.area==='restaurante'}]" @click="form.area='restaurante'">🍽️ Restaurante</button>
              <button type="button" :class="['area-option','ambos',{active:form.area==='ambos'}]" @click="form.area='ambos'">⚖️ Ambos</button>
            </div>
            <p class="hint" v-if="form.area === 'ambos'">Se reparte 50% Bar y 50% Restaurante.</p>
          </div>

          <div class="amount-preview">
            <span>Total del día</span>
            <strong>{{ fmtCOP(previewAmount) }}</strong>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showForm = false">Cancelar</button>
          <button class="btn btn-primary" @click="saveEntry" :disabled="saving">
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ══════════ MODAL GENERAR PAGO ══════════ -->
    <div class="modal-overlay" v-if="payModal" @click.self="payModal = null">
      <div class="modal" style="max-width:480px">
        <div class="modal-header">
          <h3 class="modal-title">Pagar a {{ payModal.name }}</h3>
          <button class="btn-close" @click="payModal = null">×</button>
        </div>
        <div class="modal-body">
          <p class="pay-info">{{ payModal.ids.length }} día(s) aprobado(s) por pagar.</p>
          <div class="pay-breakdown">
            <div class="pb-row"><span>🍺 Bar</span><strong>{{ fmtCOP(payModal.bar) }}</strong></div>
            <div class="pb-row"><span>🍽️ Restaurante</span><strong>{{ fmtCOP(payModal.rest) }}</strong></div>
            <div class="pb-row total"><span>Total</span><strong>{{ fmtCOP(payModal.bar + payModal.rest) }}</strong></div>
          </div>

          <div class="form-group">
            <label class="form-label">¿De dónde sale el dinero?</label>
            <div class="area-picker">
              <button type="button" :class="['area-option',{active:payMethod==='efectivo'}]" @click="payMethod='efectivo'">💵 Efectivo</button>
              <button type="button" :class="['area-option',{active:payMethod==='banco'}]" @click="payMethod='banco'">🏦 Banco</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Fecha del pago</label>
            <input v-model="payDate" type="date" class="form-control" />
          </div>
          <p class="hint">Se crearán 2 salidas en Finanzas (Bar y Restaurante) que se descontarán del {{ payMethod }}.</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="payModal = null">Cancelar</button>
          <button class="btn btn-primary" @click="confirmPay" :disabled="paying">
            {{ paying ? 'Procesando...' : 'Confirmar pago' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ══════════ MODAL TARIFAS ══════════ -->
    <div class="modal-overlay" v-if="ratesModal" @click.self="ratesModal = false">
      <div class="modal" style="max-width:520px">
        <div class="modal-header">
          <h3 class="modal-title">Tarifas de nómina</h3>
          <button class="btn-close" @click="ratesModal = false">×</button>
        </div>
        <div class="modal-body">
          <!-- Tarifa general (la que se usa si una persona no tiene la suya) -->
          <h4 class="rates-sub">Tarifa general</h4>
          <p class="hint" style="margin-top:0">Se aplica a quien no tenga una tarifa propia.</p>
          <div class="rates-grid">
            <div>
              <label class="form-label">🌞 Día</label>
              <input v-model.number="ratesForm.dia" type="number" min="0" class="form-control" />
            </div>
            <div>
              <label class="form-label">🌗 Medio</label>
              <input v-model.number="ratesForm.medio" type="number" min="0" class="form-control" />
            </div>
            <div>
              <label class="form-label">⏱️ Hora</label>
              <input v-model.number="ratesForm.hora" type="number" min="0" class="form-control" />
            </div>
          </div>
          <button class="btn btn-sm btn-outline" style="margin-top:8px" @click="saveRates" :disabled="saving">
            Guardar tarifa general
          </button>

          <hr class="rates-divider" />

          <!-- Tarifa personalizada por persona -->
          <h4 class="rates-sub">Tarifa por persona</h4>
          <div class="form-group" style="margin-bottom:10px">
            <select v-model="selPerson" class="form-control" @change="onSelPerson">
              <option value="">Elegir persona…</option>
              <option v-for="p in peopleForRates" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div v-if="selPerson" class="rates-grid">
            <div>
              <label class="form-label">🌞 Día</label>
              <input v-model.number="personRates.dia" type="number" min="0" class="form-control" />
            </div>
            <div>
              <label class="form-label">🌗 Medio</label>
              <input v-model.number="personRates.medio" type="number" min="0" class="form-control" />
            </div>
            <div>
              <label class="form-label">⏱️ Hora</label>
              <input v-model.number="personRates.hora" type="number" min="0" class="form-control" />
            </div>
          </div>
          <div v-if="selPerson" class="person-rate-actions">
            <button class="btn btn-sm btn-primary" @click="savePersonRate" :disabled="saving">Guardar su tarifa</button>
            <button v-if="store.employeeRates[selPerson]" class="btn btn-sm btn-outline" @click="clearPersonRate(selPerson)">
              Usar la general
            </button>
          </div>

          <!-- Lista de quienes ya tienen tarifa propia -->
          <div v-if="customRatesList.length" class="custom-rates">
            <p class="hint">Con tarifa propia:</p>
            <div v-for="c in customRatesList" :key="c.id" class="custom-rate-row">
              <span class="cr-name">{{ c.name }}</span>
              <span class="cr-vals">{{ fmtCOP(c.dia) }} / {{ fmtCOP(c.medio) }} / {{ fmtCOP(c.hora) }}h</span>
              <button class="icon-btn danger" @click="clearPersonRate(c.id)" title="Quitar">×</button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="ratesModal = false">Cerrar</button>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<script setup>
/**
 * PayrollView.vue — Panel de Nómina
 *
 * Cajero → "Mi Nómina": registra sus días (fecha, tipo, área) y ve su estado.
 * Admin  → "Nómina": revisa por empleado, aprueba, edita y genera el pago.
 *
 * El monto lo calcula el backend; aquí solo se previsualiza. Al pagar, el
 * backend marca los días como pagados y Finanzas genera 2 salidas (Bar/Rest.).
 */
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { usePayrollStore } from '../stores/payroll.js'
import { useAuthStore } from '../stores/auth.js'
import PageLayout from '../components/PageLayout.vue'

const store = usePayrollStore()
const auth = useAuthStore()
const toast = inject('toast')

const isAdmin = computed(() => auth.isAdmin)

const showForm = ref(false)
const editing = ref(null)
const saving = ref(false)
const form = reactive({ date: todayCOT(), type: 'completo', area: 'ambos', from: '', to: '' })
const who = ref('')          // admin: para quién es el día (id o '__new__')
const newName = ref('')      // admin: nombre de un trabajador ocasional

const payModal = ref(null)   // { name, employeeId, ids, bar, rest }
const payMethod = ref('efectivo')
const payDate = ref(todayCOT())
const paying = ref(false)

const ratesModal = ref(false)
const ratesForm = reactive({ dia: 0, medio: 0, hora: 0 })
const selPerson = ref('')                              // persona elegida para tarifa propia
const personRates = reactive({ dia: 0, medio: 0, hora: 0 })

// Tarifa que aplica al día que se está registrando (según la persona elegida)
const activeRates = computed(() => {
  if (!isAdmin.value) return store.rates                       // cajero: backend envía su tarifa
  if (editing.value) return store.ratesFor(editing.value.employeeId)
  if (who.value === '__new__') return store.rates              // trabajador nuevo → general
  return store.ratesFor(who.value)
})

const typeOptions = computed(() => [
  { value: 'completo', label: 'Día completo', emoji: '🌞', price: activeRates.value.dia },
  { value: 'medio',    label: 'Medio día',    emoji: '🌗', price: activeRates.value.medio },
  { value: 'rato',     label: 'Un rato',      emoji: '⏱️', price: activeRates.value.hora }
])

// ── Helpers ──────────────────────────────────────────────
function todayCOT() {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
}
function fmtCOP(v) { return '$' + Number(v || 0).toLocaleString('es-CO') }
function fmtDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function areaLabel(a) { return a === 'bar' ? '🍺 Bar' : a === 'restaurante' ? '🍽️ Rest.' : '⚖️ Ambos' }
function statusLabel(s) { return s === 'pendiente' ? 'Pendiente' : s === 'aprobado' ? 'Aprobado' : 'Pagado' }
function typeLabel(e) {
  if (e.type === 'completo') return 'Día completo'
  if (e.type === 'medio') return 'Medio día'
  return `Rato (${e.hours || 0}h)`
}
function hoursBetween(from, to) {
  if (!from || !to) return 0
  const [fh, fm] = from.split(':').map(Number)
  const [th, tm] = to.split(':').map(Number)
  if ([fh, fm, th, tm].some(isNaN)) return 0
  let mins = (th * 60 + tm) - (fh * 60 + fm)
  if (mins < 0) mins += 24 * 60
  return Math.round((mins / 60) * 100) / 100
}

const previewHours = computed(() => form.type === 'rato' ? hoursBetween(form.from, form.to) : 0)
const previewAmount = computed(() => {
  if (form.type === 'completo') return activeRates.value.dia
  if (form.type === 'medio') return activeRates.value.medio
  return Math.round(previewHours.value * activeRates.value.hora)
})

// ── Resumen del trabajador ───────────────────────────────
const myStats = computed(() => {
  let total = 0, paid = 0, pending = 0, count = 0
  const month = todayCOT().slice(0, 7)
  for (const e of store.entries) {
    if ((e.date || '').slice(0, 7) === month) { count++; total += e.amount || 0 }
    if (e.status === 'pagado') paid += e.amount || 0
    else pending += e.amount || 0
  }
  return { total, paid, pending, count }
})

// ── Agrupación por empleado (admin) ──────────────────────
const byEmployee = computed(() => {
  const map = {}
  for (const e of store.entries) {
    const g = map[e.employeeId] || (map[e.employeeId] = {
      id: e.employeeId, name: e.employeeName || 'Empleado', items: [],
      pendingCount: 0, approvedCount: 0, unpaidBar: 0, unpaidRest: 0, approvedUnpaid: 0
    })
    g.items.push(e)
    if (e.status === 'pendiente') g.pendingCount++
    if (e.status === 'aprobado') {
      g.approvedCount++
      g.unpaidBar += e.amountBar || 0
      g.unpaidRest += e.amountRest || 0
      g.approvedUnpaid += e.amount || 0
    }
  }
  return Object.values(map)
})

/** Personas a las que se les puede fijar tarifa: usuarios + trabajadores ocasionales. */
const peopleForRates = computed(() => {
  const map = new Map()
  for (const u of store.users) map.set(u.id, { id: u.id, name: u.name || u.username })
  for (const e of store.entries) {
    if (String(e.employeeId).startsWith('manual:')) map.set(e.employeeId, { id: e.employeeId, name: e.employeeName })
  }
  return [...map.values()]
})

/** Quienes ya tienen una tarifa propia (para mostrarlas y poder quitarlas). */
const customRatesList = computed(() =>
  Object.entries(store.employeeRates).map(([id, r]) => {
    const p = peopleForRates.value.find(x => x.id === id)
    return { id, name: p?.name || id.replace(/^manual:/, ''), ...r }
  })
)

/** Opciones de "¿para quién?" (admin): yo + empleados ya conocidos. */
const employeeOptions = computed(() => {
  const meId = auth.user?.id
  const meName = auth.user?.name || auth.user?.username || 'Yo'
  const opts = [{ id: meId, label: `Yo (${meName})`, name: meName }]
  for (const e of byEmployee.value) {
    if (e.id !== meId) opts.push({ id: e.id, label: e.name, name: e.name })
  }
  return opts
})

// ── Acciones ─────────────────────────────────────────────
function openCreate() {
  editing.value = null
  Object.assign(form, { date: todayCOT(), type: 'completo', area: 'ambos', from: '', to: '' })
  who.value = auth.user?.id       // por defecto: yo
  newName.value = ''
  showForm.value = true
}
function openEdit(e) {
  editing.value = e
  Object.assign(form, {
    date: e.date, type: e.type, area: e.area,
    from: e.from || '', to: e.to || ''
  })
  showForm.value = true
}
async function saveEntry() {
  if (form.type === 'rato' && previewHours.value <= 0) {
    return toast('Indica un horario válido (de → a).', 'error')
  }
  if (isAdmin.value && !editing.value && who.value === '__new__' && !newName.value.trim()) {
    return toast('Escribe el nombre del trabajador.', 'error')
  }
  saving.value = true
  try {
    const payload = { date: form.date, type: form.type, area: form.area, from: form.from, to: form.to }
    // Admin registrando: adjuntar a quién pertenece el día
    if (isAdmin.value && !editing.value) {
      if (who.value === '__new__') {
        payload.employeeName = newName.value.trim()
      } else {
        const opt = employeeOptions.value.find(o => o.id === who.value)
        payload.employeeId = who.value
        if (opt) payload.employeeName = opt.name
      }
    }
    if (editing.value) {
      await store.updateEntry(editing.value.id, payload)
      toast('Día actualizado', 'success')
    } else {
      await store.createEntry(payload)
      toast('Día registrado', 'success')
    }
    showForm.value = false
    await store.fetch()
  } catch (err) {
    toast(err.response?.data?.error || 'Error al guardar', 'error')
  } finally {
    saving.value = false
  }
}
async function removeEntry(e) {
  if (!confirm(`¿Eliminar el día ${fmtDate(e.date)}?`)) return
  try {
    await store.deleteEntry(e.id)
    toast('Día eliminado', 'success')
    await store.fetch()
  } catch (err) {
    toast(err.response?.data?.error || 'Error al eliminar', 'error')
  }
}
async function approveOne(e) {
  try { await store.approve([e.id]); toast('Día aprobado', 'success'); await store.fetch() }
  catch (err) { toast(err.response?.data?.error || 'Error', 'error') }
}
async function approveAll(emp) {
  const ids = emp.items.filter(e => e.status === 'pendiente').map(e => e.id)
  if (!ids.length) return
  try { await store.approve(ids); toast(`${ids.length} día(s) aprobado(s)`, 'success'); await store.fetch() }
  catch (err) { toast(err.response?.data?.error || 'Error', 'error') }
}
function openPay(emp) {
  const approved = emp.items.filter(e => e.status === 'aprobado')
  payModal.value = {
    name: emp.name, employeeId: emp.id,
    ids: approved.map(e => e.id),
    bar: approved.reduce((s, e) => s + (e.amountBar || 0), 0),
    rest: approved.reduce((s, e) => s + (e.amountRest || 0), 0)
  }
  payMethod.value = 'efectivo'
  payDate.value = todayCOT()
}
async function confirmPay() {
  paying.value = true
  try {
    const r = await store.pay({
      employeeId: payModal.value.employeeId,
      ids: payModal.value.ids,
      method: payMethod.value,
      date: payDate.value
    })
    toast(`Pago registrado: ${fmtCOP(r.total)} (${r.days} días)`, 'success')
    payModal.value = null
    await store.fetch()
  } catch (err) {
    toast(err.response?.data?.error || 'Error al pagar', 'error')
  } finally {
    paying.value = false
  }
}
function openRates() {
  Object.assign(ratesForm, store.rates)
  selPerson.value = ''
  store.fetchUsers()
  ratesModal.value = true
}
async function saveRates() {
  saving.value = true
  try {
    await store.saveRates({ dia: ratesForm.dia, medio: ratesForm.medio, hora: ratesForm.hora })
    toast('Tarifa general actualizada', 'success')
  } catch (err) {
    toast(err.response?.data?.error || 'Error', 'error')
  } finally {
    saving.value = false
  }
}
/** Al elegir persona, precargar su tarifa (propia o la general). */
function onSelPerson() {
  const r = store.employeeRates[selPerson.value] || store.rates
  Object.assign(personRates, { dia: r.dia, medio: r.medio, hora: r.hora })
}
async function savePersonRate() {
  if (!selPerson.value) return toast('Elige una persona.', 'error')
  saving.value = true
  try {
    const p = peopleForRates.value.find(x => x.id === selPerson.value)
    await store.saveEmployeeRate({
      employeeId: selPerson.value, employeeName: p?.name,
      dia: personRates.dia, medio: personRates.medio, hora: personRates.hora
    })
    toast('Tarifa personalizada guardada', 'success')
  } catch (err) {
    toast(err.response?.data?.error || 'Error', 'error')
  } finally {
    saving.value = false
  }
}
async function clearPersonRate(id) {
  try {
    await store.saveEmployeeRate({ employeeId: id, clear: true })
    toast('Ahora usa la tarifa general', 'success')
    if (selPerson.value === id) onSelPerson()
  } catch (err) {
    toast(err.response?.data?.error || 'Error', 'error')
  }
}

onMounted(() => store.fetch())
</script>

<style scoped>
.page-header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:18px; flex-wrap:wrap; }
.header-actions { display:flex; gap:8px; }

/* Resumen trabajadora */
.summary-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:18px; }
.sum-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:14px 16px; display:flex; flex-direction:column; gap:4px; box-shadow:var(--shadow); }
.sum-card.warn { border-left:3px solid #f59e0b; }
.sum-card.ok { border-left:3px solid #10b981; }
.sum-label { font-size:12px; color:var(--text-light); }
.sum-value { font-size:20px; font-weight:800; color:var(--text); }

.card { background:var(--surface); border-radius:var(--radius); box-shadow:var(--shadow); border:1px solid var(--border); margin-bottom:16px; }
.list-head { padding:14px 16px; border-bottom:1px solid var(--border); }
.list-head h3 { font-size:15px; font-weight:700; }

/* Filas de día (trabajadora) */
.day-row { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid var(--border); gap:10px; flex-wrap:wrap; }
.day-row:last-child { border-bottom:none; }
.day-main { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.day-date { font-weight:700; font-size:14px; }
.day-type { font-size:13px; color:var(--text-secondary); }
.day-right { display:flex; align-items:center; gap:8px; }
.day-amount { font-weight:800; color:var(--success); font-size:14px; }

/* Chips */
.area-chip { font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px; }
.area-chip.bar { background:#f59e0b22; color:#b45309; }
.area-chip.restaurante { background:#10b98122; color:#047857; }
.area-chip.ambos { background:#6366f122; color:#4338ca; }
.status-chip { font-size:11px; font-weight:700; padding:2px 9px; border-radius:20px; }
.status-chip.pendiente { background:#fef3c7; color:#b45309; }
.status-chip.aprobado { background:#dbeafe; color:#1d4ed8; }
.status-chip.pagado { background:#d1fae5; color:#047857; }

.icon-btn { background:none; border:1px solid var(--border); border-radius:7px; cursor:pointer; padding:3px 7px; font-size:13px; transition:all .15s; }
.icon-btn:hover { background:var(--bg); border-color:var(--accent); }
.icon-btn.danger:hover { border-color:var(--danger); }

/* Admin — tarjetas por empleado */
.emp-card { padding:16px; }
.emp-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; margin-bottom:12px; }
.emp-name { font-size:16px; font-weight:800; }
.emp-badges { display:flex; gap:6px; margin-top:4px; flex-wrap:wrap; }
.mini-badge { font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px; }
.mini-badge.yellow { background:#fef3c7; color:#b45309; }
.mini-badge.blue { background:#dbeafe; color:#1d4ed8; }
.emp-totals { display:flex; gap:16px; flex-wrap:wrap; }
.emp-total { display:flex; flex-direction:column; align-items:flex-end; }
.et-label { font-size:11px; color:var(--text-light); }
.et-val { font-size:15px; font-weight:700; }
.emp-total.strong .et-val { color:var(--success); font-size:17px; font-weight:800; }
.emp-actions { display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; }

.table-wrap { overflow-x:auto; }
.days-table { width:100%; border-collapse:collapse; font-size:13px; }
.days-table th { text-align:left; font-size:11px; color:var(--text-light); font-weight:600; padding:6px 10px; border-bottom:1px solid var(--border); text-transform:uppercase; }
.days-table td { padding:8px 10px; border-bottom:1px solid var(--border); }
.days-table tr:last-child td { border-bottom:none; }
.right { text-align:right; }
.nowrap { white-space:nowrap; }

/* Modales (reusa estilo global .modal-*) */
.form-group { margin-bottom:16px; }
.form-label { display:block; font-size:13px; font-weight:600; margin-bottom:6px; }
.hint { font-size:12px; color:var(--text-light); margin-top:6px; }

.type-picker { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.type-card { display:flex; flex-direction:column; align-items:center; gap:2px; padding:12px 6px; border:2px solid var(--border); border-radius:12px; background:var(--surface); cursor:pointer; transition:all .15s; }
.type-card.active { border-color:var(--primary); background:var(--surface-2); }
.tc-emoji { font-size:22px; }
.tc-label { font-size:12px; font-weight:700; text-align:center; }
.tc-price { font-size:11px; color:var(--success); font-weight:700; }

.time-row { display:flex; align-items:center; gap:10px; }
.time-sep { font-weight:700; color:var(--text-light); }

.area-picker { display:flex; gap:8px; }
.area-option { flex:1; padding:12px; border-radius:10px; border:2px solid var(--border); background:var(--surface); font-size:13px; font-weight:700; cursor:pointer; transition:all .15s; }
.area-option.active { border-color:var(--primary); background:var(--surface-2); }
.area-option.bar.active { background:#f59e0b; color:#fff; border-color:#f59e0b; }
.area-option.restaurante.active { background:#10b981; color:#fff; border-color:#10b981; }

.amount-preview { display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:var(--bg); border-radius:10px; font-size:14px; }
.amount-preview strong { font-size:20px; color:var(--success); }

.pay-info { font-size:13px; color:var(--text-secondary); margin-bottom:10px; }
.pay-breakdown { background:var(--bg); border-radius:10px; padding:10px 14px; margin-bottom:16px; }
.pb-row { display:flex; justify-content:space-between; padding:5px 0; font-size:14px; }
.pb-row.total { border-top:1px solid var(--border); margin-top:4px; padding-top:8px; font-weight:800; }
.pb-row.total strong { color:var(--success); }

/* Modal de tarifas */
.rates-sub { font-size:14px; font-weight:700; margin-bottom:2px; }
.rates-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.rates-grid .form-label { font-size:12px; }
.rates-divider { border:none; border-top:1px solid var(--border); margin:18px 0; }
.person-rate-actions { display:flex; gap:8px; margin-top:10px; }
.custom-rates { margin-top:16px; }
.custom-rate-row { display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border); }
.cr-name { font-weight:600; font-size:13px; flex:1; }
.cr-vals { font-size:12px; color:var(--text-secondary); }

.empty-state { text-align:center; padding:40px 20px; }
.empty-state-icon { font-size:40px; margin-bottom:10px; }
.empty-state-text { color:var(--text-light); font-size:14px; }
</style>
