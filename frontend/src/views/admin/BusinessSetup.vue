<template>
  <PageLayout title="Configuración del Negocio">
        <div class="page-header">
          <h1 class="page-title">Configuración del Negocio</h1>
        </div>

        <div class="setup-tabs">
          <button v-for="tab in tabs" :key="tab.id" :class="['tab-btn', { active: activeTab === tab.id }]" @click="activeTab = tab.id">
            {{ tab.label }}
          </button>
        </div>

        <!-- Business Profile -->
        <div class="card" v-if="activeTab === 'profile'">
          <h3 class="section-title">Información del Negocio</h3>
          <div v-if="saved" class="alert alert-success">Cambios guardados correctamente</div>

          <!-- Logo del negocio -->
          <div class="logo-section">
            <div class="logo-preview" @click="triggerLogoInput">
              <img v-if="logoPreview || profile.logo" :src="logoPreview || profile.logo" alt="Logo" class="logo-img" />
              <div v-else class="logo-placeholder">
                <span class="logo-icon">🏪</span>
                <span class="logo-text">Subir logo</span>
              </div>
              <div class="logo-overlay">
                <span>Cambiar foto</span>
              </div>
            </div>
            <div class="logo-actions">
              <input ref="logoInput" type="file" accept="image/*" style="display:none" @change="onLogoSelected" />
              <button class="btn btn-outline btn-sm" @click="triggerLogoInput">Elegir imagen</button>
              <button v-if="logoFile" class="btn btn-primary btn-sm" @click="uploadLogo" :disabled="uploading">
                {{ uploading ? 'Subiendo...' : 'Guardar foto' }}
              </button>
              <span v-if="logoFile" class="logo-filename">{{ logoFile.name }}</span>
            </div>
          </div>

          <div class="grid grid-2">
            <div class="form-group">
              <label class="form-label">Nombre del negocio *</label>
              <input v-model="profile.name" class="form-control" />
            </div>
            <div class="form-group">
              <label class="form-label">NIT</label>
              <input v-model="profile.nit" class="form-control" placeholder="900.xxx.xxx-1" />
            </div>
            <div class="form-group">
              <label class="form-label">Dirección</label>
              <input v-model="profile.address" class="form-control" />
            </div>
            <div class="form-group">
              <label class="form-label">Ciudad</label>
              <input v-model="profile.city" class="form-control" />
            </div>
            <div class="form-group">
              <label class="form-label">Teléfono</label>
              <input v-model="profile.phone" class="form-control" />
            </div>
            <div class="form-group">
              <label class="form-label">Prefijo de factura</label>
              <input v-model="profile.invoicePrefix" class="form-control" maxlength="4" />
            </div>
            <div class="form-group">
              <label class="form-label">Número de mesas</label>
              <input v-model.number="profile.tablesCount" type="number" class="form-control" min="1" />
            </div>
            <div class="form-group">
              <label class="form-label">Moneda</label>
              <select v-model="profile.currency" class="form-control">
                <option value="COP">COP - Peso colombiano</option>
                <option value="USD">USD - Dólar</option>
              </select>
            </div>
          </div>
          <button class="btn btn-primary" @click="saveProfile" :disabled="saving">
            {{ saving ? 'Guardando...' : 'Guardar cambios' }}
          </button>

          <!-- QR de pago por transferencia -->
          <div class="qr-section">
            <h4 class="qr-section-title">QR para pagos por transferencia</h4>
            <p class="text-muted" style="font-size:13px;margin-bottom:12px">
              Sube el QR de tu cuenta (Nequi, Bancolombia, etc.). Aparecerá un botón en el módulo de facturación cuando el cliente pague por transferencia.
            </p>
            <div class="qr-row">
              <div class="qr-preview" @click="triggerQrInput">
                <img v-if="qrPreview || profile.paymentQr" :src="qrPreview || profile.paymentQr" alt="QR" class="qr-img" />
                <div v-else class="qr-placeholder">
                  <span style="font-size:32px">📷</span>
                  <span style="font-size:12px">Subir QR</span>
                </div>
              </div>
              <div class="qr-actions">
                <input ref="qrInput" type="file" accept="image/*" style="display:none" @change="onQrSelected" />
                <button class="btn btn-outline btn-sm" @click="triggerQrInput">Elegir imagen</button>
                <button v-if="qrFile" class="btn btn-primary btn-sm" @click="uploadQr" :disabled="uploadingQr">
                  {{ uploadingQr ? 'Subiendo...' : 'Guardar QR' }}
                </button>
                <button v-if="profile.paymentQr && !qrFile" class="btn btn-danger-outline btn-sm" @click="removeQr">Quitar QR</button>
                <span v-if="qrFile" class="qr-filename">{{ qrFile.name }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Categories config -->
        <div class="card" v-if="activeTab === 'categories'">
          <h3 class="section-title">Categorías de productos</h3>
          <p class="text-muted mb-3">Define las categorías que usarás en inventario. Marca <strong>✅ Crea receta</strong> para que cada producto de esa categoría aparezca automáticamente en el menú de ventas.</p>

          <div class="cat-add-row">
            <input v-model="newCatName" class="form-control" placeholder="Nueva categoría (ej: bebidas, licores, mecato...)" @keyup.enter="addCategory" style="max-width:320px" />
            <button class="btn btn-primary" @click="addCategory">+ Agregar</button>
          </div>

          <div class="cat-list" v-if="categories.length > 0">
            <div class="cat-row" v-for="(cat, idx) in categories" :key="idx">
              <span class="cat-name">{{ cat.name }}</span>
              <label class="cat-check">
                <input type="checkbox" v-model="cat.autoRecipe" />
                <span>Crea receta automáticamente</span>
              </label>
              <button class="btn btn-sm btn-danger" @click="removeCategory(idx)">🗑</button>
            </div>
          </div>
          <p v-else class="text-muted" style="padding:16px 0">No hay categorías aún. Agrega la primera arriba.</p>

          <button class="btn btn-primary" style="margin-top:16px" @click="saveCategories">Guardar categorías</button>
        </div>

        <!-- Tables config -->
        <div class="card" v-if="activeTab === 'tables'">
          <h3 class="section-title">Configurar mesas</h3>
          <p class="text-muted mb-3">Actualmente: {{ tablesStore.tables.length }} mesas configuradas</p>
          <div class="form-group" style="max-width:200px">
            <label class="form-label">Número de mesas</label>
            <input v-model.number="newTableCount" type="number" class="form-control" min="1" max="100" />
          </div>
          <div class="alert alert-warning">
            Esto recreará todas las mesas. Las órdenes activas se perderán.
          </div>
          <button class="btn btn-primary" @click="reinitTables">Aplicar configuración</button>
        </div>

        <!-- Users -->
        <div class="card" v-if="activeTab === 'users'">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 class="section-title" style="margin:0">Usuarios del negocio</h3>
            <button class="btn btn-primary btn-sm" @click="openUserModal">+ Nuevo usuario</button>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                <tr v-for="user in users" :key="user.id">
                  <td>{{ user.name }}</td>
                  <td><code>{{ user.username }}</code></td>
                  <td><span :class="['badge', user.role === 'admin' ? 'badge-info' : 'badge-default']">{{ user.role }}</span></td>
                  <td>
                    <div class="action-btns">
                      <button class="btn btn-sm btn-outline" @click="openEditUser(user)">✏️</button>
                      <button class="btn btn-sm btn-danger" @click="deleteUser(user)">🗑️</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Backup -->
        <div class="card" v-if="activeTab === 'backup'">
          <h3 class="section-title">Copia de seguridad</h3>
          <p class="text-muted mb-3">
            Descarga todos los datos del negocio en un archivo JSON: ventas, inventario,
            recetas, turnos, deudas, proveedores y más. Guárdalo en un lugar seguro.
          </p>
          <div class="backup-info mb-3">
            <div class="backup-item">📦 Ventas e historial de facturas</div>
            <div class="backup-item">📋 Inventario y recetas</div>
            <div class="backup-item">💰 Turnos de caja y retiros</div>
            <div class="backup-item">🤝 Proveedores y pagos</div>
            <div class="backup-item">📒 Deudas y abonos</div>
            <div class="backup-item">👥 Usuarios del negocio</div>
          </div>
          <button class="btn btn-primary" @click="downloadBackup" :disabled="backingUp">
            <span v-if="backingUp">⏳ Generando...</span>
            <span v-else>⬇️ Descargar backup</span>
          </button>
          <p class="text-muted mt-2" style="font-size:12px">
            El archivo se descarga con la fecha de hoy en el nombre. Recomendamos hacerlo semanalmente.
          </p>
        </div>

        <!-- User modal -->
        <div class="modal-overlay" v-if="showUserModal" @click.self="showUserModal = false">
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title">{{ editUser ? 'Editar usuario' : 'Nuevo usuario' }}</h3>
              <button class="btn-close" @click="showUserModal = false">×</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Nombre completo *</label>
                <input v-model="userForm.name" class="form-control" />
              </div>
              <div class="form-group">
                <label class="form-label">Usuario *</label>
                <input v-model="userForm.username" class="form-control" />
              </div>
              <div class="form-group">
                <label class="form-label">{{ editUser ? 'Nueva contraseña (dejar vacío = no cambiar)' : 'Contraseña *' }}</label>
                <input v-model="userForm.password" type="password" class="form-control" />
              </div>
              <div class="form-group">
                <label class="form-label">Rol</label>
                <select v-model="userForm.role" class="form-control">
                  <option value="cajero">Cajero</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="showUserModal = false">Cancelar</button>
              <button class="btn btn-primary" @click="saveUser">Guardar</button>
            </div>
          </div>
        </div>

  </PageLayout>
</template>

<script setup>
/**
 * BusinessSetup.vue — Configuración del negocio
 *
 * Vista exclusiva para admin y superadmin. Permite gestionar:
 *   - Perfil: nombre, NIT, dirección, logo, prefijo de factura, moneda, mesas
 *   - Categorías: define las categorías de productos del inventario y si cada
 *     una crea receta automáticamente al agregar un producto
 *   - Mesas: reinicializa el número de mesas (borra órdenes activas)
 *   - Usuarios: CRUD de cajeros y admins del negocio
 *
 * Pestañas: 'profile' | 'categories' | 'tables' | 'users'
 */
import { ref, reactive, onMounted, inject } from 'vue'
import { useBusinessStore } from '../../stores/business.js'
import { useTablesStore } from '../../stores/tables.js'
import PageLayout from '../../components/PageLayout.vue'
import api from '../../services/api.js'
import { useAuthStore } from '../../stores/auth.js'

const businessStore = useBusinessStore()
const tablesStore = useTablesStore()
const authStore = useAuthStore()
const toast = inject('toast')

const tabs = [
  { id: 'profile', label: 'Perfil del negocio' },
  { id: 'categories', label: 'Categorías' },
  { id: 'tables', label: 'Mesas' },
  { id: 'users', label: 'Usuarios' },
  { id: 'backup', label: '⬇️ Backup' }
]
const activeTab = ref('profile')
const backingUp = ref(false)

const profile = reactive({
  name: '', nit: '', address: '', city: '', phone: '',
  invoicePrefix: '', tablesCount: 10, currency: 'COP', logo: '', paymentQr: ''
})

const saving = ref(false)
const saved = ref(false)
const newTableCount = ref(10)

// ── Categorías ────────────────────────────────────────
// Cada categoría: { name: string, autoRecipe: boolean }
// 'autoRecipe: true' indica que al crear un producto de esa categoría en
// inventario se generará automáticamente un ítem en el menú de ventas.
const categories = ref([])
const newCatName = ref('')

/**
 * Agrega una nueva categoría a la lista local.
 * Normaliza el nombre a minúsculas y evita duplicados.
 * No guarda en el backend hasta llamar saveCategories().
 */
function addCategory() {
  const name = newCatName.value.trim().toLowerCase()
  if (!name) return
  if (categories.value.some(c => c.name === name)) {
    toast('Esa categoría ya existe', 'warning'); return
  }
  categories.value.push({ name, autoRecipe: false })
  newCatName.value = ''
}

/** Elimina una categoría de la lista local por índice */
function removeCategory(idx) {
  categories.value.splice(idx, 1)
}

/**
 * Persiste las categorías en el backend incluyéndolas dentro del perfil.
 * Efecto secundario: actualiza businessStore.profile con los nuevos datos.
 */
async function saveCategories() {
  try {
    await businessStore.updateProfile({ ...profile, categories: categories.value })
    toast('Categorías guardadas', 'success')
  } catch {
    toast('Error al guardar categorías', 'error')
  }
}

// ── Logo ──────────────────────────────────────────────
const logoInput = ref(null)       // Referencia al <input type="file"> oculto
const logoFile = ref(null)        // Objeto File seleccionado por el usuario
const logoPreview = ref(null)     // data-URL para previsualización inmediata
const uploading = ref(false)

/** Dispara el selector de archivo del sistema operativo */
function triggerLogoInput() {
  logoInput.value?.click()
}

/**
 * Maneja la selección del archivo de logo.
 * Lee el archivo como data-URL para mostrar la previsualización
 * instantánea antes de enviarlo al servidor.
 */
function onLogoSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  logoFile.value = file
  const reader = new FileReader()
  reader.onload = ev => { logoPreview.value = ev.target.result }
  reader.readAsDataURL(file)
}

