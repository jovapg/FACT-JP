<template>
  <div class="nf">
    <div class="nf-row">
      <label class="nf-l">Trabajador</label>
      <select v-model="form.employeeId" class="form-control">
        <option value="" disabled>Escoge quién recibe el pago</option>
        <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.name }}</option>
      </select>
      <small class="nf-h">Solo aparecen los que están creados en Nómina.</small>
    </div>
    <div class="nf-grid">
      <div class="nf-row">
        <label class="nf-l">Pago del día ($)</label>
        <input v-model.number="form.dayAmount" type="number" min="0" step="1000" class="form-control" placeholder="Ej: 65000" />
      </div>
      <div class="nf-row">
        <label class="nf-l">Horas extra: total a pagar ($)</label>
        <input v-model.number="form.overtime" type="number" min="0" step="1000" class="form-control" placeholder="0" />
      </div>
    </div>
    <div class="nf-row">
      <label class="nf-l">Cuántas horas extra (opcional)</label>
      <input v-model.number="form.overtimeHours" type="number" min="0" step="0.5" class="form-control" placeholder="Ej: 2" />
    </div>
    <div class="nf-total"><span>Total a pagar</span><b>{{ money((form.dayAmount || 0) + (form.overtime || 0)) }}</b></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api.js'
import { useAuthStore } from '../stores/auth.js'

// `form` es un objeto reactivo del padre: { employeeId, dayAmount, overtime, overtimeHours }
defineProps({ form: { type: Object, required: true } })
const emit = defineEmits(['unavailable'])
const auth = useAuthStore()
const employees = ref([])
const money = (n) => '$' + Math.round(n || 0).toLocaleString('es-CO')

onMounted(async () => {
  try { employees.value = (await api.get(`/api/${auth.currentBusiness.id}/payroll/employees`)).data || [] }
  catch { emit('unavailable') } // Nómina apagada para este negocio: el padre vuelve al formulario sencillo
})
</script>

<style scoped>
.nf { display: flex; flex-direction: column; gap: 12px; }
.nf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.nf-row { display: flex; flex-direction: column; gap: 4px; }
.nf-l { font-size: 12px; font-weight: 600; color: var(--text-secondary, #6b7280); }
.nf-h { font-size: 12px; color: var(--text-muted, #9ca3af); }
.nf-total { display: flex; justify-content: space-between; align-items: center; background: var(--bg-neutral, #f3f4f6); border-radius: 8px; padding: 10px 12px; font-size: 14px; }
@media (max-width: 480px) { .nf-grid { grid-template-columns: 1fr; } }
</style>
