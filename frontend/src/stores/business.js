/**
 * stores/business.js — Store del perfil y usuarios del negocio (Pinia)
 *
 * Gestiona la configuración del negocio activo y sus usuarios:
 *   - Perfil del negocio: nombre, NIT, dirección, prefijo de facturas, etc.
 *   - CRUD de usuarios del negocio (admin, cajero)
 *
 * Se usa principalmente en BusinessSetup.vue (configuración) y en
 * InvoicesView.vue para mostrar el encabezado del negocio en el modal.
 */

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import api from '../services/api.js'
import { useAuthStore } from './auth.js'

export const useBusinessStore = defineStore('business', () => {
  const auth = useAuthStore()
  const profile = ref(null)   // Datos del perfil del negocio activo
  const loading = ref(false)

  // Cuando cambia el negocio activo: limpiar el perfil anterior y cargar el nuevo.
  // Así el logo siempre corresponde al negocio seleccionado en ese momento.
  watch(
    () => auth.currentBusiness?.id,
    (newId) => {
      profile.value = null   // evita que se muestre el logo del negocio anterior
      if (newId) fetchProfile()
    },
    { immediate: true }  // se ejecuta al inicializar: carga el perfil al hacer login
  )

  /** Construye la base URL para las rutas del negocio activo */
  function bizApi() {
    return `/api/${auth.currentBusiness?.id}`
  }

  /** Carga el perfil completo del negocio desde el backend */
  async function fetchProfile() {
    loading.value = true
    try {
      const res = await api.get(`${bizApi()}/profile`)
      profile.value = res.data
    } finally {
      loading.value = false
    }
  }

  /**
   * Actualiza el perfil del negocio (nombre, dirección, prefijo de factura, etc.).
   * Retorna el perfil actualizado.
   */
  async function updateProfile(data) {
    const res = await api.put(`${bizApi()}/profile`, data)
    profile.value = res.data
    return res.data
  }

  /** Retorna la lista de usuarios del negocio (admin y cajeros) */
  async function fetchUsers() {
    const res = await api.get(`${bizApi()}/users`)
    return res.data
  }

  /** Crea un nuevo usuario en el negocio (admin o cajero) */
  async function createUser(data) {
    const res = await api.post(`${bizApi()}/users`, data)
    return res.data
  }

  /** Actualiza los datos de un usuario existente por ID */
  async function updateUser(id, data) {
    const res = await api.put(`${bizApi()}/users/${id}`, data)
    return res.data
  }

  /** Elimina un usuario del negocio por ID */
  async function deleteUser(id) {
    const res = await api.delete(`${bizApi()}/users/${id}`)
    return res.data
  }

  return {
    profile, loading,
    fetchProfile, updateProfile,
    fetchUsers, createUser, updateUser, deleteUser
  }
})
