<template>
  <PageLayout title="Recetas / Menú">
        <div class="page-header">
          <div>
            <h1 class="page-title">Recetas / Menú</h1>
            <p class="page-subtitle">{{ inventoryStore.recipes.length }} productos en el menú</p>
          </div>
          <button class="btn btn-primary" @click="openCreate">+ Nueva receta</button>
        </div>

        <!-- Barra de búsqueda y filtros -->
        <div class="search-bar card mb-3">
          <!-- Búsqueda por texto: filtra por nombre en tiempo real -->
          <div class="search-input-wrap">
            <Search :size="15" class="search-icon" />
            <input
              v-model="search"
              class="form-control search-input"
              placeholder="Buscar receta..."
              @input="activeLetter = ''"
            />
            <!-- Botón para limpiar la búsqueda con un solo clic -->
            <button v-if="search" class="search-clear" @click="search = ''" title="Limpiar">×</button>
          </div>

          <!-- Filtro de disponibilidad -->
          <div class="avail-toggle">
            <button
              :class="['pill-sm', { active: availFilter === 'todas' }]"
              @click="availFilter = 'todas'"
            >Todas</button>
            <button
              :class="['pill-sm', { active: availFilter === 'disponible' }]"
              @click="availFilter = 'disponible'"
            >🟢 Disponibles</button>
            <button
              :class="['pill-sm', { active: availFilter === 'no_disponible' }]"
              @click="availFilter = 'no_disponible'"
            >🔴 No disp.</button>
          </div>
        </div>

        <!-- Tabs de categoría -->
        <div class="cat-tabs mb-2">
          <button
            v-for="cat in ['todas', ...inventoryStore.recipeCategories]"
            :key="cat"
            :class="['cat-tab', { active: activeCat === cat }]"
            @click="activeCat = cat; activeLetter = ''"
          >
            {{ cat }}
          </button>
        </div>

        <!-- Filtro por letra inicial: aparece solo si hay recetas que mostrar -->
        <div class="letter-bar mb-3" v-if="availableLetters.length > 1">
          <button
            :class="['letter-btn', { active: activeLetter === '' }]"
            @click="activeLetter = ''"
          >Todas</button>
          <button
            v-for="letter in availableLetters"
            :key="letter"
            :class="['letter-btn', { active: activeLetter === letter }]"
            @click="activeLetter = letter; search = ''"
          >{{ letter }}</button>
        </div>

        <!-- Contador de resultados -->
        <p class="results-count mb-3" v-if="search || activeLetter">
          {{ filteredRecipes.length }} resultado{{ filteredRecipes.length !== 1 ? 's' : '' }}
          <span v-if="search"> para "<strong>{{ search }}</strong>"</span>
          <span v-if="activeLetter"> · letra <strong>{{ activeLetter }}</strong></span>
          <button class="link-btn" @click="search = ''; activeLetter = ''">Limpiar filtros</button>
        </p>

        <div class="recipes-grid">
          <div
            v-for="recipe in filteredRecipes"
            :key="recipe.id"
            :class="['recipe-card', { unavailable: !recipe.available }]"
          >
            <div class="recipe-header">
              <div>
                <h4 class="recipe-name">{{ recipe.name }}</h4>
                <span class="badge badge-default">{{ recipe.category }}</span>
              </div>
              <div class="recipe-price">{{ formatCOP(recipe.price) }}</div>
            </div>
            <div class="recipe-ingredients" v-if="recipe.ingredients?.length > 0">
              <p class="ingredients-label">Ingredientes ({{ recipe.ingredients.length }}):</p>
              <div class="ingredient-list">
                <span
                  v-for="ing in recipe.ingredients"
                  :key="ing.inventoryId"
                  class="ingredient-chip"
                >
                  {{ getIngredientName(ing.inventoryId) }} × {{ ing.quantity }} {{ ing.unit }}
                </span>
              </div>
            </div>
            <div class="recipe-footer">
              <span :class="['badge', recipe.available ? 'badge-success' : 'badge-danger']">
                {{ recipe.available ? 'Disponible' : 'No disponible' }}
              </span>
              <div class="recipe-actions">
                <button class="btn btn-sm btn-outline" @click="toggleAvailable(recipe)">
                  {{ recipe.available ? '🔴 Desactivar' : '🟢 Activar' }}
                </button>
                <button class="btn btn-sm btn-outline" @click="openEdit(recipe)">✏️</button>
                <button class="btn btn-sm btn-danger" @click="confirmDelete(recipe)">🗑️</button>
              </div>
            </div>
          </div>

          <div v-if="filteredRecipes.length === 0" class="empty-state">
            <div class="empty-state-icon">🍽️</div>
            <p class="empty-state-text">No hay recetas en esta categoría</p>
          </div>
        </div>

        <!-- Modal de confirmación para eliminar receta -->
        <ConfirmModal
          :visible="!!deleteTarget"
          :title="`Eliminar receta`"
          :message="`¿Eliminar &quot;${deleteTarget?.name}&quot;? Esta acción no se puede deshacer.`"
          confirmText="Sí, eliminar"
          type="danger"
          @confirm="doDelete"
          @cancel="deleteTarget = null"
        />

        <!-- Modal crear/editar -->
        <div class="modal-overlay" v-if="showModal" @click.self="closeModal">
          <div class="modal" style="max-width:700px">
            <div class="modal-header">
              <h3 class="modal-title">{{ editRecipe ? 'Editar receta' : 'Nueva receta' }}</h3>
              <button class="btn-close" @click="closeModal">×</button>
            </div>
            <div class="modal-body">
              <div class="grid grid-2">
                <div class="form-group">
                  <label class="form-label">Nombre *</label>
                  <input v-model="form.name" class="form-control" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Categoría</label>
                  <input v-model="form.category" class="form-control" list="recipe-cats" />
                  <datalist id="recipe-cats">
                    <option value="platos" /><option value="bebidas" /><option value="postres" />
                    <option value="entradas" /><option value="licores" />
                  </datalist>
                </div>
                <div class="form-group">
                  <label class="form-label">Precio de venta (COP)</label>
                  <input v-model.number="form.price" type="number" class="form-control" min="0" />
                </div>
                <div class="form-group" style="display:flex;align-items:center;gap:10px;padding-top:24px;">
                  <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                    <input type="checkbox" v-model="form.available" />
                    Disponible en menú
                  </label>
                </div>
              </div>

              <!-- Ingredients -->
              <div class="ingredients-section">
                <div class="ingredients-header">
                  <h4>Ingredientes / Insumos</h4>
                  <button class="btn btn-sm btn-outline" @click="addIngredient">+ Agregar</button>
                </div>
                <div v-for="(ing, idx) in form.ingredients" :key="idx" class="ingredient-row">
                  <select v-model="ing.inventoryId" class="form-control">
                    <option value="">Seleccionar producto</option>
                    <option v-for="item in inventoryStore.items" :key="item.id" :value="item.id">
                      {{ item.name }} ({{ item.stock }} {{ item.unit }})
                    </option>
                  </select>
                  <input v-model.number="ing.quantity" type="number" class="form-control" placeholder="Cantidad" min="0" step="0.1" style="max-width:100px" />
                  <input v-model="ing.unit" class="form-control" placeholder="Unidad" style="max-width:100px" />
                  <button class="btn btn-sm btn-danger" @click="removeIngredient(idx)">×</button>
                </div>
                <p v-if="form.ingredients.length === 0" class="text-muted">
                  Sin ingredientes (no se deducirá inventario)
                </p>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="closeModal">Cancelar</button>
              <button class="btn btn-primary" @click="saveRecipe" :disabled="saving">
                {{ saving ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </div>
        </div>
  </PageLayout>
</template>

<script setup>
/**
 * RecipesView.vue — Gestión de recetas y menú
 *
 * Administra los ítems vendibles del menú (recetas).
 * Cada receta define:
 *   - Nombre, precio de venta, categoría y disponibilidad en menú
 *   - Ingredientes: lista de insumos del inventario que se descuentan
 *     automáticamente al vender este ítem (con cantidad por unidad)
 *
 * Funcionalidades:
 *   - Filtrar por categoría y disponibilidad
 *   - Crear / editar / eliminar recetas (solo admin+)
 *   - Toggle de disponibilidad (ocultar del menú sin eliminar)
 *   - Constructor de ingredientes con selector de inventario
 *
 * Las recetas son la fuente de datos para:
 *   - El menú en OrderCart (solo recetas `available: true`)
 *   - El descuento automático de inventario al crear ventas
 */
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { useInventoryStore } from '../stores/inventory.js'
import PageLayout from '../components/PageLayout.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import { Search } from 'lucide-vue-next'

const inventoryStore = useInventoryStore()
const toast = inject('toast')

const activeCat    = ref('todas')
const search       = ref('')        // Texto de búsqueda libre por nombre
const activeLetter = ref('')        // Letra inicial seleccionada en el filtro alfabético
const availFilter  = ref('todas')   // 'todas' | 'disponible' | 'no_disponible'
const showModal    = ref(false)
const editRecipe   = ref(null)
const saving       = ref(false)
const deleteTarget = ref(null)      // Receta pendiente de eliminar (null = modal cerrado)

const form = reactive({
  name: '', category: 'platos', price: 0,
  available: true, ingredients: []
})

/**
 * Letras iniciales únicas de las recetas que pasan el filtro de categoría
 * y disponibilidad (pero no el de letra ni texto, para mostrar siempre la barra completa).
 * Ordenadas alfabéticamente para mostrarlas como índice.
 */
const availableLetters = computed(() => {
  let base = inventoryStore.recipes
  if (activeCat.value !== 'todas') base = base.filter(r => r.category === activeCat.value)
  if (availFilter.value === 'disponible')    base = base.filter(r => r.available)
  if (availFilter.value === 'no_disponible') base = base.filter(r => !r.available)
  const letters = [...new Set(base.map(r => r.name.charAt(0).toUpperCase()))].sort()
  return letters
})

/**
 * Lista final de recetas aplicando todos los filtros en cascada:
 *   1. Categoría (tab superior)
 *   2. Disponibilidad (toggle)
 *   3. Letra inicial (barra alfabética)
 *   4. Texto libre (input de búsqueda) — insensible a mayúsculas y tildes
 */
const filteredRecipes = computed(() => {
  let list = inventoryStore.recipes

  // Filtro por categoría
  if (activeCat.value !== 'todas') {
    list = list.filter(r => r.category === activeCat.value)
  }

  // Filtro por disponibilidad
  if (availFilter.value === 'disponible')    list = list.filter(r => r.available)
  if (availFilter.value === 'no_disponible') list = list.filter(r => !r.available)

  // Filtro por letra inicial
  if (activeLetter.value) {
    list = list.filter(r => r.name.charAt(0).toUpperCase() === activeLetter.value)
  }

  // Filtro por texto libre (normaliza tildes para que "cafe" encuentre "café")
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    list = list.filter(r => {
      const name = r.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      return name.includes(q)
    })
  }

  return list
})

function formatCOP(v) {
  return '$' + Number(v || 0).toLocaleString('es-CO')
}

function getIngredientName(id) {
  const item = inventoryStore.items.find(i => i.id === id)
  return item?.name || 'Desconocido'
}

function openCreate() {
  editRecipe.value = null
  Object.assign(form, { name: '', category: 'platos', price: 0, available: true, ingredients: [] })
  showModal.value = true
}

function openEdit(recipe) {
  editRecipe.value = recipe
  Object.assign(form, {
    name: recipe.name,
    category: recipe.category,
    price: recipe.price,
    available: recipe.available,
    ingredients: recipe.ingredients ? recipe.ingredients.map(i => ({ ...i })) : []
  })
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editRecipe.value = null
}

function addIngredient() {
  form.ingredients.push({ inventoryId: '', quantity: 1, unit: 'unidad' })
}

function removeIngredient(idx) {
  form.ingredients.splice(idx, 1)
}

async function saveRecipe() {
  if (!form.name) return
  saving.value = true
  try {
    const data = {
      ...form,
      ingredients: form.ingredients.filter(i => i.inventoryId)
    }
    if (editRecipe.value) {
      await inventoryStore.updateRecipe(editRecipe.value.id, data)
      toast('Receta actualizada', 'success')
    } else {
      await inventoryStore.createRecipe(data)
      toast('Receta creada', 'success')
    }
    closeModal()
  } catch (err) {
    toast(err.response?.data?.error || 'Error al guardar', 'error')
  } finally {
    saving.value = false
  }
}

async function toggleAvailable(recipe) {
  await inventoryStore.updateRecipe(recipe.id, { available: !recipe.available })
  toast(`Receta ${recipe.available ? 'desactivada' : 'activada'}`, 'success')
}

/** Abre el modal de confirmación para eliminar una receta */
function confirmDelete(recipe) {
  deleteTarget.value = recipe
}

/** Ejecuta la eliminación después de que el usuario confirma en el modal */
async function doDelete() {
  try {
    await inventoryStore.deleteRecipe(deleteTarget.value.id)
    toast('Receta eliminada', 'success')
  } catch {
    toast('Error al eliminar', 'error')
  } finally {
    deleteTarget.value = null
  }
}

onMounted(async () => {
  await Promise.all([inventoryStore.fetchInventory(), inventoryStore.fetchRecipes()])
})
</script>

<style scoped>
.mb-2 { margin-bottom: 10px; }
.mb-3 { margin-bottom: 16px; }

/* ── Barra de búsqueda y filtros ──────────────────────────────── */
.search-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  flex-wrap: wrap;
}

