<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal invoice-modal">
      <div class="modal-header">
        <h3 class="modal-title">🧾 Previsualizar Factura</h3>
        <button class="btn-close" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <!-- Invoice preview -->
        <div class="invoice-preview">
          <div class="inv-biz">
            <strong>{{ business?.name || 'Mi Negocio' }}</strong>
            <span v-if="business?.nit">NIT: {{ business.nit }}</span>
            <span v-if="business?.address">{{ business.address }}</span>
            <span v-if="business?.city">{{ business.city }}</span>
            <span v-if="business?.phone">Tel: {{ business.phone }}</span>
          </div>

          <div class="inv-divider">- - - - - - - - - - - - - - -</div>

          <div class="inv-meta">
            <div><strong>Mesa:</strong> {{ table.number }}</div>
            <div><strong>Cajero:</strong> {{ auth.user?.name || auth.user?.username }}</div>
            <div><strong>Fecha:</strong> {{ formatDate(new Date()) }}</div>
          </div>

          <div class="inv-divider">- - - - - - - - - - - - - - -</div>

          <!-- Editable items -->
          <div class="inv-items">
            <div class="inv-items-header">
              <span>Producto</span>
              <span>Cant</span>
              <span>Precio</span>
              <span>Total</span>
              <span></span>
            </div>
            <div class="inv-item" v-for="item in editableItems" :key="item.recipeId">
              <span class="item-name">{{ item.name }}</span>
              <div class="item-qty-ctrl">
                <button @click="decreaseQty(item)" class="qty-mini-btn">−</button>
                <span>{{ item.qty }}</span>
                <button @click="item.qty++" class="qty-mini-btn">+</button>
              </div>
              <span>{{ formatCOP(item.price) }}</span>
              <span class="item-line-total">{{ formatCOP(item.qty * item.price) }}</span>
              <button class="remove-mini-btn" @click="removeItem(item)">×</button>
            </div>
          </div>

          <div class="inv-divider">- - - - - - - - - - - - - - -</div>

          <div class="inv-subtotal">
            <span>Subtotal:</span>
            <span>{{ formatCOP(invoiceTotal) }}</span>
          </div>
          <div class="inv-discount-row" v-if="discount > 0">
            <span>Descuento:</span>
            <span class="discount-amount">- {{ formatCOP(discount) }}</span>
          </div>
          <div class="inv-iva-note">(Precios incluyen IVA)</div>

          <div class="inv-divider">- - - - - - - - - - - - - - -</div>

          <div class="inv-total-row">
            <span>TOTAL:</span>
            <span class="inv-total-amount">{{ formatCOP(finalTotal) }}</span>
          </div>
        </div>

        <!-- Client name + Discount -->
        <div class="extra-fields">
          <div class="form-group">
            <label class="form-label">👤 Nombre del cliente (opcional)</label>
            <input v-model="clientName" class="form-control" placeholder="Ej: Juan García" />
          </div>
          <div class="form-group">
            <label class="form-label">🏷️ Descuento (COP)</label>
            <input v-model.number="discount" type="number" min="0" :max="invoiceTotal" class="form-control" placeholder="0" />
          </div>
        </div>

        <!-- Payment method -->
        <div class="payment-section">
          <h4 class="payment-title">Método de pago</h4>
          <div class="payment-options">
            <button
              v-for="method in paymentMethods"
              :key="method.value"
              :class="['payment-opt', { active: selectedPayment === method.value }]"
              @click="selectedPayment = method.value"
            >
              {{ method.icon }} {{ method.label }}
            </button>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-outline" @click="$emit('close')">Cancelar</button>
        <button
          class="btn btn-success btn-lg"
          @click="confirmSale"
          :disabled="confirming || editableItems.length === 0"
        >
          {{ confirming ? 'Procesando...' : '✅ Confirmar y Facturar' }}
        </button>
      </div>
    </div>

    <!-- Confirmed invoice modal -->
    <div class="modal-overlay" v-if="confirmedSale" @click.self="closeSuccess">
      <div class="modal invoice-modal">
        <div class="modal-header confirmed-header">
          <div class="confirmed-title">
            <span class="confirmed-check">✅</span>
            <h3>¡Venta confirmada!</h3>
          </div>
          <button class="btn-close" @click="closeSuccess">×</button>
        </div>

        <div class="modal-body">
          <div class="invoice-preview">
            <!-- Business header -->
            <div class="inv-biz">
              <strong>{{ business?.name || 'Mi Negocio' }}</strong>
              <span v-if="business?.nit">NIT: {{ business.nit }}</span>
              <span v-if="business?.address">{{ business.address }}</span>
              <span v-if="business?.city">{{ business.city }}</span>
              <span v-if="business?.phone">Tel: {{ business.phone }}</span>
            </div>

            <div class="inv-divider">- - - - - - - - - - - - - - -</div>

            <div class="inv-meta">
              <div><strong>Factura #:</strong> {{ confirmedSale.invoiceNumber }}</div>
              <div><strong>Fecha:</strong> {{ formatDate(new Date(confirmedSale.createdAt)) }}</div>
              <div><strong>Cajero:</strong> {{ confirmedSale.cashier }}</div>
              <div v-if="confirmedSale.client"><strong>Cliente:</strong> {{ confirmedSale.client }}</div>
              <div v-if="confirmedSale.tableNumber"><strong>Mesa:</strong> {{ confirmedSale.tableNumber }}</div>
              <div><strong>Pago:</strong> {{ confirmedSale.paymentMethod }}</div>
            </div>

            <div class="inv-divider">- - - - - - - - - - - - - - -</div>

            <div class="inv-items">
              <div class="inv-items-header">
                <span>Producto</span>
                <span>Cant</span>
                <span>Precio</span>
                <span>Total</span>
              </div>
              <div class="inv-item-readonly" v-for="item in confirmedSale.items" :key="item.recipeId">
                <span class="item-name">{{ item.name }}</span>
                <span style="text-align:center">{{ item.qty }}</span>
                <span>{{ formatCOP(item.price) }}</span>
                <span class="item-line-total">{{ formatCOP(item.qty * item.price) }}</span>
              </div>
            </div>

            <div class="inv-divider">- - - - - - - - - - - - - - -</div>

            <div class="inv-subtotal">
              <span>Subtotal:</span>
              <span>{{ formatCOP(confirmedSale.subtotal || confirmedSale.total) }}</span>
            </div>
            <div class="inv-discount-row" v-if="confirmedSale.discount > 0">
              <span>Descuento:</span>
              <span class="discount-amount">- {{ formatCOP(confirmedSale.discount) }}</span>
            </div>
            <div class="inv-iva-note">(Precios incluyen IVA)</div>

            <div class="inv-divider">- - - - - - - - - - - - - - -</div>

            <div class="inv-total-row">
              <span>TOTAL:</span>
              <span class="inv-total-amount">{{ formatCOP(confirmedSale.total) }}</span>
            </div>

            <div class="inv-thanks">¡Gracias por su visita!</div>
          </div>
        </div>

        <div class="modal-footer confirmed-footer">
          <button class="btn btn-outline" @click="closeSuccess">Cerrar</button>
          <button v-if="canShare" class="btn btn-outline" @click="sharePdf">
            📤 Compartir
          </button>
          <a
            :href="`/api/${bizId}/invoices/${confirmedSale.id}/pdf?token=${token}`"
            target="_blank"
            class="btn btn-primary"
          >
            📄 Descargar PDF
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * InvoicePreview.vue — Vista previa y confirmación de factura
 *
 * Componente modal que se muestra antes de confirmar una venta.
 * Flujo de dos pasos:
 *
 * PASO 1 — Vista previa (antes de facturar):
 *   - Muestra el desglose completo del pedido (ítems, precios, totales)
 *   - Permite editar el nombre del cliente
 *   - Permite aplicar un descuento en pesos
 *   - Muestra el total final calculado en tiempo real
 *   - Botón "Confirmar y Facturar" para crear la venta
 *
 * PASO 2 — Confirmación (después de facturar):
 *   - Muestra la factura generada en formato de ticket
 *   - Incluye número de factura, fecha, ítems, descuento y total
 *   - Botones para ver el PDF completo o cerrar
 *   - Al cerrar emite 'confirmed' al padre (OrderCart) para liberar la mesa
 *
 * Props:
 *   table:         Object  — Mesa de la cual viene el pedido
 *   initialClient: string  — Nombre del cliente pre-cargado desde OrderCart
 *
 * Emits:
 *   confirmed — cuando el usuario cierra la confirmación (la factura ya fue creada)
 */
