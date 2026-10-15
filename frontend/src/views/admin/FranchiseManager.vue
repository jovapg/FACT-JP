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
              <button class="btn btn-sm btn-outline" @click="openConfig(biz)" title="Nombre de los espacios, forma de cobro y módulo de recetas">🧩 Forma de trabajo</button>
              <button class="btn btn-sm btn-outline" @click="toggleRecipes(biz)" title="Activar o quitar la pantalla de Recetas">
                🍳 Recetas: {{ biz.usesRecipes === false ? 'No' : 'Sí' }}
              </button>
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

        <!-- Forma de trabajo de una franquicia existente -->
        <div class="modal-overlay" v-if="cfgTarget" @click.self="cfgTarget = null">
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title">Forma de trabajo · {{ cfgTarget.name }}</h3>
              <button class="btn-close" @click="cfgTarget = null">×</button>
            </div>
            <div class="modal-body">
              <div class="grid grid-2">
                <div class="form-group">
                  <label class="form-label">Cómo se llaman los espacios</label>
                  <input v-model="cfg.spaceLabel" class="form-control" placeholder="Mesa, Campo, Pista..." />
                </div>
                <div class="form-group">
                  <label class="form-label">En plural</label>
                  <input v-model="cfg.spaceLabelPlural" class="form-control" placeholder="Mesas, Campos..." />
                </div>
                <div class="form-group" style="grid-column:1/-1">
                  <label class="form-label">Nombres de los espacios (separados por coma)</label>
                  <input v-model="cfg.spaceNamesText" class="form-control" placeholder="Ej: Alfa, Mega, Beta (vacío = numerados 1, 2, 3...)" />
                </div>
                <div class="form-group" style="grid-column:1/-1">
                  <label class="form-label">Forma de cobro</label>
                  <div class="mode-opts">
                    <button type="button" :class="['mode-opt', { active: !cfg.multiOrders }]" @click="cfg.multiOrders = false">
                      <strong>Una cuenta por espacio</strong><span>Como la mesa de un restaurante</span>
                    </button>
                    <button type="button" :class="['mode-opt', { active: cfg.multiOrders }]" @click="cfg.multiOrders = true">
                      <strong>Varias ventas por espacio</strong><span>Cada una se guarda y se factura aparte, más venta directa</span>
                    </button>
                  </div>
                </div>
                <div class="form-group" style="grid-column:1/-1">
                  <label class="form-label">Cómo se llama el módulo de recetas</label>
                  <input v-model="cfg.recipesLabel" class="form-control" placeholder="Recetas, Combos..." />
                </div>
                <div class="form-group" style="grid-column:1/-1">
                  <label class="form-label">Módulos que usa este negocio</label>
                  <div class="mods-grid">
                    <label v-for="mm in MODULES" :key="mm.key" class="mod-check">
                      <input type="checkbox" v-model="cfg.modules[mm.key]" /> <span>{{ mm.label }}</span>
                    </label>
                    <label class="mod-check"><input type="checkbox" v-model="cfg.usesRecipes" /> <span>Recetas / Combos</span></label>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="cfgTarget = null">Cancelar</button>
              <button class="btn btn-primary" @click="saveConfig" :disabled="cfgSaving">{{ cfgSaving ? 'Guardando...' : 'Guardar' }}</button>
            </div>
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
                <div class="form-group" style="grid-column:1/-1">
                  <label class="form-label">Tipo de negocio (ícono)</label>
                  <div class="icon-grid">
                    <button v-for="opt in BUSINESS_ICONS" :key="opt.key" type="button"
                      :class="['icon-opt', { active: form.icon === opt.key }]" @click="pickIcon(opt.key)">
                      <component :is="opt.icon" :size="22" />
                      <span>{{ opt.label }}</span>
                    </button>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Cómo se llaman los espacios</label>
                  <input v-model="form.spaceLabel" class="form-control" placeholder="Mesa, Campo, Pista..." />
                </div>
                <div class="form-group">
                  <label class="form-label">En plural</label>
                  <input v-model="form.spaceLabelPlural" class="form-control" placeholder="Mesas, Campos..." />
                </div>
                <div class="form-group" style="grid-column:1/-1">
                  <label class="form-label">Nombres de los espacios (separados por coma)</label>
                  <input v-model="form.spaceNamesText" class="form-control" placeholder="Ej: Alfa, Mega, Beta (vacío = numerados 1, 2, 3...)" />
                </div>
                <div class="form-group" style="grid-column:1/-1">
                  <label class="form-label">Forma de cobro</label>
                  <div class="mode-opts">
                    <button type="button" :class="['mode-opt', { active: !form.multiOrders }]" @click="form.multiOrders = false">
                      <strong>Una cuenta por espacio</strong><span>Como la mesa de un restaurante</span>
                    </button>
                    <button type="button" :class="['mode-opt', { active: form.multiOrders }]" @click="form.multiOrders = true">
                      <strong>Varias ventas por espacio</strong><span>Cada una se guarda y se factura aparte, más venta directa</span>
                    </button>
                  </div>
                </div>
                <div class="form-group" style="grid-column:1/-1">
                  <label class="form-label">Cómo se llama el módulo de recetas</label>
                  <input v-model="form.recipesLabel" class="form-control" placeholder="Recetas, Combos..." />
                </div>
                <div class="form-group" style="grid-column:1/-1">
                  <label class="form-label">Módulos que usa este negocio</label>
                  <div class="mods-grid">
                    <label v-for="mm in MODULES" :key="mm.key" class="mod-check">
                      <input type="checkbox" v-model="form.modules[mm.key]" /> <span>{{ mm.label }}</span>
                    </label>
                  </div>
                </div>
                <div class="form-group" style="grid-column:1/-1">
                  <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
                    <input type="checkbox" v-model="form.usesRecipes" />
                    <span><strong>Usa recetas</strong> (platos con ingredientes). Desmárcalo para bares, tiendas y servicios: se vende directo del inventario.</span>
                  </label>
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
import { useBusinessStore } from '../../stores/business.js'
import api from '../../services/api.js'
import PageLayout from '../../components/PageLayout.vue'
import { BUSINESS_ICONS, DEFAULT_BUSINESS_ICON, businessIconFor } from '../../utils/businessIcons.js'

