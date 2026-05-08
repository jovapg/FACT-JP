<template>
  <div class="order-cart">
    <!-- Header -->
    <div class="cart-header">
      <div class="cart-title">
        <span class="mesa-badge">Mesa {{ table.number }}</span>
        <span :class="['status-dot', table.status]"></span>
      </div>
      <button class="btn-close-cart" @click="$emit('close')">✕</button>
    </div>

    <!-- Categories & Products -->
    <div class="products-section">
      <div class="search-bar">
        <input v-model="search" class="form-control" placeholder="🔍 Buscar producto..." />
      </div>
      <div class="cat-tabs">
        <button
          v-for="cat in allCategories"
          :key="cat"
          :class="['cat-btn', { active: selectedCat === cat }]"
          @click="selectedCat = cat"
        >
          {{ cat === 'todas' ? '🍽️ Todas' : cat }}
        </button>
      </div>

      <div class="products-grid">
        <button
          v-for="recipe in filteredRecipes"
          :key="recipe.id"
          :class="['product-btn', { 'in-cart': isInCart(recipe) }]"
          @click="addToCart(recipe)"
          :disabled="!recipe.available"
        >
          <span class="product-name">{{ recipe.name }}</span>
          <span class="product-price">{{ formatCOP(recipe.price) }}</span>
          <span v-if="isInCart(recipe)" class="in-cart-badge">{{ getQty(recipe) }}</span>
        </button>
      </div>
    </div>

    <!-- Cart Items -->
    <div class="cart-items-section">
      <div class="cart-items-header">
        <h4>Orden actual</h4>
        <span class="items-count">{{ cartItems.length }} items</span>
      </div>

      <div class="cart-items" v-if="cartItems.length > 0">
        <div class="cart-item" v-for="item in cartItems" :key="item.recipeId">
          <div class="item-info">
            <span class="item-name">{{ item.name }}</span>
            <span class="item-unit-price">{{ formatCOP(item.price) }} c/u</span>
          </div>
          <div class="item-controls">
            <button class="qty-btn" @click="decreaseQty(item)">−</button>
            <span class="qty-value">{{ item.qty }}</span>
            <button class="qty-btn" @click="increaseQty(item)">+</button>
            <span class="item-total">{{ formatCOP(item.qty * item.price) }}</span>
            <button class="remove-btn" @click="removeFromCart(item)">×</button>
          </div>
        </div>
      </div>

      <div class="cart-empty" v-else>
        <span>Sin items en la orden</span>
      </div>

      <div class="cart-total" v-if="cartItems.length > 0">
        <span>Subtotal</span>
        <span class="total-amount">{{ formatCOP(cartTotal) }}</span>
      </div>
    </div>

    <!-- Client name -->
    <div class="client-field">
      <input v-model="clientName" class="form-control" placeholder="👤 Nombre del cliente (opcional)" />
    </div>

    <!-- Actions -->
    <div class="cart-actions">
      <button
        class="btn btn-outline btn-sm"
        @click="saveOrder"
        :disabled="saving || cartItems.length === 0"
      >
        💾 Guardar orden
      </button>
      <button
        class="btn btn-danger btn-sm"
        @click="clearOrder"
        v-if="table.status === 'ocupada'"
      >
        🗑️ Limpiar mesa
      </button>
      <button
        class="btn btn-primary"
        @click="showInvoice = true"
        :disabled="cartItems.length === 0"
        style="flex:1"
      >
        🧾 Previsualizar factura
      </button>
    </div>

    <!-- Invoice Preview -->
    <InvoicePreview
      v-if="showInvoice"
      :table="table"
      :items="cartItems"
      :initialClient="clientName"
      @close="showInvoice = false"
      @confirmed="handleSaleConfirmed"
    />
  </div>
</template>

