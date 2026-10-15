/**
 * stores/tables.js — Store de mesas (Pinia)
 *
 * Gestiona el estado de las mesas del negocio activo:
 *   - Lista de mesas con su estado (libre / ocupada) y pedido activo
 *   - Mesa seleccionada actualmente (para el panel de OrderCart)
 *   - Contadores computados de mesas libres y ocupadas (para el dashboard)
 *   - Actualización del pedido de una mesa
 *   - Limpieza de mesa (cuando se cierra la factura)
 *
 * Nota: useAuthStore() se captura al inicio del store para evitar
 * el error de "getActivePinia" en llamadas async.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api.js'
import { useAuthStore } from './auth.js'

export const useTablesStore = defineStore('tables', () => {
  const auth = useAuthStore()
  const tables = ref([])          // Lista de todas las mesas del negocio
  const selectedTable = ref(null) // Mesa que el usuario tiene abierta en este momento
  const loading = ref(false)

  /** Retorna el ID del negocio activo */
  function bizId() {
    return auth.currentBusiness?.id
  }

  /** Número de mesas con estado 'ocupada' (para el dashboard) */
  const occupiedCount = computed(() => tables.value.filter(t => t.status === 'ocupada').length)

  /** Número de mesas con estado 'libre' (para el dashboard) */
  const freeCount = computed(() => tables.value.filter(t => t.status === 'libre').length)

  /** Carga todas las mesas del negocio desde el backend */
  async function fetchTables() {
    if (!bizId()) return
    loading.value = true
    try {
      const res = await api.get(`/api/${bizId()}/tables`)
      tables.value = res.data
    } finally {
      loading.value = false
    }
  }

  /**
   * Reinicializa todas las mesas del negocio.
   * Se usa en configuración para cambiar el número de mesas.
   * `count` es el número de mesas a crear (todas quedan libres).
   */
  async function initTables(count) {
    const res = await api.post(`/api/${bizId()}/tables/init`, { count })
    tables.value = res.data
    return res.data
  }

  /** Selecciona una mesa para mostrar su pedido en el panel lateral */
  function selectTable(table) {
    selectedTable.value = table
  }

  /** Una venta guardada de un espacio, presentada como "mesa" para que OrderCart la edite igual */
  function virtualOrder(table, order) {
    return { ...table, order, _orderId: order.id, _orderName: order.name, status: 'ocupada' }
  }

  /** Abre una venta guardada (de un espacio con varias ventas) en el panel de pedidos */
  function selectOrder(table, order) {
    selectedTable.value = virtualOrder(table, order)
  }

  /** Abre el panel para una venta directa: sin espacio, se cobra y listo */
  function selectDirect() {
    selectedTable.value = { id: null, number: '', name: '', status: 'libre', order: null, _direct: true }
  }

  /** Crea una venta guardada nueva en un espacio. Devuelve { table, order } */
  async function createOrder(tableId) {
    const res = await api.post(`/api/${bizId()}/tables/${tableId}/orders`, {})
    const idx = tables.value.findIndex(t => t.id === tableId)
    if (idx !== -1) tables.value[idx] = res.data.table
    return res.data
  }

  /** Deselecciona la mesa activa (cierra el panel de pedidos) */
  function clearSelection() {
    selectedTable.value = null
  }

  /**
   * Guarda o actualiza el pedido de una mesa.
   * Si `items` está vacío, la mesa vuelve a estado 'libre'.
   * Actualiza tanto la lista local como la mesa seleccionada si coinciden.
   */
  async function updateOrder(tableId, items, client, waiter, orderId) {
    if (orderId) {
      // Espacio con varias ventas: se guarda solo esa venta
      const r = await api.put(`/api/${bizId()}/tables/${tableId}/orders/${orderId}`, { items, client, waiter })
      const i = tables.value.findIndex(t => t.id === tableId)
      if (i !== -1) tables.value[i] = r.data.table
      if (selectedTable.value?._orderId === orderId) selectedTable.value = virtualOrder(r.data.table, r.data.order)
      return r.data.table
    }
    const res = await api.put(`/api/${bizId()}/tables/${tableId}/order`, { items, client, waiter })
    const idx = tables.value.findIndex(t => t.id === tableId)
    if (idx !== -1) tables.value[idx] = res.data
    if (selectedTable.value?.id === tableId) selectedTable.value = res.data
    return res.data
  }

  /**
   * Limpia el pedido de una mesa (la pone en estado 'libre').
   * Se llama automáticamente después de crear una venta exitosa.
   * También deselecciona la mesa si era la que estaba activa.
   */
  async function clearTable(tableId, orderId) {
    if (orderId) {
      // Espacio con varias ventas: se elimina solo esa venta
      const r = await api.delete(`/api/${bizId()}/tables/${tableId}/orders/${orderId}`)
      const i = tables.value.findIndex(t => t.id === tableId)
      if (i !== -1) tables.value[i] = r.data.table
      if (selectedTable.value?._orderId === orderId) selectedTable.value = null
      return r.data.table
    }
    const res = await api.delete(`/api/${bizId()}/tables/${tableId}/order`)
    const idx = tables.value.findIndex(t => t.id === tableId)
    if (idx !== -1) tables.value[idx] = res.data
    if (selectedTable.value?.id === tableId) selectedTable.value = null
    return res.data
  }

  return {
    tables, selectedTable, loading,
    occupiedCount, freeCount,
    fetchTables, initTables, selectTable, selectOrder, selectDirect, createOrder, clearSelection,
    updateOrder, clearTable
  }
})