const router = useRouter()
const auth = useAuthStore()
const businessStore = useBusinessStore()
const toast = inject('toast')

const businesses = ref([])
const showModal = ref(false)
const saving = ref(false)
const iconTarget = ref(null)   // Franquicia a la que se le está cambiando el ícono
const cfgTarget = ref(null)    // Franquicia a la que se le edita la forma de trabajo
const cfgSaving = ref(false)
const MODULES = [
  { key: 'debtors', label: 'Deudas y fiado' },
  { key: 'payroll', label: 'Nómina' },
  { key: 'finance', label: 'Finanzas' },
  { key: 'reports', label: 'Reportes' },
  { key: 'audit', label: 'Bitácora' }
]
const allModules = () => ({ debtors: true, payroll: true, finance: true, reports: true, audit: true })
const cfg = reactive({ spaceLabel: 'Mesa', spaceLabelPlural: 'Mesas', spaceNamesText: '', multiOrders: false, recipesLabel: 'Recetas', usesRecipes: true, modules: allModules() })

/** "Alfa, Mega\nBeta" → ['Alfa', 'Mega', 'Beta'] */
const parseNames = (t) => String(t || '').split(/[,\n]/).map(x => x.trim()).filter(Boolean)

// Al escoger el tipo de negocio se propone una forma de trabajo (todo se puede cambiar)
const presetBase = () => ({ spaceLabel: 'Mesa', spaceLabelPlural: 'Mesas', spaceNamesText: '', multiOrders: false, recipesLabel: 'Recetas', usesRecipes: true, modules: allModules() })
const PRESETS = {
  // Restaurante: mesas, una cuenta por mesa y recetas (platos con ingredientes)
  utensils: {},
  // Bar y licorería: mesas, una cuenta por mesa, sin recetas (se vende directo del inventario)
  beer: { usesRecipes: false },
  wine: { usesRecipes: false },
  // Campo de tiro: campos con nombre, varias ventas por campo, combos y sin deudas
  crosshair: { spaceLabel: 'Campo', spaceLabelPlural: 'Campos', spaceNamesText: 'Alfa, Mega, Beta', multiOrders: true, recipesLabel: 'Combos', usesRecipes: true, modules: { ...allModules(), debtors: false } }
}
function pickIcon(key) {
  form.icon = key
  Object.assign(form, presetBase(), PRESETS[key] || {})
}

