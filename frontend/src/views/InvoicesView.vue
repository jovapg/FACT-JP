<template>
  <PageLayout title="Facturas">
        <div class="page-header">
          <div>
            <h1 class="page-title">Historial de Facturas</h1>
            <p class="page-subtitle">{{ invoices.length }} facturas registradas</p>
          </div>
        </div>

        <!-- Search -->
        <div class="card mb-3" style="padding:14px">
          <input v-model="search" class="form-control" placeholder="Buscar por número, cajero, mesa..." style="max-width:400px" />
        </div>

        <div v-if="loading" class="loading">
          <div class="spinner"></div> Cargando facturas...
        </div>

        <div class="card" v-else>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Fecha</th>
                  <th>Mesa</th>
                  <th>Cajero</th>
                  <th>Items</th>
                  <th>Método</th>
                  <th>Total</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="inv in filteredInvoices" :key="inv.id">
                  <td><code style="font-size:12px">{{ inv.invoiceNumber }}</code></td>
                  <td>{{ formatDateTime(inv.createdAt) }}</td>
                  <td>{{ inv.tableNumber ? 'Mesa ' + inv.tableNumber : '-' }}</td>
                  <td>{{ inv.cashier }}</td>
                  <td>{{ inv.items?.length || 0 }} items</td>
                  <td>
                    <span :class="['badge', paymentBadge(inv.paymentMethod)]">{{ paymentLabel(inv.paymentMethod) }}</span>
                  </td>
                  <td class="currency">{{ formatCOP(inv.total) }}</td>
                  <td>
                    <div class="action-btns">
                      <button class="btn btn-sm btn-outline" @click="viewInvoice(inv)">👁 Ver</button>
                      <button
                        v-if="canManage && inv.paymentMethod !== 'pago_fiado'"
                        class="btn btn-sm btn-outline"
                        @click="openEditInvoice(inv)"
                      >✏️ Editar</button>
                      <a
                        :href="`/api/${bizId}/invoices/${inv.id}/pdf?token=${token}`"
                        target="_blank"
                        class="btn btn-sm btn-primary"
                      >
                        PDF
                      </a>
                    </div>
                  </td>
                </tr>
                <tr v-if="filteredInvoices.length === 0">
                  <td colspan="8" style="text-align:center;color:var(--text-light);padding:32px">Sin facturas</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Invoice detail modal -->
        <div class="modal-overlay" v-if="selectedInvoice" @click.self="selectedInvoice = null">
          <div class="modal" style="max-width:500px">
            <div class="modal-header">
              <h3 class="modal-title">Factura {{ selectedInvoice.invoiceNumber }}</h3>
              <button class="btn-close" @click="selectedInvoice = null">×</button>
            </div>
            <div class="modal-body invoice-detail">
              <div class="inv-header">
                <strong>{{ business?.name }}</strong>
                <span v-if="business?.nit">NIT: {{ business.nit }}</span>
                <span v-if="business?.address">{{ business.address }}, {{ business.city }}</span>
              </div>
              <div class="inv-info">
                <div><strong>Factura #:</strong> {{ selectedInvoice.invoiceNumber }}</div>
                <div><strong>Fecha:</strong> {{ formatDate(selectedInvoice.createdAt) }}</div>
                <div><strong>Cajero:</strong> {{ selectedInvoice.cashier }}</div>
                <div v-if="selectedInvoice.tableNumber"><strong>Mesa:</strong> {{ selectedInvoice.tableNumber }}</div>
                <div v-if="selectedInvoice.editedAt" class="edited-note">✏️ Editada por {{ selectedInvoice.editedBy }} el {{ formatDateTime(selectedInvoice.editedAt) }}</div>
              </div>
              <table class="inv-items-table">
                <thead>
                  <tr><th>Producto</th><th>Cant</th><th>Precio</th><th>Total</th></tr>
                </thead>
                <tbody>
                  <tr v-for="item in selectedInvoice.items" :key="item.recipeId">
                    <td>{{ item.name }}</td>
                    <td>{{ item.qty }}</td>
                    <td>{{ formatCOP(item.price) }}</td>
                    <td>{{ formatCOP(item.qty * item.price) }}</td>
                  </tr>
                </tbody>
              </table>
              <div class="inv-total">
                <div class="inv-subtotal">Subtotal: {{ formatCOP(selectedInvoice.total) }}</div>
                <p class="inv-iva">(Precios incluyen IVA)</p>
                <div class="inv-payment">Método: {{ paymentLabel(selectedInvoice.paymentMethod) }}</div>
                <div class="inv-grand-total">TOTAL: {{ formatCOP(selectedInvoice.total) }}</div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="selectedInvoice = null">Cerrar</button>
              <a :href="`/api/${bizId}/invoices/${selectedInvoice.id}/pdf?token=${token}`" target="_blank" class="btn btn-primary">
                Descargar PDF
              </a>
            </div>
          </div>
        </div>

        <!-- Edit invoice modal (admin) -->
        <div class="modal-overlay" v-if="editingInvoice" @click.self="editingInvoice = null">
          <div class="modal modal-edit">
            <div class="modal-header">
              <h3 class="modal-title">✏️ Editar factura {{ editingInvoice.invoiceNumber }}</h3>
              <button class="btn-close" @click="editingInvoice = null">×</button>
            </div>
            <div class="modal-body edit-body">
              <p class="text-muted edit-hint">
                Al guardar se ajusta el inventario: se devuelve el stock de lo que quitaste
                y se descuenta el de lo que agregaste.
              </p>

              <!-- Agregar producto -->
              <input v-model="editSearch" class="form-control" placeholder="🔍 Buscar producto para agregar..." />
              <div class="edit-products-grid" v-if="editSearch.trim()">
                <button
                  v-for="p in editFilteredProducts"
                  :key="p._itemId"
                  :class="['edit-product-btn', { 'out-of-stock': p.outOfStock }]"
                  :disabled="p.outOfStock"
                  @click="addEditItem(p)"
                >
                  <span>{{ p.name }}</span>
                  <span class="ep-price">{{ formatCOP(p.price) }}{{ p.outOfStock ? ' · Agotado' : '' }}</span>
                </button>
                <div v-if="editFilteredProducts.length === 0" class="edit-empty">Sin resultados</div>
              </div>

              <!-- Items actuales -->
              <div class="edit-items">
                <div class="edit-item" v-for="item in editItems" :key="item._itemId">
                  <div class="ei-info">
                    <span class="ei-name">{{ item.name }}</span>
                    <span class="ei-unit">{{ formatCOP(item.price) }} c/u</span>
                  </div>
                  <div class="ei-controls">
                    <button class="qty-btn" @click="decEditItem(item)">−</button>
                    <span class="qty-value">{{ item.qty }}</span>
                    <button class="qty-btn" @click="item.qty++">+</button>
                    <span class="ei-total">{{ formatCOP(item.qty * item.price) }}</span>
                    <button class="remove-btn" @click="removeEditItem(item)">×</button>
                  </div>
                </div>
                <div v-if="editItems.length === 0" class="edit-empty">Sin productos — agrega al menos uno</div>
              </div>

              <!-- Método de pago -->
              <div class="edit-payment">
                <label class="form-label">Método de pago</label>
                <div class="pay-opts">
                  <button
                    v-for="m in paymentMethods"
                    :key="m.value"
                    :class="['pay-opt', { active: editPayment === m.value }]"
                    @click="editPayment = m.value"
                  >{{ m.icon }} {{ m.label }}</button>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Cliente (opcional)</label>
                <input v-model="editClient" class="form-control" placeholder="Nombre del cliente" />
              </div>

              <div class="edit-total-row">
                <span>Nuevo total</span>
                <span class="edit-total-value">{{ formatCOP(editTotal) }}</span>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="editingInvoice = null">Cancelar</button>
              <button class="btn btn-primary" @click="saveEditInvoice" :disabled="savingEdit || editItems.length === 0">
                <div class="spinner" v-if="savingEdit" style="width:14px;height:14px;border-width:2px"></div>
                {{ savingEdit ? 'Guardando...' : `Guardar cambios · ${formatCOP(editTotal)}` }}
              </button>
            </div>
          </div>
        </div>

  </PageLayout>
