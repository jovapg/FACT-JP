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
            <div class="inv-item-wrap" v-for="item in editableItems" :key="item.recipeId">
              <div class="inv-item">
                <span class="item-name">
                  {{ item.name }}
                  <span :class="['area-tag', (item.area || 'bar')]">{{ (item.area || 'bar') === 'restaurante' ? '🍽️' : '🍺' }}</span>
                </span>
                <div class="item-qty-ctrl">
                  <button @click="decreaseQty(item)" class="qty-mini-btn">−</button>
                  <span>{{ item.qty }}</span>
                  <button @click="item.qty++" class="qty-mini-btn">+</button>
                </div>
                <span>{{ formatCOP(item.price) }}</span>
                <span class="item-line-total">{{ formatCOP(item.qty * item.price) }}</span>
                <button class="remove-mini-btn" @click="removeItem(item)">×</button>
              </div>
              <!-- Descuento por producto: botón que abre un campo de valor -->
              <div class="inv-item-disc">
                <button
                  v-if="!item._showDisc && !(item.discount > 0)"
                  class="disc-add-btn"
                  @click="item._showDisc = true"
                >🏷️ Agregar descuento</button>
                <div v-else class="disc-input-row">
                  <span class="disc-label">Descuento:</span>
                  <input
                    v-model.number="item.discount"
                    type="number"
                    min="0"
                    :max="item.qty * item.price"
                    class="disc-input"
                    placeholder="0"
                  />
                  <span class="disc-applied">− {{ formatCOP(item.discount || 0) }}</span>
                  <button class="disc-remove" @click="item.discount = 0; item._showDisc = false" title="Quitar descuento">×</button>
                </div>
              </div>
            </div>
          </div>

          <div class="inv-divider">- - - - - - - - - - - - - - -</div>

          <div class="inv-subtotal">
            <span>Subtotal:</span>
            <span>{{ formatCOP(invoiceTotal) }}</span>
          </div>
          <div class="inv-discount-row" v-if="totalDiscount > 0">
            <span>Descuentos:</span>
            <span class="discount-amount">- {{ formatCOP(totalDiscount) }}</span>
          </div>
          <div class="inv-iva-note">(Precios incluyen IVA)</div>

          <div class="inv-divider">- - - - - - - - - - - - - - -</div>

          <div class="inv-total-row">
            <span>TOTAL:</span>
            <span class="inv-total-amount">{{ formatCOP(finalTotal) }}</span>
          </div>
        </div>

        <!-- Client name -->
        <div class="extra-fields">
          <div class="form-group">
            <label class="form-label">👤 Nombre del cliente (opcional)</label>
            <input v-model="clientName" class="form-control" placeholder="Ej: Juan García" />
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
          <!-- Botón QR para transferencia: el cliente escanea para pagar -->
          <button
            v-if="selectedPayment === 'transferencia' && business?.paymentQr"
            class="btn btn-qr"
            @click="showQrModal = true"
            type="button"
          >
            📲 Abrir QR para que el cliente pague
          </button>
          <p v-else-if="selectedPayment === 'transferencia' && !business?.paymentQr" class="text-muted" style="font-size:12px;margin-top:8px">
            ⓘ Sube tu QR en Configuración para usar este flujo
          </p>

          <!-- Ayuda de cambio (solo efectivo) — no se guarda, es para el cajero -->
          <div v-if="selectedPayment === 'efectivo'" class="cash-helper">
            <div class="cash-field">
              <label class="form-label">💵 Dinero recibido</label>
              <input v-model.number="cashReceived" type="number" min="0" class="form-control" placeholder="0" />
            </div>
            <div class="change-row" :class="{ negative: change < 0, ready: cashReceived > 0 && change >= 0 }">
              <span>Devuelta para el cliente:</span>
              <span class="change-amount">
                {{ !cashReceived ? '—' : (change >= 0 ? formatCOP(change) : 'Faltan ' + formatCOP(-change)) }}
              </span>
            </div>
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
              <div><strong>Pago:</strong> {{ paymentLabel(confirmedSale.paymentMethod) }}</div>
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

        <!-- WhatsApp phone input -->
        <div class="wa-input-row" v-if="showWaInput">
          <span class="wa-prefix">+57</span>
          <input
            v-model="waPhone"
            class="form-control wa-input"
            placeholder="3001234567"
            type="tel"
            maxlength="10"
            @keyup.enter="sendWhatsApp"
            ref="waInputRef"
          />
          <button class="btn btn-success" @click="sendWhatsApp">Enviar</button>
          <button class="btn btn-outline" @click="showWaInput = false; waPhone = ''">✕</button>
        </div>

        <div class="modal-footer confirmed-footer">
          <button class="btn btn-outline" @click="closeSuccess">Cerrar</button>
          <button class="btn btn-whatsapp" @click="toggleWaInput">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </button>
          <button v-if="canShare" class="btn btn-outline" @click="sharePdf">
            📤 Compartir
          </button>
          <a
            :href="`/api/${bizId}/invoices/${confirmedSale.id}/pdf?token=${token}`"
            target="_blank"
            class="btn btn-primary"
          >
            📄 PDF
          </a>
        </div>
      </div>
    </div>

    <!-- QR modal: imagen grande para que el cliente escanee -->
    <div class="qr-modal-overlay" v-if="showQrModal" @click.self="showQrModal = false">
      <div class="qr-modal">
        <button class="qr-close" @click="showQrModal = false">✕ Cerrar</button>
        <p class="qr-title">Escanea para pagar</p>
        <img :src="business.paymentQr" alt="QR de pago" class="qr-modal-img" />
        <p class="qr-amount">Total: {{ formatCOP(finalTotal) }}</p>
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
import { ref, computed, onMounted, nextTick, inject } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useBusinessStore } from '../stores/business.js'
import { useTablesStore } from '../stores/tables.js'
import { useSalesStore } from '../stores/sales.js'
import api from '../services/api.js'
import { paymentLabel } from '../utils/payment.js'

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
const showQrModal = ref(false)
const clientName = ref('')
const cashReceived = ref(null)   // Ayuda de cambio en efectivo (no se guarda)
const confirming = ref(false)
const confirmedSale = ref(null)
const shortlinkUrl = ref('')   // URL corta pre-generada para compartir
const showWaInput = ref(false)
const waPhone = ref('')
const waInputRef = ref(null)

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
// Suma de los descuentos puestos producto por producto
const totalDiscount = computed(() =>
  editableItems.value.reduce((sum, item) => sum + (Number(item.discount) || 0), 0)
)
const finalTotal = computed(() => Math.max(0, invoiceTotal.value - totalDiscount.value))
// Devuelta = dinero recibido − total (solo ayuda visual para el cajero)
const change = computed(() => (Number(cashReceived.value) || 0) - finalTotal.value)

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
      // Cada ítem viaja con su bolsillo (area) y su descuento individual
      items: editableItems.value.map(i => ({
        ...i,
        discount: Number(i.discount) || 0,
        area: i.area || 'bar'
      })),
      paymentMethod: selectedPayment.value,
      cashier: auth.user?.name || auth.user?.username,
      client: clientName.value || '',
      discount: totalDiscount.value,
      total: finalTotal.value
    })

    if (result.inventoryAlerts?.length > 0) {
      toast(`⚠️ ${result.inventoryAlerts.length} productos con stock bajo`, 'warning')
    }

    confirmedSale.value = result.sale
    // Pre-generar shortlink para que sendWhatsApp sea sincrónico (evita bloqueo en móvil)
    try {
      const sl = await api.post(`/api/${bizId.value}/invoices/${result.sale.id}/shortlink`)
      shortlinkUrl.value = sl.data.url
    } catch {
      shortlinkUrl.value = ''
    }
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

