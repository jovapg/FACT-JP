/**
 * stores/domicilios.js — Domicilios hechos a mano (los que NO entraron por la carta en línea)
 *
 * Son pedidos guardados sin mesa: se listan como tarjetas debajo de las mesas y desaparecen al facturarse o cancelarse.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api.js'
import { useAuthStore } from './auth.js'

export const useDomiciliosStore = defineStore('domicilios', () => {
  const auth = useAuthStore()
  const list = ref([])
  const loading = ref(false)
  const bizId = () => auth.currentBusiness?.id
  const base = () => `/api/${bizId()}/domicilios`

  const count = computed(() => list.value.length)

  async function fetch() {
    if (!bizId()) return
    try { list.value = (await api.get(base())).data } catch { /* sin conexión o módulo apagado: se queda la lista que había */ }
  }

  /** Crea o actualiza (si trae id). Devuelve el domicilio guardado. */
  async function save({ id, name, phone, address, items }) {
    const body = { name, phone, address, items }
    const res = id ? await api.put(`${base()}/${id}`, body) : await api.post(base(), body)
    await fetch()
    return res.data
  }

  async function setStatus(id, status) {
    const prev = list.value.find(d => d.id === id)
    if (prev) prev.status = status // se ve al instante; si falla, se vuelve a leer
    try { await api.put(`${base()}/${id}`, { status }) } finally { await fetch() }
  }

  async function cancel(id) {
    await api.delete(`${base()}/${id}`)
    await fetch()
  }

  return { list, loading, count, fetch, save, setStatus, cancel }
})
