<template>
  <PageLayout title="Bitácora">
    <div class="page-header">
      <div>
        <h1 class="page-title">Bitácora de cambios</h1>
        <p class="page-subtitle">Quién editó o eliminó facturas, fiados, abonos y compras</p>
      </div>
      <input v-model="search" class="form-control" placeholder="Buscar..." style="max-width:240px" />
    </div>

    <!-- Problemas del sistema: solo los ve el superadmin -->
    <div v-if="auth.isSuperAdmin" class="card sys-card">
      <div class="sys-head">
        <div>
          <h3 class="sys-title">⚠️ Problemas del sistema</h3>
          <p class="sys-sub">Solo los ves tú, como superadmin. Aquí aparece si un archivo de datos se daña, si falla un respaldo o si el servidor se detiene por un error.</p>
        </div>
        <button v-if="openCount > 0" class="btn btn-sm btn-outline" @click="resolveAllProblems">Marcar todo como revisado</button>
      </div>
      <p v-if="!problems.length" class="sys-ok">✅ Sin problemas del sistema.</p>
      <div v-for="p in problems" :key="p.id" :class="['sys-row', { done: p.resolved }]">
        <div class="sys-main">
          <strong>{{ p.title }}</strong>
          <span v-if="p.count > 1" class="sys-count">se repitió {{ p.count }} veces</span>
          <div class="sys-detail">{{ p.detail }}</div>
          <div class="sys-date">{{ formatDateTime(p.date) }}<span v-if="p.resolved"> · revisado</span></div>
        </div>
        <button v-if="!p.resolved" class="btn btn-sm btn-outline" @click="resolveProblem(p)">Revisado</button>
      </div>
    </div>

    <div v-if="loading" class="loading"><div class="spinner"></div></div>

    <div v-else class="card">
      <div v-if="filtered.length === 0" class="empty-state" style="padding:40px 0">
        <p class="empty-state-title">Sin registros</p>
        <p class="empty-state-text">Aquí aparecerán los cambios sensibles a medida que ocurran.</p>
      </div>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Fecha</th><th>Usuario</th><th>Acción</th></tr>
          </thead>
          <tbody>
            <tr v-for="e in filtered" :key="e.id">
              <td class="text-muted" style="white-space:nowrap">{{ formatDateTime(e.date) }}</td>
              <td><strong>{{ e.user }}</strong> <span class="role-tag" v-if="e.role">{{ e.role }}</span></td>
              <td><span class="act-icon">{{ icon(e.action) }}</span> {{ e.summary }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </PageLayout>
</template>

<script setup>
/**
 * AuditView.vue — Bitácora de cambios (auditoría)
 * Lista las acciones sensibles registradas (editar/eliminar facturas, fiados,
 * abonos, compras), más reciente primero. Solo admin.
 */
import { ref, computed, onMounted } from 'vue'
import api from '../services/api.js'
import { useAuthStore } from '../stores/auth.js'
import PageLayout from '../components/PageLayout.vue'

const auth = useAuthStore()
const entries = ref([])
const loading = ref(false)
const search = ref('')

// ── Problemas del sistema (solo superadmin) ──
const problems = ref([])
const openCount = computed(() => problems.value.filter(p => !p.resolved).length)

async function loadProblems() {
  if (!auth.isSuperAdmin) return
  try {
    const res = await api.get('/api/system-events')
    problems.value = (res.data.events || []).slice(0, 30)
  } catch { problems.value = [] }
}
async function resolveProblem(p) {
  await api.post(`/api/system-events/${p.id}/resolve`)
  await loadProblems()
}
async function resolveAllProblems() {
  await api.post('/api/system-events/resolve-all')
  await loadProblems()
}

const filtered = computed(() => {
  if (!search.value.trim()) return entries.value
  const q = search.value.toLowerCase()
  return entries.value.filter(e =>
    (e.summary || '').toLowerCase().includes(q) || (e.user || '').toLowerCase().includes(q)
  )
})

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function icon(action) {
  if ((action || '').startsWith('delete')) return '🗑️'
  if ((action || '').startsWith('edit')) return '✏️'
  return '•'
}

onMounted(async () => {
  loadProblems()
  loading.value = true
  try {
    const res = await api.get(`/api/${auth.currentBusiness?.id}/audit`)
    entries.value = res.data
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.sys-card { padding: 16px; margin-bottom: 16px; border: 1px solid var(--border); }
.sys-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
.sys-title { margin: 0 0 3px; font-size: 15px; font-weight: 700; color: var(--text); }
.sys-sub { margin: 0; font-size: 12.5px; color: var(--text-secondary); max-width: 640px; }
.sys-ok { margin: 6px 0 0; font-size: 13px; color: var(--success); }
.sys-row {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  padding: 10px 12px; margin-top: 8px; border-radius: var(--radius-sm);
  background: var(--danger-light); border: 1px solid var(--danger);
}
.sys-row.done { background: transparent; border-color: var(--border); opacity: 0.7; }
.sys-main { min-width: 0; font-size: 13px; color: var(--text); }
.sys-count { margin-left: 8px; font-size: 11.5px; color: var(--text-secondary); }
.sys-detail { margin-top: 3px; font-size: 12.5px; color: var(--text-secondary); word-break: break-word; }
.sys-date { margin-top: 3px; font-size: 11.5px; color: var(--text-secondary); }
.text-muted { font-size: 13px; color: var(--text-light); }
.role-tag { font-size: 10.5px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 1px 6px; color: var(--text-light); margin-left: 6px; text-transform: capitalize; }
.act-icon { margin-right: 4px; }
</style>