/**
 * Sube el archivo de logo al backend usando multipart/form-data.
 * Después de la subida actualiza profile.logo y agrega un cache-buster
 * a la previsualización para forzar que el navegador recargue la imagen.
 */
async function uploadLogo() {
  if (!logoFile.value) return
  uploading.value = true
  try {
    const businessId = authStore.currentBusiness?.id
    const formData = new FormData()
    formData.append('logo', logoFile.value)
    const { data } = await api.post(`/api/${businessId}/profile/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    // Actualiza el perfil reactivo para que saveProfile() no sobreescriba el logo nuevo
    profile.logo = data.logo
    // Cache-buster: fuerza al navegador a recargar la imagen en lugar de usar caché
    logoPreview.value = data.logo + '?t=' + Date.now()
    logoFile.value = null
    toast('Logo guardado', 'success')
  } catch {
    toast('Error al subir el logo', 'error')
  } finally {
    uploading.value = false
  }
}

// ── QR de pagos por transferencia ───────────────────
const qrInput = ref(null)
const qrFile = ref(null)
const qrPreview = ref(null)
const uploadingQr = ref(false)

function triggerQrInput() { qrInput.value?.click() }

function onQrSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  qrFile.value = file
  const reader = new FileReader()
  reader.onload = ev => { qrPreview.value = ev.target.result }
  reader.readAsDataURL(file)
}

async function uploadQr() {
  if (!qrFile.value) return
  uploadingQr.value = true
  try {
    const businessId = authStore.currentBusiness?.id
    const formData = new FormData()
    formData.append('paymentQr', qrFile.value)
    const { data } = await api.post(`/api/${businessId}/profile/payment-qr`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    profile.paymentQr = data.paymentQr
    qrPreview.value = data.paymentQr + '?t=' + Date.now()
    qrFile.value = null
    toast('QR guardado', 'success')
  } catch {
    toast('Error al subir el QR', 'error')
  } finally {
    uploadingQr.value = false
  }
}

/** Quita el QR del perfil (no borra el archivo, solo desvincula) */
async function removeQr() {
  if (!confirm('¿Quitar el QR de pago?')) return
  try {
    const businessId = authStore.currentBusiness?.id
    await api.put(`/api/${businessId}/profile`, { ...profile, paymentQr: '' })
    profile.paymentQr = ''
    qrPreview.value = null
    toast('QR removido', 'success')
  } catch {
    toast('Error al quitar el QR', 'error')
  }
}

// ── Usuarios ──────────────────────────────────────────
const users = ref([])
const showUserModal = ref(false)
const editUser = ref(null)        // null = creando, objeto = editando
const userForm = reactive({ name: '', username: '', password: '', role: 'cajero' })

/**
 * Guarda el perfil del negocio (nombre, NIT, dirección, etc.) en el backend.
 * Muestra una alerta de éxito que desaparece automáticamente a los 3 segundos.
 */
async function saveProfile() {
  saving.value = true
  try {
    await businessStore.updateProfile({ ...profile })
    saved.value = true
    toast('Perfil guardado', 'success')
    setTimeout(() => saved.value = false, 3000)
  } catch {
    toast('Error al guardar', 'error')
  } finally {
    saving.value = false
  }
}

/**
 * Reinicializa todas las mesas del negocio con el nuevo número indicado.
 * ATENCIÓN: elimina todas las órdenes activas. Requiere confirmación.
 */
async function reinitTables() {
  if (!confirm(`¿Reiniciar a ${newTableCount.value} mesas? Las órdenes activas se perderán.`)) return
  await tablesStore.initTables(newTableCount.value)
  toast('Mesas configuradas', 'success')
}

/** Obtiene la lista de usuarios del negocio desde el backend y la almacena en users */
async function loadUsers() {
  users.value = await businessStore.fetchUsers()
}

/** Abre el modal en modo creación con el formulario limpio */
function openUserModal() {
  editUser.value = null
  Object.assign(userForm, { name: '', username: '', password: '', role: 'cajero' })
  showUserModal.value = true
}

/**
 * Abre el modal en modo edición precargando los datos del usuario seleccionado.
 * La contraseña se deja vacía intencionalmente; solo se cambia si el admin la escribe.
 */
function openEditUser(u) {
  editUser.value = u
  Object.assign(userForm, { name: u.name, username: u.username, password: '', role: u.role })
  showUserModal.value = true
}

/**
 * Crea o actualiza un usuario según si editUser tiene valor.
 * Si editUser es null → crea; si tiene valor → actualiza.
 * Omite la contraseña del payload si se deja en blanco al editar.
 */
async function saveUser() {
  if (!userForm.name || !userForm.username) { toast('Nombre y usuario requeridos', 'warning'); return }
  if (!editUser.value && !userForm.password) { toast('Contraseña requerida', 'warning'); return }
  try {
    const data = { ...userForm }
    if (!data.password) delete data.password   // No enviar campo vacío al editar
    if (editUser.value) {
      await businessStore.updateUser(editUser.value.id, data)
      toast('Usuario actualizado', 'success')
    } else {
      await businessStore.createUser(data)
      toast('Usuario creado', 'success')
    }
    showUserModal.value = false
    await loadUsers()
  } catch {
    toast('Error al guardar usuario', 'error')
  }
}

/** Elimina un usuario tras confirmación explícita del admin */
async function deleteUser(u) {
  if (!confirm(`¿Eliminar usuario "${u.username}"?`)) return
  await businessStore.deleteUser(u.id)
  await loadUsers()
  toast('Usuario eliminado', 'success')
}

/**
 * Al montar la vista: carga el perfil del negocio, las categorías,
 * el estado actual de mesas y la lista de usuarios.
 */
async function downloadBackup() {
  backingUp.value = true
  try {
    const bizId = authStore.currentBusiness?.id
    const res = await api.get(`/api/${bizId}/backup`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    // El nombre del archivo viene en el header Content-Disposition del servidor
    const disposition = res.headers['content-disposition'] || ''
    const match = disposition.match(/filename="?([^"]+)"?/)
    a.download = match ? match[1] : `backup-${new Date().toISOString().slice(0,10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast('Backup descargado correctamente', 'success')
  } catch {
    toast('Error al generar el backup', 'error')
  } finally {
    backingUp.value = false
  }
}

onMounted(async () => {
  await businessStore.fetchProfile()
  if (businessStore.profile) Object.assign(profile, businessStore.profile)
  // Cargar las categorías persistidas en el perfil
  categories.value = businessStore.profile?.categories || []
  newTableCount.value = profile.tablesCount || 10
  await tablesStore.fetchTables()
  await loadUsers()
})
</script>

<style scoped>
.setup-tabs { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 2px solid var(--border); }
.tab-btn {
  padding: 10px 20px;
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  color: var(--text-light);
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
}
.tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
.section-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
.mb-3 { margin-bottom: 14px; }
.text-muted { color: var(--text-light); font-size: 13px; }
.action-btns { display: flex; gap: 6px; }

/* Categorías */
.cat-add-row { display: flex; gap: 10px; align-items: center; margin-bottom: 20px; }
.cat-list { display: flex; flex-direction: column; gap: 8px; }
.cat-row {
  display: flex; align-items: center; gap: 16px;
  padding: 10px 14px; border: 1px solid var(--border);
  border-radius: 8px; background: var(--surface); color: var(--text);
}
.cat-name { font-weight: 600; min-width: 140px; text-transform: capitalize; }
.cat-check { display: flex; align-items: center; gap: 6px; font-size: 13px; flex: 1; cursor: pointer; }
.cat-check input { width: 16px; height: 16px; cursor: pointer; }

/* ── Logo section ─────────────────────────────────── */
.logo-section {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
}
.logo-preview {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 12px;
  overflow: hidden;
  border: 2px dashed var(--border);
  cursor: pointer;
  flex-shrink: 0;
  background: var(--bg-secondary, #f5f5f5);
}
.logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.logo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.logo-icon { font-size: 28px; }
.logo-text { font-size: 11px; color: var(--text-light); }
.logo-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  opacity: 0;
  transition: opacity 0.2s;
}
.logo-preview:hover .logo-overlay { opacity: 1; }
.logo-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.logo-filename {
  font-size: 12px;
  color: var(--text-light);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qr-section {
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}
.qr-section-title { font-size: 15px; font-weight: 700; margin-bottom: 8px; color: var(--text); }
.qr-row { display: flex; align-items: center; gap: 20px; }
.qr-preview {
  width: 140px;
  height: 140px;
  border-radius: 12px;
  border: 2px dashed var(--border);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--surface-2);
}
.qr-preview:hover { border-color: var(--accent); }
.qr-img { width: 100%; height: 100%; object-fit: contain; }
.qr-placeholder { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--text-light); }
.qr-actions { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.qr-filename { font-size: 12px; color: var(--text-light); max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.btn-danger-outline {
  border: 1.5px solid var(--danger);
  background: transparent;
  color: var(--danger);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
}
.btn-danger-outline:hover { background: #fef2f2; }

.backup-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}
.backup-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-light);
}
.backup-item svg {
  color: var(--primary);
  flex-shrink: 0;
}
</style>
