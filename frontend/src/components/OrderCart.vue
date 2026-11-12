<template>
  <div class="order-cart">
    <!-- Header -->
    <div class="cart-header">
      <div class="cart-title">
        <span class="mesa-badge">{{ headerTitle }}</span>
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
          :class="['product-btn', { 'in-cart': isInCart(recipe), 'out-of-stock': recipe.outOfStock }]"
          @click="addToCart(recipe)"
          :disabled="!recipe.available || recipe.outOfStock"
        >
          <span class="product-name">{{ recipe.name }}</span>
          <span class="product-price">{{ formatCOP(recipe.price) }}</span>
          <span v-if="recipe.outOfStock" class="stock-badge">Agotado</span>
          <span v-else-if="isInCart(recipe)" class="in-cart-badge">{{ getQty(recipe) }}</span>
        </button>
      </div>
    </div>

    <!-- Cart Items -->
    <div class="cart-items-section">
      <div class="cart-items-header">
        <h4>Orden actual</h4>
        <span class="items-count">{{ productItems.length }} items</span>
      </div>

      <div class="cart-items" v-if="productItems.length > 0">
        <div class="cart-item" v-for="item in productItems" :key="item._itemId">
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

    </div>

    <!-- Pie fijo: subtotal siempre visible, cliente, domicilio y acciones -->
    <div class="cart-footer">
    <div class="cart-total" v-if="productItems.length > 0">
      <template v-if="domiItem">
        <div class="tot-line"><span>Subtotal</span><span>{{ formatCOP(productsTotal) }}</span></div>
        <div class="tot-line"><span>🛵 Domicilio</span><span>{{ formatCOP(domiFee) }}</span></div>
        <div class="tot-main"><span>Total a cobrar</span><span class="total-amount">{{ formatCOP(cartTotal) }}</span></div>
      </template>
      <div v-else class="tot-main"><span>Subtotal</span><span class="total-amount">{{ formatCOP(cartTotal) }}</span></div>
    </div>

    <!-- Cliente y domicilio -->
    <div class="client-field">
      <input v-model="clientName" class="form-control" placeholder="👤 Nombre del cliente (opcional)" />
      <label :class="['domi-switch', { on: !!domiItem }]" title="Pedido para llevar a domicilio (no vino por la carta en línea)">
        <input type="checkbox" :checked="!!domiItem" @change="toggleDomicilio($event.target.checked)" />
        <span class="domi-track"></span><span>🛵 Domicilio</span>
      </label>
    </div>
    <div v-if="domiItem" class="domi-row">
      <span>Valor del domicilio</span>
      <div class="domi-input"><span>$</span>
        <input inputmode="numeric" class="form-control" placeholder="0" :value="domiFee ? domiFee.toLocaleString('es-CO') : ''" @input="setDomiFee($event)" />
      </div>
      <small>Si es gratis, déjalo en 0.</small>
    </div>

    <!-- Actions -->
    <div class="cart-actions">
      <button
        v-if="!table._direct"
        class="btn btn-outline btn-sm"
        @click="saveOrder"
        :disabled="saving || (productItems.length === 0 && !(table._orderId && clientName))"
      >
        💾 Guardar orden
      </button>
      <button
        class="btn btn-danger btn-sm"
        @click="clearOrder"
        v-if="table.status === 'ocupada' && !table._direct"
      >
        {{ table._orderId ? '🗑️ Eliminar venta' : '🗑️ Limpiar ' + spaces.label.toLowerCase() }}
      </button>
      <button
        class="btn btn-primary"
        @click="showInvoice = true"
        :disabled="productItems.length === 0"
        style="flex:1"
      >
        🧾 Previsualizar factura
      </button>
    </div>
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
import { useSpaces } from '../composables/useSpaces.js'

const props = defineProps({
  table: { type: Object, required: true },
  startInvoice: { type: Boolean, default: false } // abrir directo la factura (botón Facturar)
})

const spaces = useSpaces()