import { ref, computed, onMounted, inject } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useBusinessStore } from '../stores/business.js'
import { useTablesStore } from '../stores/tables.js'
import { useSalesStore } from '../stores/sales.js'

const props = defineProps({
  table: { type: Object, required: true },
  items: { type: Array, required: true },
  initialClient: { type: String, default: '' }
})

const emit = defineEmits(['close', 'confirmed'])

const auth = useAuthStore()
const businessStore = useBusinessStore()
const tablesStore = useTablesStore()
const salesStore = useSalesStore()
const toast = inject('toast')

const editableItems = ref([])
const selectedPayment = ref('efectivo')
const clientName = ref('')
const discount = ref(0)
const confirming = ref(false)
const confirmedSale = ref(null)

const business = computed(() => businessStore.profile)
const bizId = computed(() => auth.currentBusiness?.id)
const token = computed(() => auth.token)
const canShare = computed(() => !!navigator.share)

const paymentMethods = [
  { value: 'efectivo', label: 'Efectivo', icon: '💵' },
  { value: 'transferencia', label: 'Transferencia', icon: '📲' },
  { value: 'tarjeta', label: 'Tarjeta', icon: '💳' }
]

const invoiceTotal = computed(() =>
  editableItems.value.reduce((sum, item) => sum + item.qty * item.price, 0)
)
const finalTotal = computed(() => Math.max(0, invoiceTotal.value - (discount.value || 0)))

