<template>
  <div id="app-root">
    <router-view v-slot="{ Component }">
      <transition name="page">
        <component :is="Component" :key="$route.path" />
      </transition>
    </router-view>

    <!-- Banner de actualización disponible -->
    <div v-if="hasUpdate" class="update-banner" @click="applyUpdate">
      🔄 Nueva versión disponible — Toca aquí para actualizar
    </div>

    <!-- Toast de notificación global -->
    <transition name="toast-anim">
      <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">
        <span class="toast-dot"></span>
        {{ toast.message }}
      </div>
    </transition>
  </div>
</template>

<script setup>
/**
 * App.vue — Componente raíz de la aplicación
 *
 * Es el componente de más alto nivel. Contiene:
 *   1. El <router-view> con transición 'fade' para cambiar entre vistas
 *   2. El sistema global de notificaciones tipo "toast"
 *
 * El toast se provee con `provide('toast', showToast)` para que
 * cualquier componente descendiente pueda mostrarlo con:
 *   const toast = inject('toast')
 *   toast('Mensaje', 'success' | 'error' | 'warning' | 'info')
 */
import { reactive, ref, provide } from 'vue'

// Estado reactivo del toast: visible, mensaje y tipo de color
const toast = reactive({ show: false, message: '', type: 'success' })

/**
 * Muestra una notificación flotante (toast) en la parte inferior de la pantalla.
 * @param {string} message  - Texto a mostrar
 * @param {string} type     - Tipo de toast: 'success' | 'error' | 'warning' | 'info'
 * @param {number} duration - Milisegundos que permanece visible (por defecto 3000)
 */
function showToast(message, type = 'success', duration = 3000) {
  toast.message = message
  toast.type = type
  toast.show = true
  setTimeout(() => { toast.show = false }, duration)
}

// Proveer la función a todos los componentes descendientes via inject('toast')
provide('toast', showToast)

// ── Detección de actualización del Service Worker ─────────────────
// Cuando el nuevo SW toma el control (skipWaiting activo), mostramos
// un banner para que el usuario recargue voluntariamente.
const hasUpdate = ref(false)
function applyUpdate() { window.location.reload() }

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    hasUpdate.value = true
  })
}
</script>

<style>
/* Toast mejorado */
.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  padding: 11px 20px;
  border-radius: 10px;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  font-size: 13.5px;
  z-index: 9999;
  box-shadow: 0 8px 28px rgba(0,0,0,0.22);
  max-width: 90vw;
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
  letter-spacing: -0.01em;
}
.toast-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255,255,255,0.6);
  flex-shrink: 0;
}
.toast-success { background: #064e3b; color: #6ee7b7; }
.toast-error   { background: #7f1d1d; color: #fca5a5; }
.toast-warning { background: #78350f; color: #fcd34d; }
.toast-info    { background: #1e3a5f; color: #93c5fd; }

/* Banner de actualización */
.update-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  color: #1a0a00;
  text-align: center;
  padding: 10px 16px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  z-index: 99999;
  letter-spacing: -0.01em;
  box-shadow: 0 2px 12px rgba(245,158,11,0.4);
  animation: slideDown 0.3s ease;
}
@keyframes slideDown {
  from { transform: translateY(-100%); }
  to   { transform: translateY(0); }
}

/* Animación del toast */
.toast-anim-enter-active { transition: all 0.28s cubic-bezier(0.34,1.56,0.64,1); }
.toast-anim-leave-active { transition: all 0.2s ease; }
.toast-anim-enter-from  { opacity: 0; transform: translateX(-50%) translateY(16px) scale(0.92); }
.toast-anim-leave-to    { opacity: 0; transform: translateX(-50%) translateY(8px); }
</style>
