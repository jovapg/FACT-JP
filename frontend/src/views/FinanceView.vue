<template>
  <PageLayout title="Finanzas">
    <div class="page-header">
      <div>
        <h1 class="page-title">Finanzas</h1>
        <p class="page-subtitle">Cuánto tienes en efectivo y banco, por Bar y Restaurante</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-outline" @click="openConfig">⚙️ Saldo inicial</button>
        <button class="btn btn-primary" @click="openManual">+ Movimiento</button>
      </div>
    </div>

    <!-- Selector de área + periodo -->
    <div class="card filters-bar mb-3">
      <div class="seg">
        <button v-for="a in areas" :key="a.value" :class="['seg-btn', { active: area === a.value }]" @click="area = a.value">{{ a.label }}</button>
      </div>
      <div class="seg">
        <button v-for="p in periods" :key="p.value" :class="['seg-btn', { active: period === p.value }]" @click="setPeriod(p.value)">{{ p.label }}</button>
      </div>
    </div>

    <div v-if="finance.loading && !finance.data" class="loading"><div class="spinner"></div></div>

    <template v-else>
      <!-- Tarjetas de saldo -->
      <div class="cards-grid mb-3">
        <div class="fcard efectivo">
          <p class="fcard-label">💵 Efectivo</p>
          <p class="fcard-value">{{ formatCOP(sel.efectivo) }}</p>
          <div v-if="area === 'total'" class="fcard-sub">
            <span>🍺 {{ formatCOP(bal.bar.efectivo) }}</span>
            <span>🍽️ {{ formatCOP(bal.restaurante.efectivo) }}</span>
          </div>
        </div>
        <div class="fcard banco">
          <p class="fcard-label">🏦 Banco</p>
          <p class="fcard-value">{{ formatCOP(sel.banco) }}</p>
          <div v-if="area === 'total'" class="fcard-sub">
            <span>🍺 {{ formatCOP(bal.bar.banco) }}</span>
            <span>🍽️ {{ formatCOP(bal.restaurante.banco) }}</span>
          </div>
        </div>
        <div class="fcard total">
          <p class="fcard-label">💰 Dinero que debería tener</p>
          <p class="fcard-value">{{ formatCOP(sel.efectivo + sel.banco) }}</p>
          <div class="fcard-sub"><span>Efectivo + banco (salidas ya restadas)</span></div>
        </div>
      </div>

      <!-- Resumen del mes (referencia, no afecta saldos) -->
      <div class="card ref-card mb-3">
        <div class="ref-head">
          <span>📋 Resumen del mes <em>(referencia · no afecta los saldos)</em></span>
          <button class="btn btn-sm btn-outline" @click="openRef">✏️ Editar</button>
        </div>
        <div class="ref-body">
          <div class="ref-item"><span class="ref-l">Ventas del mes</span><span class="ref-v pos">{{ formatCOP(refSel.ventas) }}</span></div>
          <div class="ref-item"><span class="ref-l">Salidas del mes</span><span class="ref-v neg">{{ formatCOP(refSel.salidas) }}</span></div>
          <div class="ref-item"><span class="ref-l">Neto</span><span class="ref-v" :class="(refSel.ventas - refSel.salidas) < 0 ? 'neg' : 'pos'">{{ formatCOP(refSel.ventas - refSel.salidas) }}</span></div>
        </div>
      </div>

      <!-- Listas Entradas / Salidas -->
      <div class="ledger-grid">
        <div class="card ledger-col">
          <div class="ledger-head entradas-head">↑ Entradas <span>{{ formatCOP(periodIngresos) }}</span></div>
          <div v-if="entradas.length === 0" class="ledger-empty">Sin entradas en el periodo</div>
          <div v-for="m in entradas" :key="m.id" class="mov">
            <div class="mov-info">
              <span class="mov-label">{{ m.label }}</span>
              <span class="mov-meta">{{ formatDate(m.date) }} · {{ areaTag(m.area) }} · {{ bucketIcon(m.bucket) }}</span>
            </div>
            <span class="mov-amount pos">+{{ formatCOP(m.amount) }}</span>
          </div>
        </div>

        <div class="card ledger-col">
          <div class="ledger-head salidas-head">↓ Salidas <span>{{ formatCOP(periodEgresos) }}</span></div>
          <div v-if="salidas.length === 0" class="ledger-empty">Sin salidas en el periodo</div>
          <div v-for="m in salidas" :key="m.id" class="mov">
            <div class="mov-info">
              <span class="mov-label">{{ m.label }}</span>
              <span class="mov-meta">{{ formatDate(m.date) }} · {{ areaTag(m.area) }} · {{ bucketIcon(m.bucket) }}</span>
            </div>
            <div class="mov-right">
              <span :class="['mov-amount', m.type === 'traslado' ? 'tras' : 'neg']">
                {{ m.type === 'traslado' ? '↔' : '−' }}{{ formatCOP(m.amount) }}
              </span>
              <button v-if="!m.locked" class="mov-del" title="Eliminar" @click="removeManual(m)">🗑</button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Modal: Saldo inicial ── -->
    <div class="modal-overlay" v-if="showConfig" @click.self="showConfig = false">
      <div class="modal" style="max-width:460px">
        <div class="modal-header">
          <h3 class="modal-title">⚙️ Saldo inicial</h3>
          <button class="btn-close" @click="showConfig = false">×</button>
        </div>
        <div class="modal-body">
          <p class="text-muted" style="font-size:12.5px;margin-bottom:12px">
            Cuánto tienes HOY en efectivo y banco (incluye la base de caja). Desde la fecha de inicio,
            cierres de turno, compras y pagos se suman/restan sobre estos saldos.
          </p>
          <div class="form-group">
            <label class="form-label">Fecha de inicio</label>
            <input v-model="configForm.openingDate" type="date" class="form-control" />
          </div>
          <div class="config-grid">
            <div></div><div class="ch">💵 Efectivo</div><div class="ch">🏦 Banco</div>
            <div class="rh">🍺 Bar</div>
            <input v-model.number="configForm.bar.efectivo" type="number" min="0" class="form-control" />
            <input v-model.number="configForm.bar.banco" type="number" min="0" class="form-control" />
            <div class="rh">🍽️ Restaurante</div>
            <input v-model.number="configForm.restaurante.efectivo" type="number" min="0" class="form-control" />
            <input v-model.number="configForm.restaurante.banco" type="number" min="0" class="form-control" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showConfig = false">Cancelar</button>
          <button class="btn btn-primary" @click="saveConfig" :disabled="saving">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
        </div>
      </div>
    </div>

    <!-- ── Modal: Resumen del mes (referencia) ── -->
    <div class="modal-overlay" v-if="showRef" @click.self="showRef = false">
      <div class="modal" style="max-width:460px">
        <div class="modal-header">
          <h3 class="modal-title">📋 Resumen del mes (referencia)</h3>
          <button class="btn-close" @click="showRef = false">×</button>
        </div>
        <div class="modal-body">
          <p class="text-muted" style="font-size:12.5px;margin-bottom:12px">
            Son cifras solo para verlas como referencia (lo que vendiste y gastaste este mes).
            <strong>No cambian los saldos de efectivo ni banco.</strong>
          </p>
          <div class="config-grid">
            <div></div><div class="ch">Ventas</div><div class="ch">Salidas</div>
            <div class="rh">🍺 Bar</div>
            <input v-model.number="refForm.bar.ventas" type="number" min="0" class="form-control" />
            <input v-model.number="refForm.bar.salidas" type="number" min="0" class="form-control" />
            <div class="rh">🍽️ Restaurante</div>
            <input v-model.number="refForm.restaurante.ventas" type="number" min="0" class="form-control" />
            <input v-model.number="refForm.restaurante.salidas" type="number" min="0" class="form-control" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showRef = false">Cancelar</button>
          <button class="btn btn-primary" @click="saveRef" :disabled="saving">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
        </div>
      </div>
    </div>

    <!-- ── Modal: Movimiento manual ── -->
    <div class="modal-overlay" v-if="showManual" @click.self="showManual = false">
      <div class="modal" style="max-width:440px">
        <div class="modal-header">
          <h3 class="modal-title">+ Movimiento manual</h3>
          <button class="btn-close" @click="showManual = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Tipo</label>
            <div class="seg">
              <button :class="['seg-btn', { active: manualForm.type === 'ingreso' }]" @click="manualForm.type = 'ingreso'">↑ Entrada</button>
              <button :class="['seg-btn', { active: manualForm.type === 'egreso' }]" @click="manualForm.type = 'egreso'">↓ Salida</button>
              <button :class="['seg-btn', { active: manualForm.type === 'traslado' }]" @click="manualForm.type = 'traslado'">↔ Traslado</button>
            </div>
          </div>

          <div class="grid grid-2">
            <div class="form-group">
              <label class="form-label">Área</label>
              <select v-model="manualForm.area" class="form-control">
                <option value="bar">🍺 Bar</option>
                <option value="restaurante">🍽️ Restaurante</option>
                <option value="general">General</option>
              </select>
            </div>
            <div class="form-group" v-if="manualForm.type !== 'traslado'">
              <label class="form-label">¿Dónde?</label>
              <select v-model="manualForm.bucket" class="form-control">
                <option value="efectivo">💵 Efectivo</option>
                <option value="banco">🏦 Banco</option>
              </select>
            </div>
            <div class="form-group" v-else>
              <label class="form-label">Desde</label>
              <select v-model="manualForm.from" class="form-control">
                <option value="efectivo">💵 Efectivo → 🏦 Banco</option>
                <option value="banco">🏦 Banco → 💵 Efectivo</option>
              </select>
            </div>
          </div>

          <div class="grid grid-2">
            <div class="form-group">
              <label class="form-label">Monto (COP) *</label>
              <input v-model.number="manualForm.amount" type="number" min="0" class="form-control" placeholder="0" />
            </div>
            <div class="form-group">
              <label class="form-label">Fecha</label>
              <input v-model="manualForm.date" type="date" class="form-control" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Detalle</label>
            <input v-model="manualForm.description" class="form-control" placeholder="Ej: Depósito al banco, inyección de capital..." />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showManual = false">Cancelar</button>
          <button class="btn btn-primary" @click="saveManual" :disabled="saving">{{ saving ? 'Guardando...' : 'Registrar' }}</button>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<script setup>
