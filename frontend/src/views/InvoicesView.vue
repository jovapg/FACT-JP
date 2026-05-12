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
                    <span :class="['badge', payBadge(inv.paymentMethod)]">{{ inv.paymentMethod }}</span>
                  </td>
                  <td class="currency">{{ formatCOP(inv.total) }}</td>
                  <td>
                    <div class="action-btns">
                      <button class="btn btn-sm btn-outline" @click="viewInvoice(inv)">👁 Ver</button>
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
                <div class="inv-payment">Método: {{ selectedInvoice.paymentMethod }}</div>
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
import { ref, computed, onMounted } from 'vue'
import { useSalesStore } from '../stores/sales.js'
import { useAuthStore } from '../stores/auth.js'
import { useBusinessStore } from '../stores/business.js'
import PageLayout from '../components/PageLayout.vue'

const salesStore = useSalesStore()
const auth = useAuthStore()
const businessStore = useBusinessStore()

const invoices = ref([])             // Lista completa de facturas
const loading = ref(false)
const search = ref('')               // Texto de búsqueda
const selectedInvoice = ref(null)    // Factura abierta en el modal de detalle
const bizId = computed(() => auth.currentBusiness?.id)
const business = computed(() => businessStore.profile) // Para mostrar en el encabezado del modal
const token = computed(() => auth.token)               // Para los enlaces de PDF

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

/** Clase CSS del badge según método de pago */
function payBadge(m) {
  return { efectivo: 'badge-success', transferencia: 'badge-info', tarjeta: 'badge-warning' }[m] || 'badge-default'
}

/** Abre el modal de detalle para una factura */
function viewInvoice(inv) { selectedInvoice.value = inv }

// Al montar: cargar facturas (invertidas para mostrar la más reciente primero)
// y el perfil del negocio (para el encabezado del modal)
onMounted(async () => {
  loading.value = true
  try {
    const data = await salesStore.fetchInvoices()
    invoices.value = [...data].reverse()
    await businessStore.fetchProfile()
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
.inv-items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
.inv-items-table th, .inv-items-table td { padding: 6px 8px; border-bottom: 1px solid var(--border); font-size: 13px; }
.inv-items-table th { background: var(--bg); font-weight: 600; }
.inv-total { border-top: 2px solid var(--text); padding-top: 10px; text-align: right; }
.inv-subtotal { margin-bottom: 2px; }
.inv-iva { font-size: 11px; color: var(--text-light); margin-bottom: 6px; }
.inv-payment { margin-bottom: 6px; }
.inv-grand-total { font-size: 18px; font-weight: 800; }
</style>
