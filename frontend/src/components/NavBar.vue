<template>
  <header class="navbar">
    <div class="navbar-left">
      <button class="menu-toggle" @click="toggleMenu" aria-label="Menú">
        <Menu :size="20" />
      </button>
      <h2 class="navbar-title">{{ title }}</h2>
    </div>

    <div class="navbar-right">
      <!-- Nombre del negocio con logo -->
      <span class="biz-name" v-if="auth.currentBusiness">
        <img v-if="businessStore.profile?.logo" :src="businessStore.profile.logo" class="biz-logo" alt="logo" />
        <Store v-else :size="14" class="biz-icon" />
        {{ auth.currentBusiness.name }}
      </span>

      <!-- Toggle modo oscuro -->
      <button class="icon-btn" @click="toggleDark" :title="isDark ? 'Modo claro' : 'Modo oscuro'">
        <Sun v-if="isDark" :size="17" />
        <Moon v-else :size="17" />
      </button>

      <!-- Menú de usuario -->
      <div class="user-menu" @click.stop="showMenu = !showMenu" ref="menuRef">
        <div class="user-avatar">{{ userInitial }}</div>
        <span class="user-name">{{ auth.user?.name || auth.user?.username }}</span>
        <ChevronDown :size="12" class="arrow" />

        <transition name="fade">
          <div class="dropdown-menu" v-if="showMenu" @click.stop>
            <router-link to="/admin/setup" class="dropdown-item" v-if="auth.isAdmin" @click="showMenu = false">
              <Settings :size="15" /> Configuración
            </router-link>
            <router-link to="/admin/franchises" class="dropdown-item" v-if="auth.isSuperAdmin" @click="showMenu = false">
              <Building2 :size="15" /> Franquicias
            </router-link>
            <router-link to="/select-business" class="dropdown-item" v-if="auth.businesses.length > 1" @click="showMenu = false">
              <ArrowLeftRight :size="15" /> Cambiar negocio
            </router-link>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item danger" @click="logout">
              <LogOut :size="15" /> Cerrar sesión
            </button>
          </div>
        </transition>
      </div>
    </div>
  </header>
</template>

<script setup>
/**
 * NavBar.vue — Barra de navegación superior con toggle de modo oscuro.
 *
 * Props:
 *   title: string — Nombre de la vista actual
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useBusinessStore } from '../stores/business.js'
import { useMenu } from '../composables/useMenu.js'
import { Menu, Store, Sun, Moon, ChevronDown, Settings, Building2, ArrowLeftRight, LogOut } from 'lucide-vue-next'

defineProps({ title: { type: String, default: 'facJp' } })

const auth = useAuthStore()
const businessStore = useBusinessStore()
const router = useRouter()
const { toggleMenu } = useMenu()

const showMenu = ref(false)
const menuRef = ref(null)

// ── Modo oscuro ──────────────────────────────────────────────────
const isDark = ref(document.documentElement.classList.contains('dark'))

function toggleDark() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('facjp_dark', isDark.value ? '1' : '0')
}

// Restaura la preferencia guardada al montar
onMounted(() => {
  const saved = localStorage.getItem('facjp_dark')
  if (saved === '1') {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }
})

// ── Avatar y usuario ─────────────────────────────────────────────
const userInitial = computed(() => {
  const name = auth.user?.name || auth.user?.username || 'U'
  return name.charAt(0).toUpperCase()
})

function logout() {
  auth.logout()
  router.push('/login')
}

function handleOutsideClick(e) {
  if (menuRef.value && !menuRef.value.contains(e.target)) showMenu.value = false
}

onMounted(() => document.addEventListener('click', handleOutsideClick))
onUnmounted(() => document.removeEventListener('click', handleOutsideClick))
</script>

<style scoped>
.navbar {
  height: 60px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 100;
  transition: background var(--transition), border-color var(--transition);
}

.navbar-left { display: flex; align-items: center; gap: 14px; }

.menu-toggle {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 6px;
  border-radius: var(--radius-sm);
  display: none;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
}
.menu-toggle:hover { background: var(--surface-2); color: var(--text); }

.navbar-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.02em;
}

.navbar-right { display: flex; align-items: center; gap: 8px; }

.biz-name {
  font-size: 12.5px;
  color: var(--text-light);
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  padding: 4px 10px;
  background: var(--surface-2);
  border-radius: 20px;
  border: 1px solid var(--border);
}
.biz-logo { width: 18px; height: 18px; border-radius: 4px; object-fit: cover; }
.biz-icon { color: var(--text-light); }

/* Botón icono (modo oscuro) */
.icon-btn {
  background: none;
  border: 1.5px solid var(--border);
  color: var(--text-secondary);
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
}
.icon-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }

.user-menu {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  transition: background var(--transition);
  position: relative;
}
.user-menu:hover { background: var(--surface-2); }

.user-avatar {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--accent);
  color: #1a0a00;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 13px;
}
.user-name { font-size: 13px; font-weight: 600; color: var(--text); }
.arrow { color: var(--text-light); }

.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  min-width: 200px;
  overflow: hidden;
  z-index: 999;
}
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  font-size: 13.5px;
  color: var(--text);
  text-decoration: none;
  cursor: pointer;
  background: none;
  border: none;
  width: 100%;
  text-align: left;
  font-family: inherit;
  font-weight: 500;
  transition: background var(--transition);
}
.dropdown-item:hover { background: var(--surface-2); }
.dropdown-item.danger { color: var(--danger); }
.dropdown-item.danger:hover { background: var(--danger-light); }
.dropdown-divider { height: 1px; background: var(--border); margin: 4px 0; }

@media (max-width: 768px) {
  .menu-toggle { display: flex; }
  .biz-name { display: none; }
  .user-name { display: none; }
}
</style>