/**
 * FinanceView.vue — Módulo de Finanzas / flujo de caja
 *
 * Muestra los saldos de efectivo y banco (por Bar / Restaurante / Total),
 * las entradas y salidas del periodo, y permite fijar el saldo inicial y
 * registrar movimientos manuales (incluido el traslado efectivo↔banco).
 */
import { ref, computed, onMounted, inject } from 'vue'
import { useFinanceStore } from '../stores/finance.js'
import PageLayout from '../components/PageLayout.vue'

const finance = useFinanceStore()
const toast = inject('toast')

const area = ref('total')
const period = ref('mes')
const saving = ref(false)
const showConfig = ref(false)
const showManual = ref(false)
const showRef = ref(false)

const areas = [
  { value: 'total', label: 'Total' },
  { value: 'bar', label: '🍺 Bar' },
  { value: 'restaurante', label: '🍽️ Restaurante' }
]
const periods = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'todo', label: 'Todo' }
]

const emptyArea = () => ({ efectivo: 0, banco: 0 })
const bal = computed(() => finance.data?.balances || { bar: emptyArea(), restaurante: emptyArea(), general: emptyArea() })
const sel = computed(() => {
  if (!finance.data) return emptyArea()
  return area.value === 'total' ? finance.data.totals : bal.value[area.value]
})

