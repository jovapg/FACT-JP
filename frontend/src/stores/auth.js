/**
 * stores/auth.js — Store de autenticación (Pinia)
 *
 * Maneja todo lo relacionado con la sesión del usuario:
 *   - Login / Logout
 *   - Token JWT (guardado en localStorage para sobrevivir recargas)
 *   - Usuario actual y su rol
 *   - Negocio actualmente seleccionado
 *   - Lista de negocios a los que tiene acceso el usuario
 *
 * Al iniciar la app, los datos se restauran desde localStorage
 * para que el usuario no tenga que volver a hacer login al recargar.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api.js'

export const useAuthStore = defineStore('auth', () => {
  // Estado inicial cargado desde localStorage (persistencia entre recargas)
  const user = ref(JSON.parse(localStorage.getItem('facjp_user') || 'null'))
  const token = ref(localStorage.getItem('facjp_token') || null)
  const currentBusiness = ref(JSON.parse(localStorage.getItem('facjp_business') || 'null'))
  const businesses = ref(JSON.parse(localStorage.getItem('facjp_businesses') || '[]'))

  // Computeds de conveniencia para verificar permisos
  const isAuthenticated = computed(() => !!token.value)
  const isSuperAdmin = computed(() => user.value?.role === 'superadmin')
  const isAdmin = computed(() => ['superadmin', 'admin'].includes(user.value?.role))

  /**
   * Inicia sesión con usuario y contraseña.
   * Si el usuario tiene un solo negocio lo selecciona automáticamente,
   * si tiene varios el router lo llevará al selector.
   */
  async function login(username, password, businessId = null) {
    const res = await api.post('/api/auth/login', { username, password, businessId })
    const data = res.data

    // Guardar token y datos del usuario en memoria y localStorage
    token.value = data.token
    user.value = data.user
    businesses.value = data.businesses || []

    localStorage.setItem('facjp_token', data.token)
    localStorage.setItem('facjp_user', JSON.stringify(data.user))
    localStorage.setItem('facjp_businesses', JSON.stringify(data.businesses || []))

    // Auto-seleccionar negocio si el backend lo indica o si solo hay uno
    if (data.currentBusiness) {
      selectBusiness(data.currentBusiness)
    } else if (data.businesses?.length === 1) {
      selectBusiness(data.businesses[0])
    }

    return data
  }

  /**
   * Establece el negocio activo del usuario.
   * Se guarda en localStorage para persistir la selección.
   */
  function selectBusiness(business) {
    currentBusiness.value = business
    localStorage.setItem('facjp_business', JSON.stringify(business))
  }

  /**
   * Cierra la sesión: borra todo el estado en memoria y localStorage.
   * El router lleva al login después de llamar esta función.
   */
  function logout() {
    user.value = null
    token.value = null
    currentBusiness.value = null
    businesses.value = []
    localStorage.removeItem('facjp_token')
    localStorage.removeItem('facjp_user')
    localStorage.removeItem('facjp_business')
    localStorage.removeItem('facjp_businesses')
  }

  return {
    user, token, currentBusiness, businesses,
    isAuthenticated, isSuperAdmin, isAdmin,
    login, selectBusiness, logout
  }
})
