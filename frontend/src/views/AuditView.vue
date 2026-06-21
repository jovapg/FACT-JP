<template>
  <PageLayout title="Bitácora">
    <div class="page-header">
      <div>
        <h1 class="page-title">Bitácora de cambios</h1>
        <p class="page-subtitle">Quién editó o eliminó facturas, fiados, abonos y compras</p>
      </div>
      <input v-model="search" class="form-control" placeholder="Buscar..." style="max-width:240px" />
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
.text-muted { font-size: 13px; color: var(--text-light); }
.role-tag { font-size: 10.5px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 1px 6px; color: var(--text-light); margin-left: 6px; text-transform: capitalize; }
.act-icon { margin-right: 4px; }
</style>
