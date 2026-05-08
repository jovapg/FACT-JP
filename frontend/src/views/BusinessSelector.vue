<template>
  <div class="selector-page">
    <div class="selector-card">
      <div class="selector-header">
        <div class="logo-icon">🍺</div>
        <h2>Selecciona un negocio</h2>
        <p>Bienvenido, {{ auth.user?.name || auth.user?.username }}</p>
      </div>

      <div class="businesses-grid">
        <button
          v-for="biz in auth.businesses"
          :key="biz.id"
          class="biz-card"
          @click="selectBiz(biz)"
        >
          <div class="biz-icon">🏠</div>
          <div class="biz-name">{{ biz.name }}</div>
          <div class="biz-slug">{{ biz.slug }}</div>
        </button>
      </div>

      <div v-if="auth.isSuperAdmin" class="mt-3">
        <button class="btn btn-outline btn-block" @click="router.push('/admin/franchises')">
          + Gestionar franquicias
        </button>
      </div>

      <button class="btn-logout" @click="logout">Cerrar sesión</button>
    </div>
  </div>
</template>

<script setup>
/**
 * BusinessSelector.vue — Selector de negocio
 *
 * Se muestra solo cuando el usuario tiene acceso a múltiples negocios
 * y aún no ha seleccionado uno (típico para el superadmin).
 *
 * Muestra una tarjeta por cada negocio disponible. Al elegir uno,
 * lo guarda en el store y redirige al dashboard de ese negocio.
 */
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const router = useRouter()
const auth = useAuthStore()

/** Selecciona el negocio y navega al dashboard */
function selectBiz(biz) {
  auth.selectBusiness(biz)
  router.push('/dashboard')
}

/** Cierra sesión completamente */
function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<style scoped>
.selector-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e, #0f3460);
  padding: 20px;
}

.selector-card {
  background: white;
  border-radius: 20px;
  padding: 40px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}

.selector-header {
  text-align: center;
  margin-bottom: 32px;
}
.selector-header .logo-icon { font-size: 40px; }
.selector-header h2 { font-size: 22px; font-weight: 700; margin: 8px 0 4px; }
.selector-header p { color: var(--text-light); font-size: 14px; }

.businesses-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.biz-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 16px;
  background: var(--bg);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}
.biz-card:hover {
  border-color: var(--accent);
  background: #fff5f7;
  transform: translateY(-2px);
}
.biz-icon { font-size: 32px; margin-bottom: 8px; }
.biz-name { font-weight: 700; font-size: 15px; color: var(--text); }
.biz-slug { font-size: 12px; color: var(--text-light); margin-top: 2px; }

.mt-3 { margin-top: 12px; }

.btn-logout {
  display: block;
  width: 100%;
  text-align: center;
  margin-top: 16px;
  background: none;
  border: none;
  color: var(--text-light);
  font-size: 13px;
  cursor: pointer;
  padding: 8px;
}
.btn-logout:hover { color: var(--danger); }
</style>
