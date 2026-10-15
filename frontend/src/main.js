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
import { showUpdateBanner } from './utils/updateBanner.js'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Registrar service worker solo en producción
// En desarrollo causaría que el navegador sirva archivos viejos en caché
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // ¿Ya había una versión controlando la página? Si no, es la primera visita: no hay nada que avisar
  const hadController = !!navigator.serviceWorker.controller

  // Una versión nueva tomó el control: se avisa con un botón para actualizar
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) showUpdateBanner()
  })

  window.addEventListener('load', async () => {
    try {
      // updateViaCache: 'none' → el archivo del service worker siempre se pide fresco al servidor
      const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })

      // El navegador solo busca versiones nuevas al abrir la app desde cero. En el celular la app
      // queda minimizada por horas, así que se busca también al volver a ella, al recuperar
      // internet y cada 5 minutos.
      const check = () => reg.update().catch(() => {})
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.addEventListener('online', check)
      setInterval(check, 5 * 60 * 1000)
    } catch {
      // Sin service worker la app funciona igual (solo sin modo offline)
    }
  })
}

app.mount('#app')