function formatCOP(v) {
  return '$' + Number(v || 0).toLocaleString('es-CO')
}

function formatDate(d) {
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function decreaseQty(item) {
  if (item.qty > 1) item.qty--
  else removeItem(item)
}

function removeItem(item) {
  const idx = editableItems.value.findIndex(i => i.recipeId === item.recipeId)
  if (idx !== -1) editableItems.value.splice(idx, 1)
}

async function confirmSale() {
  if (editableItems.value.length === 0) return
  confirming.value = true
  try {
    const result = await salesStore.createSale({
      tableId: props.table.id,
      tableNumber: props.table.number,
      items: editableItems.value,
      paymentMethod: selectedPayment.value,
      cashier: auth.user?.name || auth.user?.username,
      client: clientName.value || '',
      discount: discount.value || 0,
      total: finalTotal.value
    })

    if (result.inventoryAlerts?.length > 0) {
      toast(`⚠️ ${result.inventoryAlerts.length} productos con stock bajo`, 'warning')
    }

    confirmedSale.value = result.sale
    // Don't emit 'confirmed' yet — wait for user to close the invoice modal
  } catch (err) {
    toast(err.response?.data?.error || 'Error al confirmar venta', 'error')
  } finally {
    confirming.value = false
  }
}

function closeSuccess() {
  const sale = confirmedSale.value
  confirmedSale.value = null
  emit('confirmed', sale)
  emit('close')
}

async function sharePdf() {
  const url = `${window.location.origin}/api/${bizId.value}/invoices/${confirmedSale.value.id}/pdf?token=${token.value}`
  try {
    await navigator.share({ title: `Factura ${confirmedSale.value.invoiceNumber}`, url })
  } catch {
    // user cancelled share
  }
}

onMounted(async () => {
  editableItems.value = props.items.map(i => ({ ...i }))
  clientName.value = props.initialClient || ''
  if (!businessStore.profile) await businessStore.fetchProfile()
})
</script>

<style scoped>
.invoice-modal {
  max-width: 520px;
  max-height: 95vh;
}

.invoice-preview {
  background: #fafafa;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  margin-bottom: 16px;
}

.inv-biz {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
  font-size: 12px;
}
.inv-biz strong { font-size: 15px; }

.inv-divider { color: var(--text-light); font-size: 11px; margin: 6px 0; text-align: center; }

.inv-meta { font-size: 12px; display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }

.inv-items-header {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 20px;
  gap: 4px;
  font-weight: 700;
  font-size: 11px;
  color: var(--text-light);
  padding-bottom: 4px;
  border-bottom: 1px dashed var(--border);
  margin-bottom: 4px;
}

.inv-item {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 20px;
  gap: 4px;
  align-items: center;
  padding: 3px 0;
  font-size: 12px;
}

.item-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.item-qty-ctrl {
  display: flex;
  align-items: center;
  gap: 3px;
}
.qty-mini-btn {
  width: 18px;
  height: 18px;
  border: none;
  background: var(--border);
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.qty-mini-btn:hover { background: var(--accent); color: white; }

.item-line-total { font-weight: 700; }
.remove-mini-btn {
  background: none;
  border: none;
  color: var(--danger);
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  line-height: 1;
}

.inv-subtotal {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-top: 6px;
}
.inv-discount-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-top: 4px;
}
.discount-amount { color: var(--danger); font-weight: 700; }
.inv-iva-note { font-size: 10px; color: var(--text-light); text-align: center; }

.extra-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}
@media (max-width: 480px) {
  .extra-fields { grid-template-columns: 1fr; }
}

.inv-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
  font-weight: 800;
  font-size: 15px;
}
.inv-total-amount { font-size: 20px; color: var(--success); }

/* Payment */
.payment-section {}
.payment-title { font-size: 14px; font-weight: 700; margin-bottom: 10px; }
.payment-options { display: flex; gap: 10px; }
.payment-opt {
  flex: 1;
  padding: 12px 8px;
  border: 2px solid var(--border);
  border-radius: 10px;
  background: white;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.payment-opt:hover { border-color: var(--accent); }
.payment-opt.active { border-color: var(--success); background: #f0fff4; color: var(--success); }

/* Confirmed invoice */
.confirmed-header {
  background: #f0fff4;
  border-bottom: 2px solid var(--success);
}
.confirmed-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.confirmed-check { font-size: 22px; }
.confirmed-title h3 { font-size: 18px; font-weight: 800; color: var(--success); }
.confirmed-footer { gap: 8px; }

.inv-item-readonly {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 4px;
  align-items: center;
  padding: 4px 0;
  font-size: 12px;
  border-bottom: 1px dotted var(--border);
}
.inv-item-readonly:last-child { border-bottom: none; }

.inv-thanks {
  text-align: center;
  font-size: 11px;
  color: var(--text-light);
  margin-top: 10px;
  font-style: italic;
}
</style>