</template>

<script setup>
/**
 * InvoicesView.vue — Historial de facturas
 *
 * Lista todas las facturas generadas en el negocio en orden cronológico inverso
 * (la más reciente primero). Permite:
 *   - Buscar facturas por número, cajero o número de mesa
 *   - Ver el detalle de una factura en un modal
 *   - Abrir/descargar el PDF de cada factura
 *
 * El PDF requiere autenticación: el token se pasa como query param (?token=)
 * para que el enlace pueda abrirse directamente en el navegador.
 */
import { ref, computed, onMounted, inject } from 'vue'
import { useSalesStore } from '../stores/sales.js'
import { useAuthStore } from '../stores/auth.js'
import { useBusinessStore } from '../stores/business.js'
import { useInventoryStore } from '../stores/inventory.js'
import PageLayout from '../components/PageLayout.vue'
import { paymentLabel, paymentBadge } from '../utils/payment.js'

const salesStore = useSalesStore()
const auth = useAuthStore()
const businessStore = useBusinessStore()
const inventoryStore = useInventoryStore()
const toast = inject('toast')

const invoices = ref([])             // Lista completa de facturas
const loading = ref(false)
const search = ref('')               // Texto de búsqueda
const selectedInvoice = ref(null)    // Factura abierta en el modal de detalle
const bizId = computed(() => auth.currentBusiness?.id)
const business = computed(() => businessStore.profile) // Para mostrar en el encabezado del modal
const token = computed(() => auth.token)               // Para los enlaces de PDF
const canManage = computed(() => auth.user?.role !== 'cajero')

