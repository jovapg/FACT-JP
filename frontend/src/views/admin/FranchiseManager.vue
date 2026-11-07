<template>
  <PageLayout title="Gestión de Franquicias">
        <div class="page-header">
          <div>
            <h1 class="page-title">Franquicias</h1>
            <p class="page-subtitle">Gestión de negocios del sistema</p>
          </div>
          <button class="btn btn-primary" @click="wizard = { open: true, biz: null }">+ Nueva franquicia</button>
        </div>

        <div class="franchises-grid">
          <div class="card franchise-card" v-for="biz in businesses" :key="biz.id">
            <div class="franchise-header">
              <button class="franchise-icon" @click="iconTarget = biz" title="Cambiar ícono">
                <component :is="businessIconFor(biz.icon)" :size="26" />
              </button>
              <div>
                <h4 class="franchise-name">{{ biz.name }}</h4>
                <p class="franchise-slug">{{ biz.slug }}</p>
                <p class="franchise-slug">{{ biz.spaceLabelPlural || 'Mesas' }}{{ biz.multiOrders ? ' · varias ventas por espacio' : '' }}</p>
              </div>
              <span :class="['badge', biz.active ? 'badge-success' : 'badge-danger']">
                {{ biz.active ? 'Activo' : 'Inactivo' }}
              </span>
            </div>
            <div class="franchise-actions">
              <button class="btn btn-sm btn-outline" @click="goToSetup(biz)">⚙️ Configurar</button>
              <button class="btn btn-sm btn-outline" @click="wizard = { open: true, biz }" title="Prender o apagar módulos y ajustar la forma de trabajo">🧩 Módulos</button>
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

        <!-- Respaldos de seguridad -->
        <div class="card backups-card">
          <div class="backups-head">
            <div>
              <h3 class="backups-title">Respaldos de seguridad</h3>
              <p class="backups-text">
                Se crea uno automático cada día y se guardan los últimos {{ keepBackups }}. Incluyen todos los datos
                (ventas, inventario, usuarios, deudas…), pero no las imágenes. Descarga uno de vez en cuando a tu
                computador: así tienes una copia fuera del servidor.
              </p>
            </div>
            <button class="btn btn-primary btn-sm" @click="makeBackup" :disabled="backing">
              {{ backing ? 'Respaldando...' : 'Respaldar ahora' }}
            </button>
          </div>
          <p v-if="!backups.length" class="backups-text">Todavía no hay respaldos. El primero se crea solo, un minuto después de que arranca el servidor.</p>
          <table v-else class="table backups-table">
            <thead><tr><th>Fecha</th><th>Tamaño</th><th></th></tr></thead>
            <tbody>
              <tr v-for="b in backups" :key="b.name">
                <td>{{ fmtBackupDate(b.createdAt) }}</td>
                <td>{{ fmtSize(b.size) }}</td>
                <td class="backups-act"><button class="btn btn-sm btn-outline" @click="downloadBackup(b)">⬇️ Descargar</button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Cambiar ícono de una franquicia -->
        <div class="modal-overlay" v-if="iconTarget" @click.self="iconTarget = null">
          <div class="modal" style="max-width:460px">
            <div class="modal-header">
              <h3 class="modal-title">Ícono de {{ iconTarget.name }}</h3>
              <button class="btn-close" @click="iconTarget = null">×</button>
            </div>
            <div class="modal-body">
              <div class="icon-grid">
                    <button v-for="opt in BUSINESS_ICONS" :key="opt.key" type="button"
                      :class="['icon-opt', { active: (iconTarget.icon || DEFAULT_BUSINESS_ICON) === opt.key }]" @click="changeIcon(opt.key)">
                      <component :is="opt.icon" :size="22" />
                      <span>{{ opt.label }}</span>
                    </button>
                  </div>
            </div>
          </div>
        </div>

        <!-- Asistente: crear franquicia (5 pasos) o editar sus módulos -->
        <FranchiseWizard v-if="wizard.open" :biz="wizard.biz" @close="wizard = { open: false, biz: null }" @saved="onWizardSaved" />
  </PageLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'
import { useBusinessStore } from '../../stores/business.js'
import api from '../../services/api.js'
import PageLayout from '../../components/PageLayout.vue'
import FranchiseWizard from '../../components/FranchiseWizard.vue'
import { downloadProtected } from '../../utils/download.js'
import { BUSINESS_ICONS, DEFAULT_BUSINESS_ICON, businessIconFor } from '../../utils/businessIcons.js'

const router = useRouter()
const auth = useAuthStore()
const businessStore = useBusinessStore()
const toast = inject('toast')

