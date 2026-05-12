<template>
  <PageLayout title="Inventario">
        <div class="page-header">
          <div>
            <h1 class="page-title">Inventario</h1>
            <p class="page-subtitle">{{ inventoryStore.items.length }} productos registrados</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-outline" @click="openSyncModal" v-if="pendingSync.length > 0">
              🍺 Sincronizar al menú ({{ pendingSync.length }})
            </button>
            <button class="btn btn-primary" @click="openCreate">+ Nuevo producto</button>
          </div>
        </div>

        <!-- Filters -->
        <div class="filters-bar card mb-3">
          <input v-model="search" class="form-control" placeholder="Buscar producto..." style="max-width:260px" />
          <select v-model="catFilter" class="form-control" style="max-width:180px">
            <option value="">Todas las categorías</option>
            <option v-for="c in inventoryStore.categories" :key="c" :value="c">{{ c }}</option>
          </select>
          <label class="filter-check">
            <input type="checkbox" v-model="showLowStock" />
            Solo stock bajo
          </label>
        </div>

        <div v-if="inventoryStore.loading" class="loading">
          <div class="spinner"></div> Cargando inventario...
        </div>

        <div v-else>
          <!-- Low stock alert banner -->
          <div class="alert alert-warning" v-if="inventoryStore.lowStockItems.length > 0">
            ⚠️ {{ inventoryStore.lowStockItems.length }} producto(s) con stock bajo o agotado
          </div>

          <div class="card">
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Stock</th>
                    <th>Mínimo</th>
                    <th>Unidad</th>
                    <th>Tipo</th>
                    <th>Costo</th>
                    <th>Precio venta</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in filteredItems" :key="item.id">
                    <td><strong>{{ item.name }}</strong></td>
                    <td><span class="badge badge-default">{{ item.category }}</span></td>
                    <td>
                      <span :class="['badge', item.stock <= item.minStock ? 'badge-danger' : 'badge-success']">
                        {{ item.stock }}
                      </span>
                    </td>
                    <td>{{ item.minStock }}</td>
                    <td>{{ item.unit }}</td>
                    <td>
                      <span v-if="item.esIngrediente" class="badge badge-ingredient">🧪 Ingrediente</span>
                      <span v-else class="badge badge-sale">🛒 Venta</span>
                    </td>
                    <td>{{ formatCOP(item.cost) }}</td>
                    <td>{{ !item.esIngrediente && item.salePrice ? formatCOP(item.salePrice) : '—' }}</td>
                    <td>
                      <div class="action-btns">
                        <button class="btn btn-sm btn-outline" @click="openAdjust(item)" title="Ajustar stock">±</button>
                        <button class="btn btn-sm btn-outline" @click="openEdit(item)">✏️</button>
                        <button class="btn btn-sm btn-danger" @click="confirmDelete(item)">🗑️</button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="filteredItems.length === 0">
                    <td colspan="8" class="empty-row">No hay productos</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Create/Edit modal -->
        <div class="modal-overlay" v-if="showModal" @click.self="closeModal">
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title">{{ editItem ? 'Editar producto' : 'Nuevo producto' }}</h3>
              <button class="btn-close" @click="closeModal">×</button>
            </div>
            <div class="modal-body">
              <!-- Tipo de producto -->
              <div class="tipo-toggle mb-3">
                <label class="tipo-opt" :class="{ active: !form.esIngrediente }" @click="form.esIngrediente = false">
                  <span class="tipo-icon">🛒</span>
                  <span>
                    <strong>Producto de venta</strong>
                    <small>Tiene precio venta, aparece en POS</small>
                  </span>
                </label>
                <label class="tipo-opt" :class="{ active: form.esIngrediente }" @click="form.esIngrediente = true">
                  <span class="tipo-icon">🧪</span>
                  <span>
                    <strong>Ingrediente</strong>
                    <small>Solo se usa en recetas, no se vende</small>
                  </span>
                </label>
              </div>

              <div class="grid grid-2">
                <div class="form-group">
                  <label class="form-label">Nombre *</label>
                  <input v-model="form.name" :class="['form-control', { 'input-error': submitted && !form.name.trim() }]" />
                </div>
                <div class="form-group">
                  <label class="form-label">Proveedor *</label>
                  <select v-model="form.supplierId" :class="['form-control', { 'input-error': submitted && !form.supplierId }]">
                    <option value="">— Seleccionar proveedor —</option>
                    <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Categoría *</label>
                  <input v-model="form.category" :class="['form-control', { 'input-error': submitted && !form.category.trim() }]" list="cats" />
                  <datalist id="cats">
                    <option v-for="c in catNames" :key="c" :value="c" />
                  </datalist>
                </div>
                <div class="form-group">
                  <label class="form-label">Unidad * <span class="form-hint">¿en qué se mide? (kg, litro, unidad…)</span></label>
                  <input v-model="form.unit" :class="['form-control', { 'input-error': submitted && !form.unit.trim() }]" list="units" />
                  <datalist id="units">
                    <option value="unidad" /><option value="litro" />
                    <option value="kg" /><option value="gramo" /><option value="porción" />
                  </datalist>
                </div>
                <div class="form-group">
                  <label class="form-label">Stock actual</label>
                  <input v-model.number="form.stock" type="number" class="form-control" min="0" />
                </div>
                <div class="form-group">
                  <label class="form-label">Stock mínimo</label>
                  <input v-model.number="form.minStock" type="number" class="form-control" min="0" />
                </div>
                <div class="form-group">
                  <label class="form-label">Precio de costo (COP) *</label>
                  <input v-model.number="form.cost" type="number" :class="['form-control', { 'input-error': submitted && !(form.cost > 0) }]" min="0" />
                </div>
                <div class="form-group" v-if="!form.esIngrediente">
                  <label class="form-label">Precio de venta (COP)</label>
                  <input v-model.number="form.salePrice" type="number" class="form-control" min="0" placeholder="Ej: 8000" />
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="closeModal">Cancelar</button>
              <button class="btn btn-primary" @click="saveItem" :disabled="saving">
                {{ saving ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Adjust stock modal -->
        <div class="modal-overlay" v-if="adjustItem" @click.self="adjustItem = null">
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title">Ajustar stock - {{ adjustItem?.name }}</h3>
              <button class="btn-close" @click="adjustItem = null">×</button>
            </div>
            <div class="modal-body">
              <p class="mb-2">Stock actual: <strong>{{ adjustItem?.stock }} {{ adjustItem?.unit }}</strong></p>
              <div class="form-group">
                <label class="form-label">Ajuste (+ agregar / - reducir)</label>
                <input v-model.number="adjustAmount" type="number" class="form-control" />
              </div>
              <div class="form-group">
                <label class="form-label">Motivo</label>
                <input v-model="adjustReason" class="form-control" placeholder="Ej: Merma, corrección, etc." />
              </div>
              <p class="text-muted">Nuevo stock: <strong>{{ Math.max(0, (adjustItem?.stock || 0) + (adjustAmount || 0)) }}</strong></p>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="adjustItem = null">Cancelar</button>
              <button class="btn btn-primary" @click="doAdjust">Aplicar ajuste</button>
            </div>
          </div>
        </div>

        <!-- Update recipe price modal -->
        <div class="modal-overlay" v-if="updateRecipeModal" @click.self="updateRecipeModal = null">
          <div class="modal" style="max-width:380px">
            <div class="modal-header">
              <h3 class="modal-title">Actualizar precio en menú</h3>
              <button class="btn-close" @click="updateRecipeModal = null">×</button>
            </div>
            <div class="modal-body">
              <p class="text-muted mb-2">
                <strong>{{ updateRecipeModal.recipe.name }}</strong> está en el menú con precio
                <strong>{{ formatCOP(updateRecipeModal.recipe.price) }}</strong>.
                ¿Quieres actualizarlo?
              </p>
              <div class="form-group">
                <label class="form-label">Nuevo precio de venta</label>
                <input v-model.number="updateRecipeModal.newSalePrice" type="number" class="form-control" min="0" />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="updateRecipeModal = null">No, dejar igual</button>
              <button class="btn btn-primary" @click="confirmUpdateRecipe">Sí, actualizar</button>
            </div>
          </div>
        </div>

        <!-- Sync to menu modal -->
        <div class="modal-overlay" v-if="showSyncModal" @click.self="showSyncModal = false">
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title">🍺 Sincronizar bebidas al menú</h3>
              <button class="btn-close" @click="showSyncModal = false">×</button>
            </div>
            <div class="modal-body">
              <p class="text-muted mb-2">Estas bebidas/licores no están en el menú aún. Ingresa el precio de venta de cada una:</p>
              <div v-for="item in syncItems" :key="item.id" class="sync-row">
                <div class="sync-item-info">
                  <strong>{{ item.name }}</strong>
                  <span class="badge badge-default">{{ item.category }}</span>
                </div>
                <div class="sync-price">
                  <label class="form-label">Precio venta</label>
                  <input v-model.number="item.salePrice" type="number" class="form-control" min="0" placeholder="Ej: 8000" />
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="showSyncModal = false">Cancelar</button>
              <button class="btn btn-primary" @click="doSync" :disabled="syncing">
                {{ syncing ? 'Sincronizando...' : `Agregar ${syncItems.length} al menú` }}
              </button>
            </div>
          </div>
        </div>

      <!-- Modal de confirmación para eliminar — reemplaza el confirm() nativo del navegador -->
      <ConfirmModal
        :visible="!!confirmDelete_item"
        :title="`Eliminar producto`"
        :message="`¿Eliminar &quot;${confirmDelete_item?.name}&quot;? Esta acción no se puede deshacer.`"
        confirmText="Sí, eliminar"
        type="danger"
        @confirm="doDelete"
        @cancel="confirmDelete_item = null"
      />

  </PageLayout>
</template>

<script setup>
/**
 * InventoryView.vue — Gestión de inventario de insumos
 *
 * Permite administrar los productos/materias primas del negocio:
 *   - Filtrar por categoría y buscar por nombre
 *   - Crear / editar / eliminar ítems (solo admin+)
 *   - Ajustar stock manualmente (+/- con motivo)
 *   - Badge de alerta en ítems con stock bajo
 *
 * Auto-sincronización con el menú:
 *   Al crear un ítem en categorías 'bebidas' o 'licores', se crea
 *   automáticamente una receta/ítem de menú vinculada a ese insumo.
 *   El botón "Sincronizar al menú" permite agregar al menú los ítems
 *   existentes en esas categorías que aún no tienen receta.
 *
 * Los ítems de inventario son la base para:
 *   - Descuento automático de stock al vender (via recetas/ingredientes)
 *   - Aumento de stock al registrar compras
 *   - Alertas de stock bajo en dashboard y menú lateral
 */
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { useInventoryStore } from '../stores/inventory.js'
import { useBusinessStore } from '../stores/business.js'
import { useAuthStore } from '../stores/auth.js'
import PageLayout from '../components/PageLayout.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import api from '../services/api.js'

const inventoryStore = useInventoryStore()
const businessStore = useBusinessStore()
const auth = useAuthStore()
const toast = inject('toast')
const suppliers = ref([])   // Lista de proveedores del negocio para el selector del formulario

// ── Categorías del negocio ───────────────────────────────────────────────────
// Se leen desde businessStore.profile.categories (configuradas en BusinessSetup).
// Cada categoría tiene: { name: string, autoRecipe: boolean }

/** Categorías completas configuradas por el admin del negocio */
const bizCategories = computed(() => businessStore.profile?.categories || [])

/** Solo los nombres de las categorías, para el datalist del formulario */
const catNames = computed(() => bizCategories.value.map(c => c.name))

/** Categorías cuyo flag autoRecipe = true; al crear un producto de éstas
 *  se genera automáticamente una receta/ítem de menú vinculado */
const autoRecipeCats = computed(() => bizCategories.value.filter(c => c.autoRecipe).map(c => c.name))

// ── Sincronización pendiente con el menú ─────────────────────────────────────
const showSyncModal = ref(false)
const syncItems = ref([])     // Ítems seleccionados para sincronizar, con salePrice editable
const syncing = ref(false)
const updateRecipeModal = ref(null)  // { recipe, newSalePrice } — modal para actualizar precio de receta vinculada

/**
 * Productos vendibles (no ingredientes) con precio de venta que aún NO tienen receta en el menú.
 * Estos aparecen en el botón "Sincronizar al menú".
 */
const pendingSync = computed(() => {
  const recipeNames = new Set(inventoryStore.recipes.map(r => r.name.toLowerCase()))
  return inventoryStore.items.filter(i =>
    !i.esIngrediente &&
    (i.salePrice > 0) &&
    !recipeNames.has(i.name.toLowerCase())
  )
})

// ── Filtros de la tabla ───────────────────────────────────────────────────────
const search = ref('')
const catFilter = ref('')
const showLowStock = ref(false)

// ── Estado del modal Crear/Editar ─────────────────────────────────────────────
const showModal = ref(false)
const editItem = ref(null)   // null = creando, objeto = editando
const saving = ref(false)
const submitted = ref(false) // true tras el primer intento de guardar; activa estilos de error

// ── Modal de confirmación para eliminar ──────────────────────────────────────
const confirmDelete_item = ref(null)   // Ítem pendiente de eliminar (null = modal cerrado)

const adjustItem = ref(null)    // Ítem al que se le está ajustando el stock
const adjustAmount = ref(0)     // Cantidad de ajuste (+/-)
const adjustReason = ref('')    // Motivo del ajuste (para trazabilidad)

const form = reactive({
  name: '', category: '', unit: 'unidad',
  stock: 0, minStock: 0, cost: 0, salePrice: 0, supplierId: '',
  esIngrediente: false
})


/**
 * Lista de ítems del inventario filtrada según los controles de búsqueda.
 * Aplica los tres filtros en cascada: texto, categoría y stock bajo.
 */
const filteredItems = computed(() => {
  let items = inventoryStore.items
  if (search.value) {
    const s = search.value.toLowerCase()
    items = items.filter(i => i.name.toLowerCase().includes(s))
  }
  if (catFilter.value) {
    items = items.filter(i => i.category === catFilter.value)
  }
  if (showLowStock.value) {
    // Stock bajo: stock actual <= stock mínimo configurado
    items = items.filter(i => i.stock <= (i.minStock || 0))
  }
  return items
})

/** Formatea un número como moneda colombiana (ej: $12.500) */
function formatCOP(v) {
  return '$' + Number(v || 0).toLocaleString('es-CO')
}

/** Abre el modal en modo creación con el formulario limpio */
function openCreate() {
  editItem.value = null
  submitted.value = false
  Object.assign(form, { name: '', category: '', unit: 'unidad', stock: 0, minStock: 0, cost: 0, salePrice: 0, supplierId: '', esIngrediente: false })
  showModal.value = true
}

/**
 * Abre el modal en modo edición precargando los datos del ítem.
 * Usa spread para garantizar que supplierId sea siempre '' si no existe
 * (evita que quede undefined en el select).
 */
function openEdit(item) {
  editItem.value = item
  submitted.value = false
  Object.assign(form, { supplierId: '', esIngrediente: false, ...item })
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editItem.value = null
  submitted.value = false
}

/**
 * Crea o actualiza un ítem de inventario.
 *
 * Creación (editItem = null):
 *   - Si la categoría tiene autoRecipe, crea también una receta en el menú
 *     con el precio de venta ingresado (o el costo como fallback)
 *
 * Edición (editItem tiene valor):
 *   - Si la categoría tiene autoRecipe y ya existe una receta con el mismo nombre,
 *     ofrece actualizar el precio de venta en el menú via updateRecipeModal
 *
 * Nota: salePrice se extrae del form antes de guardar en inventario,
 * ya que ese campo no existe en el modelo de inventario del backend.
 */
async function saveItem() {
  submitted.value = true
  if (!form.name.trim()) { toast('El nombre es obligatorio', 'warning'); return }
  if (!form.supplierId) { toast('Selecciona un proveedor', 'warning'); return }
  if (!form.category.trim()) { toast('La categoría es obligatoria', 'warning'); return }
  if (!form.unit.trim()) { toast('La unidad es obligatoria', 'warning'); return }
  if (!(form.cost > 0)) { toast('El precio de costo debe ser mayor a 0', 'warning'); return }
  // Validar duplicado por nombre (solo al crear)
  if (!editItem.value) {
    const nombre = form.name.trim().toLowerCase()
    const existe = inventoryStore.items.some(i => i.name.trim().toLowerCase() === nombre)
    if (existe) { toast(`Ya existe un producto llamado "${form.name.trim()}"`, 'warning'); return }
  }
  saving.value = true
  try {
    const itemData = { ...form }
    // Si es ingrediente, limpiar precio venta para que no aparezca en POS
    if (form.esIngrediente) itemData.salePrice = 0

    if (editItem.value) {
      await inventoryStore.updateItem(editItem.value.id, itemData)
      // Si es vendible y ya existe receta vinculada, ofrecer actualizar precio
      if (!form.esIngrediente && form.salePrice > 0) {
        const linked = inventoryStore.recipes.find(r => r.name.toLowerCase() === form.name.toLowerCase())
        if (linked) {
          updateRecipeModal.value = { recipe: linked, newSalePrice: form.salePrice }
        }
      }
      toast('Producto actualizado', 'success')
    } else {
      const newItem = await inventoryStore.createItem(itemData)
      // Si es producto de venta con precio: crear receta automáticamente para que aparezca en POS
      if (!form.esIngrediente && form.salePrice > 0) {
        await inventoryStore.createRecipe({
          name: form.name,
          price: form.salePrice,
          category: form.category,
          available: true,
          ingredients: [{ inventoryId: newItem.id, quantity: 1 }]
        })
        toast(`"${form.name}" creado y agregado al menú de venta`, 'success')
      } else {
        toast('Ingrediente creado', 'success')
      }
    }
    closeModal()
  } catch (err) {
    toast(err.response?.data?.error || 'Error al guardar', 'error')
  } finally {
    saving.value = false
  }
}

/**
 * Abre el modal de confirmación para eliminar un ítem.
 * Se separó en dos funciones (abrir + ejecutar) para poder usar
 * ConfirmModal en lugar del confirm() nativo del navegador.
 */
function confirmDelete(item) {
  confirmDelete_item.value = item
}

/** Ejecuta la eliminación tras confirmar en el modal */
async function doDelete() {
  try {
    await inventoryStore.deleteItem(confirmDelete_item.value.id)
    toast('Producto eliminado', 'success')
  } catch {
    toast('Error al eliminar', 'error')
  } finally {
    confirmDelete_item.value = null
  }
}

/** Prepara el modal de ajuste de stock para un ítem específico */
function openAdjust(item) {
  adjustItem.value = item
  adjustAmount.value = 0
  adjustReason.value = ''
}

/**
 * Aplica el ajuste de stock al ítem seleccionado.
 * Un valor positivo agrega stock; negativo lo reduce (merma, corrección).
 * El backend garantiza que el stock no quede negativo.
 */
async function doAdjust() {
  try {
    await inventoryStore.adjustStock(adjustItem.value.id, adjustAmount.value, adjustReason.value)
    toast('Stock ajustado', 'success')
    adjustItem.value = null
  } catch {
    toast('Error al ajustar', 'error')
  }
}

/**
 * Confirma la actualización del precio de venta en la receta del menú.
 * Se invoca desde el modal que aparece tras editar un producto con autoRecipe.
 */
async function confirmUpdateRecipe() {
  try {
    const { recipe, newSalePrice } = updateRecipeModal.value
    await inventoryStore.updateRecipe(recipe.id, { price: newSalePrice })
    toast('Precio del menú actualizado', 'success')
  } catch {
    toast('Error al actualizar el menú', 'error')
  } finally {
    updateRecipeModal.value = null
  }
}

/**
 * Abre el modal de sincronización masiva al menú.
 * Precarga cada ítem pendiente con su costo como precio de venta sugerido,
 * para que el admin solo ajuste los que quiera cambiar.
 */
function openSyncModal() {
  syncItems.value = pendingSync.value.map(i => ({ ...i, salePrice: i.cost || 0 }))
  showSyncModal.value = true
}

/**
 * Crea recetas de menú para todos los ítems de sincronización pendiente.
 * Procesa los ítems en secuencia (no en paralelo) para evitar condiciones
 * de carrera al escribir el archivo de recetas en el backend.
 */
async function doSync() {
  syncing.value = true
  try {
    for (const item of syncItems.value) {
      await inventoryStore.createRecipe({
        name: item.name,
        price: item.salePrice || item.cost,
        category: item.category,
        available: true,
        ingredients: [{ inventoryId: item.id, quantity: 1 }]
      })
    }
    toast(`${syncItems.value.length} producto(s) agregados al menú`, 'success')
    showSyncModal.value = false
  } catch (err) {
    toast(err.response?.data?.error || 'Error al sincronizar', 'error')
  } finally {
    syncing.value = false
  }
}

onMounted(async () => {
  // Cargar inventario y recetas en paralelo implícito (sin await individual)
  inventoryStore.fetchInventory()
  inventoryStore.fetchRecipes()
  const res = await api.get(`/api/${auth.currentBusiness?.id}/suppliers`)
  suppliers.value = res.data
})
</script>

<style scoped>
.filters-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 14px 16px;
}
.filter-check { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
.mb-3 { margin-bottom: 16px; }
.mb-2 { margin-bottom: 10px; }
.text-muted { font-size: 13px; color: var(--text-light); }
.action-btns { display: flex; gap: 6px; }
.empty-row { text-align: center; color: var(--text-light); padding: 24px; }

.sync-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.sync-row:last-child { border-bottom: none; }
.sync-item-info { display: flex; align-items: center; gap: 8px; flex: 1; }
.sync-price { width: 140px; flex-shrink: 0; }
.sync-price .form-label { font-size: 11px; margin-bottom: 3px; }
.input-error { border-color: var(--danger) !important; background: #fff5f5; }

/* Toggle tipo producto */
.tipo-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.tipo-opt {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 2px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  background: var(--surface-2);
  transition: all var(--transition);
  user-select: none;
}
.tipo-opt.active {
  border-color: var(--accent);
  background: var(--accent-light);
}
.tipo-opt strong { display: block; font-size: 13px; color: var(--text); }
.tipo-opt small { display: block; font-size: 11px; color: var(--text-light); margin-top: 2px; }
.tipo-icon { font-size: 20px; flex-shrink: 0; }
.mb-3 { margin-bottom: 16px; }

/* Badges tabla */
.badge-ingredient { background: #ede9fe; color: #6d28d9; }
.badge-sale { background: #d1fae5; color: #065f46; }

/* Hint campo unidad */
.form-hint { font-size: 10.5px; color: var(--text-light); font-weight: 400; margin-left: 4px; }
</style>
