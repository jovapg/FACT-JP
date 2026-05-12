<template>
  <aside :class="['sidebar', { collapsed: isCollapsed }]">
    <div class="sidebar-header">
      <div class="sidebar-logo">
        <img v-if="businessStore.profile?.logo" :src="businessStore.profile.logo" class="logo-img" alt="logo" />
        <div v-else class="logo-icon-wrap">
          <UtensilsCrossed :size="20" color="#1a0a00" />
        </div>
        <span class="logo-text" v-if="!isCollapsed">{{ businessStore.profile?.name || 'facJp' }}</span>
      </div>
      <button class="collapse-btn" @click="isCollapsed = !isCollapsed" :title="isCollapsed ? 'Expandir' : 'Colapsar'">
        <ChevronLeft v-if="!isCollapsed" :size="16" />
        <ChevronRight v-else :size="16" />
      </button>
    </div>

    <nav class="sidebar-nav">
      <router-link
        v-for="item in visibleMenuItems"
        :key="item.path"
        :to="item.path"
        :class="['nav-item', { active: isActive(item.path) }]"
        :title="isCollapsed ? item.label : ''"
      >
        <span class="nav-icon">
          <component :is="item.icon" :size="18" />
        </span>
        <span class="nav-label" v-if="!isCollapsed">{{ item.label }}</span>
        <span v-if="item.badge && item.badge > 0 && !isCollapsed" class="nav-badge">
          {{ item.badge }}
        </span>
      </router-link>
    </nav>

    <div class="sidebar-footer" v-if="!isCollapsed">
      <div class="user-pill">
        <div class="user-avatar-sm">{{ userInitial }}</div>
        <div class="user-info">
          <span class="user-name-sm">{{ auth.user?.name || auth.user?.username }}</span>
          <span class="user-role-sm">{{ roleLabel }}</span>
        </div>
      </div>
    </div>
  </aside>

  <!-- Overlay en móvil -->
  <div class="sidebar-overlay" v-if="!isCollapsed && isMobile" @click="closeMenu"></div>
</template>

