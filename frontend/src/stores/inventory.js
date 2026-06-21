/**
 * stores/inventory.js — Store de inventario y recetas (Pinia)
 *
 * Gestiona el estado global del inventario de insumos y de las
 * recetas/ítems del menú del negocio activo. Expone:
 *   - items:    lista de productos en inventario (materia prima)
 *   - recipes:  lista de recetas/platos vendibles en el menú
 *   - Computeds: items con stock bajo, categorías únicas de ambas listas
 *   - CRUD completo para ítems e inventario
 *   - adjustStock: ajuste manual de stock (mermas, conteos, etc.)
 *
 * Nota: useAuthStore() se llama UNA sola vez al inicio del store
 * para evitar el error "getActivePinia was called with no active Pinia".
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api.js'
import { useAuthStore } from './auth.js'

export const useInventoryStore = defineStore('inventory', () => {
  // useAuthStore se captura aquí (no dentro de funciones async)
  const auth = useAuthStore()
  const items = ref([])    // Productos de inventario
  const recipes = ref([])  // Recetas/ítems del menú
  const loading = ref(false)

  /** Retorna el ID del negocio activo */
  function bizId() {
    return auth.currentBusiness?.id
  }

  /** Items cuyo stock está igual o por debajo del mínimo configurado */
  const lowStockItems = computed(() => items.value.filter(i => i.stock <= (i.minStock || 0)))

  /** Categorías únicas del inventario (para filtros y dropdowns) */
  const categories = computed(() => [...new Set(items.value.map(i => i.category).filter(Boolean))])

  /** Categorías únicas de las recetas (para filtros del menú) */
  const recipeCategories = computed(() => [...new Set(recipes.value.map(r => r.category).filter(Boolean))])

  /** Carga todos los ítems de inventario del negocio activo */
  async function fetchInventory() {
    if (!bizId()) return
    loading.value = true
    try {
      const res = await api.get(`/api/${bizId()}/inventory`)
      items.value = res.data
    } finally {
      loading.value = false
    }
  }

  /** Carga todas las recetas/ítems del menú del negocio activo */
  async function fetchRecipes() {
    if (!bizId()) return
    const res = await api.get(`/api/${bizId()}/recipes`)
    recipes.value = res.data
  }

  /** Crea un nuevo ítem de inventario y lo agrega al estado local */
  async function createItem(data) {
    const res = await api.post(`/api/${bizId()}/inventory`, data)
    items.value.push(res.data)
    return res.data
  }

  /** Actualiza un ítem de inventario existente por ID */
  async function updateItem(id, data) {
    const res = await api.put(`/api/${bizId()}/inventory/${id}`, data)
    const idx = items.value.findIndex(i => i.id === id)
    if (idx !== -1) items.value[idx] = res.data
    return res.data
  }

  /** Elimina un ítem de inventario por ID */
  async function deleteItem(id) {
    await api.delete(`/api/${bizId()}/inventory/${id}`)
    items.value = items.value.filter(i => i.id !== id)
  }

  /**
   * Ajusta el stock de un ítem manualmente.
   * `adjustment` puede ser positivo (entrada) o negativo (salida/merma).
   * `reason` es el motivo del ajuste (texto libre).
   */
  async function adjustStock(id, adjustment, reason) {
    const res = await api.patch(`/api/${bizId()}/inventory/${id}/adjust`, { adjustment, reason })
    const idx = items.value.findIndex(i => i.id === id)
    if (idx !== -1) items.value[idx] = res.data
    return res.data
  }

  /**
   * Conteo físico: envía [{ id, counted }] y el backend ajusta el stock a lo
   * contado. Devuelve { ajustados, changes, inventory }. Refresca el estado.
   */
  async function countInventory(countItems) {
    const res = await api.post(`/api/${bizId()}/inventory/count`, { items: countItems })
    if (Array.isArray(res.data.inventory)) items.value = res.data.inventory
    return res.data
  }

  /** Crea una nueva receta/ítem de menú */
  async function createRecipe(data) {
    const res = await api.post(`/api/${bizId()}/recipes`, data)
    recipes.value.push(res.data)
    return res.data
  }

  /** Actualiza una receta/ítem de menú existente por ID */
  async function updateRecipe(id, data) {
    const res = await api.put(`/api/${bizId()}/recipes/${id}`, data)
    const idx = recipes.value.findIndex(r => r.id === id)
    if (idx !== -1) recipes.value[idx] = res.data
    return res.data
  }

  /** Elimina una receta/ítem de menú por ID */
  async function deleteRecipe(id) {
    await api.delete(`/api/${bizId()}/recipes/${id}`)
    recipes.value = recipes.value.filter(r => r.id !== id)
  }

  return {
    items, recipes, loading,
    lowStockItems, categories, recipeCategories,
    fetchInventory, fetchRecipes,
    createItem, updateItem, deleteItem, adjustStock, countInventory,
    createRecipe, updateRecipe, deleteRecipe
  }
})