<script setup>
/**
 * OrderCart.vue — Panel lateral de gestión de pedidos
 *
 * Se muestra como panel deslizante al seleccionar una mesa en TablesView.
 * Permite:
 *   - Buscar productos por nombre (campo de búsqueda agregado recientemente)
 *   - Seleccionar ítems del menú (recetas disponibles) organizados por categoría
 *   - Ajustar cantidades (+/-) o eliminar ítems del pedido
 *   - Ingresar el nombre del cliente
 *   - Guardar el pedido en la mesa (sin facturar)
 *   - Abrir InvoicePreview para confirmar y generar la factura
 *
 * Props:
 *   table: Object — Mesa actualmente seleccionada (con su pedido en curso,
 *                   incluyendo table.order.items y table.order.client)
 *
 * Emits:
 *   close          — cuando el usuario cierra el panel
 *   saved          — cuando se guarda el pedido sin facturar
 *   sale-confirmed — cuando se confirma y genera la factura
 *
 * Flujo:
 *   Pedido en mesa → guardar → InvoicePreview → confirmar → factura creada → mesa liberada
 */
import { ref, reactive, computed, watch, onMounted, inject } from 'vue'
import { useInventoryStore } from '../stores/inventory.js'
import { useTablesStore } from '../stores/tables.js'
import InvoicePreview from './InvoicePreview.vue'

const props = defineProps({
  table: { type: Object, required: true }
})

const emit = defineEmits(['close', 'saved', 'sale-confirmed'])
const inventoryStore = useInventoryStore()
const tablesStore = useTablesStore()
const toast = inject('toast')

const cartItems = ref([])
const selectedCat = ref('todas')
const search = ref('')       // Texto del campo de búsqueda para filtrar productos
const showInvoice = ref(false)
const saving = ref(false)
const clientName = ref('')

/**
 * Al montar el componente, restaura los ítems y el nombre del cliente
 * si la mesa ya tiene una orden guardada previamente.
 */
onMounted(() => {
  if (props.table.order?.items) {
    cartItems.value = props.table.order.items.map(i => ({ ...i }))
    clientName.value = props.table.order.client || ''
  }
})

/**
 * Observa cambios en la mesa seleccionada para refrescar el carrito.
 * Necesario cuando el usuario cambia de mesa sin cerrar el panel.
 * Si la mesa queda libre (ej. tras confirmar venta), limpia el estado local.
 */
watch(() => props.table, (newTable) => {
  if (newTable.order?.items) {
    cartItems.value = newTable.order.items.map(i => ({ ...i }))
    clientName.value = newTable.order.client || ''
  } else if (newTable.status === 'libre') {
    cartItems.value = []
    clientName.value = ''
  }
}, { deep: true })

/**
 * Lista de categorías disponibles derivada de las recetas del inventario.
 * La opción 'todas' siempre aparece primero.
 */
const allCategories = computed(() => {
  const cats = [...new Set(inventoryStore.recipes.map(r => r.category).filter(Boolean))]
  return ['todas', ...cats]
})

/**
 * Lista de recetas visible en el grid de productos, aplicando:
 *   1. Solo recetas disponibles (r.available === true)
 *   2. Filtro por categoría seleccionada
 *   3. Filtro de búsqueda por nombre (insensible a mayúsculas)
 */
const filteredRecipes = computed(() => {
  let list = inventoryStore.recipes.filter(r => r.available)
  if (selectedCat.value !== 'todas') list = list.filter(r => r.category === selectedCat.value)
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    list = list.filter(r => r.name.toLowerCase().includes(q))
  }
  return list
})

/** Suma total de todos los ítems en el carrito (qty × precio) */
const cartTotal = computed(() =>
  cartItems.value.reduce((sum, item) => sum + item.qty * item.price, 0)
)

/** Formatea un número como moneda colombiana (ej: $12.500) */
function formatCOP(v) {
  return '$' + Number(v || 0).toLocaleString('es-CO')
}