async function openConfig(biz) {
  try {
    const p = (await api.get(`/api/${biz.id}/profile`)).data
    Object.assign(cfg, {
      spaceLabel: p.spaceLabel || 'Mesa',
      spaceLabelPlural: p.spaceLabelPlural || 'Mesas',
      spaceNamesText: (p.spaceNames || []).join(', '),
      multiOrders: !!p.multiOrders,
      recipesLabel: p.recipesLabel || 'Recetas',
      usesRecipes: p.usesRecipes !== false,
      modules: { ...allModules(), ...(p.modules || {}) }
    })
    cfgTarget.value = biz
  } catch {
    toast('No se pudo cargar la configuración', 'error')
  }
}

async function saveConfig() {
  cfgSaving.value = true
  try {
    const biz = cfgTarget.value
    const res = await api.put(`/api/businesses/${biz.id}/settings`, {
      spaceLabel: cfg.spaceLabel,
      spaceLabelPlural: cfg.spaceLabelPlural,
      spaceNames: parseNames(cfg.spaceNamesText),
      multiOrders: cfg.multiOrders,
      recipesLabel: cfg.recipesLabel,
      usesRecipes: cfg.usesRecipes,
      modules: cfg.modules
    })
    const idx = businesses.value.findIndex(b => b.id === biz.id)
    if (idx !== -1) businesses.value[idx] = res.data
    if (auth.currentBusiness?.id === biz.id) await businessStore.fetchProfile()
    cfgTarget.value = null
    toast('Forma de trabajo guardada', 'success')
  } catch (err) {
    toast(err.response?.data?.error || 'Error al guardar', 'error')
  } finally {
    cfgSaving.value = false
  }
}

const form = reactive({
  name: '', slug: '', nit: '', address: '',
  city: 'Medellín', phone: '', invoicePrefix: '', tablesCount: 10, usesRecipes: true, icon: DEFAULT_BUSINESS_ICON,
  spaceLabel: 'Mesa', spaceLabelPlural: 'Mesas', spaceNamesText: '', multiOrders: false, recipesLabel: 'Recetas',
  modules: { debtors: true, payroll: true, finance: true, reports: true, audit: true }
})

async function loadBusinesses() {
  const res = await api.get('/api/businesses')
  businesses.value = res.data
}

function openCreate() {
  Object.assign(form, { name: '', slug: '', nit: '', address: '', city: 'Medellín', phone: '', invoicePrefix: '', tablesCount: 10, usesRecipes: true, icon: DEFAULT_BUSINESS_ICON, spaceLabel: 'Mesa', spaceLabelPlural: 'Mesas', spaceNamesText: '', multiOrders: false, recipesLabel: 'Recetas', modules: { debtors: true, payroll: true, finance: true, reports: true, audit: true } })
  showModal.value = true
}

function closeModal() { showModal.value = false }

async function createFranchise() {
  if (!form.name) { toast('Nombre requerido', 'warning'); return }
  saving.value = true
  try {
    const res = await api.post('/api/businesses', { ...form, spaceNames: parseNames(form.spaceNamesText) })
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

async function toggleRecipes(biz) {
  const next = biz.usesRecipes === false
  try {
    const res = await api.put(`/api/businesses/${biz.id}/settings`, { usesRecipes: next })
    const idx = businesses.value.findIndex(b => b.id === biz.id)
    if (idx !== -1) businesses.value[idx] = res.data
    toast(`Recetas ${next ? 'activadas' : 'desactivadas'} en "${biz.name}"`, 'success')
  } catch (err) {
    toast(err.response?.data?.error || 'Error al cambiar', 'error')
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
.franchise-icon {
  width: 46px; height: 46px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 12px; border: 1px solid var(--border);
  background: var(--surface-2); color: var(--text); cursor: pointer;
}
.franchise-icon:hover { border-color: var(--accent); }
.mods-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 6px 14px; }
.mod-check { display: flex; align-items: center; gap: 7px; font-size: 13px; cursor: pointer; }
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
