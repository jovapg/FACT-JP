/**
 * stores/payroll.js — Store de Nómina / asistencia (Pinia)
 *
 * Gestiona los días trabajados que reporta el personal y las tarifas.
 *   - El cajero solo ve/registra los suyos (el backend filtra por su usuario).
 *   - El admin ve todos, edita, aprueba y genera el pago.
 *
 * El monto de cada día lo calcula el backend según las tarifas; aquí solo
 * enviamos tipo, área, fecha y (para "rato") las horas de/a.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api.js'
import { useAuthStore } from './auth.js'

export const usePayrollStore = defineStore('payroll', () => {
  const auth = useAuthStore()
  const entries = ref([])
  const rates = ref({ dia: 50000, medio: 25000, hora: 6250 })
  const loading = ref(false)

  /** Días pendientes por aprobar (alimenta el badge rojo del menú) */
  const pendingCount = computed(() => entries.value.filter(e => e.status === 'pendiente').length)

  function bizId() { return auth.currentBusiness?.id }

  /** Carga días y tarifas. Filtros opcionales { from, to, employeeId }. */
  async function fetch(params = {}) {
    if (!bizId()) return
    loading.value = true
    try {
      const res = await api.get(`/api/${bizId()}/payroll`, { params })
      entries.value = res.data.entries || []
      if (res.data.rates) rates.value = res.data.rates
    } finally {
      loading.value = false
    }
  }

  async function fetchRates() {
    if (!bizId()) return
    const res = await api.get(`/api/${bizId()}/payroll/rates`)
    rates.value = res.data
  }

  async function saveRates(data) {
    const res = await api.put(`/api/${bizId()}/payroll/rates`, data)
    rates.value = res.data
    return res.data
  }

  async function createEntry(data) {
    const res = await api.post(`/api/${bizId()}/payroll`, data)
    return res.data
  }

  async function updateEntry(id, data) {
    const res = await api.put(`/api/${bizId()}/payroll/${id}`, data)
    return res.data
  }

  async function deleteEntry(id) {
    await api.delete(`/api/${bizId()}/payroll/${id}`)
  }

  async function approve(ids) {
    const res = await api.post(`/api/${bizId()}/payroll/approve`, { ids })
    return res.data
  }

  async function pay({ employeeId, ids, method, date }) {
    const res = await api.post(`/api/${bizId()}/payroll/pay`, { employeeId, ids, method, date })
    return res.data
  }

  return {
    entries, rates, loading, pendingCount,
    fetch, fetchRates, saveRates,
    createEntry, updateEntry, deleteEntry, approve, pay
  }
})
