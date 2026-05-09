/**
 * stores/debtors.js — Store de deudas / cuentas por cobrar (Pinia)
 *
 * Gestiona los clientes que compran fiado y su historial de transacciones.
 * balance = sum(cargos) - sum(abonos)
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api.js'
import { useAuthStore } from './auth.js'

export const useDebtorsStore = defineStore('debtors', () => {
  const auth = useAuthStore()
  const debtors = ref([])
  const loading = ref(false)

  function bizId() { return auth.currentBusiness?.id }

  async function fetchDebtors() {
    if (!bizId()) return
    loading.value = true
    try {
      const res = await api.get(`/api/${bizId()}/debtors`)
      debtors.value = res.data
    } finally {
      loading.value = false
    }
  }

  async function createDebtor(data) {
    const res = await api.post(`/api/${bizId()}/debtors`, data)
    debtors.value.push(res.data)
    return res.data
  }

  async function updateDebtor(id, data) {
    const res = await api.put(`/api/${bizId()}/debtors/${id}`, data)
    const idx = debtors.value.findIndex(d => d.id === id)
    if (idx !== -1) debtors.value[idx] = res.data
    return res.data
  }

  async function deleteDebtor(id) {
    await api.delete(`/api/${bizId()}/debtors/${id}`)
    debtors.value = debtors.value.filter(d => d.id !== id)
  }

  async function addCharge(id, amount, description) {
    const res = await api.post(`/api/${bizId()}/debtors/${id}/charge`, { amount, description })
    const idx = debtors.value.findIndex(d => d.id === id)
    if (idx !== -1) debtors.value[idx] = res.data
    return res.data
  }

  async function addPayment(id, amount, description) {
    const res = await api.post(`/api/${bizId()}/debtors/${id}/payment`, { amount, description })
    const idx = debtors.value.findIndex(d => d.id === id)
    if (idx !== -1) debtors.value[idx] = res.data
    return res.data
  }

  const totalDebt = computed(() => debtors.value.reduce((s, d) => s + (d.balance || 0), 0))
  const activeCount = computed(() => debtors.value.filter(d => d.balance > 0).length)

  return {
    debtors, loading, totalDebt, activeCount,
    fetchDebtors, createDebtor, updateDebtor, deleteDebtor,
    addCharge, addPayment
  }
})