const movsAll = computed(() => finance.data?.movements || [])
const movs = computed(() => area.value === 'total' ? movsAll.value : movsAll.value.filter(m => m.area === area.value))
const entradas = computed(() => movs.value.filter(m => m.type === 'ingreso'))
const salidas = computed(() => movs.value.filter(m => m.type === 'egreso' || m.type === 'traslado'))
const periodIngresos = computed(() => entradas.value.reduce((s, m) => s + m.amount, 0))
const periodEgresos = computed(() => movs.value.filter(m => m.type === 'egreso').reduce((s, m) => s + m.amount, 0))
const neto = computed(() => periodIngresos.value - periodEgresos.value)

// Resumen del mes (referencia)
const refData = computed(() => finance.data?.reference || { bar: { ventas: 0, salidas: 0 }, restaurante: { ventas: 0, salidas: 0 } })
const refSel = computed(() => {
  const r = refData.value
  if (area.value === 'restaurante') return r.restaurante
  if (area.value === 'bar') return r.bar
  if (area.value === 'general') return { ventas: 0, salidas: 0 }
  return { ventas: (r.bar.ventas || 0) + (r.restaurante.ventas || 0), salidas: (r.bar.salidas || 0) + (r.restaurante.salidas || 0) }
})

function formatCOP(v) { return '$' + Number(v || 0).toLocaleString('es-CO') }
function formatDate(iso) { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
function areaTag(a) { return a === 'restaurante' ? '🍽️ Rest.' : a === 'bar' ? '🍺 Bar' : 'General' }
function bucketIcon(b) { return b === 'banco' ? '🏦 Banco' : '💵 Efectivo' }

/** Calcula el rango de fechas según el preset de periodo */
function rangeFor(p) {
  const now = new Date()
  const iso = (d) => d.toISOString().slice(0, 10)
  if (p === 'hoy') return { from: iso(now), to: iso(now) }
  if (p === 'semana') { const f = new Date(now); f.setDate(f.getDate() - 6); return { from: iso(f), to: iso(now) } }
  if (p === 'mes') return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) }
  return {} // 'todo'
}