async function toggleWaInput() {
  showWaInput.value = !showWaInput.value
  if (showWaInput.value) {
    await nextTick()
    waInputRef.value?.focus()
  }
}

function buildWaText(sale, pdfUrl) {
  const bizName = business.value?.name || 'nuestro establecimiento'
  const greeting = sale.client ? `Hola ${sale.client}! 👋` : 'Hola! 👋'
  const lines = []
  lines.push(greeting)
  lines.push('')
  lines.push(`Acabas de realizar una compra en *${bizName}*.`)
  lines.push(`Tu factura *#${sale.invoiceNumber}* por *${formatCOP(sale.total)}* ya está lista.`)
  lines.push('')
  lines.push(`📄 Descarga tu factura en PDF aquí:`)
  lines.push(pdfUrl)
  lines.push('')
  lines.push(`_Gracias por tu visita, te esperamos pronto!_ 🙌`)
  return lines.join('\n')
}

// Sincrónico — la URL ya fue pre-generada en confirmSale, así window.open
// se llama directamente desde el gesto del usuario (funciona en móvil).
function sendWhatsApp() {
  const pdfUrl = shortlinkUrl.value ||
    `${window.location.origin}/api/${bizId.value}/invoices/${confirmedSale.value.id}/pdf?token=${token.value}`
  const text = encodeURIComponent(buildWaText(confirmedSale.value, pdfUrl))
  const digits = waPhone.value.replace(/\D/g, '')
  const number = digits ? `57${digits}` : ''
  const waUrl = number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`
  window.open(waUrl, '_blank')
  showWaInput.value = false
  waPhone.value = ''
}

async function sharePdf() {
  const url = shortlinkUrl.value ||
    `${window.location.origin}/api/${bizId.value}/invoices/${confirmedSale.value.id}/pdf?token=${token.value}`
  try {
    await navigator.share({ title: `Factura ${confirmedSale.value.invoiceNumber}`, url })
  } catch {
    // user cancelled share
  }
}

onMounted(async () => {
  // Cada ítem editable arranca con descuento 0 y su bolsillo (area) preservado
  editableItems.value = props.items.map(i => ({
    ...i,
    discount: Number(i.discount) || 0,
    area: i.area || 'bar',
    _showDisc: false
  }))
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
  color: #1a1a1a;
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

/* ── Descuento por producto ───────────────────────────────────── */
.inv-item-wrap { border-bottom: 1px dotted var(--border); padding: 4px 0; }
.inv-item-wrap:last-child { border-bottom: none; }
.area-tag { font-size: 10px; }
.inv-item-disc { padding: 2px 0 4px; }
.disc-add-btn {
  background: none;
  border: 1px dashed var(--accent);
  color: var(--accent);
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
}
.disc-add-btn:hover { background: var(--accent-light); }
.disc-input-row { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.disc-label { color: var(--text-light); }
.disc-input {
  width: 90px;
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 12px;
}
.disc-applied { color: var(--danger); font-weight: 700; }
.disc-remove {
  background: none;
  border: none;
  color: var(--danger);
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  padding: 0 2px;
}
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
  background: var(--surface);
  color: var(--text);
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

/* Ayuda de cambio en efectivo */
.cash-helper {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-2);
}
.cash-field .form-label { font-size: 13px; font-weight: 600; margin-bottom: 4px; display: block; }
.change-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
  font-size: 14px;
  font-weight: 600;
}
.change-amount { font-size: 20px; font-weight: 800; color: var(--text-light); }
.change-row.ready .change-amount { color: var(--success); }
.change-row.negative .change-amount { color: var(--danger); font-size: 15px; }

.btn-qr {
  margin-top: 12px;
  width: 100%;
  padding: 12px 16px;
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  transition: transform 0.15s, box-shadow 0.15s;
}
.btn-qr:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4); }

/* QR fullscreen modal */
.qr-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}
.qr-modal {
  background: white;
  border-radius: 16px;
  padding: 28px 24px;
  max-width: 480px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  position: relative;
}
.qr-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: var(--danger);
  color: white;
  border: none;
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.qr-close:hover { background: #b91c1c; }
.qr-title { font-size: 20px; font-weight: 700; color: var(--text); margin: 8px 0 0; }
.qr-modal-img {
  max-width: 380px;
  width: 100%;
  height: auto;
  border-radius: 8px;
}
.qr-amount {
  font-size: 22px;
  font-weight: 800;
  color: var(--success);
  margin: 0;
}

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
.confirmed-footer { gap: 8px; flex-wrap: wrap; }

.btn-whatsapp {
  background: #25D366;
  color: white;
  border: none;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}
.btn-whatsapp:hover { background: #1ebe5d; }

.wa-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--surface-2);
  border-top: 1px solid var(--border);
}
.wa-prefix {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}
.wa-input {
  flex: 1;
  min-width: 0;
}

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
