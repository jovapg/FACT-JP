<template>
  <div class="card dp mb-3">
    <div class="dp-head">
      <div>
        <h3>🛵 Bolsillo Domicilios</h3>
        <small>Entra el domicilio cobrado · sale el pago del domiciliario y la moto</small>
      </div>
      <input class="dp-date" type="date" v-model="day" @change="load" :max="today" />
    </div>

    <div v-if="d" class="dp-grid">
      <div class="dp-box in"><span>Ingresos del día</span><b>{{ money(d.ingresosDia) }}</b>
        <small>{{ d.domiciliosDia }} domicilio(s)<template v-if="d.gratisDia"> · {{ d.gratisDia }} gratis</template></small></div>
      <div class="dp-box out"><span>Salidas del día</span><b>{{ money(d.salidasDia) }}</b></div>
      <div :class="['dp-box', d.saldo < 0 ? 'neg' : 'ok']"><span>Saldo acumulado</span><b>{{ money(d.saldo) }}</b>
        <small v-if="d.saldo < 0">Negativo: hubo domicilios gratis o pagos mayores a lo cobrado</small>
        <small v-else>Lo que va quedando para la moto</small></div>
    </div>

    <div class="dp-actions">
      <button class="btn btn-primary btn-sm" @click="open('pago')">Pagar al domiciliario</button>
      <button class="btn btn-outline btn-sm" @click="open('moto')">Gasto de la moto</button>
    </div>

    <ul v-if="d && d.salidas.length" class="dp-list">
      <li v-for="s in d.salidas" :key="s.id">
        <span>{{ s.kind === 'moto' ? '🏍️ Moto' : '🛵 Domiciliario' }}<em v-if="s.note"> · {{ s.note }}</em>
          <em v-if="s.incentive"> · incluye incentivo {{ money(s.incentive) }}</em></span>
        <b>−{{ money(s.amount) }}</b>
        <button class="dp-del" title="Borrar" @click="remove(s)">✕</button>
      </li>
    </ul>

    <!-- Formulario -->
    <div v-if="form" class="dp-modal" @click.self="form = null">
      <form class="dp-form" @submit.prevent="save">
        <h3>{{ form.kind === 'pago' ? 'Pagar al domiciliario' : 'Gasto de la moto' }}</h3>
        <label>{{ form.kind === 'pago' ? 'Pago del día ($)' : 'Valor ($)' }}
          <input v-model.number="form.amount" type="number" min="0" step="500" required /></label>
        <label v-if="form.kind === 'pago'">Incentivo ($, opcional)
          <input v-model.number="form.incentive" type="number" min="0" step="500" /></label>
        <label>Nota <input v-model="form.note" maxlength="120" :placeholder="form.kind === 'pago' ? 'Ej: 18 domicilios' : 'Ej: gasolina, cambio de aceite'" /></label>
        <label>Se paga en
          <select v-model="form.bucket"><option value="efectivo">💵 Efectivo</option><option value="banco">🏦 Banco</option></select></label>
        <p v-if="form.kind === 'pago'" class="dp-total">Total a pagar: <b>{{ money((form.amount || 0) + (form.incentive || 0)) }}</b></p>
        <p v-if="err" class="dp-err">{{ err }}</p>
        <div class="dp-btns">
          <button type="button" class="btn btn-outline" @click="form = null">Cancelar</button>
          <button class="btn btn-primary" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
/**
 * DomiciliosPocket.vue — Bolsillo "Domicilios" dentro de Finanzas.
 * El valor del domicilio entra con cada venta (línea "Domicilio"); aquí se registran las salidas:
 * pago al domiciliario (con incentivo) y gastos de la moto. Esas salidas también bajan el dinero
 * en Finanzas (el servidor las suma a los movimientos), y por eso se avisa al padre con `changed`.
 */
import { ref, onMounted, inject } from 'vue'
import api from '../services/api.js'
import { useAuthStore } from '../stores/auth.js'

const emit = defineEmits(['changed'])
const auth = useAuthStore()
const toast = inject('toast', () => {})
const money = (n) => (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(Number(n) || 0)).toLocaleString('es-CO')

// Hoy en hora de Colombia (UTC-5), como lo calcula el servidor
const cotToday = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
const today = cotToday()
const day = ref(today)
const d = ref(null)
const form = ref(null)
const err = ref('')
const saving = ref(false)
const base = () => `/api/${auth.currentBusiness.id}/finance/domicilios`

async function load() {
  try { d.value = (await api.get(base(), { params: { date: day.value } })).data }
  catch { toast('No se pudo cargar el bolsillo de domicilios', 'error') }
}
function open(kind) { err.value = ''; form.value = { kind, amount: null, incentive: 0, note: '', bucket: 'efectivo' } }
async function save() {
  err.value = ''; saving.value = true
  try {
    await api.post(base(), form.value)
    form.value = null
    await load(); emit('changed'); toast('Salida registrada', 'success')
  } catch (e) { err.value = e.response?.data?.error || 'No se pudo guardar' }
  finally { saving.value = false }
}
async function remove(s) {
  if (!window.confirm('¿Borrar esta salida?')) return
  try { await api.delete(`${base()}/${s.id}`); await load(); emit('changed') }
  catch { toast('No se pudo borrar', 'error') }
}
onMounted(load)
</script>

<style scoped>
.dp-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.dp-head h3 { margin: 0; font-size: 16px; } .dp-head small { color: var(--text-secondary); }
.dp-date { padding: 6px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); }
.dp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 12px; }
.dp-box { border: 1px solid var(--border); border-radius: 12px; padding: 12px; background: var(--surface-2); display: flex; flex-direction: column; gap: 2px; }
.dp-box span { font-size: 12px; color: var(--text-secondary); } .dp-box b { font-size: 20px; } .dp-box small { font-size: 11px; color: var(--text-secondary); }
.dp-box.in b { color: var(--success); } .dp-box.out b { color: var(--danger); } .dp-box.neg b { color: var(--danger); }
.dp-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.dp-list { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.dp-list li { display: flex; align-items: center; gap: 10px; font-size: 14px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 10px; }
.dp-list li span { flex: 1; } .dp-list em { font-style: normal; color: var(--text-secondary); font-size: 12px; }
.dp-del { border: 0; background: none; color: var(--text-secondary); cursor: pointer; }
.dp-modal { position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; padding: 16px; }
.dp-form { width: 100%; max-width: 380px; background: var(--surface); color: var(--text); border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 10px; }
.dp-form h3 { margin: 0; }
.dp-form label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-secondary); }
.dp-form input, .dp-form select { padding: 9px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); font-size: 15px; }
.dp-total { margin: 0; font-size: 15px; } .dp-err { margin: 0; color: var(--danger); font-size: 13px; font-weight: 600; }
.dp-btns { display: flex; gap: 8px; justify-content: flex-end; }
</style>