/** Retorna true si la receta ya está en el carrito */
function isInCart(recipe) {
  return cartItems.value.some(i => i.recipeId === recipe.id)
}

/** Retorna la cantidad actual de una receta en el carrito, o 0 si no está */
function getQty(recipe) {
  return cartItems.value.find(i => i.recipeId === recipe.id)?.qty || 0
}

/**
 * Agrega una receta al carrito o incrementa su cantidad si ya existe.
 * El ítem se almacena con recipeId para identificación y precio snapshot
 * al momento de agregar (no cambia si el precio del menú se modifica después).
 */
function addToCart(recipe) {
  const existing = cartItems.value.find(i => i.recipeId === recipe.id)
  if (existing) {
    existing.qty++
  } else {
    cartItems.value.push({
      recipeId: recipe.id,
      name: recipe.name,
      price: recipe.price,
      qty: 1
    })
  }
}

function increaseQty(item) { item.qty++ }

/**
 * Reduce la cantidad del ítem en 1.
 * Si llega a 0 lo elimina del carrito en lugar de dejar qty = 0.
 */
function decreaseQty(item) {
  if (item.qty > 1) item.qty--
  else removeFromCart(item)
}

/** Elimina completamente un ítem del carrito por su recipeId */
function removeFromCart(item) {
  cartItems.value = cartItems.value.filter(i => i.recipeId !== item.recipeId)
}

/**
 * Guarda el pedido actual en la mesa sin generar factura.
 * Permite retomar el pedido más tarde desde la misma mesa.
 * Efecto secundario: actualiza el estado de la mesa en tablesStore.
 */
async function saveOrder() {
  saving.value = true
  try {
    await tablesStore.updateOrder(props.table.id, cartItems.value, clientName.value)
    emit('saved')
    toast('Orden guardada', 'success')
  } catch {
    toast('Error al guardar', 'error')
  } finally {
    saving.value = false
  }
}

/**
 * Limpia la orden de la mesa y la marca como libre.
 * Requiere confirmación del usuario. No genera factura.
 * Efecto secundario: emite 'close' para cerrar el panel.
 */
async function clearOrder() {
  if (!confirm('¿Limpiar la orden de esta mesa?')) return
  cartItems.value = []
  await tablesStore.clearTable(props.table.id)
  emit('close')
  toast('Mesa liberada', 'success')
}

/**
 * Callback ejecutado cuando InvoicePreview confirma la venta.
 * La factura ya fue generada en ese momento; aquí solo limpiamos
 * el estado local del carrito y notificamos al padre.
 */
async function handleSaleConfirmed() {
  showInvoice.value = false
  cartItems.value = []
  emit('sale-confirmed')
}
</script>

<style scoped>
.order-cart {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
}

.cart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--primary);
  color: white;
  flex-shrink: 0;
}

.cart-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 700;
}