<script setup>
/**
 * SideMenu.vue — Menú lateral de navegación
 *
 * Menú con íconos Lucide, colapsable en escritorio y tipo drawer en móvil.
 * Badge naranja en Inventario cuando hay stock bajo.
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useInventoryStore } from '../stores/inventory.js'
import { useBusinessStore } from '../stores/business.js'
import { useMenu } from '../composables/useMenu.js'
import {
  LayoutDashboard, UtensilsCrossed, Package, BookOpen,
  ShoppingCart, Truck, BarChart3, Receipt, Settings, Building2,
  ChevronLeft, ChevronRight, Clock, Wallet
} from 'lucide-vue-next'

const auth = useAuthStore()
const businessStore = useBusinessStore()
const inventoryStore = useInventoryStore()
const route = useRoute()
const { isMenuOpen, closeMenu } = useMenu()
const isCollapsed = ref(false)
const isMobile = ref(false)

const menuItems = [
  { path: '/dashboard',        label: 'Dashboard',       icon: LayoutDashboard,  roles: ['superadmin','admin','cajero'] },
  { path: '/tables',           label: 'Registrar Venta', icon: UtensilsCrossed,  roles: ['superadmin','admin','cajero'] },
  { path: '/inventory',        label: 'Inventario',      icon: Package,          roles: ['superadmin','admin'] },
  { path: '/recipes',          label: 'Recetas / Menú',  icon: BookOpen,         roles: ['superadmin','admin'] },
  { path: '/purchases',        label: 'Compras',         icon: ShoppingCart,     roles: ['superadmin','admin'] },
  { path: '/suppliers',        label: 'Proveedores',     icon: Truck,            roles: ['superadmin','admin'] },
  { path: '/reports',          label: 'Reportes',        icon: BarChart3,        roles: ['superadmin','admin'] },
  { path: '/shifts',           label: 'Turnos de Caja',  icon: Clock,            roles: ['superadmin','admin','cajero'] },
  { path: '/debtors',          label: 'Deudas',          icon: Wallet,           roles: ['superadmin','admin'] },
  { path: '/invoices',         label: 'Facturas',        icon: Receipt,          roles: ['superadmin','admin','cajero'] },
  { path: '/admin/setup',      label: 'Configuración',   icon: Settings,         roles: ['superadmin','admin'] },
  { path: '/admin/franchises', label: 'Franquicias',     icon: Building2,        roles: ['superadmin'] }
]

const visibleMenuItems = computed(() => {
  const role = auth.user?.role
  return menuItems.filter(item => item.roles.includes(role)).map(item => ({
    ...item,
    badge: item.path === '/inventory' ? inventoryStore.lowStockItems.length : 0
  }))
})

const roleLabel = computed(() => {
  const labels = { superadmin: 'Super Admin', admin: 'Administrador', cajero: 'Cajero' }
  return labels[auth.user?.role] || auth.user?.role
})

const userInitial = computed(() => {
  const n = auth.user?.name || auth.user?.username || 'U'
  return n.charAt(0).toUpperCase()
})

function isActive(path) {
  return route.path === path || route.path.startsWith(path + '/')
}

function handleResize() {
  isMobile.value = window.innerWidth < 768
  isCollapsed.value = isMobile.value
}

watch(isMenuOpen, (open) => {
  if (isMobile.value) isCollapsed.value = !open
})
watch(() => route.path, () => {
  if (isMobile.value) closeMenu()
})

onMounted(() => { handleResize(); window.addEventListener('resize', handleResize) })
onUnmounted(() => window.removeEventListener('resize', handleResize))
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  min-height: 100vh;
  background: linear-gradient(180deg, #0d1424 0%, #0f172a 60%, #0c1120 100%);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.25s cubic-bezier(0.4,0,0.2,1);
  position: relative;
  z-index: 200;
  border-right: 1px solid rgba(255,255,255,0.04);
}
.sidebar.collapsed { width: 64px; }

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  min-height: 64px;
  background: rgba(255,255,255,0.02);
}
.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 11px;
  overflow: hidden;
}
.logo-icon-wrap {
  width: 32px;
  height: 32px;
  background: var(--accent);
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.logo-img { width: 32px; height: 32px; border-radius: 9px; object-fit: cover; flex-shrink: 0; }
.logo-text {
  font-size: 15px;
  font-weight: 700;
  color: white;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.collapse-btn {
  background: rgba(255,255,255,0.07);
  border: none;
  color: rgba(255,255,255,0.5);
  width: 26px;
  height: 26px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.18s;
}
.collapse-btn:hover { background: rgba(255,255,255,0.14); color: white; }

.sidebar-nav {
  flex: 1;
  padding: 10px 8px;
  overflow-y: auto;
  overflow-x: hidden;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 10px;
  border-radius: 9px;
  text-decoration: none;
  color: rgba(255,255,255,0.55);
  font-size: 13.5px;
  font-weight: 500;
  margin-bottom: 1px;
  transition: all 0.16s;
  white-space: nowrap;
  overflow: hidden;
  position: relative;
  /* Elimina el retraso de 300ms en pantallas táctiles */
  touch-action: manipulation;
}
.nav-item:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.95); }
.nav-item.active {
  background: linear-gradient(135deg, rgba(245,158,11,0.22) 0%, rgba(249,115,22,0.14) 100%);
  color: #fbbf24;
  font-weight: 700;
  border-left: 3px solid #f59e0b;
  padding-left: 7px;
  box-shadow: inset 0 0 20px rgba(245,158,11,0.06);
}
.nav-icon { flex-shrink: 0; width: 20px; display: flex; align-items: center; justify-content: center; }
.nav-label { flex: 1; }
.nav-badge {
  background: #ef4444;
  color: white;
  font-size: 10px;
  font-weight: 800;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.sidebar-footer {
  padding: 10px 10px 16px;
  border-top: 1px solid rgba(255,255,255,0.06);
  background: rgba(0,0,0,0.15);
}
.user-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 10px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.06);
  transition: background 0.18s;
}
.user-pill:hover { background: rgba(255,255,255,0.08); }
.user-avatar-sm {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--accent);
  color: #1a0a00;
  font-size: 13px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.user-info { display: flex; flex-direction: column; min-width: 0; }
.user-name-sm { font-size: 12.5px; font-weight: 600; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.user-role-sm { font-size: 10.5px; color: rgba(255,255,255,0.4); white-space: nowrap; }

.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(2px);
  z-index: 199;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0; top: 0;
    height: 100%;
    z-index: 200;
    transform: translateX(0);
  }
  .sidebar.collapsed {
    transform: translateX(-100%);
    width: var(--sidebar-width);
  }

  /* Ítems de menú con objetivo táctil más amplio en móvil */
  .nav-item { padding: 12px 10px; min-height: 44px; }
}
</style>
