/**
 * stores/finance.js — Store del módulo de Finanzas / flujo de caja (Pinia)
 *
 * Obtiene del backend los saldos (efectivo/banco por área) y los movimientos
 * del periodo, y permite fijar el saldo inicial y registrar movimientos manuales.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api.js'
import { useAuthStore } from './auth.js'

export const useFinanceStore = defineStore('finance', () => {
  const auth = useAuthStore()
  const data = ref(null)       // { opening, openingDate, balances, totals, movements, periodTotals }
  const loading = ref(false)

  function bizId() { return auth.currentBusiness?.id }

  async function fetchFinance(params = {}) {
    if (!bizId()) return
    loading.value = true
    try {
      const res = await api.get(`/api/${bizId()}/finance`, { params })
      data.value = res.data
      return res.data
    } finally {
      loading.value = false
    }
  }

  /** Fija el saldo inicial (por área × bucket) y la fecha de inicio */
  async function setOpening(opening, openingDate) {
    const res = await api.put(`/api/${bizId()}/finance/opening`, { opening, openingDate })
    return res.data
  }

  /** Fija la meta de costo (food cost %) */
  async function setCostTarget(target) {
    const res = await api.put(`/api/${bizId()}/finance/cost-target`, { target })
    return res.data
  }

  /** Obtiene el reporte del día (ventas, fiados, salidas, saldos) */
  async function fetchDaily(date) {
    const res = await api.get(`/api/${bizId()}/finance/daily`, { params: date ? { date } : {} })
    return res.data
  }

  /** Guarda el resumen del mes de referencia (no afecta saldos) */
  async function setReference(reference) {
    const res = await api.put(`/api/${bizId()}/finance/reference`, { reference })
    return res.data
  }

  /** Agrega un movimiento manual (ingreso/egreso/traslado) */
  async function addManual(payload) {
    const res = await api.post(`/api/${bizId()}/finance/manual`, payload)
    return res.data
  }

  /** Elimina un movimiento manual por ID */
  async function deleteManual(id) {
    await api.delete(`/api/${bizId()}/finance/manual/${id}`)
  }

  return { data, loading, fetchFinance, fetchDaily, setOpening, setReference, setCostTarget, addManual, deleteManual }
})
