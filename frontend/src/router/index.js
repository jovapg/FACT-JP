/**
 * router/index.js — Configuración de rutas de la SPA
 *
 * Define todas las rutas de la aplicación y sus guardias de navegación.
 * Cada ruta tiene metadata que controla el acceso:
 *   - public:           ruta pública (no requiere autenticación)
 *   - requiresAuth:     el usuario debe estar logueado
 *   - requiresBusiness: el usuario debe tener un negocio seleccionado
 *   - roles:            array de roles permitidos (superadmin, admin, cajero)
 *
 * El guardia `beforeEach` redirige automáticamente si no se cumplen
 * las condiciones, evitando acceso no autorizado a vistas protegidas.
 */

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true } // Accesible sin sesión; redirige al dashboard si ya hay sesión
  },
  {
    path: '/select-business',
    name: 'select-business',
    component: () => import('../views/BusinessSelector.vue'),
    meta: { requiresAuth: true } // Solo para usuarios con múltiples negocios
  },
  {
    path: '/',
    redirect: '/dashboard' // La raíz siempre lleva al dashboard
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { requiresAuth: true, requiresBusiness: true }
  },
  {
    path: '/tables',
    name: 'tables',
    component: () => import('../views/TablesView.vue'),
    meta: { requiresAuth: true, requiresBusiness: true }
  },
  {
    path: '/inventory',
    name: 'inventory',
    component: () => import('../views/InventoryView.vue'),
    meta: { requiresAuth: true, requiresBusiness: true, roles: ['superadmin', 'admin', 'cajero'] }
  },
  {
    path: '/recipes',
    name: 'recipes',
    component: () => import('../views/RecipesView.vue'),
    meta: { requiresAuth: true, requiresBusiness: true, roles: ['superadmin', 'admin'] }
  },
  {
    path: '/purchases',
    name: 'purchases',
    component: () => import('../views/PurchasesView.vue'),
    meta: { requiresAuth: true, requiresBusiness: true, roles: ['superadmin', 'admin'] }
  },
  {
    path: '/suppliers',
    name: 'suppliers',
    component: () => import('../views/SuppliersView.vue'),
    meta: { requiresAuth: true, requiresBusiness: true, roles: ['superadmin', 'admin'] }
  },
  {
    path: '/reports',
    name: 'reports',
    component: () => import('../views/ReportsView.vue'),
    meta: { requiresAuth: true, requiresBusiness: true, roles: ['superadmin', 'admin'] }
  },
  {
    path: '/invoices',
    name: 'invoices',
    component: () => import('../views/InvoicesView.vue'),
    meta: { requiresAuth: true, requiresBusiness: true }
  },
  {
    path: '/shifts',
    name: 'shifts',
    component: () => import('../views/ShiftsView.vue'),
    meta: { requiresAuth: true, requiresBusiness: true }
  },
  {
    path: '/debtors',
    name: 'debtors',
    component: () => import('../views/DebtorsView.vue'),
    meta: { requiresAuth: true, requiresBusiness: true, roles: ['superadmin', 'admin', 'cajero'] }
  },
  {
    path: '/admin/setup',
    name: 'business-setup',
    component: () => import('../views/admin/BusinessSetup.vue'),
    meta: { requiresAuth: true, requiresBusiness: true, roles: ['superadmin', 'admin'] }
  },
  {
    path: '/admin/franchises',
    name: 'franchise-manager',
    component: () => import('../views/admin/FranchiseManager.vue'),
    meta: { requiresAuth: true, roles: ['superadmin'] } // Solo superadmin puede gestionar franquicias
  },
  {
    // Captura cualquier ruta que no coincida con las anteriores y muestra la página 404 personalizada.
    // El `pathMatch: 'prefix'` con '/:pathMatch(.*)' captura rutas con múltiples segmentos.
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

/**
 * Guardia global de navegación — se ejecuta antes de cada cambio de ruta.
 * Orden de verificaciones:
 * 1. Ruta pública → si ya hay sesión, redirige al dashboard (evita ir al login logueado)
 * 2. Requiere autenticación → si no hay token, va al login
 * 3. Requiere negocio → si no hay negocio seleccionado, va al selector
 * 4. Requiere rol → si el rol del usuario no está en la lista, va al dashboard
 */
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  if (to.meta.public) {
    if (authStore.isAuthenticated) return next('/dashboard')
    return next()
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return next('/login')
  }

  if (to.meta.requiresBusiness && !authStore.currentBusiness) {
    return next('/select-business')
  }

  if (to.meta.roles && !to.meta.roles.includes(authStore.user?.role)) {
    return next('/dashboard')
  }

  next()
})

/**
 * Cuando un lazy-import falla (chunk no encontrado — típico tras un deploy
 * con PWA service worker sirviendo assets viejos), hacemos un hard reload
 * hacia la ruta destino para que el navegador pida los archivos frescos.
 * Esto evita que la transición de página quede colgada indefinidamente.
 */
router.onError((error, to) => {
  const isChunkError = (
    error?.message?.includes('Failed to fetch dynamically imported module') ||
    error?.message?.includes('Importing a module script failed') ||
    error?.message?.includes('Unable to preload CSS') ||
    error?.name === 'ChunkLoadError'
  )
  if (isChunkError) {
    console.warn('[router] Chunk load error — reloading to', to.fullPath)
    window.location.href = to.fullPath
  }
})

export default router