const businesses = ref([])
const iconTarget = ref(null)   // Franquicia a la que se le está cambiando el ícono
const wizard = ref({ open: false, biz: null })   // asistente de crear / editar módulos

async function loadBusinesses() {
  const res = await api.get('/api/businesses')
  businesses.value = res.data
}

/** El asistente creó o cambió una franquicia: se actualiza la lista y la sesión */
async function onWizardSaved(biz) {
  const idx = businesses.value.findIndex(x => x.id === biz.id)
  if (idx === -1) { businesses.value.push(biz); auth.businesses.push(biz) } else businesses.value[idx] = { ...businesses.value[idx], ...biz }
  if (auth.currentBusiness?.id === biz.id) await businessStore.fetchProfile()
}

async function changeIcon(key) {
  const biz = iconTarget.value
  try {
    const res = await api.put(`/api/businesses/${biz.id}/settings`, { icon: key })
    const idx = businesses.value.findIndex(b => b.id === biz.id)
    if (idx !== -1) businesses.value[idx] = res.data
    iconTarget.value = null
    toast('Ícono actualizado', 'success')
  } catch (err) {
    toast(err.response?.data?.error || 'Error al cambiar el ícono', 'error')
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
  const msg = `¿Eliminar la franquicia "${biz.name}"?\n\n` +
              `- Se borran TODOS sus datos: ventas, inventario, recetas, deudas, usuarios, logo y QR\n` +
              `- No se puede recuperar\n\n` +
              `Escribe "ELIMINAR" para confirmar:`
  if (prompt(msg) !== 'ELIMINAR') return
  try {
    await api.delete(`/api/businesses/${biz.id}`)
    businesses.value = businesses.value.filter(b => b.id !== biz.id)
    toast('Franquicia eliminada', 'success')
  } catch (err) {
    toast(err.response?.data?.error || 'Error al eliminar', 'error')
  }
}

function goToSetup(biz) {
  auth.selectBusiness(biz)
  router.push('/admin/setup')
}

// ── Respaldos de seguridad ──
const backups = ref([])
const keepBackups = ref(30)
const backing = ref(false)

async function loadBackups() {
  try {
    const res = await api.get('/api/backups')
    backups.value = res.data.backups || []
    keepBackups.value = res.data.keep || 30
  } catch { backups.value = [] }
}

async function makeBackup() {
  backing.value = true
  try {
    await api.post('/api/backups')
    await loadBackups()
    toast('Respaldo creado', 'success')
  } catch (err) {
    toast(err.response?.data?.error || 'No se pudo crear el respaldo', 'error')
  } finally {
    backing.value = false
  }
}

async function downloadBackup(b) {
  try {
    await downloadProtected(`/api/backups/${b.name}/download`, b.name)
  } catch {
    toast('No se pudo descargar el respaldo', 'error')
  }
}

const fmtBackupDate = (iso) => new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const fmtSize = (n) => n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB'

onMounted(() => { loadBusinesses(); loadBackups() })
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
.franchise-icon {
  width: 46px; height: 46px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 12px; border: 1px solid var(--border);
  background: var(--surface-2); color: var(--text); cursor: pointer;
}
.franchise-icon:hover { border-color: var(--accent); }
.mods-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 6px 14px; }
.mod-check { display: flex; align-items: center; gap: 7px; font-size: 13px; cursor: pointer; }
.backups-card { margin-top: 24px; padding: 18px; }
.backups-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 12px; }
.backups-title { margin: 0 0 4px; font-size: 16px; font-weight: 700; color: var(--text); }
.backups-text { margin: 0; font-size: 12.5px; color: var(--text-light); max-width: 620px; }
.backups-table { margin-top: 6px; }
.backups-act { text-align: right; }
.mode-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.mode-opt {
  display: flex; flex-direction: column; gap: 3px; text-align: left; padding: 10px 12px;
  border: 1.5px solid var(--border); border-radius: 10px; background: var(--surface);
  color: var(--text); cursor: pointer; font-size: 13px;
}
.mode-opt span { font-size: 11.5px; color: var(--text-light); }
.mode-opt:hover { border-color: var(--accent); }
.mode-opt.active { border-color: var(--accent); background: rgba(245,158,11,0.12); }
@media (max-width: 520px) { .mode-opts { grid-template-columns: 1fr; } }
.icon-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.icon-opt {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 10px 4px; border: 1.5px solid var(--border); border-radius: 10px;
  background: var(--surface); color: var(--text); cursor: pointer; font-size: 11px;
}
.icon-opt:hover { border-color: var(--accent); }
.icon-opt.active { border-color: var(--accent); background: rgba(245,158,11,0.12); font-weight: 700; }
@media (max-width: 480px) { .icon-grid { grid-template-columns: repeat(3, 1fr); } }
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