async function load() {
  try { await finance.fetchFinance(rangeFor(period.value)) }
  catch (err) { toast(err.response?.data?.error || 'Error al cargar finanzas', 'error') }
}
function setPeriod(p) { period.value = p; load() }

// ── Saldo inicial ──
const configForm = ref({ openingDate: '', bar: emptyArea(), restaurante: emptyArea() })
function openConfig() {
  const d = finance.data
  configForm.value = {
    openingDate: d?.openingDate ? d.openingDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    bar: { ...emptyArea(), ...(d?.opening?.bar || {}) },
    restaurante: { ...emptyArea(), ...(d?.opening?.restaurante || {}) }
  }
  showConfig.value = true
}
async function saveConfig() {
  saving.value = true
  try {
    await finance.setOpening(
      { bar: configForm.value.bar, restaurante: configForm.value.restaurante },
      configForm.value.openingDate
    )
    showConfig.value = false
    toast('Saldo inicial guardado', 'success')
    await load()
  } catch (err) {
    toast(err.response?.data?.error || 'Error al guardar', 'error')
  } finally { saving.value = false }
}

// ── Resumen del mes (referencia) ──
const refForm = ref({ bar: { ventas: 0, salidas: 0 }, restaurante: { ventas: 0, salidas: 0 } })
function openRef() {
  const r = refData.value
  refForm.value = {
    bar: { ventas: r.bar.ventas || 0, salidas: r.bar.salidas || 0 },
    restaurante: { ventas: r.restaurante.ventas || 0, salidas: r.restaurante.salidas || 0 }
  }
  showRef.value = true
}
async function saveRef() {
  saving.value = true
  try {
    await finance.setReference(refForm.value)
    showRef.value = false
    toast('Resumen guardado', 'success')
    await load()
  } catch (err) {
    toast(err.response?.data?.error || 'Error al guardar', 'error')
  } finally { saving.value = false }
}

