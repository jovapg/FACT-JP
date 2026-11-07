<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal wz">
      <div class="modal-header">
        <h3 class="modal-title">{{ isEdit ? 'Módulos y forma de trabajo · ' + biz.name : 'Nueva franquicia' }}</h3>
        <button class="btn-close" @click="$emit('close')">×</button>
      </div>

      <div v-if="loading" class="modal-body"><div class="loading"><div class="spinner"></div></div></div>

      <template v-else>
        <!-- Pasos (solo al crear) -->
        <div v-if="!isEdit" class="wz-steps">
          <span v-for="(s, i) in STEPS" :key="s" :class="{ on: i === step, ok: i < step }">{{ i < step ? '✓' : i + 1 }} {{ s }}</span>
        </div>

        <div class="modal-body wz-body">
          <!-- ── 1 · Datos ── -->
          <template v-if="!isEdit && step === 0">
            <div class="grid grid-2">
              <div class="form-group" style="grid-column:1/-1">
                <label class="form-label">Nombre del negocio *</label>
                <input v-model="data.name" class="form-control" placeholder="Ej: Deli-Combos Santa Elena" />
              </div>
              <div class="form-group">
                <label class="form-label">Slug (va en el link de la carta)</label>
                <input v-model="data.slug" class="form-control" placeholder="deli-combos" @input="slugEdited = true" />
              </div>
              <div class="form-group">
                <label class="form-label">Prefijo de facturas</label>
                <input v-model="data.invoicePrefix" class="form-control" maxlength="4" placeholder="DC" @input="prefixEdited = true" />
              </div>
              <div class="form-group">
                <label class="form-label">Ciudad</label>
                <input v-model="data.city" class="form-control" />
              </div>
              <div class="form-group">
                <label class="form-label">Teléfono</label>
                <input v-model="data.phone" class="form-control" />
              </div>
              <div class="form-group" style="grid-column:1/-1">
                <label class="form-label">Dirección (sale en las facturas)</label>
                <input v-model="data.address" class="form-control" />
              </div>
              <div class="form-group" style="grid-column:1/-1">
                <label class="form-label">Ícono del menú</label>
                <div class="wz-icons">
                  <button v-for="opt in BUSINESS_ICONS" :key="opt.key" type="button" :class="['wz-icon', { on: icon === opt.key }]" @click="icon = opt.key" :title="opt.label">
                    <component :is="opt.icon" :size="20" />
                  </button>
                </div>
              </div>
            </div>
          </template>

          <!-- ── 2 · Tipo y módulos ── -->
          <template v-if="isEdit || step === 1">
            <template v-if="!isEdit">
              <p class="wz-hint">Empieza con una plantilla. Después ajustas lo que quieras.</p>
              <div class="wz-tpls">
                <button v-for="t in reg.templates" :key="t.id" type="button" :class="['wz-tpl', { on: tplId === t.id }]" @click="applyTemplate(t)">
                  <b>{{ t.name }}</b><span>{{ t.desc }}</span>
                </button>
                <button type="button" :class="['wz-tpl', { on: tplId === '' }]" @click="tplId = ''"><b>Personalizado</b><span>Lo armo yo, módulo por módulo</span></button>
              </div>
            </template>

            <div v-for="g in groups" :key="g.name" class="wz-group">
              <div class="wz-gh">{{ g.name }}</div>
              <div v-for="m in g.items" :key="m.key" class="wz-mod">
                <div class="wz-tx">
                  <span>{{ m.label }}</span>
                  <small>{{ m.desc }}<template v-if="m.requires.length"> · <em>Necesita: {{ m.requires.map(labelOf).join(', ') }}</em></template></small>
                </div>
                <button type="button" :class="['wz-sw', { on: on[m.key] }]" role="switch" :aria-checked="!!on[m.key]" :aria-label="m.label" @click="toggle(m.key)"></button>
              </div>
            </div>

            <details class="wz-base">
              <summary>Siempre incluidos en toda franquicia</summary>
              <p v-for="b in reg.base" :key="b.label"><b>{{ b.label }}</b> — {{ b.desc }}</p>
            </details>
            <details class="wz-base">
              <summary>Quién ve qué</summary>
              <p><b>Tú (superadmin):</b> prendes y apagas módulos, creas y borras franquicias, respaldos y bitácora del sistema. Solo tú.</p>
              <p><b>Admin de la franquicia:</b> usa los módulos prendidos y ve cuáles tiene; no los puede cambiar. Crea sus cajeros y ajusta su carta.</p>
              <p><b>Cajero:</b> vende, factura, abre y cierra turno, inventario, deudas, nómina (registrar días) y pedidos. No ve Finanzas, Reportes, Recetas, Compras, Directorio ni Configuración.</p>
              <p><b>Domiciliario:</b> solo ve pedidos y marca "salí" y "entregado".</p>
            </details>
          </template>

          <!-- ── 3 · Ajustes (solo lo que aplica a los módulos escogidos) ── -->
          <template v-if="isEdit || step === 2">
            <div class="wz-gh" style="margin-top:4px">Espacios de venta</div>
            <div class="grid grid-2">
              <div class="form-group">
                <label class="form-label">Cómo se llaman los espacios</label>
                <input v-model="labels.spaceLabel" class="form-control" placeholder="Mesa, Campo, Pista..." />
              </div>
              <div class="form-group">
                <label class="form-label">En plural</label>
                <input v-model="labels.spaceLabelPlural" class="form-control" placeholder="Mesas, Campos..." />
              </div>
              <div class="form-group" style="grid-column:1/-1">
                <label class="form-label">Nombres propios (separados por coma)</label>
                <input v-model="labels.spaceNamesText" class="form-control" placeholder="Ej: Alfa, Mega, Beta (vacío = numerados)" />
              </div>
              <div v-if="!isEdit && !parseNames(labels.spaceNamesText).length" class="form-group">
                <label class="form-label">Cuántos espacios (0 = ninguno)</label>
                <input v-model.number="labels.tablesCount" type="number" min="0" max="200" class="form-control" />
              </div>
              <div v-if="on.rec" class="form-group">
                <label class="form-label">Cómo se llama el módulo de recetas</label>
                <input v-model="labels.recipesLabel" class="form-control" placeholder="Recetas, Combos..." />
              </div>
            </div>

            <template v-if="on.carta && (!isEdit || !hadCarta)">
              <div class="wz-gh" style="margin-top:14px">Carta pública y pedidos</div>
              <div class="grid grid-2">
                <div v-if="!isEdit" class="form-group">
                  <label class="form-label">WhatsApp del negocio</label>
                  <input v-model="carta.whatsapp" inputmode="tel" class="form-control" placeholder="3001234567" />
                </div>
                <div v-if="!isEdit" class="form-group">
                  <label class="form-label">Recibir pedidos desde / hasta</label>
                  <div style="display:flex;gap:8px"><input v-model="carta.openFrom" type="time" class="form-control" /><input v-model="carta.openTo" type="time" class="form-control" /></div>
                </div>
                <div class="form-group" style="grid-column:1/-1">
                  <label class="wz-check"><input type="checkbox" v-model="carta.sample" />
                    Cargar la carta de ejemplo (la de Deli-Combos, sin sus datos de contacto). Se editan precios, agotados y visibilidad. Si no, la carta empieza vacía.</label>
                  <small class="wz-hint2">Todavía no hay un editor para crear productos nuevos desde cero: la carta de ejemplo es el punto de partida.</small>
                </div>
              </div>
            </template>
            <p v-if="!isEdit && !on.carta" class="wz-hint2">Los demás ajustes (horario, WhatsApp, domicilio…) aparecen aquí solo si prendes la carta pública.</p>
          </template>

          <!-- ── 4 · Usuarios ── -->
          <template v-if="!isEdit && step === 3">
            <p class="wz-hint">Crea los usuarios de la franquicia desde ya. Guarda las contraseñas: al final se muestran una sola vez.</p>
            <div v-for="(u, i) in users" :key="i" class="wz-user">
              <input v-model="u.name" class="form-control" placeholder="Nombre" />
              <input v-model="u.username" class="form-control" placeholder="usuario" autocapitalize="none" />
              <div class="wz-pass"><input v-model="u.password" class="form-control" placeholder="contraseña" /><button type="button" class="btn btn-sm btn-outline" title="Generar contraseña" @click="u.password = genPass()">🎲</button></div>
              <select v-model="u.role" class="form-control">
                <option value="admin">Administrador</option>
                <option value="cajero">Cajero</option>
                <option v-if="on.carta" value="domiciliario">Domiciliario (solo pedidos)</option>
              </select>
              <button type="button" class="btn btn-sm btn-outline" title="Quitar" @click="users.splice(i, 1)">✕</button>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
              <button type="button" class="btn btn-sm btn-outline" @click="addUser('admin')">+ Administrador</button>
              <button type="button" class="btn btn-sm btn-outline" @click="addUser('cajero')">+ Cajero</button>
              <button v-if="on.carta" type="button" class="btn btn-sm btn-outline" @click="addUser('domiciliario')">+ Domiciliario</button>
            </div>
            <p class="wz-hint2">Los nombres de usuario no se pueden repetir en todo el sistema. Por eso llevan el prefijo del negocio.</p>
          </template>

          <!-- ── 5 · Listo ── -->
          <template v-if="!isEdit && step === 4">
            <template v-if="!result">
              <p class="wz-hint">Revisa antes de crear:</p>
              <div class="wz-sum">
                <div><span>Negocio</span><b>{{ data.name }}</b></div>
                <div><span>Link de la carta</span><b>{{ on.carta ? origin + '/carta/' + data.slug : 'No tiene carta' }}</b></div>
                <div><span>Módulos</span><b>{{ activeLabels.join(', ') || 'Solo la base' }}</b></div>
                <div><span>Espacios</span><b>{{ spacesText }}</b></div>
                <div><span>Usuarios</span><b>{{ users.length ? users.map(u => u.username + ' (' + roleName(u.role) + ')').join(', ') : 'Ninguno todavía' }}</b></div>
              </div>
            </template>
            <template v-else>
              <div class="wz-ok">✅ <b>{{ result.business.name }}</b> quedó creada.</div>
              <p v-if="result.users.length" class="wz-hint">Guarda estos accesos ahora. <b>No se vuelven a mostrar.</b></p>
              <div v-for="u in result.users" :key="u.username" class="wz-cred"><span>{{ roleName(u.role) }}</span><b>{{ u.username }}</b><code>{{ u.password }}</code></div>
              <button v-if="result.users.length" class="btn btn-outline btn-sm" style="margin-top:10px" @click="copyCreds">📋 Copiar accesos</button>
              <p v-if="on.carta" class="wz-hint2">Carta pública: {{ origin }}/carta/{{ result.business.slug }}</p>
            </template>
          </template>

          <p v-if="err" class="wz-err">{{ err }}</p>
        </div>

        <div class="modal-footer">
          <template v-if="isEdit">
            <button class="btn btn-outline" @click="$emit('close')">Cancelar</button>
            <button class="btn btn-primary" :disabled="saving" @click="saveEdit">{{ saving ? 'Guardando…' : 'Guardar cambios' }}</button>
          </template>
          <template v-else-if="result">
            <button class="btn btn-primary" @click="$emit('close')">Cerrar</button>
          </template>
          <template v-else>
            <button class="btn btn-outline" @click="step === 0 ? $emit('close') : (step--, err = '')">{{ step === 0 ? 'Cancelar' : '← Atrás' }}</button>
            <button v-if="step < 4" class="btn btn-primary" @click="next">Siguiente →</button>
            <button v-else class="btn btn-primary" :disabled="saving" @click="create">{{ saving ? 'Creando…' : 'Crear franquicia' }}</button>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
