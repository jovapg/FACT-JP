/**
 * stores/debtors.js — Store de deudas / cuentas por cobrar (Pinia)
 *
 * Gestiona los clientes que compran fiado y su historial de transacciones.
 * balance = sum(cargos) - sum(abonos)
 *
 * Al saldar (balance = 0), el backend genera automáticamente una factura
 * de paymentMethod='pago_fiado' con los items acumulados.
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

  /** Registra fiado. items = [{ recipeId|inventoryId, name, price, qty }] */
  async function addCharge(id, amount, description, items = []) {
    const res = await api.post(`/api/${bizId()}/debtors/${id}/charge`, { amount, description, items })
    const debtor = res.data.debtor
    const idx = debtors.value.findIndex(d => d.id === id)
    if (idx !== -1) debtors.value[idx] = debtor
    return res.data  // { debtor, inventoryAlerts }
  }

  /** Edita un fiado (solo admin). items = [{ recipeId|inventoryId, name, price, qty }] */
  async function editCharge(debtorId, txId, { amount, description, items } = {}) {
    const res = await api.put(`/api/${bizId()}/debtors/${debtorId}/charge/${txId}`, { amount, description, items })
    const debtor = res.data.debtor
    const idx = debtors.value.findIndex(d => d.id === debtorId)
    if (idx !== -1) debtors.value[idx] = debtor
    return res.data  // { debtor, inventoryAlerts }
  }

  /** Elimina un fiado registrado por error (solo admin). Devuelve stock. */
  async function deleteCharge(debtorId, txId) {
    const res = await api.delete(`/api/${bizId()}/debtors/${debtorId}/charge/${txId}`)
    const debtor = res.data.debtor
    const idx = debtors.value.findIndex(d => d.id === debtorId)
    if (idx !== -1) debtors.value[idx] = debtor
    return res.data  // { debtor }
  }

  /** Registra abono. Si salda, el backend genera factura y la retorna en generatedSale. */
  async function addPayment(id, amount, description, paidWith = 'efectivo', area = 'bar') {
    const res = await api.post(`/api/${bizId()}/debtors/${id}/payment`, { amount, description, paidWith, area })
    const debtor = res.data.debtor
    const idx = debtors.value.findIndex(d => d.id === id)
    if (idx !== -1) debtors.value[idx] = debtor
    return res.data  // { debtor, generatedSale|null }
  }

  /** Edita un abono (solo admin). Reabre fiados si la deuda vuelve a quedar pendiente. */
  async function editPayment(debtorId, txId, { amount, description } = {}) {
    const res = await api.put(`/api/${bizId()}/debtors/${debtorId}/payment/${txId}`, { amount, description })
    const debtor = res.data.debtor
    const idx = debtors.value.findIndex(d => d.id === debtorId)
    if (idx !== -1) debtors.value[idx] = debtor
    return res.data  // { debtor }
  }

  /** Elimina un abono (solo admin). Reabre fiados si la deuda vuelve a quedar pendiente. */
  async function deletePayment(debtorId, txId) {
    const res = await api.delete(`/api/${bizId()}/debtors/${debtorId}/payment/${txId}`)
    const debtor = res.data.debtor
    const idx = debtors.value.findIndex(d => d.id === debtorId)
    if (idx !== -1) debtors.value[idx] = debtor
    return res.data  // { debtor }
  }

  /** Borra movimientos de todos los deudores, conserva los clientes. Solo admin. */
  async function clearAllHistory() {
    await api.delete(`/api/${bizId()}/debtors/transactions`)
    for (const d of debtors.value) {
      d.transactions = []
      d.balance = 0
    }
  }

  const totalDebt = computed(() => debtors.value.reduce((s, d) => s + (d.balance || 0), 0))
  const activeCount = computed(() => debtors.value.filter(d => d.balance > 0).length)

  /** Todos los abonos (type='payment') aplanados con nombre del cliente. Más recientes primero. */
  const allPayments = computed(() => {
    const out = []
    for (const d of debtors.value) {
      for (const t of (d.transactions || [])) {
        if (t.type === 'payment') {
          out.push({ ...t, debtorId: d.id, debtorName: d.name })
        }
      }
    }
    return out.sort((a, b) => new Date(b.date) - new Date(a.date))
  })

  return {
    debtors, loading, totalDebt, activeCount, allPayments,
    fetchDebtors, createDebtor, updateDebtor, deleteDebtor,
    addCharge, editCharge, deleteCharge, addPayment, editPayment, deletePayment, clearAllHistory
  }
})
