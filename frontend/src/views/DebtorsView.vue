<template>
  <PageLayout title="Deudas">

    <div class="page-header">
      <div>
        <h1 class="page-title">Panel de Deudas</h1>
        <p class="page-subtitle">Clientes que compran fiado y sus saldos pendientes</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">
        <UserPlus :size="15" /> Nuevo cliente
      </button>
    </div>

    <!-- Resumen -->
    <div class="summary-cards mb-4">
      <div class="summary-card">
        <p class="summary-label">Clientes con deuda</p>
        <p class="summary-value danger">{{ debtorsStore.activeCount }}</p>
      </div>
      <div class="summary-card highlight">
        <p class="summary-label">Deuda total pendiente</p>
        <p class="summary-value danger">{{ formatCOP(debtorsStore.totalDebt) }}</p>
      </div>
      <div class="summary-card">
        <p class="summary-label">Total registrados</p>
        <p class="summary-value">{{ debtorsStore.debtors.length }}</p>
      </div>
    </div>

    <!-- Búsqueda -->
    <div class="filters-bar card mb-3">
      <input v-model="search" class="form-control" placeholder="Buscar cliente..." style="max-width:260px" />
      <label class="filter-check">
        <input type="checkbox" v-model="onlyActive" />
        Solo con saldo pendiente
      </label>
    </div>

    <div v-if="debtorsStore.loading" class="loading">
      <div class="spinner"></div>
    </div>

    <div v-else class="card">
      <div v-if="filteredDebtors.length === 0" class="empty-state">
        <Wallet :size="38" class="empty-icon" />
        <p class="empty-state-title">Sin clientes registrados</p>
        <p class="empty-state-text">Agrega un cliente para empezar a registrar fiados</p>
      </div>

      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th>Saldo pendiente</th>
              <th>Movimientos</th>
              <th>Último movimiento</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in filteredDebtors" :key="d.id" class="debtor-row" @click="openDetail(d)">
              <td>
                <div class="client-name">
                  <div class="client-avatar">{{ d.name.charAt(0).toUpperCase() }}</div>
                  <strong>{{ d.name }}</strong>
                </div>
              </td>
              <td class="text-muted">{{ d.phone || '—' }}</td>
              <td>
                <span :class="['balance-badge', d.balance > 0 ? 'balance-debt' : 'balance-ok']">
                  {{ d.balance > 0 ? formatCOP(d.balance) : 'Al día ✓' }}
                </span>
              </td>
              <td class="text-muted">{{ d.transactions?.length || 0 }}</td>
              <td class="text-muted">{{ lastMovement(d) }}</td>
              <td @click.stop>
                <div class="action-btns">
                  <button class="btn btn-sm btn-danger-outline" @click="openCharge(d)" title="Registrar fiado">
                    <Plus :size="12" /> Fiado
                  </button>
                  <button class="btn btn-sm btn-success-outline" @click="openPayment(d)" title="Registrar abono" :disabled="d.balance <= 0">
                    <Minus :size="12" /> Abono
                  </button>
                  <button v-if="canManage" class="btn btn-sm btn-outline" @click="openEdit(d)" title="Editar">✏️</button>
                  <button v-if="canManage" class="btn btn-sm btn-danger" @click="confirmDel(d)" title="Eliminar">🗑️</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Historial de pagos (abonos) ── -->
    <div class="card mt-4">
      <div class="history-header">
        <div>
          <h3 class="history-title">Historial de pagos</h3>
          <p class="text-muted" style="font-size:12.5px">Abonos registrados de todos los clientes</p>
        </div>
        <button v-if="canManage" class="btn btn-sm btn-danger-outline" @click="confirmClearHistory">
          🗑️ Borrar historial
        </button>
      </div>

      <div v-if="debtorsStore.allPayments.length === 0" class="empty-state" style="padding:24px 0">
        <p class="text-muted" style="text-align:center">Aún no hay abonos registrados</p>
      </div>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Monto</th>
              <th>Descripción</th>
              <th>Registrado por</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in debtorsStore.allPayments" :key="p.id">
              <td class="text-muted">{{ formatDateTime(p.date) }}</td>
              <td><strong>{{ p.debtorName }}</strong></td>
              <td class="payment-amount">+{{ formatCOP(p.amount) }}</td>
              <td class="text-muted">{{ p.description || '—' }}</td>
              <td class="text-muted">{{ p.registeredBy }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Modal: Crear / Editar cliente ── -->
    <div class="modal-overlay" v-if="showClientModal" @click.self="showClientModal = false">
      <div class="modal" style="max-width:420px">
        <div class="modal-header">
          <h3 class="modal-title">{{ editDebtor ? 'Editar cliente' : 'Nuevo cliente' }}</h3>
          <button class="btn-close" @click="showClientModal = false"><X :size="18" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Nombre *</label>
            <input v-model="clientForm.name" type="text" class="form-control"
              :class="{ 'input-error': clientSubmitted && !clientForm.name.trim() }"
              placeholder="Ej: Juan García" />
          </div>
          <div class="form-group">
            <label class="form-label">Teléfono (opcional)</label>
            <input v-model="clientForm.phone" type="tel" class="form-control" placeholder="Ej: 3001234567" />
          </div>
          <div class="form-group">
            <label class="form-label">Notas (opcional)</label>
            <input v-model="clientForm.notes" type="text" class="form-control" placeholder="Ej: Habitué, paga quincena" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showClientModal = false">Cancelar</button>
          <button class="btn btn-primary" @click="saveClient" :disabled="saving">
            <div class="spinner" v-if="saving" style="width:14px;height:14px;border-width:2px"></div>
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Modal: Registrar fiado (mini-POS) ── -->
    <div class="modal-overlay" v-if="showChargeModal" @click.self="showChargeModal = false">
      <div class="modal modal-pos">
        <div class="modal-header">
          <div class="detail-header-info">
            <div class="client-avatar">{{ activeDebtor?.name.charAt(0).toUpperCase() }}</div>
            <div>
              <h3 class="modal-title">{{ editingCharge ? 'Editar fiado' : 'Registrar fiado' }} — {{ activeDebtor?.name }}</h3>
              <p class="text-muted" style="font-size:12px">Saldo actual: <strong class="danger">{{ formatCOP(activeDebtor?.balance) }}</strong></p>
            </div>
          </div>
          <button class="btn-close" @click="showChargeModal = false"><X :size="18" /></button>
        </div>
        <div class="modal-body pos-body">

          <!-- Buscador + categorías -->
          <div class="pos-search-row">
            <input v-model="chargeSearch" class="form-control" placeholder="🔍 Buscar producto..." style="flex:1" />
          </div>
          <div class="cat-tabs">
            <button
              v-for="cat in chargeCategories"
              :key="cat"
              :class="['cat-btn', { active: chargeCat === cat }]"
              @click="chargeCat = cat"
            >{{ cat === 'todas' ? '🍽️ Todas' : cat }}</button>
          </div>

          <!-- Grid de productos -->
          <div class="pos-products-grid">
            <button
              v-for="r in chargeFilteredRecipes"
              :key="r.id"
              :class="['product-btn', { 'in-cart': isInChargeCart(r), 'out-of-stock': r.outOfStock }]"
              @click="addToChargeCart(r)"
              :disabled="r.outOfStock"
            >
              <span class="product-name">{{ r.name }}</span>
              <span class="product-price">{{ formatCOP(r.price) }}</span>
              <span v-if="r.outOfStock" class="stock-badge">Agotado</span>
              <span v-else-if="isInChargeCart(r)" class="in-cart-badge">{{ getChargeQty(r) }}</span>
            </button>
            <div v-if="chargeFilteredRecipes.length === 0" class="pos-empty">
              Sin productos disponibles
            </div>
          </div>

          <!-- Carrito -->
          <div class="pos-cart" v-if="chargeCart.length > 0">
            <p class="section-mini-title mb-2">Pedido</p>
            <div class="cart-items">
              <div class="cart-item" v-for="item in chargeCart" :key="item.recipeId">
                <div class="item-info">
                  <span class="item-name">{{ item.name }}</span>
                  <span class="item-unit-price">{{ formatCOP(item.price) }} c/u</span>
                </div>
                <div class="item-controls">
                  <button class="qty-btn" @click="decreaseChargeQty(item)">−</button>
                  <span class="qty-value">{{ item.qty }}</span>
                  <button class="qty-btn" @click="item.qty++">+</button>
                  <span class="item-total">{{ formatCOP(item.qty * item.price) }}</span>
                  <button class="remove-btn" @click="removeFromChargeCart(item)">×</button>
                </div>
              </div>
            </div>
            <div class="cart-total-row">
              <span class="fw-700">Total fiado</span>
              <span class="cart-total-value">{{ formatCOP(chargeTotal) }}</span>
            </div>
          </div>
          <div v-else class="pos-cart-empty">
            <p class="text-muted" style="text-align:center;padding:12px 0">Selecciona productos del menú</p>
          </div>

          <!-- Nota libre opcional -->
          <div class="form-group mt-2">
            <label class="form-label">Nota adicional (opcional)</label>
            <input v-model="chargeNote" type="text" class="form-control" placeholder="Ej: Mesa 3, para llevar..." />
          </div>
          <p v-if="chargeSubmitted && chargeCart.length === 0" class="error-hint">Agrega al menos un producto</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showChargeModal = false">Cancelar</button>
          <button class="btn btn-danger" @click="handleCharge" :disabled="saving || chargeCart.length === 0">
            <div class="spinner" v-if="saving" style="width:14px;height:14px;border-width:2px"></div>
            {{ saving ? 'Guardando...' : `${editingCharge ? 'Guardar cambios' : 'Registrar fiado'} · ${formatCOP(chargeTotal)}` }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Modal: Registrar abono ── -->
    <div class="modal-overlay" v-if="showPaymentModal" @click.self="showPaymentModal = false">
      <div class="modal" style="max-width:400px">
        <div class="modal-header">
          <h3 class="modal-title">Registrar abono</h3>
          <button class="btn-close" @click="showPaymentModal = false"><X :size="18" /></button>
        </div>
        <div class="modal-body">
          <div class="client-info-bar mb-3">
            <div class="client-avatar">{{ activeDebtor?.name.charAt(0).toUpperCase() }}</div>
            <div>
              <p class="fw-700">{{ activeDebtor?.name }}</p>
              <p class="text-muted" style="font-size:12px">Saldo pendiente: <strong class="danger">{{ formatCOP(activeDebtor?.balance) }}</strong></p>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Monto que abona *</label>
            <input v-model.number="paymentForm.amount" type="number" class="form-control"
              :class="{ 'input-error': paymentSubmitted && !paymentForm.amount }"
              min="1" step="1000" placeholder="Ej: 20000" />
            <span v-if="paymentForm.amount > 0" class="field-hint">
              Saldo restante:
              <strong :class="remaining <= 0 ? 'success' : 'danger'">
                {{ remaining <= 0 ? 'Queda en cero ✓' : formatCOP(remaining) }}
              </strong>
            </span>
          </div>
          <div class="form-group">
            <label class="form-label">¿Con qué pagó?</label>
            <div class="seg-toggle">
              <button type="button" :class="['seg-opt', { active: paymentForm.paidWith === 'efectivo' }]" @click="paymentForm.paidWith = 'efectivo'">💵 Efectivo</button>
              <button type="button" :class="['seg-opt', { active: paymentForm.paidWith === 'banco' }]" @click="paymentForm.paidWith = 'banco'">🏦 Banco</button>
            </div>
            <span class="field-hint">El área (Bar/Restaurante) se reparte automático según lo que debe el cliente.</span>
          </div>
          <div class="form-group">
            <label class="form-label">Notas (opcional)</label>
            <input v-model="paymentForm.description" type="text" class="form-control"
              placeholder="Ej: Pago completo, Pago parcial..." />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showPaymentModal = false">Cancelar</button>
          <button class="btn btn-primary" @click="handlePayment" :disabled="saving">
            <div class="spinner" v-if="saving" style="width:14px;height:14px;border-width:2px"></div>
            {{ saving ? 'Guardando...' : 'Registrar abono' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Modal: Editar abono ── -->
    <div class="modal-overlay" v-if="showEditPaymentModal" @click.self="showEditPaymentModal = false">
      <div class="modal" style="max-width:400px">
        <div class="modal-header">
          <h3 class="modal-title">Editar abono</h3>
          <button class="btn-close" @click="showEditPaymentModal = false"><X :size="18" /></button>
        </div>
        <div class="modal-body">
          <p class="text-muted" style="font-size:12.5px;margin-bottom:12px">
            Al cambiar el monto se recalcula el saldo. Si la deuda vuelve a quedar pendiente,
            los fiados que figuraban como <strong>facturados</strong> se reabren y se borra la
            factura automática de pago de fiado.
          </p>
          <div class="form-group">
            <label class="form-label">Monto del abono *</label>
            <input v-model.number="editPaymentForm.amount" type="number" class="form-control"
              :class="{ 'input-error': editPaymentSubmitted && !editPaymentForm.amount }"
              min="1" step="1000" placeholder="Ej: 11000" />
          </div>
          <div class="form-group">
            <label class="form-label">Notas (opcional)</label>
            <input v-model="editPaymentForm.description" type="text" class="form-control"
              placeholder="Ej: Pago parcial..." />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showEditPaymentModal = false">Cancelar</button>
          <button class="btn btn-primary" @click="handleEditPayment" :disabled="saving">
            <div class="spinner" v-if="saving" style="width:14px;height:14px;border-width:2px"></div>
            {{ saving ? 'Guardando...' : 'Guardar cambios' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Modal: Historial del cliente ── -->
    <div class="modal-overlay" v-if="detailDebtor" @click.self="detailDebtor = null">
      <div class="modal" style="max-width:500px">
        <div class="modal-header">
          <div class="detail-header-info">
            <div class="client-avatar lg">{{ detailDebtor.name.charAt(0).toUpperCase() }}</div>
            <div>
              <h3 class="modal-title">{{ detailDebtor.name }}</h3>
              <p class="text-muted" style="font-size:12px">{{ detailDebtor.phone || 'Sin teléfono' }}{{ detailDebtor.notes ? ' · ' + detailDebtor.notes : '' }}</p>
            </div>
          </div>
          <button class="btn-close" @click="detailDebtor = null"><X :size="18" /></button>
        </div>
        <div class="modal-body">
          <!-- Saldo destacado -->
          <div class="balance-hero mb-3" :class="detailDebtor.balance > 0 ? 'balance-hero-debt' : 'balance-hero-ok'">
            <p class="balance-hero-label">Saldo pendiente</p>
            <p class="balance-hero-value">{{ formatCOP(detailDebtor.balance) }}</p>
          </div>

          <!-- Historial de transacciones -->
          <div v-if="!detailDebtor.transactions?.length" class="empty-state" style="padding:20px 0">
            <p class="text-muted" style="text-align:center">Sin movimientos aún</p>
          </div>
          <div v-else>
            <p class="section-mini-title">Historial de movimientos</p>
            <div class="transactions-list">
              <div v-for="t in [...detailDebtor.transactions].reverse()" :key="t.id"
                :class="['transaction-row', t.type]">
                <div class="transaction-info">
                  <span class="transaction-icon">{{ t.type === 'charge' ? '📌' : '✅' }}</span>
                  <div>
                    <p class="transaction-desc">
                      {{ t.description }}
                      <span v-if="t.editedAt" class="edited-tag" title="Editado">✏️ editado</span>
                    </p>
                    <p class="transaction-meta">{{ formatDateTime(t.date) }} · por {{ t.registeredBy }}</p>
                  </div>
                </div>
                <div class="transaction-right">
                  <span :class="['transaction-amount', t.type]">
                    {{ t.type === 'charge' ? '+' : '-' }}{{ formatCOP(t.amount) }}
                  </span>
                  <!-- Editar/eliminar fiado: solo admin y solo cargos no facturados -->
                  <div v-if="canManage && t.type === 'charge' && !t.settled" class="tx-actions">
                    <button class="tx-action-btn" title="Editar fiado" @click="openEditCharge(detailDebtor, t)">✏️</button>
                    <button class="tx-action-btn danger" title="Eliminar fiado" @click="confirmDeleteCharge(detailDebtor, t)">🗑️</button>
                  </div>
                  <span v-else-if="t.type === 'charge' && t.settled" class="settled-tag" title="Ya facturado">facturado</span>
                  <!-- Editar/eliminar abono: solo admin -->
                  <div v-if="canManage && t.type === 'payment'" class="tx-actions">
                    <button class="tx-action-btn" title="Editar abono" @click="openEditPayment(detailDebtor, t)">✏️</button>
                    <button class="tx-action-btn danger" title="Eliminar abono" @click="confirmDeletePayment(detailDebtor, t)">🗑️</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="detailDebtor = null">Cerrar</button>
          <button class="btn btn-danger-outline" @click="openCharge(detailDebtor); detailDebtor = null">
            <Plus :size="13" /> Fiado
          </button>
          <button class="btn btn-primary" @click="openPayment(detailDebtor); detailDebtor = null" :disabled="detailDebtor.balance <= 0">
            <Minus :size="13" /> Abono
          </button>
        </div>
      </div>
    </div>

    <!-- ── Modal: Confirmar eliminar ── -->
    <ConfirmModal
      :visible="!!deleteTarget"
      title="Eliminar cliente"
      :message="`¿Eliminar &quot;${deleteTarget?.name}&quot;? Se perderá todo su historial.`"
      confirmText="Sí, eliminar"
      type="danger"
      @confirm="doDelete"
      @cancel="deleteTarget = null"
    />

    <!-- ── Modal: Confirmar eliminar fiado ── -->
    <ConfirmModal
      :visible="!!deleteChargeTarget"
      title="Eliminar fiado"
      :message="`¿Eliminar este fiado de ${formatCOP(deleteChargeTarget?.tx?.amount)}? Los productos se devolverán al inventario y se ajustará el saldo del cliente.`"
      confirmText="Sí, eliminar"
      type="danger"
      @confirm="doDeleteCharge"
      @cancel="deleteChargeTarget = null"
    />

    <!-- ── Modal: Confirmar eliminar abono ── -->
    <ConfirmModal
      :visible="!!deletePaymentTarget"
      title="Eliminar abono"
      :message="`¿Eliminar este abono de ${formatCOP(deletePaymentTarget?.tx?.amount)}? Se recalcula el saldo y, si la deuda vuelve a quedar pendiente, se reabren los fiados facturados.`"
      confirmText="Sí, eliminar"
      type="danger"
      @confirm="doDeletePayment"
      @cancel="deletePaymentTarget = null"
    />

  </PageLayout>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { useDebtorsStore } from '../stores/debtors.js'
import { useInventoryStore } from '../stores/inventory.js'
import { useAuthStore } from '../stores/auth.js'
import PageLayout from '../components/PageLayout.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import { UserPlus, Wallet, X, Plus, Minus } from 'lucide-vue-next'

const debtorsStore = useDebtorsStore()
const inventoryStore = useInventoryStore()
const auth = useAuthStore()
const toast = inject('toast')

const canManage = computed(() => auth.user?.role !== 'cajero')

// ── Filtros ──────────────────────────────────────────────────────
const search = ref('')
const onlyActive = ref(false)

const filteredDebtors = computed(() => {
  let list = debtorsStore.debtors
  if (search.value) {
    const s = search.value.toLowerCase()
    list = list.filter(d => d.name.toLowerCase().includes(s) || d.phone?.includes(s))
  }
  if (onlyActive.value) list = list.filter(d => d.balance > 0)
  return list
})

// ── Estado ───────────────────────────────────────────────────────
const saving = ref(false)
const showClientModal = ref(false)
const showChargeModal  = ref(false)
const showPaymentModal = ref(false)
const detailDebtor  = ref(null)
const editDebtor    = ref(null)
const activeDebtor  = ref(null)
const deleteTarget  = ref(null)
const editingCharge = ref(null)   // Transacción de fiado en edición (null = nuevo fiado)
const deleteChargeTarget = ref(null)   // { debtor, tx } a eliminar
const showEditPaymentModal = ref(false)
const editPaymentTarget = ref(null)    // { debtor, tx } del abono en edición
const editPaymentSubmitted = ref(false)
const editPaymentForm = ref({ amount: '', description: '' })
const deletePaymentTarget = ref(null)  // { debtor, tx } a eliminar

const clientSubmitted  = ref(false)
const chargeSubmitted  = ref(false)
const paymentSubmitted = ref(false)

const clientForm  = ref({ name: '', phone: '', notes: '' })
const paymentForm = ref({ amount: '', description: '', paidWith: 'efectivo' })

// ── Mini-POS del fiado ────────────────────────────────────────────
const chargeCart   = ref([])   // [{ recipeId, name, price, qty }]
const chargeSearch = ref('')
const chargeCat    = ref('todas')
const chargeNote   = ref('')

const chargeCategories = computed(() => {
  const recipeCats = inventoryStore.recipes.map(r => r.category)
  const invCats = inventoryStore.items.filter(i => (i.salePrice || 0) > 0).map(i => i.category)
  const cats = [...new Set([...recipeCats, ...invCats].filter(Boolean))]
  return ['todas', ...cats]
})

// Misma lógica de fusión que OrderCart: recetas + inventario con salePrice
const chargeSellableItems = computed(() => {
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
      return { ...r, _itemId: r.id, price: inv ? inv.salePrice : r.price, area: (inv?.area) || r.area || 'bar', outOfStock }
    })
  const usedNames = new Set(result.map(r => r.name.toLowerCase().trim()))
  for (const i of inventoryStore.items) {
    if ((i.salePrice || 0) > 0 && !usedNames.has(i.name.toLowerCase().trim())) {
      result.push({ id: i.id, _itemId: i.id, _invOnly: true, name: i.name, price: i.salePrice, category: i.category, area: i.area || 'bar', available: true, outOfStock: (i.stock || 0) <= 0 })
    }
  }
  return result
})

const chargeFilteredRecipes = computed(() => {
  let list = chargeSellableItems.value
  if (chargeCat.value !== 'todas') list = list.filter(r => r.category === chargeCat.value)
  if (chargeSearch.value.trim()) {
    const q = chargeSearch.value.trim().toLowerCase()
    list = list.filter(r => r.name.toLowerCase().includes(q))
  }
  return list
})
const chargeTotal = computed(() =>
  chargeCart.value.reduce((s, i) => s + i.qty * i.price, 0)
)
function isInChargeCart(r) { return chargeCart.value.some(i => i._itemId === r._itemId) }
function getChargeQty(r)   { return chargeCart.value.find(i => i._itemId === r._itemId)?.qty || 0 }
function addToChargeCart(r) {
  if (r.outOfStock) {
    toast('Producto agotado, stock en ceros', 'error')
    return
  }
  const existing = chargeCart.value.find(i => i._itemId === r._itemId)
  if (existing) existing.qty++
  else chargeCart.value.push({
    _itemId: r._itemId,
    recipeId: r._invOnly ? undefined : r.id,
    inventoryId: r._invOnly ? r.id : undefined,
    name: r.name, price: r.price, area: r.area || 'bar', qty: 1
  })
}
function decreaseChargeQty(item) {
  if (item.qty > 1) item.qty--
  else removeFromChargeCart(item)
}
function removeFromChargeCart(item) {
  chargeCart.value = chargeCart.value.filter(i => i._itemId !== item._itemId)
}

const remaining = computed(() =>
  Math.max(0, (activeDebtor.value?.balance || 0) - (paymentForm.value.amount || 0))
)

// ── Helpers ──────────────────────────────────────────────────────
function formatCOP(v) { return '$' + Number(v || 0).toLocaleString('es-CO') }
function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
function lastMovement(d) {
  if (!d.transactions?.length) return '—'
  const last = d.transactions[d.transactions.length - 1]
  return new Date(last.date).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Acciones ─────────────────────────────────────────────────────
function openCreate() {
  editDebtor.value = null
  clientForm.value = { name: '', phone: '', notes: '' }
  clientSubmitted.value = false
  showClientModal.value = true
}

function openEdit(d) {
  editDebtor.value = d
  clientForm.value = { name: d.name, phone: d.phone || '', notes: d.notes || '' }
  clientSubmitted.value = false
  showClientModal.value = true
}

function openCharge(d) {
  activeDebtor.value = d
  editingCharge.value = null
  chargeCart.value = []
  chargeSearch.value = ''
  chargeCat.value = 'todas'
  chargeNote.value = ''
  chargeSubmitted.value = false
  showChargeModal.value = true
}

/** Abre el mini-POS precargado con los productos de un fiado existente para editarlo */
function openEditCharge(d, tx) {
  activeDebtor.value = d
  editingCharge.value = tx
  detailDebtor.value = null
  // Precargar el carrito desde los items del fiado
  chargeCart.value = (tx.items || []).map(i => ({
    _itemId: i.recipeId || i.inventoryId || i.name,
    recipeId: i.recipeId,
    inventoryId: i.inventoryId,
    name: i.name,
    price: i.price,
    area: i.area || 'bar',
    qty: i.qty || 1
  }))
  // Recuperar la nota libre (lo que va después de " — " en la descripción)
  const dashIdx = (tx.description || '').indexOf(' — ')
  chargeNote.value = dashIdx !== -1 ? tx.description.slice(dashIdx + 3) : ''
  chargeSearch.value = ''
  chargeCat.value = 'todas'
  chargeSubmitted.value = false
  showChargeModal.value = true
}

function openPayment(d) {
  activeDebtor.value = d
  paymentForm.value = { amount: '', description: '', paidWith: 'efectivo' }
  paymentSubmitted.value = false
  showPaymentModal.value = true
}

function openDetail(d) {
  // Siempre muestra el debtor actualizado desde el store
  detailDebtor.value = debtorsStore.debtors.find(x => x.id === d.id) || d
}

function confirmDel(d) { deleteTarget.value = d }

async function saveClient() {
  clientSubmitted.value = true
  if (!clientForm.value.name.trim()) return
  saving.value = true
  try {
    if (editDebtor.value) {
      await debtorsStore.updateDebtor(editDebtor.value.id, clientForm.value)
      toast('Cliente actualizado', 'success')
    } else {
      await debtorsStore.createDebtor(clientForm.value)
      toast('Cliente creado', 'success')
    }
    showClientModal.value = false
  } catch (err) {
    toast(err.response?.data?.error || 'Error al guardar', 'error')
  } finally {
    saving.value = false
  }
}

async function handleCharge() {
  chargeSubmitted.value = true
  if (chargeCart.value.length === 0) return
  saving.value = true
  try {
    // Descripción legible: "2x Cerveza, 1x Hamburguesa — Mesa 3"
    const desc = chargeCart.value
      .map(i => `${i.qty}x ${i.name}`)
      .join(', ') + (chargeNote.value ? ` — ${chargeNote.value}` : '')
    // Items para el backend: descontará inventario y guardará para la factura al saldar
    const items = chargeCart.value.map(i => ({
      recipeId: i.recipeId,
      inventoryId: i.inventoryId,
      name: i.name,
      price: i.price,
      area: i.area || 'bar',
      qty: i.qty
    }))
    let res
    if (editingCharge.value) {
      res = await debtorsStore.editCharge(activeDebtor.value.id, editingCharge.value.id, {
        amount: chargeTotal.value, description: desc, items
      })
      toast(`Fiado actualizado · ${formatCOP(chargeTotal.value)}`, 'success')
    } else {
      res = await debtorsStore.addCharge(activeDebtor.value.id, chargeTotal.value, desc, items)
      toast(`Fiado de ${formatCOP(chargeTotal.value)} registrado`, 'success')
    }
    showChargeModal.value = false
    editingCharge.value = null
    if (res.inventoryAlerts?.length > 0) {
      toast(`⚠️ ${res.inventoryAlerts.length} producto(s) con stock bajo`, 'warning')
    }
    inventoryStore.fetchInventory()
  } catch (err) {
    toast(err.response?.data?.error || 'Error al registrar', 'error')
  } finally {
    saving.value = false
  }
}

async function handlePayment() {
  paymentSubmitted.value = true
  if (!paymentForm.value.amount) return
  saving.value = true
  try {
    const res = await debtorsStore.addPayment(activeDebtor.value.id, paymentForm.value.amount, paymentForm.value.description, paymentForm.value.paidWith)
    showPaymentModal.value = false
    if (res.generatedSale) {
      toast(`✅ Saldo cubierto. Factura ${res.generatedSale.invoiceNumber} generada`, 'success')
    } else {
      toast(`Abono de ${formatCOP(paymentForm.value.amount)} registrado`, 'success')
    }
  } catch (err) {
    toast(err.response?.data?.error || 'Error al registrar', 'error')
  } finally {
    saving.value = false
  }
}

/** Borra todo el historial de movimientos. Solo admin/superadmin. */
async function confirmClearHistory() {
  const msg = '¿Borrar TODO el historial de movimientos?\n\n' +
              '- Se borrarán cargos y abonos de todos los clientes\n' +
              '- Los saldos volverán a $0\n' +
              '- Los clientes registrados se conservan\n' +
              '- Las facturas ya generadas (pago_fiado) NO se borran\n\n' +
              'Escribe "BORRAR" para confirmar:'
  const answer = prompt(msg)
  if (answer !== 'BORRAR') return
  try {
    await debtorsStore.clearAllHistory()
    toast('Historial borrado', 'success')
  } catch (err) {
    toast(err.response?.data?.error || 'Error al borrar', 'error')
  }
}

async function doDelete() {
  try {
    await debtorsStore.deleteDebtor(deleteTarget.value.id)
    toast('Cliente eliminado', 'success')
  } catch {
    toast('Error al eliminar', 'error')
  } finally {
    deleteTarget.value = null
  }
}

/** Abre la confirmación de eliminación de un fiado puntual */
function confirmDeleteCharge(d, tx) {
  deleteChargeTarget.value = { debtor: d, tx }
}

/** Elimina un fiado (devuelve productos al inventario y ajusta saldo) */
async function doDeleteCharge() {
  const { debtor, tx } = deleteChargeTarget.value
  try {
    const res = await debtorsStore.deleteCharge(debtor.id, tx.id)
    // Refrescar el detalle abierto con el deudor actualizado
    if (detailDebtor.value && detailDebtor.value.id === debtor.id) {
      detailDebtor.value = res.debtor
    }
    inventoryStore.fetchInventory()
    toast('Fiado eliminado · productos devueltos al inventario', 'success')
  } catch (err) {
    toast(err.response?.data?.error || 'Error al eliminar el fiado', 'error')
  } finally {
    deleteChargeTarget.value = null
  }
}

/** Abre el modal de edición de un abono */
function openEditPayment(d, tx) {
  editPaymentTarget.value = { debtor: d, tx }
  editPaymentForm.value = { amount: tx.amount, description: tx.description || '' }
  editPaymentSubmitted.value = false
  showEditPaymentModal.value = true
}

/** Guarda el monto editado del abono */
async function handleEditPayment() {
  editPaymentSubmitted.value = true
  if (!editPaymentForm.value.amount) return
  saving.value = true
  try {
    const { debtor, tx } = editPaymentTarget.value
    const res = await debtorsStore.editPayment(debtor.id, tx.id, {
      amount: editPaymentForm.value.amount,
      description: editPaymentForm.value.description
    })
    if (detailDebtor.value && detailDebtor.value.id === debtor.id) detailDebtor.value = res.debtor
    showEditPaymentModal.value = false
    toast('Abono actualizado', 'success')
  } catch (err) {
    toast(err.response?.data?.error || 'Error al editar el abono', 'error')
  } finally {
    saving.value = false
  }
}

/** Abre la confirmación de eliminación de un abono */
function confirmDeletePayment(d, tx) {
  deletePaymentTarget.value = { debtor: d, tx }
}

/** Elimina un abono y recalcula el saldo */
async function doDeletePayment() {
  const { debtor, tx } = deletePaymentTarget.value
  try {
    const res = await debtorsStore.deletePayment(debtor.id, tx.id)
    if (detailDebtor.value && detailDebtor.value.id === debtor.id) detailDebtor.value = res.debtor
    toast('Abono eliminado', 'success')
  } catch (err) {
    toast(err.response?.data?.error || 'Error al eliminar el abono', 'error')
  } finally {
    deletePaymentTarget.value = null
  }
}

onMounted(() => {
  debtorsStore.fetchDebtors()
  inventoryStore.fetchRecipes()
  inventoryStore.fetchInventory()
})
</script>

<style scoped>
.mb-4 { margin-bottom: 20px; }
.mb-3 { margin-bottom: 14px; }

/* Resumen */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.summary-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px 20px;
}
.summary-card.highlight {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
  border-color: transparent;
}
.summary-card.highlight .summary-label { color: rgba(255,255,255,0.6); }
.summary-card.highlight .summary-value { color: #f87171; }
.summary-label { font-size: 12px; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
.summary-value { font-size: 26px; font-weight: 800; color: var(--text); letter-spacing: -0.03em; }
.summary-value.danger { color: var(--danger); }

/* Filtros */
.filters-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 16px; }
.filter-check { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }

/* Tabla */
.debtor-row { cursor: pointer; }
.client-name { display: flex; align-items: center; gap: 10px; }
.client-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
  color: white;
  font-size: 13px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.client-avatar.lg { width: 42px; height: 42px; font-size: 17px; }
.text-muted { font-size: 13px; color: var(--text-light); }

.balance-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12.5px;
  font-weight: 700;
}
.balance-debt { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.balance-ok   { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }

.action-btns { display: flex; gap: 5px; flex-wrap: wrap; }

/* Botones extra */
.btn-danger-outline {
  border: 1.5px solid var(--danger);
  color: var(--danger);
  background: transparent;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
}
.btn-danger-outline:hover { background: #fef2f2; }
.btn-success-outline {
  border: 1.5px solid var(--success);
  color: var(--success);
  background: transparent;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
}
.btn-success-outline:hover { background: #f0fdf4; }
.btn-success-outline:disabled { opacity: 0.4; cursor: not-allowed; }

/* Modal: info del cliente */
.client-info-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
}
.field-hint { font-size: 12.5px; color: var(--text-light); margin-top: 6px; display: block; }

/* Selector segmentado (efectivo/banco, área) */
.seg-toggle { display: flex; gap: 8px; }
.seg-opt {
  flex: 1; padding: 9px; border: 1.5px solid var(--border); border-radius: 8px;
  background: var(--surface); color: var(--text); cursor: pointer; font-size: 13px; font-weight: 600;
}
.seg-opt.active { border-color: var(--accent); background: var(--accent-light, #fffbeb); color: #b45309; }

/* Modal: detalle */
.detail-header-info { display: flex; align-items: center; gap: 12px; }
.balance-hero {
  border-radius: var(--radius-sm);
  padding: 16px 20px;
  text-align: center;
}
.balance-hero-debt { background: #fef2f2; border: 1px solid #fecaca; }
.balance-hero-ok   { background: #f0fdf4; border: 1px solid #bbf7d0; }
.balance-hero-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-light); margin-bottom: 4px; }
.balance-hero-value { font-size: 28px; font-weight: 900; letter-spacing: -0.03em; color: var(--text); }

.section-mini-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-light);
  margin-bottom: 10px;
}
.transactions-list { display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow-y: auto; }
.transaction-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  gap: 12px;
}
.transaction-row.charge  { background: #fef9f9; border: 1px solid #fecaca; }
.transaction-row.payment { background: #f0fdf4; border: 1px solid #bbf7d0; }
.transaction-info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.transaction-icon { font-size: 16px; flex-shrink: 0; }
.transaction-desc { font-size: 13.5px; font-weight: 500; color: var(--text); }
.transaction-meta { font-size: 11.5px; color: var(--text-light); margin-top: 1px; }
.transaction-amount { font-size: 14px; font-weight: 800; flex-shrink: 0; }
.transaction-amount.charge  { color: #dc2626; }
.transaction-amount.payment { color: #16a34a; }

.transaction-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.tx-actions { display: flex; gap: 3px; }
.tx-action-btn {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  padding: 3px 6px;
  line-height: 1;
}
.tx-action-btn:hover { background: var(--surface-2); }
.tx-action-btn.danger:hover { background: #fef2f2; border-color: var(--danger); }
.edited-tag { font-size: 10px; color: var(--text-light); font-style: italic; margin-left: 4px; }
.settled-tag {
  font-size: 10px;
  color: var(--success);
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 1px 6px;
  border-radius: 8px;
  text-transform: uppercase;
  font-weight: 700;
}

.success { color: var(--success); }
.danger  { color: var(--danger); }
.fw-700  { font-weight: 700; }
.empty-icon { color: var(--text-light); margin-bottom: 12px; }
.input-error { border-color: var(--danger) !important; }

/* ── Mini-POS modal ── */
.modal-pos { max-width: 580px; }
.pos-body { display: flex; flex-direction: column; gap: 10px; }
.pos-search-row { display: flex; gap: 8px; }

.cat-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.cat-btn {
  padding: 5px 12px;
  border-radius: 20px;
  border: 1.5px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.cat-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #1a0a00;
  font-weight: 700;
}
.pos-products-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
  max-height: 200px;
  overflow-y: auto;
}
.product-btn {
  position: relative;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 8px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.product-btn:hover { border-color: var(--accent); background: rgba(245,158,11,0.05); }
.product-btn.in-cart { border-color: var(--accent); background: rgba(245,158,11,0.1); }
.product-btn:disabled { cursor: not-allowed; }
.product-btn.out-of-stock { opacity: 0.6; border-color: var(--danger); }
.product-btn.out-of-stock .product-name { text-decoration: line-through; color: var(--text-light); }
.stock-badge {
  position: absolute;
  top: 5px; right: 5px;
  background: var(--danger);
  color: white;
  font-size: 8.5px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 8px;
  text-transform: uppercase;
}
.product-name { font-size: 12.5px; font-weight: 600; color: var(--text); line-height: 1.3; }
.product-price { font-size: 11.5px; color: var(--text-light); }
.in-cart-badge {
  position: absolute;
  top: 5px; right: 5px;
  background: var(--accent);
  color: #1a0a00;
  font-size: 10px;
  font-weight: 800;
  width: 18px; height: 18px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.pos-empty { grid-column: 1/-1; text-align: center; color: var(--text-light); font-size: 13px; padding: 20px 0; }

.pos-cart { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; }
.pos-cart-empty { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); }
.cart-items { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.cart-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.item-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.item-name { font-size: 13px; font-weight: 600; }
.item-unit-price { font-size: 11px; color: var(--text-light); }
.item-controls { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
.qty-btn {
  width: 24px; height: 24px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  color: var(--text);
}
.qty-btn:hover { background: var(--accent); border-color: var(--accent); color: #1a0a00; }
.qty-value { font-size: 13px; font-weight: 700; min-width: 20px; text-align: center; }
.item-total { font-size: 13px; font-weight: 700; min-width: 56px; text-align: right; }
.remove-btn {
  width: 20px; height: 20px;
  border: none; background: none;
  color: var(--text-light);
  cursor: pointer; font-size: 16px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px;
}
.remove-btn:hover { background: #fef2f2; color: var(--danger); }
.cart-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1.5px solid var(--border);
  margin-top: 4px;
}
.cart-total-value { font-size: 18px; font-weight: 900; color: var(--danger); letter-spacing: -0.02em; }

.mt-2 { margin-top: 8px; }
.mb-2 { margin-bottom: 8px; }
.error-hint { font-size: 12.5px; color: var(--danger); margin-top: 4px; }

.mt-4 { margin-top: 20px; }
.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  gap: 12px;
  flex-wrap: wrap;
}
.history-title { font-size: 15px; font-weight: 700; color: var(--text); margin: 0; }
.payment-amount { color: var(--success); font-weight: 700; }

@media (max-width: 768px) {
  .summary-cards { grid-template-columns: 1fr 1fr; }
  .pos-products-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 480px) {
  .summary-cards { grid-template-columns: 1fr; }
  .pos-products-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