/**
 * FranchiseWizard.vue — Crear una franquicia (5 pasos) o editar sus módulos y forma de trabajo.
 * Todo sale de la lista única de módulos del servidor (/api/businesses/registry): al agregar un módulo
 * nuevo allá, aparece aquí solo. Solo el superadmin ve esta pantalla.
 */
import { ref, reactive, computed, watch, onMounted, inject } from 'vue'
import api from '../services/api.js'
import { BUSINESS_ICONS, DEFAULT_BUSINESS_ICON } from '../utils/businessIcons.js'

const props = defineProps({ biz: { type: Object, default: null } })
const emit = defineEmits(['close', 'saved'])
const toast = inject('toast', () => {})

const isEdit = computed(() => !!props.biz)
const STEPS = ['Datos', 'Tipo y módulos', 'Ajustes', 'Usuarios', 'Listo']
const origin = window.location.origin

const loading = ref(true)
const saving = ref(false)
const err = ref('')
const step = ref(0)
const reg = reactive({ modules: [], base: [], templates: [] })
const on = reactive({})
const tplId = ref('')
const icon = ref(DEFAULT_BUSINESS_ICON)
const data = reactive({ name: '', slug: '', invoicePrefix: '', city: 'Medellín', phone: '', address: '' })
const labels = reactive({ spaceLabel: 'Mesa', spaceLabelPlural: 'Mesas', spaceNamesText: '', recipesLabel: 'Recetas', tablesCount: 10 })
const carta = reactive({ whatsapp: '', openFrom: '07:00', openTo: '20:00', sample: true })
const users = ref([])
const result = ref(null)
const hadCarta = ref(false)
let slugEdited = false
let prefixEdited = false

