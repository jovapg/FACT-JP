/**
 * stores/shifts.js — Store de turnos de caja (Pinia)
 *
 * Gestiona el estado del turno activo y el historial de turnos.
 * El turno activo se carga al iniciar la app y se actualiza
 * automáticamente al abrir/cerrar un turno.
 *
 * currentShift: turno abierto actualmente (null si no hay ninguno)
 * shifts: historial completo de turnos del negocio
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api.js'
import { useAuthStore } from './auth.js'

export const useShiftsStore = defineStore('shifts', () => {
  const auth = useAuthStore()

  const currentShift = ref(null)  // Turno actualmente abierto
  const shifts = ref([])          // Historial de turnos
  const loading = ref(false)

  function bizId() {
    return auth.currentBusiness?.id
  }

  /** Carga el turno activo desde el backend */
  async function fetchCurrentShift() {
    if (!bizId()) return
    try {
      const res = await api.get(`/api/${bizId()}/shifts/current`)
      currentShift.value = res.data // null si no hay turno abierto
    } catch {
      currentShift.value = null
    }
  }

  /** Carga el historial completo de turnos */
  async function fetchShifts() {
    if (!bizId()) return
    loading.value = true
    try {
      const res = await api.get(`/api/${bizId()}/shifts`)
      shifts.value = res.data
    } finally {
      loading.value = false
    }
  }

  /**
   * Abre un nuevo turno de caja.
   * @param {number} openingCash - Efectivo inicial en la caja
   * @param {string} notes       - Notas opcionales
   */
  async function openShift(openingCash, notes = '') {
    const res = await api.post(`/api/${bizId()}/shifts/open`, { openingCash, notes })
    currentShift.value = res.data
    shifts.value.unshift(res.data) // Agregar al inicio del historial
    return res.data
  }

  /**
   * Cierra el turno activo.
   * @param {string} id          - ID del turno a cerrar
   * @param {number} closingCash - Efectivo contado al cerrar
   */
  async function closeShift(id, closingCash) {
    const res = await api.post(`/api/${bizId()}/shifts/${id}/close`, { closingCash })
    currentShift.value = null // Ya no hay turno activo
    // Actualizar el turno en el historial local
    const idx = shifts.value.findIndex(s => s.id === id)
    if (idx !== -1) shifts.value[idx] = res.data
    return res.data
  }

  /**
   * Registra un retiro de caja durante el turno.
   * @param {string} id     - ID del turno activo
   * @param {number} amount - Monto retirado
   * @param {string} reason - Motivo del retiro
   */
  async function addWithdrawal(id, amount, reason) {
    const res = await api.post(`/api/${bizId()}/shifts/${id}/withdrawal`, { amount, reason })
    currentShift.value = res.data // Actualizar turno activo con nuevo retiro
    return res.data
  }

  return {
    currentShift, shifts, loading,
    fetchCurrentShift, fetchShifts,
    openShift, closeShift, addWithdrawal
  }
})