// ── Edición de factura (solo admin) ──────────────────────────────
const editingInvoice = ref(null)     // Factura en edición (null = ninguna)
const editItems = ref([])            // Items editables
const editPayment = ref('efectivo')
const editClient = ref('')
const editSearch = ref('')
const savingEdit = ref(false)

const paymentMethods = [
  { value: 'efectivo', label: 'Efectivo', icon: '💵' },
  { value: 'transferencia', label: 'Transferencia', icon: '📲' },
  { value: 'tarjeta', label: 'Tarjeta', icon: '💳' }
]

// Productos vendibles (recetas + inventario con precio), con bandera de agotado
const sellableItems = computed(() => {
  const invByName = new Map()
  for (const i of inventoryStore.items) {
    if ((i.salePrice || 0) > 0) invByName.set(i.name.toLowerCase().trim(), i)
  }
  const invById = new Map(inventoryStore.items.map(i => [i.id, i]))
  const result = inventoryStore.recipes
    .filter(r => r.available)
    .map(r => {
      const inv = invByName.get(r.name.toLowerCase().trim())
      let outOfStock = false
      if (inv) outOfStock = (inv.stock || 0) <= 0
      else if (r.ingredients?.length) {
        outOfStock = r.ingredients.some(ing => {
          const ii = invById.get(ing.inventoryId)
          return ii && (ii.stock || 0) <= 0
        })
      }
      return { _itemId: r.id, recipeId: r.id, inventoryId: undefined, name: r.name, price: inv ? inv.salePrice : r.price, category: r.category, area: r.area || 'bar', outOfStock }
    })
  const usedNames = new Set(result.map(r => r.name.toLowerCase().trim()))
  for (const i of inventoryStore.items) {
    if ((i.salePrice || 0) > 0 && !usedNames.has(i.name.toLowerCase().trim())) {
      result.push({ _itemId: i.id, recipeId: undefined, inventoryId: i.id, name: i.name, price: i.salePrice, category: i.category, area: i.area || 'bar', outOfStock: (i.stock || 0) <= 0 })
    }
  }
  return result
})

