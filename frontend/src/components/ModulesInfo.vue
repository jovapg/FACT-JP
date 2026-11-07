<template>
  <div class="card mi">
    <h3 class="mi-title">Módulos de tu negocio</h3>
    <p class="mi-sub">Esto es lo que tiene activo tu franquicia. Para activar otro módulo, comunícate con soporte.</p>

    <div v-if="loading" class="loading"><div class="spinner"></div></div>
    <template v-else>
      <div v-for="g in groups" :key="g.name" class="mi-group">
        <div class="mi-gh">{{ g.name }}</div>
        <div v-for="m in g.items" :key="m.key" :class="['mi-row', { off: !state[m.key] }]">
          <div class="mi-tx"><span>{{ m.label }}</span><small>{{ m.desc }}</small></div>
          <span :class="['badge', state[m.key] ? 'badge-success' : 'badge-default']">{{ state[m.key] ? 'Incluido' : 'No incluido' }}</span>
        </div>
      </div>
      <div class="mi-group">
        <div class="mi-gh">Siempre incluido</div>
        <div v-for="b in base" :key="b.label" class="mi-row">
          <div class="mi-tx"><span>{{ b.label }}</span><small>{{ b.desc }}</small></div>
          <span class="badge badge-success">Incluido</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
/** ModulesInfo.vue — Vista de solo lectura para el admin: qué módulos tiene su franquicia (los cambia el superadmin). */
import { ref, reactive, computed, onMounted } from 'vue'
import api from '../services/api.js'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const loading = ref(true)
const modules = ref([])
const base = ref([])
const state = reactive({})

const groups = computed(() => {
  const out = []
  for (const m of modules.value) { let g = out.find(x => x.name === m.group); if (!g) out.push(g = { name: m.group, items: [] }); g.items.push(m) }
  return out
})

onMounted(async () => {
  try {
    const [reg, st] = await Promise.all([api.get('/api/businesses/registry'), api.get(`/api/businesses/${auth.currentBusiness.id}/modules`)])
    modules.value = reg.data.modules; base.value = reg.data.base
    Object.assign(state, st.data)
  } catch { /* si falla, la tarjeta queda vacía */ }
  finally { loading.value = false }
})
</script>

<style scoped>
.mi-title { margin: 0 0 4px; font-size: 16px; } .mi-sub { margin: 0 0 14px; color: var(--text-secondary); font-size: 13px; }
.mi-group { margin-bottom: 10px; }
.mi-gh { font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--text-secondary); padding: 6px 0 4px; border-bottom: 1px solid var(--border); }
.mi-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--border); }
.mi-row:last-child { border-bottom: 0; } .mi-row.off { opacity: .55; }
.mi-tx { min-width: 0; font-size: 14px; } .mi-tx small { display: block; color: var(--text-secondary); font-size: 12px; }
</style>
