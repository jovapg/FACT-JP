<template>
  <PageLayout title="Gestión de Franquicias">
        <div class="page-header">
          <div>
            <h1 class="page-title">Franquicias</h1>
            <p class="page-subtitle">Gestión de negocios del sistema</p>
          </div>
          <button class="btn btn-primary" @click="openCreate">+ Nueva franquicia</button>
        </div>

        <div class="franchises-grid">
          <div class="card franchise-card" v-for="biz in businesses" :key="biz.id">
            <div class="franchise-header">
              <div class="franchise-icon">🏠</div>
              <div>
                <h4 class="franchise-name">{{ biz.name }}</h4>
                <p class="franchise-slug">{{ biz.slug }}</p>
              </div>
              <span :class="['badge', biz.active ? 'badge-success' : 'badge-danger']">
                {{ biz.active ? 'Activo' : 'Inactivo' }}
              </span>
            </div>
            <div class="franchise-actions">
              <button class="btn btn-sm btn-outline" @click="goToSetup(biz)">⚙️ Configurar</button>
              <button class="btn btn-sm btn-outline" @click="toggleActive(biz)">
                {{ biz.active ? '🔴 Desactivar' : '🟢 Activar' }}
              </button>
              <button class="btn btn-sm btn-warning" @click="confirmResetSales(biz)" title="Borrar historial de ventas">🧹 Facturas</button>
              <button class="btn btn-sm btn-danger" @click="confirmDelete(biz)">🗑️</button>
            </div>
          </div>

          <div v-if="businesses.length === 0" class="empty-state" style="grid-column:1/-1">
            <div class="empty-state-icon">🏢</div>
            <p class="empty-state-text">No hay franquicias creadas</p>
          </div>
        </div>

        <!-- Create modal -->
        <div class="modal-overlay" v-if="showModal" @click.self="closeModal">
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title">Nueva Franquicia</h3>
              <button class="btn-close" @click="closeModal">×</button>
            </div>
            <div class="modal-body">
              <div class="grid grid-2">
                <div class="form-group" style="grid-column:1/-1">
                  <label class="form-label">Nombre del negocio *</label>
                  <input v-model="form.name" class="form-control" placeholder="Ej: Bar Central" />
                </div>
                <div class="form-group">
                  <label class="form-label">Slug (URL)</label>
                  <input v-model="form.slug" class="form-control" placeholder="bar-central" />
                </div>
                <div class="form-group">
                  <label class="form-label">NIT</label>
                  <input v-model="form.nit" class="form-control" placeholder="900.xxx.xxx-1" />
                </div>
                <div class="form-group">
                  <label class="form-label">Dirección</label>
                  <input v-model="form.address" class="form-control" />
                </div>
                <div class="form-group">
                  <label class="form-label">Ciudad</label>
                  <input v-model="form.city" class="form-control" value="Medellín" />
                </div>
                <div class="form-group">
                  <label class="form-label">Teléfono</label>
                  <input v-model="form.phone" class="form-control" />
                </div>
                <div class="form-group">
                  <label class="form-label">Prefijo factura</label>
                  <input v-model="form.invoicePrefix" class="form-control" maxlength="4" placeholder="BC" />
                </div>
                <div class="form-group">
                  <label class="form-label">Número de mesas</label>
                  <input v-model.number="form.tablesCount" type="number" class="form-control" min="1" />
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="closeModal">Cancelar</button>
              <button class="btn btn-primary" @click="createFranchise" :disabled="saving">
                {{ saving ? 'Creando...' : 'Crear franquicia' }}
              </button>
            </div>
          </div>
        </div>
  </PageLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'
import api from '../../services/api.js'
import PageLayout from '../../components/PageLayout.vue'

const router = useRouter()
const auth = useAuthStore()
const toast = inject('toast')

const businesses = ref([])
const showModal = ref(false)
const saving = ref(false)

const form = reactive({
  name: '', slug: '', nit: '', address: '',
  city: 'Medellín', phone: '', invoicePrefix: '', tablesCount: 10
})

async function loadBusinesses() {
  const res = await api.get('/api/businesses')
  businesses.value = res.data
}

function openCreate() {
  Object.assign(form, { name: '', slug: '', nit: '', address: '', city: 'Medellín', phone: '', invoicePrefix: '', tablesCount: 10 })
  showModal.value = true
}

function closeModal() { showModal.value = false }

async function createFranchise() {
  if (!form.name) { toast('Nombre requerido', 'warning'); return }
  saving.value = true
  try {
    const res = await api.post('/api/businesses', { ...form })
    businesses.value.push(res.data)
    auth.businesses.push(res.data)
    toast('Franquicia creada', 'success')
    closeModal()
  } catch (err) {
    toast(err.response?.data?.error || 'Error al crear', 'error')
  } finally {
    saving.value = false
  }
}

async function toggleActive(biz) {
  const res = await api.put(`/api/businesses/${biz.id}`, { active: !biz.active })
  const idx = businesses.value.findIndex(b => b.id === biz.id)
  if (idx !== -1) businesses.value[idx] = res.data
  toast(`Franquicia ${res.data.active ? 'activada' : 'desactivada'}`, 'success')
}

async function confirmResetSales(biz) {
  const msg = `¿Borrar TODO el historial de ventas de "${biz.name}"?\n\n` +
              `- Se borrarán todas las facturas y turnos\n` +
              `- El contador volverá a #0001\n` +
              `- Inventario y recetas NO se tocan\n\n` +
              `Esta acción es irreversible. Escribe "BORRAR" para confirmar:`
  const answer = prompt(msg)
  if (answer !== 'BORRAR') return
  try {
    await api.post(`/api/businesses/${biz.id}/reset-sales`)
    toast(`Facturas de "${biz.name}" borradas`, 'success')
  } catch (err) {
    toast(err.response?.data?.error || 'Error al borrar', 'error')
  }
}

async function confirmDelete(biz) {
  if (!confirm(`¿Eliminar franquicia "${biz.name}"? Esta acción es irreversible.`)) return
  await api.delete(`/api/businesses/${biz.id}`)
  businesses.value = businesses.value.filter(b => b.id !== biz.id)
  toast('Franquicia eliminada', 'success')
}

function goToSetup(biz) {
  auth.selectBusiness(biz)
  router.push('/admin/setup')
}

onMounted(loadBusinesses)
</script>

<style scoped>
.franchises-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
.franchise-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.franchise-icon { font-size: 32px; }
.franchise-name { font-weight: 700; font-size: 16px; }
.franchise-slug { font-size: 12px; color: var(--text-light); }
.franchise-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.btn-warning {
  background: var(--warning);
  color: #1a0a00;
  border: none;
  font-weight: 700;
}
.btn-warning:hover { background: #d97706; }
</style>
