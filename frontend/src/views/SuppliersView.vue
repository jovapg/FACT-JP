<template>
  <PageLayout title="Proveedores">
        <div class="page-header">
          <div>
            <h1 class="page-title">Proveedores</h1>
            <p class="page-subtitle">Gestión de proveedores y pagos</p>
          </div>
          <button class="btn btn-primary" @click="openCreate">+ Nuevo</button>
        </div>

        <!-- Filter tabs -->
        <div class="tipo-tabs mb-3">
          <button
            v-for="t in tipoOptions"
            :key="t.value"
            :class="['tipo-tab', filterTipo === t.value ? 'active' : '']"
            @click="filterTipo = t.value"
          >
            {{ t.icon }} {{ t.label }}
            <span class="tab-count">{{ countByTipo(t.value) }}</span>
          </button>
        </div>

        <div class="suppliers-grid">
          <div class="card supplier-card" v-for="s in filteredSuppliers" :key="s.id">
            <div class="supplier-header">
              <div>
                <h4 class="supplier-name">{{ s.name }}</h4>
                <p class="supplier-nit" v-if="s.nit">NIT: {{ s.nit }}</p>
                <span :class="['tipo-badge', 'tipo-' + (s.tipo || 'proveedor')]">
                  {{ tipoLabel(s.tipo) }}
                </span>
              </div>
              <div :class="['debt-badge', s.totalDebt > 0 ? 'badge-danger' : 'badge-success']" class="badge">
                {{ s.totalDebt > 0 ? 'Deuda: ' + formatCOP(s.totalDebt) : 'Al día' }}
              </div>
            </div>
            <div class="supplier-info">
              <span v-if="s.phone">📞 {{ s.phone }}</span>
              <span v-if="s.email">✉️ {{ s.email }}</span>
              <span v-if="s.contact">👤 {{ s.contact }}</span>
            </div>
            <div class="supplier-actions">
              <button class="btn btn-sm btn-success" @click="openPayment(s)" v-if="s.totalDebt > 0">
                💳 Registrar pago
              </button>
              <button class="btn btn-sm btn-outline" @click="openPayments(s)">
                Ver pagos ({{ s.payments?.length || 0 }})
              </button>
              <button class="btn btn-sm btn-outline" @click="openEdit(s)">✏️</button>
              <button class="btn btn-sm btn-danger" @click="confirmDelete(s)">🗑️</button>
            </div>
          </div>

          <div v-if="filteredSuppliers.length === 0" class="empty-state" style="grid-column:1/-1">
            <div class="empty-state-icon">🏭</div>
            <p class="empty-state-text">No hay proveedores registrados</p>
          </div>
        </div>

        <!-- Create/Edit modal -->
        <div class="modal-overlay" v-if="showModal" @click.self="closeModal">
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title">{{ editSupplier ? 'Editar proveedor' : 'Nuevo proveedor' }}</h3>
              <button class="btn-close" @click="closeModal">×</button>
            </div>
            <div class="modal-body">
              <div class="grid grid-2">
                <div class="form-group" style="grid-column:1/-1">
                  <label class="form-label">Nombre *</label>
                  <input v-model="form.name" class="form-control" />
                </div>
                <div class="form-group" style="grid-column:1/-1">
                  <label class="form-label">Tipo</label>
                  <select v-model="form.tipo" class="form-control">
                    <option value="proveedor">🏭 Proveedor</option>
                    <option value="empleado">👷 Empleado</option>
                    <option value="arriendo">🏠 Arriendo</option>
                    <option value="credito">💳 Crédito</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">NIT</label>
                  <input v-model="form.nit" class="form-control" />
                </div>
                <div class="form-group">
                  <label class="form-label">Teléfono</label>
                  <input v-model="form.phone" class="form-control" />
                </div>
                <div class="form-group">
                  <label class="form-label">Contacto</label>
                  <input v-model="form.contact" class="form-control" />
                </div>
                <div class="form-group">
                  <label class="form-label">Email</label>
                  <input v-model="form.email" class="form-control" type="email" />
                </div>
                <div class="form-group" style="grid-column:1/-1">
                  <label class="form-label">Dirección</label>
                  <input v-model="form.address" class="form-control" />
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="closeModal">Cancelar</button>
              <button class="btn btn-primary" @click="saveSupplier">Guardar</button>
            </div>
          </div>
        </div>

        <!-- Payment modal -->
        <div class="modal-overlay" v-if="paymentSupplier" @click.self="paymentSupplier = null">
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title">Registrar pago - {{ paymentSupplier?.name }}</h3>
              <button class="btn-close" @click="paymentSupplier = null">×</button>
            </div>
            <div class="modal-body">
              <p class="mb-2">Deuda actual: <strong class="text-danger">{{ formatCOP(paymentSupplier?.totalDebt) }}</strong></p>
              <div class="form-group">
                <label class="form-label">Monto</label>
                <input v-model.number="paymentForm.amount" type="number" class="form-control" />
              </div>
              <div class="form-group">
                <label class="form-label">Método</label>
                <select v-model="paymentForm.method" class="form-control">
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Notas</label>
                <input v-model="paymentForm.notes" class="form-control" />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="paymentSupplier = null">Cancelar</button>
              <button class="btn btn-success" @click="savePayment">Registrar pago</button>
            </div>
          </div>
        </div>

        <!-- Payments history modal -->
        <div class="modal-overlay" v-if="paymentsSupplier" @click.self="paymentsSupplier = null">
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title">Pagos - {{ paymentsSupplier?.name }}</h3>
              <button class="btn-close" @click="paymentsSupplier = null">×</button>
            </div>
            <div class="modal-body">
              <div v-if="paymentsSupplier?.payments?.length === 0" class="text-muted">Sin pagos registrados</div>
              <div class="table-wrap" v-else>
                <table class="table">
                  <thead>
                    <tr><th>Fecha</th><th>Monto</th><th>Método</th><th>Notas</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in paymentsSupplier.payments" :key="p.id">
                      <td>{{ formatDate(p.date) }}</td>
                      <td class="currency">{{ formatCOP(p.amount) }}</td>
                      <td>{{ p.method }}</td>
                      <td>{{ p.notes || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="paymentsSupplier = null">Cerrar</button>
            </div>
          </div>
        </div>

  </PageLayout>
</template>

<script setup>
/**
 * SuppliersView.vue — Gestión de proveedores, empleados, arriendos y créditos
 *
 * Permite registrar todas las entidades externas a las que el negocio les paga,
 * clasificadas por `tipo`:
 *   - 🏭 proveedor: empresa que vende insumos (su deuda se genera al comprar)
 *   - 👷 empleado:  trabajador con pago semanal de nómina
 *   - 🏠 arriendo:  pago mensual del local
 *   - 💳 credito:   cuota a banco o persona
 *
 * Funcionalidades:
 *   - Filtrar por tipo con tabs en la parte superior
 *   - Crear / editar proveedor con modal
 *   - Registrar pagos (descuenta de la deuda)
 *   - Ver historial de pagos en modal
 *   - Eliminar proveedor
 *
 * Los pagos registrados aquí son la fuente de datos para el cálculo
 * de egresos en el reporte de Rentabilidad.
 */
import { ref, reactive, computed, onMounted, inject } from 'vue'
import api from '../services/api.js'
import { useAuthStore } from '../stores/auth.js'
import PageLayout from '../components/PageLayout.vue'

const auth = useAuthStore()
const toast = inject('toast')
const bizId = computed(() => auth.currentBusiness?.id)

const suppliers = ref([])
const showModal = ref(false)
const editSupplier = ref(null)
const paymentSupplier = ref(null)
const paymentsSupplier = ref(null)
const filterTipo = ref('todos')

const tipoOptions = [
  { value: 'todos', label: 'Todos', icon: '📋' },
  { value: 'proveedor', label: 'Proveedores', icon: '🏭' },
  { value: 'empleado', label: 'Empleados', icon: '👷' },
  { value: 'arriendo', label: 'Arriendo', icon: '🏠' },
  { value: 'credito', label: 'Créditos', icon: '💳' }
]

const filteredSuppliers = computed(() => {
  if (filterTipo.value === 'todos') return suppliers.value
  return suppliers.value.filter(s => (s.tipo || 'proveedor') === filterTipo.value)
})

function countByTipo(tipo) {
  if (tipo === 'todos') return suppliers.value.length
  return suppliers.value.filter(s => (s.tipo || 'proveedor') === tipo).length
}

function tipoLabel(tipo) {
  const map = { proveedor: '🏭 Proveedor', empleado: '👷 Empleado', arriendo: '🏠 Arriendo', credito: '💳 Crédito' }
  return map[tipo] || '🏭 Proveedor'
}

const form = reactive({ name: '', tipo: 'proveedor', nit: '', phone: '', contact: '', email: '', address: '' })
const paymentForm = reactive({ amount: 0, method: 'efectivo', notes: '' })

function formatCOP(v) { return '$' + Number(v || 0).toLocaleString('es-CO') }
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

async function loadSuppliers() {
  const res = await api.get(`/api/${bizId.value}/suppliers`)
  suppliers.value = res.data
}

function openCreate() {
  editSupplier.value = null
  Object.assign(form, { name: '', tipo: 'proveedor', nit: '', phone: '', contact: '', email: '', address: '' })
  showModal.value = true
}

function openEdit(s) {
  editSupplier.value = s
  Object.assign(form, { ...s })
  showModal.value = true
}

function closeModal() { showModal.value = false }

async function saveSupplier() {
  if (!form.name) return
  try {
    if (editSupplier.value) {
      const res = await api.put(`/api/${bizId.value}/suppliers/${editSupplier.value.id}`, { ...form })
      const idx = suppliers.value.findIndex(s => s.id === editSupplier.value.id)
      if (idx !== -1) suppliers.value[idx] = res.data
      toast('Proveedor actualizado', 'success')
    } else {
      const res = await api.post(`/api/${bizId.value}/suppliers`, { ...form })
      suppliers.value.push(res.data)
      toast('Proveedor creado', 'success')
    }
    closeModal()
  } catch {
    toast('Error al guardar', 'error')
  }
}

async function confirmDelete(s) {
  if (!confirm(`¿Eliminar "${s.name}"?`)) return
  await api.delete(`/api/${bizId.value}/suppliers/${s.id}`)
  suppliers.value = suppliers.value.filter(x => x.id !== s.id)
  toast('Proveedor eliminado', 'success')
}

function openPayment(s) {
  paymentSupplier.value = s
  Object.assign(paymentForm, { amount: s.totalDebt, method: 'efectivo', notes: '' })
}

async function savePayment() {
  try {
    const res = await api.post(`/api/${bizId.value}/suppliers/${paymentSupplier.value.id}/payment`, { ...paymentForm })
    const idx = suppliers.value.findIndex(s => s.id === paymentSupplier.value.id)
    if (idx !== -1) suppliers.value[idx] = res.data
    toast('Pago registrado', 'success')
    paymentSupplier.value = null
  } catch {
    toast('Error al registrar pago', 'error')
  }
}

function openPayments(s) { paymentsSupplier.value = s }

onMounted(loadSuppliers)
</script>

<style scoped>
.mb-3 { margin-bottom: 16px; }
.tipo-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.tipo-tab {
  padding: 7px 14px; border-radius: 20px; border: 2px solid var(--border);
  background: white; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 6px;
  transition: all 0.2s;
}
.tipo-tab.active { background: var(--primary); color: white; border-color: var(--primary); }
.tab-count {
  background: rgba(0,0,0,0.15); border-radius: 10px; padding: 1px 7px; font-size: 11px; font-weight: 700;
}
.tipo-badge {
  display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 10px; margin-top: 3px; font-weight: 600;
}
.tipo-proveedor { background: #eaf4fb; color: #2980b9; }
.tipo-empleado  { background: #f5eef8; color: #8e44ad; }
.tipo-arriendo  { background: #fef9e7; color: #d68910; }
.tipo-credito   { background: #fde8e8; color: #e74c3c; }

.suppliers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
.supplier-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
.supplier-name { font-weight: 700; font-size: 16px; }
.supplier-nit { font-size: 12px; color: var(--text-light); }
.supplier-info { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-light); margin-bottom: 12px; }
.supplier-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.mb-2 { margin-bottom: 10px; }
.text-muted { color: var(--text-light); font-size: 13px; }
.text-danger { color: var(--danger); }
</style>
