/**
 * composables/usePedidos.js — Pedidos en línea (carta pública) para quien atiende
 *
 * Singleton: una sola consulta cada 10 s para toda la app. La usan el menú (contador rojo)
 * y la pantalla de Pedidos. Cuando llega un pedido nuevo "por confirmar" suena un aviso
 * (el navegador solo deja sonar después de que la persona toque algo en la página).
 */
import { ref, computed } from 'vue'
import api from '../services/api.js'
import { useAuthStore } from '../stores/auth.js'

const pedidos = ref([])
const loaded = ref(false)
const soundOn = ref(readSound())
let timer = null
let lastPending = -1
let audioCtx = null

function readSound() { try { return localStorage.getItem('facjp_pedidos_sound') !== 'off' } catch { return true } }

function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    const now = audioCtx.currentTime
    ;[0, 0.22, 0.44].forEach((d, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain()
      o.type = 'sine'; o.frequency.value = i === 2 ? 1175 : 880
      g.gain.setValueAtTime(0.0001, now + d)
      g.gain.exponentialRampToValueAtTime(0.35, now + d + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + d + 0.2)
      o.connect(g).connect(audioCtx.destination)
      o.start(now + d); o.stop(now + d + 0.21)
    })
  } catch { /* sin audio: queda el contador */ }
}

export function usePedidos() {
  const auth = useAuthStore()
  const base = () => `/api/${auth.currentBusiness?.id}`

  const pending = computed(() => pedidos.value.filter(p => p.status === 'por_confirmar'))
  // Activos = en proceso + entregados que aún no se han facturado
  const active = computed(() => pedidos.value.filter(p => ['por_confirmar', 'pendiente', 'en_preparacion', 'en_camino'].includes(p.status) || (p.status === 'entregado' && !p.saleId)))

  async function refresh() {
    if (!auth.currentBusiness?.id) return
    try {
      const { data } = await api.get(`${base()}/pedidos`)
      pedidos.value = data
      loaded.value = true
      const n = data.filter(p => p.status === 'por_confirmar').length
      if (lastPending >= 0 && n > lastPending && soundOn.value) beep()
      lastPending = n
    } catch { /* sin conexión: se reintenta en 10 s */ }
  }

  function start() {
    if (timer) return
    lastPending = -1
    refresh()
    timer = setInterval(refresh, 10000)
  }
  function stop() { clearInterval(timer); timer = null; pedidos.value = []; loaded.value = false }

  function toggleSound() {
    soundOn.value = !soundOn.value
    try { localStorage.setItem('facjp_pedidos_sound', soundOn.value ? 'on' : 'off') } catch { /* no guarda */ }
    if (soundOn.value) beep()
  }

  async function update(id, body) {
    const { data } = await api.put(`${base()}/pedidos/${id}`, body)
    await refresh()
    return data
  }

  return { pedidos, loaded, pending, active, soundOn, refresh, start, stop, toggleSound, update }
}