const parseNames = (t) => String(t || '').split(/[,\n]/).map(x => x.trim()).filter(Boolean)
const labelOf = (k) => reg.modules.find(m => m.key === k)?.label || k
const roleName = (r) => ({ admin: 'Administrador', cajero: 'Cajero', domiciliario: 'Domiciliario' }[r] || r)
const groups = computed(() => {
  const out = []
  for (const m of reg.modules) { let g = out.find(x => x.name === m.group); if (!g) out.push(g = { name: m.group, items: [] }); g.items.push(m) }
  return out
})
const activeLabels = computed(() => reg.modules.filter(m => on[m.key]).map(m => m.label))
const spacesText = computed(() => {
  const names = parseNames(labels.spaceNamesText)
  if (names.length) return `${labels.spaceLabelPlural}: ${names.join(', ')}`
  return labels.tablesCount > 0 ? `${labels.tablesCount} ${labels.spaceLabelPlural.toLowerCase()} numeradas` : 'Sin espacios (solo venta directa)'
})

// ── Dependencias: prender uno prende lo que necesita; apagar uno apaga lo que depende de él ──
function setOn(k, v) {
  if (v) { on[k] = true; for (const r of reg.modules.find(m => m.key === k)?.requires || []) if (!on[r]) setOn(r, true) }
  else { on[k] = false; for (const m of reg.modules) if (on[m.key] && m.requires.includes(k)) setOn(m.key, false) }
}
function toggle(k) { setOn(k, !on[k]); if (!isEdit.value) tplId.value = '' }
function applyTemplate(t) {
  tplId.value = t.id
  for (const m of reg.modules) on[m.key] = false
  t.on.forEach(k => { on[k] = true })
  icon.value = t.icon
  Object.assign(labels, { spaceLabel: t.labels.spaceLabel, spaceLabelPlural: t.labels.spaceLabelPlural, spaceNamesText: (t.labels.spaceNames || []).join(', '),
    recipesLabel: t.labels.recipesLabel, tablesCount: t.tablesCount !== undefined ? t.tablesCount : 10 })
}

