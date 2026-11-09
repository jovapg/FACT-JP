<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal" style="max-width:780px">
      <div class="modal-header">
        <h3 class="modal-title">Importar lista de productos</h3>
        <button class="btn-icon" @click="$emit('close')" aria-label="Cerrar">✕</button>
      </div>

      <div class="modal-body">
        <template v-if="!result">
          <p class="imp-hint">
            Pega la lista (copiada desde Excel). Columnas: <b>Nombre</b>, <b>Categoría</b>, <b>Precio de venta</b>
            (opcionales: Costo, Stock, Unidad, Área). Si no trae encabezados, el orden es nombre, categoría, precio.
          </p>
          <textarea v-model="text" class="form-control imp-text" rows="9" placeholder="Nombre&#9;Categoría&#9;Precio&#10;Pastel de pollo&#9;Fritos&#9;4500" @input="plan = null"></textarea>

          <div class="imp-opts">
            <label class="imp-opt">
              <span>Control de stock de los nuevos</span>
              <select v-model="control" class="form-control" @change="plan = null">
                <option value="con">Con control (stock 0 = agotado hasta cargar stock)</option>
                <option value="sin">Sin control (siempre disponibles)</option>
              </select>
            </label>
            <label class="imp-check"><input type="checkbox" v-model="updatePrices" @change="plan = null" /> Actualizar el precio de los que ya existen</label>
          </div>

          <div v-if="plan" class="imp-plan">
            <div class="imp-counts">
              <span class="c-new">{{ plan.counts.nuevo }} nuevos</span>
              <span v-if="plan.counts.actualiza" class="c-upd">{{ plan.counts.actualiza }} con precio nuevo</span>
              <span v-if="plan.counts.existe" class="c-dup">{{ plan.counts.existe }} ya existen (se saltan)</span>
              <span v-if="plan.counts.duplicado" class="c-dup">{{ plan.counts.duplicado }} repetidos en la lista</span>
              <span v-if="plan.counts.error" class="c-err">{{ plan.counts.error }} con error</span>
            </div>
            <div v-if="control === 'con' && plan.counts.nuevo" class="imp-warn">⚠️ Los nuevos quedarán con stock 0, o sea <b>agotados</b>, hasta que cargues stock (o marques “no controlar stock”).</div>
            <div class="imp-table">
              <table class="table">
                <thead><tr><th>#</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Estado</th></tr></thead>
                <tbody>
                  <tr v-for="r in shown" :key="r.line + r.name" :class="'st-' + r.status">
                    <td>{{ r.line }}</td><td>{{ r.name }}</td><td>{{ r.category }}</td><td>{{ r.salePrice != null ? money(r.salePrice) : '' }}</td>
                    <td>{{ label[r.status] }}<small v-if="r.message"> · {{ r.message }}</small></td>
                  </tr>
                </tbody>
              </table>
              <p v-if="plan.rows.length > shown.length" class="imp-hint">Se muestran las primeras {{ shown.length }} de {{ plan.rows.length }}. Los errores salen primero.</p>
            </div>
          </div>
        </template>

        <div v-else class="imp-done">
          <h4>✅ Listo</h4>
          <p><b>{{ result.created }}</b> productos creados<template v-if="result.updated">, <b>{{ result.updated }}</b> con precio actualizado</template>.
            <template v-if="result.counts.existe"> {{ result.counts.existe }} ya existían.</template>
            <template v-if="result.counts.error"> {{ result.counts.error }} traían error y no se cargaron.</template></p>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-outline" @click="$emit('close')">{{ result ? 'Cerrar' : 'Cancelar' }}</button>
        <template v-if="!result">
          <button class="btn btn-outline" :disabled="!!busy || !text.trim()" @click="review">{{ busy === 'review' ? 'Revisando…' : 'Revisar' }}</button>
          <button class="btn btn-primary" :disabled="!!busy || !plan || !(plan.counts.nuevo + plan.counts.actualiza)" @click="commit">
            {{ busy === 'commit' ? 'Importando…' : `Importar ${plan ? plan.counts.nuevo + plan.counts.actualiza : ''} productos` }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import api from '../services/api.js'
import { useAuthStore } from '../stores/auth.js'

const emit = defineEmits(['close', 'done'])
const auth = useAuthStore()
const toast = inject('toast')

const text = ref('')
const control = ref('con')
const updatePrices = ref(false)
const plan = ref(null)
const result = ref(null)
const busy = ref('')
const label = { nuevo: 'Nuevo', existe: 'Ya existe', actualiza: 'Actualiza precio', duplicado: 'Repetido', error: 'Error' }
const money = (n) => '$' + Number(n || 0).toLocaleString('es-CO')
const order = { error: 0, duplicado: 1, actualiza: 2, existe: 3, nuevo: 4 }
const shown = computed(() => (plan.value ? [...plan.value.rows].sort((a, b) => order[a.status] - order[b.status] || a.line - b.line).slice(0, 300) : []))

const url = () => `/api/${auth.currentBusiness.id}/inventory/import`
const body = (dryRun) => ({ text: text.value, control: control.value, updatePrices: updatePrices.value, dryRun })

async function review() {
  busy.value = 'review'
  try { plan.value = (await api.post(url(), body(true))).data }
  catch (e) { plan.value = null; toast(e.response?.data?.error || 'No se pudo revisar la lista', 'error') }
  finally { busy.value = '' }
}
async function commit() {
  busy.value = 'commit'
  try { result.value = (await api.post(url(), body(false))).data; emit('done') }
  catch (e) { toast(e.response?.data?.error || 'No se pudo importar', 'error') }
  finally { busy.value = '' }
}
</script>

<style scoped>
.imp-hint { font-size: 13px; color: var(--text-muted, #6b7280); margin: 0 0 10px; }
.imp-text { font-family: ui-monospace, Consolas, monospace; font-size: 13px; white-space: pre; }
.imp-opts { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; margin: 12px 0; }
.imp-opt { display: flex; flex-direction: column; gap: 4px; font-size: 13px; flex: 1; min-width: 260px; }
.imp-check { font-size: 13px; display: flex; gap: 6px; align-items: center; }
.imp-counts { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; font-size: 13px; font-weight: 600; }
.imp-counts span { padding: 3px 10px; border-radius: 99px; background: var(--surface-2, rgba(128,128,128,.15)); }
.c-new { color: #16a34a; } .c-upd { color: #2563eb; } .c-dup { color: #b45309; } .c-err { color: #dc2626; }
.imp-warn { font-size: 13px; background: var(--warning-light, #fef3c7); color: #92400e; border-radius: 8px; padding: 8px 12px; margin-bottom: 8px; }
.imp-table { max-height: 300px; overflow: auto; border: 1px solid var(--border, #e5e7eb); border-radius: 8px; }
.st-error td { color: #dc2626; } .st-existe td, .st-duplicado td { opacity: .65; }
.imp-done { text-align: center; padding: 12px 0; }
</style>