const editFilteredProducts = computed(() => {
  const q = editSearch.value.trim().toLowerCase()
  if (!q) return []
  return sellableItems.value.filter(p => p.name.toLowerCase().includes(q)).slice(0, 12)
})

const editTotal = computed(() =>
  editItems.value.reduce((s, i) => s + i.qty * i.price - (Number(i.discount) || 0), 0)
)

/**
 * Filtra las facturas según el texto de búsqueda.
 * Busca en número de factura, nombre del cajero y número de mesa.
 */
const filteredInvoices = computed(() => {
  if (!search.value) return invoices.value
  const s = search.value.toLowerCase()
  return invoices.value.filter(inv =>
    inv.invoiceNumber?.toLowerCase().includes(s) ||
    inv.cashier?.toLowerCase().includes(s) ||
    String(inv.tableNumber).includes(s)
  )
})

function formatCOP(v) { return '$' + Number(v || 0).toLocaleString('es-CO') }

/** Formatea fecha como DD/MM/YYYY */
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Formatea fecha y hora como DD/MM/YYYY HH:MM */
function formatDateTime(iso) {
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}


/** Abre el modal de detalle para una factura */
function viewInvoice(inv) { selectedInvoice.value = inv }

// ── Edición de factura ───────────────────────────────────────────
/** Abre el modal de edición con los datos de la factura */
function openEditInvoice(inv) {
  editingInvoice.value = inv
  editItems.value = (inv.items || []).map(i => ({
    _itemId: i.recipeId || i.inventoryId || i.name,
    recipeId: i.recipeId,
    inventoryId: i.inventoryId,
    name: i.name,
    price: Number(i.price) || 0,
    qty: i.qty || i.quantity || 1,
    area: i.area || 'bar',
    discount: Number(i.discount) || 0
  }))
  editPayment.value = inv.paymentMethod || 'efectivo'
  editClient.value = inv.client || ''
  editSearch.value = ''
}

/** Agrega un producto al carrito de edición (o aumenta su cantidad) */
function addEditItem(p) {
  if (p.outOfStock) { toast('Producto agotado, stock en ceros', 'error'); return }
  const existing = editItems.value.find(i => i._itemId === p._itemId)
  if (existing) existing.qty++
  else editItems.value.push({
    _itemId: p._itemId, recipeId: p.recipeId, inventoryId: p.inventoryId,
    name: p.name, price: p.price, qty: 1, area: p.area || 'bar', discount: 0
  })
  editSearch.value = ''
}

function decEditItem(item) {
  if (item.qty > 1) item.qty--
  else removeEditItem(item)
}
function removeEditItem(item) {
  editItems.value = editItems.value.filter(i => i._itemId !== item._itemId)
}

/** Guarda los cambios de la factura y ajusta el inventario */
async function saveEditInvoice() {
  if (editItems.value.length === 0) return
  savingEdit.value = true
  try {
    const payload = {
      items: editItems.value.map(i => ({
        recipeId: i.recipeId,
        inventoryId: i.inventoryId,
        name: i.name,
        price: i.price,
        qty: i.qty,
        area: i.area || 'bar',
        discount: Number(i.discount) || 0
      })),
      paymentMethod: editPayment.value,
      client: editClient.value
    }
    const res = await salesStore.updateInvoice(editingInvoice.value.id, payload)
    // Actualizar la lista local y el detalle si está abierto
    const idx = invoices.value.findIndex(s => s.id === res.sale.id)
    if (idx !== -1) invoices.value[idx] = res.sale
    if (selectedInvoice.value?.id === res.sale.id) selectedInvoice.value = res.sale
    editingInvoice.value = null
    toast('Factura actualizada · inventario ajustado', 'success')
    if (res.inventoryAlerts?.length > 0) {
      toast(`⚠️ ${res.inventoryAlerts.length} producto(s) con stock bajo`, 'warning')
    }
    inventoryStore.fetchInventory()
  } catch (err) {
    toast(err.response?.data?.error || 'Error al editar la factura', 'error')
  } finally {
    savingEdit.value = false
  }
}

