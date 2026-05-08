/**
 * main.js — Punto de entrada de la aplicación
 *
 * Aquí se crea la instancia de Vue, se registran los plugins
 * globales (Pinia para el estado y Vue Router para la navegación),
 * se importan los estilos globales y se monta la app en el DOM.
 * El service worker (PWA) solo se activa en producción para evitar
 * que cache archivos mientras se desarrolla.
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
import './assets/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Registrar service worker solo en producción
// En desarrollo causaría que el navegador sirva archivos viejos en caché
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

app.mount('#app')
