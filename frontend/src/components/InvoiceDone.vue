<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal invoice-modal">
      <div class="modal-header">
        <div class="id-title"><span>✅</span><h3 class="modal-title">¡Factura creada!</h3></div>
        <button class="btn-close" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <div class="id-box">
          <div class="id-biz">
            <strong>{{ business?.name || 'Mi Negocio' }}</strong>
            <span v-if="business?.nit">NIT: {{ business.nit }}</span>
            <span v-if="business?.address">{{ business.address }}</span>
            <span v-if="business?.phone">Tel: {{ business.phone }}</span>
          </div>
          <div class="id-meta">
            <div><b>Factura #:</b> {{ sale.invoiceNumber }}</div>
            <div><b>Fecha:</b> {{ new Date(sale.createdAt).toLocaleString('es-CO') }}</div>
            <div v-if="sale.client"><b>Cliente:</b> {{ sale.client }}</div>
            <div><b>Pago:</b> {{ paymentLabel(sale.paymentMethod) }}</div>
          </div>
          <div class="id-items">
            <div v-for="(i, k) in sale.items" :key="k" class="id-item">
              <span>{{ i.qty }} × {{ i.name }}</span><b>{{ money(i.qty * i.price) }}</b>
            </div>
          </div>
          <div class="id-total"><span>TOTAL</span><b>{{ money(sale.total) }}</b></div>
        </div>

        <!-- WhatsApp: ya viene con el celular del cliente -->
        <div v-if="showWa" class="id-wa">
          <span>+57</span>
          <input v-model="waPhone" class="form-control" type="tel" maxlength="10" placeholder="3001234567" @keyup.enter="sendWhatsApp" />
          <button class="btn btn-success" @click="sendWhatsApp">Enviar</button>
          <button class="btn btn-outline" @click="showWa = false">✕</button>
        </div>
      </div>

      <div class="modal-footer id-footer">
        <button class="btn btn-outline" @click="$emit('close')">Cerrar</button>
        <button class="btn btn-whatsapp" @click="showWa = !showWa">📲 WhatsApp</button>
        <button v-if="canShare" class="btn btn-outline" @click="share">📤 Compartir</button>
        <a href="#" class="btn btn-primary" @click.prevent="openProtected(`/api/${bizId}/invoices/${sale.id}/pdf`).catch(() => toast('No se pudo abrir el PDF', 'error'))">📄 PDF</a>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * InvoiceDone.vue — "Factura creada": la misma salida que al facturar una venta normal
 * (enviar por WhatsApp con enlace corto, compartir y abrir el PDF), usada al facturar un pedido en línea.
 * El celular del cliente ya viene escrito.
 */
import { ref, computed, onMounted, inject } from 'vue'
import api from '../services/api.js'
import { useAuthStore } from '../stores/auth.js'
import { useBusinessStore } from '../stores/business.js'
import { paymentLabel } from '../utils/payment.js'
import { openProtected } from '../utils/download.js'

const props = defineProps({ sale: { type: Object, required: true }, phone: { type: String, default: '' } })
defineEmits(['close'])

const auth = useAuthStore()
const toast = inject('toast', () => {})
const business = computed(() => useBusinessStore().profile)
const bizId = computed(() => auth.currentBusiness?.id)
const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO')
const canShare = computed(() => !!navigator.share)

const showWa = ref(false)
const waPhone = ref(String(props.phone || '').replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '').slice(-10))
const shortlinkUrl = ref('')

// El enlace corto se prepara de antemano para que el botón de WhatsApp abra al instante (móvil)
onMounted(async () => {
  try { shortlinkUrl.value = (await api.post(`/api/${bizId.value}/invoices/${props.sale.id}/shortlink`)).data.url } catch { shortlinkUrl.value = '' }
})

function waText() {
  const s = props.sale
  const lines = [s.client ? `Hola ${s.client}! 👋` : 'Hola! 👋', '',
    `Gracias por tu pedido en *${business.value?.name || 'nuestro establecimiento'}*.`,
    `Tu factura *#${s.invoiceNumber}* por *${money(s.total)}* ya está lista.`, '']
  if (shortlinkUrl.value) lines.push('📄 Descarga tu factura en PDF aquí:', shortlinkUrl.value, '')
  lines.push('_Gracias por tu compra, te esperamos pronto!_ 🙌')
  return lines.join('\n')
}
function sendWhatsApp() {
  const digits = waPhone.value.replace(/\D/g, '')
  const url = `https://wa.me/${digits ? '57' + digits : ''}?text=${encodeURIComponent(waText())}`
  window.open(url, '_blank')
}
async function share() {
  if (!shortlinkUrl.value) return
  try { await navigator.share({ title: `Factura ${props.sale.invoiceNumber}`, url: shortlinkUrl.value }) } catch { /* canceló */ }
}
</script>

<style scoped>
.id-title { display: flex; align-items: center; gap: 8px; }
.id-box { border: 1px dashed var(--border); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; background: var(--surface-2); }
.id-biz { display: flex; flex-direction: column; align-items: center; font-size: 12px; color: var(--text-secondary); text-align: center; }
.id-biz strong { color: var(--text); font-size: 15px; }
.id-meta { font-size: 13px; display: flex; flex-direction: column; gap: 2px; }
.id-items { display: flex; flex-direction: column; gap: 4px; font-size: 13px; border-top: 1px dashed var(--border); padding-top: 8px; }
.id-item { display: flex; justify-content: space-between; gap: 10px; }
.id-total { display: flex; justify-content: space-between; font-size: 18px; border-top: 1px dashed var(--border); padding-top: 8px; }
.id-wa { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.id-wa input { flex: 1; min-width: 0; }
.id-footer { flex-wrap: wrap; }
</style>