/* Input de búsqueda con ícono a la izquierda */
.search-input-wrap {
  position: relative;
  flex: 1;
  min-width: 200px;
}
.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-light);
  pointer-events: none;
}
.search-input {
  padding-left: 32px;  /* espacio para el ícono lupa */
  padding-right: 32px; /* espacio para el botón × */
}
/* Botón × para borrar el texto de búsqueda */
.search-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-light);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 4px;
  transition: color var(--transition);
}
.search-clear:hover { color: var(--danger); }

/* Toggle de disponibilidad */
.avail-toggle { display: flex; gap: 6px; flex-wrap: wrap; }
.pill-sm {
  padding: 5px 12px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.18s;
}
.pill-sm.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

/* ── Tabs de categoría ─────────────────────────────────────────── */
.cat-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.cat-tab {
  padding: 6px 16px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 13px;
  cursor: pointer;
  text-transform: capitalize;
  transition: all 0.2s;
}
.cat-tab.active { background: var(--accent); color: white; border-color: var(--accent); }

/* ── Filtro alfabético ────────────────────────────────────────── */
.letter-bar {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  align-items: center;
  padding: 8px 0;
}
.letter-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.16s;
  color: var(--text-secondary);
}
.letter-btn:first-child { width: auto; padding: 0 10px; font-weight: 500; }
.letter-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
.letter-btn.active { background: var(--primary); color: white; border-color: var(--primary); }

/* ── Contador de resultados ───────────────────────────────────── */
.results-count {
  font-size: 13px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
/* Botón de texto para limpiar filtros sin estilo de botón */
.link-btn {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 13px;
  cursor: pointer;
  font-weight: 600;
  padding: 0;
  text-decoration: underline;
}

.recipes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.recipe-card {
  background: white;
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow);
  border: 2px solid transparent;
  transition: all 0.2s;
}
.recipe-card:hover { border-color: var(--accent); }
.recipe-card.unavailable { opacity: 0.6; }

.recipe-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}
.recipe-name { font-weight: 700; font-size: 15px; margin-bottom: 4px; }
.recipe-price { font-size: 18px; font-weight: 800; color: var(--success); }

.recipe-ingredients { margin-bottom: 12px; }
.ingredients-label { font-size: 11px; color: var(--text-light); margin-bottom: 4px; }
.ingredient-list { display: flex; flex-wrap: wrap; gap: 4px; }
.ingredient-chip {
  background: var(--bg);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  color: var(--text);
}

.recipe-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.recipe-actions { display: flex; gap: 6px; }

.ingredients-section { margin-top: 20px; }
.ingredients-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.ingredient-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.text-muted { font-size: 13px; color: var(--text-light); }
</style>