// ── Movimiento manual ──
const manualForm = ref({ type: 'egreso', area: 'bar', bucket: 'efectivo', from: 'efectivo', amount: 0, description: '', date: '' })
function openManual() {
  manualForm.value = { type: 'egreso', area: area.value === 'total' ? 'bar' : area.value, bucket: 'efectivo', from: 'efectivo', amount: 0, description: '', date: new Date().toISOString().slice(0, 10) }
  showManual.value = true
}
async function saveManual() {
  if (!(Number(manualForm.value.amount) > 0)) { toast('El monto debe ser mayor a 0', 'warning'); return }
  saving.value = true
  try {
    await finance.addManual({ ...manualForm.value })
    showManual.value = false
    toast('Movimiento registrado', 'success')
    await load()
  } catch (err) {
    toast(err.response?.data?.error || 'Error al registrar', 'error')
  } finally { saving.value = false }
}
async function removeManual(m) {
  if (!confirm('¿Eliminar este movimiento manual?')) return
  try {
    await finance.deleteManual(m.id)
    toast('Movimiento eliminado', 'success')
    await load()
  } catch (err) {
    toast(err.response?.data?.error || 'Error al eliminar', 'error')
  }
}

onMounted(load)
</script>

<style scoped>
.mb-3 { margin-bottom: 16px; }
.filters-bar { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; padding: 12px 14px; }
.seg { display: inline-flex; gap: 4px; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 3px; flex-wrap: wrap; }
.seg-btn { border: none; background: none; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text-secondary); white-space: nowrap; }
.seg-btn.active { background: var(--accent); color: #1a0a00; }

.cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.fcard { border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 18px; background: var(--surface); }
.fcard-label { font-size: 12px; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
.fcard-value { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; color: var(--text); }
.fcard-sub { display: flex; gap: 12px; margin-top: 8px; font-size: 12px; color: var(--text-light); }
.fcard.efectivo { border-left: 4px solid #16a34a; }
.fcard.banco { border-left: 4px solid #2563eb; }
.fcard.total { border-left: 4px solid var(--accent); }
.fcard.neto { border-left: 4px solid #16a34a; }
.fcard.neto.negative { border-left-color: var(--danger); }
.fcard.neto.negative .fcard-value { color: var(--danger); }
.fcard-sub .pos { color: #16a34a; font-weight: 700; }
.fcard-sub .neg { color: var(--danger); font-weight: 700; }

.ledger-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.ledger-col { padding: 0; overflow: hidden; }
.ledger-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; font-weight: 700; font-size: 14px; border-bottom: 1px solid var(--border); }
.entradas-head { background: #f0fdf4; color: #15803d; }
.salidas-head { background: #fef2f2; color: #dc2626; }
.ledger-empty { padding: 24px; text-align: center; color: var(--text-light); font-size: 13px; }
.mov { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 16px; border-bottom: 1px solid var(--border); }
.mov:last-child { border-bottom: none; }
.mov-info { display: flex; flex-direction: column; min-width: 0; }
.mov-label { font-size: 13.5px; font-weight: 600; color: var(--text); }
.mov-meta { font-size: 11.5px; color: var(--text-light); margin-top: 1px; }
.mov-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.mov-amount { font-size: 14px; font-weight: 800; white-space: nowrap; }
.mov-amount.pos { color: #16a34a; }
.mov-amount.neg { color: var(--danger); }
.mov-amount.tras { color: #2563eb; }
.mov-del { border: none; background: none; cursor: pointer; font-size: 14px; opacity: 0.6; }
.mov-del:hover { opacity: 1; }

.ref-card { padding: 0; }
.ref-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border); font-weight: 700; font-size: 13.5px; gap: 10px; flex-wrap: wrap; }
.ref-head em { font-weight: 500; font-style: normal; font-size: 12px; color: var(--text-light); }
.ref-body { display: flex; gap: 24px; padding: 14px 16px; flex-wrap: wrap; }
.ref-item { display: flex; flex-direction: column; gap: 2px; }
.ref-l { font-size: 11.5px; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.04em; }
.ref-v { font-size: 18px; font-weight: 800; }
.ref-v.pos { color: #16a34a; }
.ref-v.neg { color: var(--danger); }

.config-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; align-items: center; }
.config-grid .ch { font-size: 12px; font-weight: 700; text-align: center; color: var(--text-light); }
.config-grid .rh { font-size: 13px; font-weight: 600; }

@media (max-width: 900px) { .cards-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 640px) { .ledger-grid { grid-template-columns: 1fr; } .cards-grid { grid-template-columns: 1fr 1fr; } }
</style>