// Al montar: cargar facturas (invertidas para mostrar la más reciente primero)
// y el perfil del negocio (para el encabezado del modal)
onMounted(async () => {
  loading.value = true
  try {
    const data = await salesStore.fetchInvoices()
    invoices.value = [...data].reverse()
    await businessStore.fetchProfile()
    // Recetas e inventario para el editor de facturas (solo admin)
    if (canManage.value) {
      inventoryStore.fetchRecipes()
      inventoryStore.fetchInventory()
    }
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.mb-3 { margin-bottom: 16px; }
.action-btns { display: flex; gap: 6px; }
.currency { color: var(--success); font-weight: 700; }

.invoice-detail { font-size: 13px; }
.inv-header {
  text-align: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--text-light);
}
.inv-info { margin-bottom: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.edited-note { grid-column: 1/-1; font-size: 11.5px; color: var(--accent); font-style: italic; }
.inv-items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
.inv-items-table th, .inv-items-table td { padding: 6px 8px; border-bottom: 1px solid var(--border); font-size: 13px; }
.inv-items-table th { background: var(--bg); font-weight: 600; }
.inv-total { border-top: 2px solid var(--text); padding-top: 10px; text-align: right; }
.inv-subtotal { margin-bottom: 2px; }
.inv-iva { font-size: 11px; color: var(--text-light); margin-bottom: 6px; }
.inv-payment { margin-bottom: 6px; }
.inv-grand-total { font-size: 18px; font-weight: 800; }

/* ── Editor de factura ── */
.modal-edit { max-width: 520px; }
.edit-body { display: flex; flex-direction: column; gap: 12px; }
.edit-hint { font-size: 12.5px; color: var(--text-light); margin: 0; }
.edit-products-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  max-height: 160px;
  overflow-y: auto;
}
.edit-product-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 10px;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  text-align: left;
  font-size: 12.5px;
}
.edit-product-btn:hover { border-color: var(--accent); }
.edit-product-btn:disabled { cursor: not-allowed; }
.edit-product-btn.out-of-stock { opacity: 0.6; border-color: var(--danger); }
.edit-product-btn.out-of-stock span:first-child { text-decoration: line-through; }
.ep-price { font-size: 11px; color: var(--text-light); }
.edit-empty { grid-column: 1/-1; text-align: center; color: var(--text-light); font-size: 13px; padding: 12px 0; }

.edit-items { display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--border); border-radius: 8px; padding: 8px; }
.edit-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ei-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.ei-name { font-size: 13px; font-weight: 600; }
.ei-unit { font-size: 11px; color: var(--text-light); }
.ei-controls { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.qty-btn {
  width: 26px; height: 26px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}
.qty-btn:hover { background: var(--accent); border-color: var(--accent); color: white; }
.qty-value { min-width: 22px; text-align: center; font-weight: 700; font-size: 13px; }
.ei-total { min-width: 64px; text-align: right; font-weight: 700; font-size: 13px; }
.remove-btn { border: none; background: none; color: var(--danger); cursor: pointer; font-size: 18px; line-height: 1; }

.pay-opts { display: flex; gap: 8px; }
.pay-opt {
  flex: 1;
  padding: 8px;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 600;
}
.pay-opt.active { border-color: var(--success); background: #f0fff4; color: var(--success); }

.edit-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 2px solid var(--border);
  font-weight: 700;
}
.edit-total-value { font-size: 20px; font-weight: 900; color: var(--success); }
</style>