// slug y prefijo se arman solos a partir del nombre (hasta que los edites a mano)
const slugify = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
watch(() => data.name, (n) => {
  if (!slugEdited) data.slug = slugify(n)
  if (!prefixEdited) data.invoicePrefix = String(n).split(/[\s-]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 3).toUpperCase() || String(n).slice(0, 2).toUpperCase()
})

const genPass = () => { const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'; return Array.from({ length: 10 }, () => a[Math.floor(Math.random() * a.length)]).join('') }
function addUser(role) {
  const pre = (data.invoicePrefix || data.slug || 'neg').toLowerCase()
  const n = users.value.filter(u => u.role === role).length + 1
  const base = { admin: 'admin', cajero: 'caja', domiciliario: 'domi' }[role]
  users.value.push({ name: '', username: `${pre}-${base}${role === 'admin' && n === 1 ? '' : n}`, password: genPass(), role })
}

function next() {
  err.value = ''
  if (step.value === 0) {
    if (data.name.trim().length < 2) return (err.value = 'Escribe el nombre del negocio.')
    if (!/^[a-z0-9-]{2,40}$/.test(data.slug)) return (err.value = 'El slug solo puede tener letras minúsculas, números y guiones.')
  }
  if (step.value === 2 && on.carta && carta.whatsapp && String(carta.whatsapp).replace(/\D/g, '').length < 10) return (err.value = 'El WhatsApp debe tener 10 dígitos.')
  if (step.value === 2 && !users.value.length) addUser('admin')
  if (step.value === 3) {
    const seen = new Set()
    for (const u of users.value) {
      u.username = String(u.username).trim()
      if (!/^[a-zA-Z0-9._-]{3,30}$/.test(u.username)) return (err.value = `Usuario no válido: "${u.username}" (3 a 30 letras, números, punto o guion).`)
      if (String(u.password).length < 6) return (err.value = `La contraseña de "${u.username}" debe tener al menos 6 caracteres.`)
      if (seen.has(u.username.toLowerCase())) return (err.value = `El usuario "${u.username}" está repetido.`)
      seen.add(u.username.toLowerCase())
    }
  }
  step.value++
}

function labelsBody() {
  return { spaceLabel: labels.spaceLabel, spaceLabelPlural: labels.spaceLabelPlural, spaceNames: parseNames(labels.spaceNamesText), recipesLabel: labels.recipesLabel }
}

async function create() {
  saving.value = true; err.value = ''
  try {
    const keys = Object.fromEntries(reg.modules.map(m => [m.key, !!on[m.key]]))
    const body = {
      name: data.name.trim(), slug: data.slug, invoicePrefix: data.invoicePrefix, city: data.city, phone: data.phone, address: data.address, icon: icon.value,
      template: tplId.value || undefined, moduleKeys: keys,
      labels: { ...labelsBody(), tablesCount: Number.isInteger(labels.tablesCount) ? labels.tablesCount : undefined },
      cartaSettings: on.carta ? { whatsapp: carta.whatsapp, openFrom: carta.openFrom, openTo: carta.openTo, address: data.address } : undefined,
      cartaSample: carta.sample,
      users: users.value.map(u => ({ name: u.name || u.username, username: u.username, password: u.password, role: u.role }))
    }
    const res = await api.post('/api/businesses', body)
    result.value = { business: res.data, users: users.value.map(u => ({ ...u })) }
    emit('saved', res.data)
  } catch (e) {
    err.value = e.response?.data?.error || 'No se pudo crear la franquicia'
  } finally { saving.value = false }
}

async function saveEdit() {
  saving.value = true; err.value = ''
  try {
    const keys = Object.fromEntries(reg.modules.map(m => [m.key, !!on[m.key]]))
    const body = { moduleKeys: keys, ...labelsBody() }
    if (on.carta && !hadCarta.value) body.cartaSample = carta.sample
    const res = await api.put(`/api/businesses/${props.biz.id}/settings`, body)
    emit('saved', res.data)
    toast('Guardado', 'success')
    emit('close')
  } catch (e) {
    err.value = e.response?.data?.error || 'No se pudo guardar'
  } finally { saving.value = false }
}

async function copyCreds() {
  const r = result.value
  const lines = [`${r.business.name}`, r.business.slug && on.carta ? `Carta: ${origin}/carta/${r.business.slug}` : '', `App: ${origin}`, ...r.users.map(u => `${roleName(u.role)}: ${u.username} / ${u.password}`)].filter(Boolean)
  try { await navigator.clipboard.writeText(lines.join('\n')); toast('Accesos copiados', 'success') } catch { window.prompt('Copia los accesos:', lines.join('\n')) }
}

onMounted(async () => {
  try {
    const r = (await api.get('/api/businesses/registry')).data
    Object.assign(reg, { modules: r.modules, base: r.base, templates: r.templates })
    for (const m of reg.modules) on[m.key] = false
    if (isEdit.value) {
      const [st, prof] = await Promise.all([api.get(`/api/businesses/${props.biz.id}/modules`), api.get(`/api/${props.biz.id}/profile`)])
      for (const m of reg.modules) on[m.key] = !!st.data[m.key]
      hadCarta.value = !!st.data.carta
      Object.assign(labels, { spaceLabel: prof.data.spaceLabel || 'Mesa', spaceLabelPlural: prof.data.spaceLabelPlural || 'Mesas',
        spaceNamesText: (prof.data.spaceNames || []).join(', '), recipesLabel: prof.data.recipesLabel || 'Recetas' })
    } else {
      applyTemplate(reg.templates.find(t => t.id === 'polleria') || reg.templates[0])
    }
  } catch { toast('No se pudo cargar la lista de módulos', 'error'); emit('close') }
  finally { loading.value = false }
})
</script>

<style scoped>
.wz { max-width: 760px; width: 100%; max-height: 92vh; display: flex; flex-direction: column; }
.wz-body { overflow-y: auto; }
.wz-steps { display: flex; border-bottom: 1px solid var(--border); font-size: 12px; overflow-x: auto; }
.wz-steps span { flex: 1; padding: 10px 6px; text-align: center; color: var(--text-light); white-space: nowrap; }
.wz-steps span.on { color: var(--accent-hover); background: var(--accent-light); font-weight: 700; }
.wz-steps span.ok { color: var(--success); }
.wz-hint { color: var(--text-secondary); font-size: 13px; margin: 0 0 10px; }
.wz-hint2 { color: var(--text-secondary); font-size: 12px; display: block; margin-top: 4px; }
.wz-icons { display: flex; flex-wrap: wrap; gap: 6px; }
.wz-icon { width: 38px; height: 38px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); cursor: pointer; display: grid; place-items: center; }
.wz-icon.on { border-color: var(--accent); background: var(--accent-light); }
.wz-tpls { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-bottom: 14px; }
.wz-tpl { text-align: left; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 12px; padding: 10px 12px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; font-family: inherit; }
.wz-tpl b { font-size: 14px; } .wz-tpl span { font-size: 12px; color: var(--text-secondary); }
.wz-tpl.on { border: 2px solid var(--accent); padding: 9px 11px; }
.wz-group { margin-bottom: 8px; }
.wz-gh { font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--text-secondary); padding: 6px 0 4px; border-bottom: 1px solid var(--border); }
.wz-mod { display: flex; align-items: center; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--border); }
.wz-mod:last-child { border-bottom: 0; }
.wz-tx { flex: 1; min-width: 0; font-size: 14px; } .wz-tx small { display: block; color: var(--text-secondary); font-size: 12px; line-height: 1.35; } .wz-tx em { font-style: normal; color: var(--warning); }
.wz-sw { width: 38px; height: 22px; border-radius: 99px; border: 0; background: var(--border); position: relative; cursor: pointer; flex: none; transition: background .15s; }
.wz-sw::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: left .15s; }
.wz-sw.on { background: var(--success); } .wz-sw.on::after { left: 19px; }
.wz-base { margin-top: 10px; border: 1px solid var(--border); border-radius: 10px; padding: 8px 12px; font-size: 13px; }
.wz-base summary { cursor: pointer; font-weight: 600; }
.wz-base p { margin: 6px 0 0; color: var(--text-secondary); line-height: 1.4; } .wz-base b { color: var(--text); }
.wz-check { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; line-height: 1.4; }
.wz-user { display: grid; grid-template-columns: 1fr 1fr 1.2fr 1.1fr auto; gap: 6px; margin-bottom: 6px; align-items: center; }
.wz-pass { display: flex; gap: 4px; }
.wz-sum { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.wz-sum > div { display: flex; gap: 12px; padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
.wz-sum > div:last-child { border-bottom: 0; } .wz-sum span { width: 120px; flex: none; color: var(--text-secondary); } .wz-sum b { word-break: break-word; }
.wz-ok { font-size: 15px; margin-bottom: 8px; }
.wz-cred { display: grid; grid-template-columns: 110px 1fr 1fr; gap: 8px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 10px; margin-bottom: 6px; font-size: 13px; }
.wz-cred code { background: var(--surface-2); border-radius: 6px; padding: 2px 6px; }
.wz-err { color: var(--danger); font-weight: 600; font-size: 13px; margin: 10px 0 0; }
@media (max-width: 640px) { .wz-user { grid-template-columns: 1fr 1fr; } }
</style>
