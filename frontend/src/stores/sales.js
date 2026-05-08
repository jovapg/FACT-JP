/**
 * stores/sales.js — Store de ventas y reportes (Pinia)
 *
 * Centraliza todas las operaciones relacionadas con ventas:
 *   - Listar y filtrar ventas del negocio activo
 *   - Crear nuevas ventas (facturar)
 *   - Obtener el PDF de una factura (como URL con token)
 *   - Exportar reporte de ventas a Excel (descarga directa)
 *   - Cargar datos para el módulo de reportes
 *
 * Nota: useAuthStore() se captura al inicio del store para evitar
 * el error de "getActivePinia" al llamarlo dentro de funciones async.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api.js'
import { useAuthStore } from './auth.js'

export const useSalesStore = defineStore('sales', () => {
  const auth = useAuthStore()
  const sales = ref([])    // Lista de ventas cargadas en memoria
  const loading = ref(false)

  /** Retorna el ID del negocio activo */
  function bizId() {
    return auth.currentBusiness?.id
  }

  /**
   * Obtiene ventas del backend con filtros opcionales.
   * Parámetros posibles: { period: 'day'|'week'|'month', from, to, date }
   */
  async function fetchSales(params = {}) {
    if (!bizId()) return
    loading.value = true
    try {
      const res = await api.get(`/api/${bizId()}/sales`, { params })
      sales.value = res.data
      return res.data
    } finally {
      loading.value = false
    }
  }

  /**
   * Crea una nueva venta (factura).
   * Retorna { sale, inventoryAlerts } — los alertas indican items con stock bajo
   * después de descontar los ingredientes de esta venta.
   */
  async function createSale(data) {
    const res = await api.post(`/api/${bizId()}/sales`, data)
    sales.value.unshift(res.data.sale) // Agrega al inicio de la lista local
    return res.data
  }

  /** Obtiene una venta específica por ID */
  async function getSale(id) {
    const res = await api.get(`/api/${bizId()}/sales/${id}`)
    return res.data
  }

  /** Retorna todas las ventas (facturas) del negocio activo */
  async function fetchInvoices() {
    const res = await api.get(`/api/${bizId()}/invoices`)
    return res.data
  }

  /**
   * Construye la URL del PDF de una factura.
   * Incluye el token JWT como query param para que el navegador
   * pueda abrirlo directamente sin header de Authorization.
   */
  function getPdfUrl(saleId) {
    return `/api/${bizId()}/invoices/${saleId}/pdf?token=${auth.token}`
  }

  /**
   * Descarga el reporte de ventas como archivo Excel.
   * Usa responseType 'blob' para manejar el archivo binario
   * y crea un enlace temporal para disparar la descarga.
   */
  async function exportExcel(from, to) {
    const token = auth.token
    const params = new URLSearchParams()
    if (from) params.append('from', from)
    if (to) params.append('to', to)

    const res = await api.get(`/api/${bizId()}/reports/export/excel?${params}`, {
      responseType: 'blob'
    })

    // Crear URL temporal del blob y simular clic para descargar
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-ventas-${Date.now()}.xlsx`
    a.click()
    window.URL.revokeObjectURL(url) // Liberar memoria
  }

  /**
   * Carga el resumen de ventas para el módulo de reportes.
   * Retorna { sales, summary: { count, totalRevenue, byPayment, byDay, topProducts } }
   */
  async function fetchReports(params = {}) {
    const res = await api.get(`/api/${bizId()}/reports/sales`, { params })
    return res.data
  }

  return {
    sales, loading,
    fetchSales, createSale, getSale,
    fetchInvoices, getPdfUrl, exportExcel, fetchReports
  }
})
