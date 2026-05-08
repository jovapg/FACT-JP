/**
 * api.js — Cliente HTTP centralizado (Axios)
 *
 * Crea una instancia de Axios con configuración base para todas
 * las llamadas al backend. Incluye dos interceptores:
 *   - Request:  adjunta automáticamente el token JWT del localStorage
 *               en el header Authorization de cada petición.
 *   - Response: si el servidor responde 401 (token inválido/expirado),
 *               limpia el localStorage y redirige al login.
 *
 * Todos los stores y vistas importan este objeto en lugar de Axios directamente.
 */

import axios from 'axios'

// baseURL vacío → las rutas son absolutas tipo "/api/..."
// Vite proxy redirige /api → http://localhost:3001 en desarrollo
const api = axios.create({
  baseURL: '',
  timeout: 15000
})

// Interceptor de solicitud: inyecta el token JWT en cada petición
api.interceptors.request.use(config => {
  const token = localStorage.getItem('facjp_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor de respuesta: maneja errores 401 (sesión expirada)
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      // Limpiar todos los datos de sesión y forzar re-login
      localStorage.removeItem('facjp_token')
      localStorage.removeItem('facjp_user')
      localStorage.removeItem('facjp_business')
      localStorage.removeItem('facjp_businesses')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