.mesa-badge {
  font-size: 20px;
  font-weight: 800;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.status-dot.libre { background: #27ae60; }
.status-dot.ocupada { background: #f39c12; }

.btn-close-cart {
  background: rgba(255,255,255,0.2);
  border: none;
  color: white;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-close-cart:hover { background: rgba(255,255,255,0.3); }

/* Products section */
.products-section {
  flex-shrink: 0;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}

.search-bar { padding: 8px 12px; border-bottom: 1px solid var(--border); }
.search-bar .form-control { font-size: 13px; min-height: 36px; }

.cat-tabs {
  display: flex;
  gap: 6px;
  padding: 10px 12px;
  overflow-x: auto;
  border-bottom: 1px solid var(--border);
}
.cat-btn {
  padding: 5px 14px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: white;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  text-transform: capitalize;
  transition: all 0.15s;
  /* Elimina el retraso de 300ms en pantallas táctiles */
  touch-action: manipulation;
  /* Objetivo táctil mínimo recomendado */
  min-height: 36px;
}
.cat-btn.active { background: var(--accent); color: white; border-color: var(--accent); }

.products-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 10px 12px;
  /* Altura dinámica: mínimo 180px, ideal 35% del viewport, máximo 280px */
  max-height: clamp(180px, 35vh, 280px);
  overflow-y: auto;
}

.product-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 10px 12px;
  background: white;
  border: 2px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
  position: relative;
  /* Objetivo táctil mínimo de 60px garantiza facilidad de toque */
  min-height: 60px;
  /* Elimina el retraso de 300ms en pantallas táctiles */
  touch-action: manipulation;
}
.product-btn:hover { border-color: var(--accent); background: #fff5f7; }
.product-btn:active { transform: scale(0.97); }
.product-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.product-btn.in-cart { border-color: var(--success); background: #f0fff4; }

.product-name { font-size: 13px; font-weight: 600; line-height: 1.2; }
.product-price { font-size: 13px; font-weight: 800; color: var(--success); margin-top: 4px; }
.in-cart-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background: var(--accent);
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}

/* Cart items */
.cart-items-section {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.cart-items-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.cart-items-header h4 { font-size: 14px; font-weight: 700; }
.items-count { font-size: 12px; color: var(--text-light); }

.cart-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background: var(--bg);
  border-radius: 8px;
  margin-bottom: 6px;
}
.item-info { display: flex; justify-content: space-between; align-items: center; }
.item-name { font-size: 13px; font-weight: 600; }
.item-unit-price { font-size: 11px; color: var(--text-light); }
.item-controls { display: flex; align-items: center; gap: 8px; }
.qty-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: var(--primary);
  color: white;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
  /* Elimina el retraso de 300ms en pantallas táctiles */
  touch-action: manipulation;
}
.qty-btn:hover { background: var(--accent); }
.qty-value { font-size: 15px; font-weight: 700; min-width: 20px; text-align: center; }
.item-total { font-weight: 700; color: var(--success); font-size: 13px; margin-left: auto; }
.remove-btn {
  background: none;
  border: none;
  color: var(--danger);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 2px;
}

.cart-empty {
  text-align: center;
  color: var(--text-light);
  font-size: 13px;
  padding: 24px;
}

.cart-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-top: 2px solid var(--border);
  margin-top: 8px;
  font-size: 15px;
  font-weight: 700;
}
.total-amount { font-size: 20px; color: var(--success); }

.client-field {
  padding: 8px 12px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
.client-field .form-control { font-size: 13px; min-height: 38px; }

/* Actions */
.cart-actions {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  flex-wrap: wrap;
}

/* ── Ajustes responsivos para tabletas y celulares ── */
@media (max-width: 768px) {
  /* Botones de cantidad más grandes para facilitar el toque */
  .qty-btn {
    width: 40px;
    height: 40px;
    font-size: 18px;
  }

  /* Botón de cerrar el panel más grande (objetivo táctil 44px) */
  .btn-close-cart {
    width: 44px;
    height: 44px;
    font-size: 18px;
  }

  /* Pestañas de categorías con mayor altura para facilitar el toque */
  .cat-btn { min-height: 40px; padding: 8px 16px; font-size: 13px; }

  /* Acciones del carrito en columna si no caben en una fila */
  .cart-actions { gap: 6px; }
  .cart-actions .btn-sm { min-height: 40px; }
}

@media (max-width: 480px) {
  .products-grid { grid-template-columns: 1fr 1fr; }

  /* En celulares: área de productos un poco más alta */
  .products-grid { max-height: clamp(200px, 40vh, 320px); }

  /* Botones de cantidad ocupan más espacio táctil */
  .qty-btn { width: 44px; height: 44px; }

  /* Las acciones se apilan: Guardar y Limpiar juntos, Factura abajo */
  .cart-actions {
    flex-wrap: wrap;
  }
  .cart-actions .btn-outline,
  .cart-actions .btn-danger { flex: 1; min-width: 0; justify-content: center; }
}
</style>