/** Título del panel: "Campo Alfa · Venta 2", "Mesa 3" o "Venta directa" */
const headerTitle = computed(() => {
  if (props.table._direct) return 'Venta directa'
  return spaces.nameOf(props.table) + (props.table._orderName ? ' · ' + props.table._orderName : '')
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
// Normaliza un item del carrito añadiendo _itemId para compatibilidad
function normalizeCartItem(i) {
  return { ...i, _itemId: i._itemId || i.recipeId || i.inventoryId }
}

onMounted(() => {
  if (props.table.order?.items) {
    cartItems.value = props.table.order.items.map(normalizeCartItem)
    clientName.value = props.table.order.client || ''
  }
  if (props.startInvoice && cartItems.value.length > 0) showInvoice.value = true
})

/**
 * Observa cambios en la mesa seleccionada para refrescar el carrito.
 * Necesario cuando el usuario cambia de mesa sin cerrar el panel.
 * Si la mesa queda libre (ej. tras confirmar venta), limpia el estado local.
 */
watch(() => props.table, (newTable) => {
  if (newTable.order?.items) {
    cartItems.value = newTable.order.items.map(normalizeCartItem)
    clientName.value = newTable.order.client || ''
  } else if (newTable.status === 'libre') {
    cartItems.value = []
    clientName.value = ''
  }
}, { deep: true })

/**
 * Lista de categorías disponibles incluyendo tanto recetas como items de
 * inventario con precio de venta configurado.
 */
const allCategories = computed(() => {
  const recipeCats = inventoryStore.recipes.map(r => r.category)
  const invCats = inventoryStore.items.filter(i => (i.salePrice || 0) > 0).map(i => i.category)
  const cats = [...new Set([...recipeCats, ...invCats].filter(Boolean))]
  return ['todas', ...cats]
})

/**
 * Fusiona recetas y items de inventario con salePrice > 0 en una sola lista.
 * Reglas:
 *   - Si un item de inventario tiene el mismo nombre que una receta,
 *     la receta se muestra pero usa el salePrice del inventario (precio autoritativo).
 *   - Si un item de inventario no tiene receta correspondiente,
 *     se agrega directamente con su salePrice.
 * Esto garantiza que nunca se muestre el precio de costo en el POS.
 */
const sellableItems = computed(() => {
  // Mapa de items de inventario con salePrice, indexados por nombre normalizado
  const invByName = new Map()
  for (const i of inventoryStore.items) {
    if ((i.salePrice || 0) > 0) {
      invByName.set(i.name.toLowerCase().trim(), i)
    }
  }
  // Mapa por id para verificar stock de ingredientes de recetas
  const invById = new Map(inventoryStore.items.map(i => [i.id, i]))

  // Recetas disponibles, precio overrideado si hay match en inventario
  const result = inventoryStore.recipes
    .filter(r => r.available)
    .map(r => {
      const inv = invByName.get(r.name.toLowerCase().trim())
      let outOfStock = false
      if (inv) outOfStock = !inv.noStock && (inv.stock || 0) <= 0
      else if (r.ingredients?.length) {
        outOfStock = r.ingredients.some(ing => {
          const ii = invById.get(ing.inventoryId)
          return ii && !ii.noStock && (ii.stock || 0) <= 0
        })
      }
      return { ...r, _itemId: r.id, price: inv ? inv.salePrice : r.price, area: r.area || 'bar', outOfStock }
    })

  // Items de inventario sin receta correspondiente
  const usedNames = new Set(result.map(r => r.name.toLowerCase().trim()))
  for (const i of inventoryStore.items) {
    if ((i.salePrice || 0) > 0 && !usedNames.has(i.name.toLowerCase().trim())) {
      result.push({
        id: i.id, _itemId: i.id, _invOnly: true,
        name: i.name, price: i.salePrice, category: i.category, available: true,
        area: i.area || 'bar', outOfStock: !i.noStock && (i.stock || 0) <= 0
      })
    }
  }

  return result
})

const filteredRecipes = computed(() => {
  let list = sellableItems.value
  if (selectedCat.value !== 'todas') list = list.filter(r => r.category === selectedCat.value)
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    list = list.filter(r => r.name.toLowerCase().includes(q))
  }
  return list
})

/** Suma total de todos los ítems en el carrito (qty × precio) */
// El domicilio es una línea más de la orden (kind 'domicilio'), igual que en los pedidos de la carta en línea:
// viaja por guardar orden, factura, turno, Finanzas y bolsillo Domicilios sin formato nuevo.
const domiItem = computed(() => cartItems.value.find(i => i.kind === 'domicilio'))
const productItems = computed(() => cartItems.value.filter(i => i.kind !== 'domicilio'))
const domiFee = computed(() => Number(domiItem.value?.price) || 0)
const productsTotal = computed(() => productItems.value.reduce((sum, i) => sum + i.qty * i.price, 0))
function toggleDomicilio(on) {
  if (on && !domiItem.value) {
    cartItems.value.push({ _itemId: '__domicilio', recipeId: '__domicilio', name: 'Domicilio', price: 0, qty: 1, discount: 0, area: 'bar', kind: 'domicilio' })
  } else if (!on) {
    cartItems.value = cartItems.value.filter(i => i.kind !== 'domicilio')
  }
}
function setDomiFee(e) {
  const digits = String(e.target.value).replace(/[^0-9]/g, '').slice(0, 9)
  if (domiItem.value) domiItem.value.price = Number(digits) || 0
  e.target.value = digits ? Number(digits).toLocaleString('es-CO') : ''
}
const cartTotal = computed(() =>
  cartItems.value.reduce((sum, item) => sum + item.qty * item.price, 0)
)

/** Formatea un número como moneda colombiana (ej: $12.500) */
function formatCOP(v) {
  return '$' + Number(v || 0).toLocaleString('es-CO')
}

/** Retorna true si el item ya está en el carrito */
function isInCart(item) {
  return cartItems.value.some(i => i._itemId === item._itemId)
}

/** Retorna la cantidad actual de un item en el carrito, o 0 si no está */
function getQty(item) {
  return cartItems.value.find(i => i._itemId === item._itemId)?.qty || 0
}

/**
 * Agrega un item al carrito o incrementa su cantidad si ya existe.
 * Para recetas: guarda recipeId (para descuento de ingredientes en inventario).
 * Para items de inventario directo: guarda inventoryId (para descuento de stock).
 */
function addToCart(item) {
  if (item.outOfStock) {
    toast('Producto agotado, stock en ceros', 'error')
    return
  }
  const existing = cartItems.value.find(i => i._itemId === item._itemId)
  if (existing) {
    existing.qty++
  } else {
    cartItems.value.push({
      _itemId: item._itemId,
      recipeId: item._invOnly ? undefined : item.id,
      inventoryId: item._invOnly ? item.id : undefined,
      name: item.name,
      price: item.price,
      area: item.area || 'bar',   // Bolsillo (Bar / Restaurante) — viaja hasta la venta
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

/** Elimina completamente un ítem del carrito por su _itemId */
function removeFromCart(item) {
  cartItems.value = cartItems.value.filter(i => i._itemId !== item._itemId)
}

/**
 * Guarda el pedido actual en la mesa sin generar factura.
 * Permite retomar el pedido más tarde desde la misma mesa.
 * Efecto secundario: actualiza el estado de la mesa en tablesStore.
 */
async function saveOrder() {
  saving.value = true
  try {
    await tablesStore.updateOrder(props.table.id, cartItems.value, clientName.value, undefined, props.table._orderId)
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
  const esVenta = !!props.table._orderId
  if (!confirm(esVenta ? '¿Eliminar esta venta guardada?' : `¿Limpiar la orden de este ${spaces.label.toLowerCase()}?`)) return
  cartItems.value = []
  await tablesStore.clearTable(props.table.id, props.table._orderId)
  emit('close')
  toast(esVenta ? 'Venta eliminada' : `${spaces.label} liberado`, 'success')
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
  min-height: 0;
  background: var(--surface);
  color: var(--text);
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
  flex: 1 1 0;           /* se encoge para que el pie (subtotal, cliente, botones) siempre quepa */
  min-height: 150px;
  display: flex;
  flex-direction: column;
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
  background: var(--surface);
  color: var(--text);
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
  flex: 1;
  min-height: 0;
  overflow-y: auto;      /* la lista de productos es lo que se desplaza */
  align-content: start;
}

.product-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 10px 12px;
  background: var(--surface);
  color: var(--text);
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
.product-btn:hover { border-color: var(--accent); background: var(--surface-2); }
.product-btn:active { transform: scale(0.97); }
.product-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.product-btn.in-cart { border-color: var(--success); background: var(--surface-2); color: var(--text); }
.product-btn.out-of-stock { opacity: 0.6; background: var(--surface-2); border-color: var(--danger); }
.product-btn.out-of-stock .product-name { text-decoration: line-through; color: var(--text-light); }
.stock-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background: var(--danger);
  color: white;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

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
  flex: 0 1 auto;
  max-height: 30%;       /* la orden se desplaza dentro de este espacio, sin empujar el pie */
  min-height: 64px;
  overflow-y: auto;
  padding: 10px 12px;
}
.cart-footer { flex-shrink: 0; background: var(--surface); box-shadow: 0 -6px 12px rgba(0,0,0,.06); }

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
  padding: 8px 12px 4px;
  border-top: 2px solid var(--border);
  font-size: 15px;
  font-weight: 700;
}
.tot-line { display: flex; justify-content: space-between; font-size: 13px; font-weight: 500; color: var(--text-muted); padding: 1px 0; }
.tot-main { display: flex; justify-content: space-between; align-items: center; }
.total-amount { font-size: 20px; color: var(--success); }

.client-field {
  padding: 6px 12px 8px;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}
.client-field .form-control { font-size: 13px; min-height: 38px; flex: 1; min-width: 0; }
.domi-switch { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; white-space: nowrap; cursor: pointer; border: 1px solid var(--border); border-radius: 8px; padding: 0 10px; min-height: 38px; user-select: none; }
.domi-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.domi-track { width: 28px; height: 16px; border-radius: 99px; background: var(--border); position: relative; flex: none; transition: background .15s; }
.domi-track::after { content: ''; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; transition: left .15s; }
.domi-switch.on { border-color: var(--success); }
.domi-switch.on .domi-track { background: var(--success); }
.domi-switch.on .domi-track::after { left: 14px; }
.domi-switch input:focus-visible + .domi-track { outline: 2px solid var(--accent); outline-offset: 2px; }
.domi-row { display: flex; align-items: center; gap: 8px; margin: 0 12px 8px; padding: 6px 10px; border: 1px solid var(--success); border-radius: 8px; background: rgba(22,163,74,.08); font-size: 12px; font-weight: 600; flex-wrap: wrap; }
.domi-row small { flex-basis: 100%; font-weight: 400; color: var(--text-muted); margin-top: -2px; }
.domi-input { display: flex; align-items: center; gap: 4px; margin-left: auto; }
.domi-input .form-control { width: 110px; text-align: right; min-height: 34px; font-size: 14px; font-weight: 700; }

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
  .client-field { flex-wrap: wrap; }
  .domi-switch { flex: 1; justify-content: center; }

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
