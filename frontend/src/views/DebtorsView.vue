<template>
  <PageLayout title="Deudas">

    <div class="page-header">
      <div>
        <h1 class="page-title">Panel de Deudas</h1>
        <p class="page-subtitle">Clientes que compran fiado y sus saldos pendientes</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">
        <UserPlus :size="15" /> Nuevo cliente
      </button>
    </div>

    <!-- Resumen -->
    <div class="summary-cards mb-4">
      <div class="summary-card">
        <p class="summary-label">Clientes con deuda</p>
        <p class="summary-value danger">{{ debtorsStore.activeCount }}</p>
      </div>
      <div class="summary-card highlight">
        <p class="summary-label">Deuda total pendiente</p>
        <p class="summary-value danger">{{ formatCOP(debtorsStore.totalDebt) }}</p>
      </div>
      <div class="summary-card">
        <p class="summary-label">Total registrados</p>
        <p class="summary-value">{{ debtorsStore.debtors.length }}</p>
      </div>
    </div>

    <!-- Búsqueda -->
    <div class="filters-bar card mb-3">
      <input v-model="search" class="form-control" placeholder="Buscar cliente..." style="max-width:260px" />
      <label class="filter-check">
        <input type="checkbox" v-model="onlyActive" />
        Solo con saldo pendiente
      </label>
    </div>

    <div v-if="debtorsStore.loading" class="loading">
      <div class="spinner"></div>
    </div>

    <div v-else class="card">
      <div v-if="filteredDebtors.length === 0" class="empty-state">
        <Wallet :size="38" class="empty-icon" />
        <p class="empty-state-title">Sin clientes registrados</p>
        <p class="empty-state-text">Agrega un cliente para empezar a registrar fiados</p>
      </div>

      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th>Saldo pendiente</th>
              <th>Movimientos</th>
              <th>Último movimiento</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in filteredDebtors" :key="d.id" class="debtor-row" @click="openDetail(d)">
              <td>
                <div class="client-name">
                  <div class="client-avatar">{{ d.name.charAt(0).toUpperCase() }}</div>
                  <strong>{{ d.name }}</strong>
                </div>
              </td>
              <td class="text-muted">{{ d.phone || '—' }}</td>
              <td>
                <span :class="['balance-badge', d.balance > 0 ? 'balance-debt' : 'balance-ok']">
                  {{ d.balance > 0 ? formatCOP(d.balance) : 'Al día ✓' }}
                </span>
              </td>
              <td class="text-muted">{{ d.transactions?.length || 0 }}</td>
              <td class="text-muted">{{ lastMovement(d) }}</td>
              <td @click.stop>
                <div class="action-btns">
                  <button class="btn btn-sm btn-danger-outline" @click="openCharge(d)" title="Registrar fiado">
                    <Plus :size="12" /> Fiado
                  </button>
                  <button class="btn btn-sm btn-success-outline" @click="openPayment(d)" title="Registrar abono" :disabled="d.balance <= 0">
                    <Minus :size="12" /> Abono
                  </button>
                  <button class="btn btn-sm btn-outline" @click="openEdit(d)" title="Editar">✏️</button>
                  <button class="btn btn-sm btn-danger" @click="confirmDel(d)" title="Eliminar">🗑️</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Modal: Crear / Editar cliente ── -->
    <div class="modal-overlay" v-if="showClientModal" @click.self="showClientModal = false">
      <div class="modal" style="max-width:420px">
        <div class="modal-header">
          <h3 class="modal-title">{{ editDebtor ? 'Editar cliente' : 'Nuevo cliente' }}</h3>
          <button class="btn-close" @click="showClientModal = false"><X :size="18" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Nombre *</label>
            <input v-model="clientForm.name" type="text" class="form-control"
              :class="{ 'input-error': clientSubmitted && !clientForm.name.trim() }"
              placeholder="Ej: Juan García" />
          </div>
          <div class="form-group">
            <label class="form-label">Teléfono (opcional)</label>
            <input v-model="clientForm.phone" type="tel" class="form-control" placeholder="Ej: 3001234567" />
          </div>
          <div class="form-group">
            <label class="form-label">Notas (opcional)</label>
            <input v-model="clientForm.notes" type="text" class="form-control" placeholder="Ej: Habitué, paga quincena" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showClientModal = false">Cancelar</button>
          <button class="btn btn-primary" @click="saveClient" :disabled="saving">
            <div class="spinner" v-if="saving" style="width:14px;height:14px;border-width:2px"></div>
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Modal: Registrar fiado ── -->
    <div class="modal-overlay" v-if="showChargeModal" @click.self="showChargeModal = false">
      <div class="modal" style="max-width:400px">
        <div class="modal-header">
          <h3 class="modal-title">Registrar fiado</h3>
          <button class="btn-close" @click="showChargeModal = false"><X :size="18" /></button>
        </div>
        <div class="modal-body">
          <div class="client-info-bar mb-3">
            <div class="client-avatar">{{ activeDebtor?.name.charAt(0).toUpperCase() }}</div>
            <div>
              <p class="fw-700">{{ activeDebtor?.name }}</p>
              <p class="text-muted" style="font-size:12px">Saldo actual: <strong class="danger">{{ formatCOP(activeDebtor?.balance) }}</strong></p>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">¿Qué pidió? *</label>
            <input v-model="chargeForm.description" type="text" class="form-control"
              :class="{ 'input-error': chargeSubmitted && !chargeForm.description.trim() }"
              placeholder="Ej: 2 cervezas + papas" />
          </div>
          <div class="form-group">
            <label class="form-label">Monto *</label>
            <input v-model.number="chargeForm.amount" type="number" class="form-control"
              :class="{ 'input-error': chargeSubmitted && !chargeForm.amount }"
              min="1" step="1000" placeholder="Ej: 15000" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showChargeModal = false">Cancelar</button>
          <button class="btn btn-danger" @click="handleCharge" :disabled="saving">
            <div class="spinner" v-if="saving" style="width:14px;height:14px;border-width:2px"></div>
            {{ saving ? 'Guardando...' : 'Registrar fiado' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Modal: Registrar abono ── -->
    <div class="modal-overlay" v-if="showPaymentModal" @click.self="showPaymentModal = false">
      <div class="modal" style="max-width:400px">
        <div class="modal-header">
          <h3 class="modal-title">Registrar abono</h3>
          <button class="btn-close" @click="showPaymentModal = false"><X :size="18" /></button>
        </div>
        <div class="modal-body">
          <div class="client-info-bar mb-3">
            <div class="client-avatar">{{ activeDebtor?.name.charAt(0).toUpperCase() }}</div>
            <div>
              <p class="fw-700">{{ activeDebtor?.name }}</p>
              <p class="text-muted" style="font-size:12px">Saldo pendiente: <strong class="danger">{{ formatCOP(activeDebtor?.balance) }}</strong></p>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Monto que abona *</label>
            <input v-model.number="paymentForm.amount" type="number" class="form-control"
              :class="{ 'input-error': paymentSubmitted && !paymentForm.amount }"
              min="1" step="1000" placeholder="Ej: 20000" />
            <span v-if="paymentForm.amount > 0" class="field-hint">
              Saldo restante:
              <strong :class="remaining <= 0 ? 'success' : 'danger'">
                {{ remaining <= 0 ? 'Queda en cero ✓' : formatCOP(remaining) }}
              </strong>
            </span>
          </div>
          <div class="form-group">
            <label class="form-label">Notas (opcional)</label>
            <input v-model="paymentForm.description" type="text" class="form-control"
              placeholder="Ej: Pago completo, Pago parcial..." />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showPaymentModal = false">Cancelar</button>
          <button class="btn btn-primary" @click="handlePayment" :disabled="saving">
            <div class="spinner" v-if="saving" style="width:14px;height:14px;border-width:2px"></div>
            {{ saving ? 'Guardando...' : 'Registrar abono' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Modal: Historial del cliente ── -->
    <div class="modal-overlay" v-if="detailDebtor" @click.self="detailDebtor = null">
      <div class="modal" style="max-width:500px">
        <div class="modal-header">
          <div class="detail-header-info">
            <div class="client-avatar lg">{{ detailDebtor.name.charAt(0).toUpperCase() }}</div>
            <div>
              <h3 class="modal-title">{{ detailDebtor.name }}</h3>
              <p class="text-muted" style="font-size:12px">{{ detailDebtor.phone || 'Sin teléfono' }}{{ detailDebtor.notes ? ' · ' + detailDebtor.notes : '' }}</p>
            </div>
          </div>
          <button class="btn-close" @click="detailDebtor = null"><X :size="18" /></button>
        </div>
        <div class="modal-body">
          <!-- Saldo destacado -->
          <div class="balance-hero mb-3" :class="detailDebtor.balance > 0 ? 'balance-hero-debt' : 'balance-hero-ok'">
            <p class="balance-hero-label">Saldo pendiente</p>
            <p class="balance-hero-value">{{ formatCOP(detailDebtor.balance) }}</p>
          </div>

          <!-- Historial de transacciones -->
          <div v-if="!detailDebtor.transactions?.length" class="empty-state" style="padding:20px 0">
            <p class="text-muted" style="text-align:center">Sin movimientos aún</p>
          </div>
          <div v-else>
            <p class="section-mini-title">Historial de movimientos</p>
            <div class="transactions-list">
              <div v-for="t in [...detailDebtor.transactions].reverse()" :key="t.id"
                :class="['transaction-row', t.type]">
                <div class="transaction-info">
                  <span class="transaction-icon">{{ t.type === 'charge' ? '📌' : '✅' }}</span>
                  <div>
                    <p class="transaction-desc">{{ t.description }}</p>
                    <p class="transaction-meta">{{ formatDateTime(t.date) }} · por {{ t.registeredBy }}</p>
                  </div>
                </div>
                <span :class="['transaction-amount', t.type]">
                  {{ t.type === 'charge' ? '+' : '-' }}{{ formatCOP(t.amount) }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="detailDebtor = null">Cerrar</button>
          <button class="btn btn-danger-outline" @click="openCharge(detailDebtor); detailDebtor = null">
            <Plus :size="13" /> Fiado
          </button>
          <button class="btn btn-primary" @click="openPayment(detailDebtor); detailDebtor = null" :disabled="detailDebtor.balance <= 0">
            <Minus :size="13" /> Abono
          </button>
        </div>
      </div>
    </div>

    <!-- ── Modal: Confirmar eliminar ── -->
    <ConfirmModal
      :visible="!!deleteTarget"
      title="Eliminar cliente"
      :message="`¿Eliminar &quot;${deleteTarget?.name}&quot;? Se perderá todo su historial.`"
      confirmText="Sí, eliminar"
      type="danger"
      @confirm="doDelete"
      @cancel="deleteTarget = null"
    />

  </PageLayout>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { useDebtorsStore } from '../stores/debtors.js'
import PageLayout from '../components/PageLayout.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import { UserPlus, Wallet, X, Plus, Minus } from 'lucide-vue-next'

const debtorsStore = useDebtorsStore()
const toast = inject('toast')

// ── Filtros ──────────────────────────────────────────────────────
const search = ref('')
const onlyActive = ref(false)

const filteredDebtors = computed(() => {
  let list = debtorsStore.debtors
  if (search.value) {
    const s = search.value.toLowerCase()
    list = list.filter(d => d.name.toLowerCase().includes(s) || d.phone?.includes(s))
  }
  if (onlyActive.value) list = list.filter(d => d.balance > 0)
  return list
})

// ── Estado ───────────────────────────────────────────────────────
const saving = ref(false)
const showClientModal = ref(false)
const showChargeModal  = ref(false)
const showPaymentModal = ref(false)
const detailDebtor  = ref(null)
const editDebtor    = ref(null)
const activeDebtor  = ref(null)
const deleteTarget  = ref(null)

const clientSubmitted  = ref(false)
const chargeSubmitted  = ref(false)
const paymentSubmitted = ref(false)

const clientForm  = ref({ name: '', phone: '', notes: '' })
const chargeForm  = ref({ description: '', amount: '' })
const paymentForm = ref({ amount: '', description: '' })

const remaining = computed(() =>
  Math.max(0, (activeDebtor.value?.balance || 0) - (paymentForm.value.amount || 0))
)

// ── Helpers ──────────────────────────────────────────────────────
function formatCOP(v) { return '$' + Number(v || 0).toLocaleString('es-CO') }
function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
function lastMovement(d) {
  if (!d.transactions?.length) return '—'
  const last = d.transactions[d.transactions.length - 1]
  return new Date(last.date).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Acciones ─────────────────────────────────────────────────────
function openCreate() {
  editDebtor.value = null
  clientForm.value = { name: '', phone: '', notes: '' }
  clientSubmitted.value = false
  showClientModal.value = true
}

function openEdit(d) {
  editDebtor.value = d
  clientForm.value = { name: d.name, phone: d.phone || '', notes: d.notes || '' }
  clientSubmitted.value = false
  showClientModal.value = true
}

function openCharge(d) {
  activeDebtor.value = d
  chargeForm.value = { description: '', amount: '' }
  chargeSubmitted.value = false
  showChargeModal.value = true
}

function openPayment(d) {
  activeDebtor.value = d
  paymentForm.value = { amount: '', description: '' }
  paymentSubmitted.value = false
  showPaymentModal.value = true
}

function openDetail(d) {
  // Siempre muestra el debtor actualizado desde el store
  detailDebtor.value = debtorsStore.debtors.find(x => x.id === d.id) || d
}

function confirmDel(d) { deleteTarget.value = d }

async function saveClient() {
  clientSubmitted.value = true
  if (!clientForm.value.name.trim()) return
  saving.value = true
  try {
    if (editDebtor.value) {
      await debtorsStore.updateDebtor(editDebtor.value.id, clientForm.value)
      toast('Cliente actualizado', 'success')
    } else {
      await debtorsStore.createDebtor(clientForm.value)
      toast('Cliente creado', 'success')
    }
    showClientModal.value = false
  } catch (err) {
    toast(err.response?.data?.error || 'Error al guardar', 'error')
  } finally {
    saving.value = false
  }
}

async function handleCharge() {
  chargeSubmitted.value = true
  if (!chargeForm.value.description.trim() || !chargeForm.value.amount) return
  saving.value = true
  try {
    await debtorsStore.addCharge(activeDebtor.value.id, chargeForm.value.amount, chargeForm.value.description)
    showChargeModal.value = false
    toast(`Fiado de ${formatCOP(chargeForm.value.amount)} registrado`, 'success')
  } catch (err) {
    toast(err.response?.data?.error || 'Error al registrar', 'error')
  } finally {
    saving.value = false
  }
}

async function handlePayment() {
  paymentSubmitted.value = true
  if (!paymentForm.value.amount) return
  saving.value = true
  try {
    await debtorsStore.addPayment(activeDebtor.value.id, paymentForm.value.amount, paymentForm.value.description)
    showPaymentModal.value = false
    toast(`Abono de ${formatCOP(paymentForm.value.amount)} registrado`, 'success')
  } catch (err) {
    toast(err.response?.data?.error || 'Error al registrar', 'error')
  } finally {
    saving.value = false
  }
}

async function doDelete() {
  try {
    await debtorsStore.deleteDebtor(deleteTarget.value.id)
    toast('Cliente eliminado', 'success')
  } catch {
    toast('Error al eliminar', 'error')
  } finally {
    deleteTarget.value = null
  }
}

onMounted(() => debtorsStore.fetchDebtors())
</script>

<style scoped>
.mb-4 { margin-bottom: 20px; }
.mb-3 { margin-bottom: 14px; }

/* Resumen */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.summary-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px 20px;
}
.summary-card.highlight {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
  border-color: transparent;
}
.summary-card.highlight .summary-label { color: rgba(255,255,255,0.6); }
.summary-card.highlight .summary-value { color: #f87171; }
.summary-label { font-size: 12px; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
.summary-value { font-size: 26px; font-weight: 800; color: var(--text); letter-spacing: -0.03em; }
.summary-value.danger { color: var(--danger); }

/* Filtros */
.filters-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 16px; }
.filter-check { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }

/* Tabla */
.debtor-row { cursor: pointer; }
.client-name { display: flex; align-items: center; gap: 10px; }
.client-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
  color: white;
  font-size: 13px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.client-avatar.lg { width: 42px; height: 42px; font-size: 17px; }
.text-muted { font-size: 13px; color: var(--text-light); }

.balance-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12.5px;
  font-weight: 700;
}
.balance-debt { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.balance-ok   { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }

.action-btns { display: flex; gap: 5px; flex-wrap: wrap; }

/* Botones extra */
.btn-danger-outline {
  border: 1.5px solid var(--danger);
  color: var(--danger);
  background: transparent;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
}
.btn-danger-outline:hover { background: #fef2f2; }
.btn-success-outline {
  border: 1.5px solid var(--success);
  color: var(--success);
  background: transparent;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
}
.btn-success-outline:hover { background: #f0fdf4; }
.btn-success-outline:disabled { opacity: 0.4; cursor: not-allowed; }

/* Modal: info del cliente */
.client-info-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
}
.field-hint { font-size: 12.5px; color: var(--text-light); margin-top: 6px; display: block; }

/* Modal: detalle */
.detail-header-info { display: flex; align-items: center; gap: 12px; }
.balance-hero {
  border-radius: var(--radius-sm);
  padding: 16px 20px;
  text-align: center;
}
.balance-hero-debt { background: #fef2f2; border: 1px solid #fecaca; }
.balance-hero-ok   { background: #f0fdf4; border: 1px solid #bbf7d0; }
.balance-hero-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-light); margin-bottom: 4px; }
.balance-hero-value { font-size: 28px; font-weight: 900; letter-spacing: -0.03em; color: var(--text); }

.section-mini-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-light);
  margin-bottom: 10px;
}
.transactions-list { display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow-y: auto; }
.transaction-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  gap: 12px;
}
.transaction-row.charge  { background: #fef9f9; border: 1px solid #fecaca; }
.transaction-row.payment { background: #f0fdf4; border: 1px solid #bbf7d0; }
.transaction-info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.transaction-icon { font-size: 16px; flex-shrink: 0; }
.transaction-desc { font-size: 13.5px; font-weight: 500; color: var(--text); }
.transaction-meta { font-size: 11.5px; color: var(--text-light); margin-top: 1px; }
.transaction-amount { font-size: 14px; font-weight: 800; flex-shrink: 0; }
.transaction-amount.charge  { color: #dc2626; }
.transaction-amount.payment { color: #16a34a; }

.success { color: var(--success); }
.danger  { color: var(--danger); }
.fw-700  { font-weight: 700; }
.empty-icon { color: var(--text-light); margin-bottom: 12px; }
.input-error { border-color: var(--danger) !important; }

@media (max-width: 768px) {
  .summary-cards { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 480px) {
  .summary-cards { grid-template-columns: 1fr; }
}
</style>
