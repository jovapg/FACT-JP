<template>
  <section class="dm-sec" aria-label="Domicilios">
    <div class="dm-head">
      <h3 class="dm-title">🛵 Domicilios <span class="dm-count">{{ store.count }}</span></h3>
      <button class="btn btn-primary btn-sm" @click="$emit('new')">+ Nuevo domicilio</button>
    </div>

    <p v-if="!store.count" class="dm-empty">
      No hay domicilios por enviar. Cuando llegue uno por teléfono o WhatsApp, créalo aquí y se queda guardado hasta que lo factures.
    </p>

    <div v-else class="dm-grid">
      <article v-for="d in store.list" :key="d.id" :class="['dm-card', { sent: d.status === 'en_camino' }]">
        <div class="dm-row">
          <strong class="dm-name">{{ d.name }}</strong>
          <span class="dm-pill" :class="d.status === 'en_camino' ? 'go' : 'wait'">{{ d.status === 'en_camino' ? 'En camino' : 'Por enviar' }}</span>
        </div>
        <p v-if="d.phone || d.address" class="dm-info">
          <span v-if="d.phone">📞 {{ d.phone }}</span>
          <span v-if="d.address">📍 {{ d.address }}</span>
        </p>
        <p class="dm-items">{{ summary(d) }}</p>
        <div class="dm-foot">
          <span class="dm-meta">🛵 {{ money(fee(d)) }} · {{ ago(d.createdAt) }}</span>
          <strong class="dm-total">{{ money(total(d)) }}</strong>
        </div>
        <button v-if="d.status !== 'en_camino'" class="dm-ship" @click="toggle(d)">🛵 Marcar en camino</button>
        <button v-else class="dm-ship back" @click="toggle(d)">↩ Aún no salió</button>
        <div class="dm-actions">
          <button class="btn btn-outline btn-sm" @click="$emit('open', d)">Abrir</button>
          <button class="btn btn-primary btn-sm" @click="$emit('bill', d)">Facturar</button>
          <button class="dm-cancel" title="Cancelar este domicilio" aria-label="Cancelar domicilio" @click="cancel(d)">🗑️</button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted, inject } from 'vue'
import { useDomiciliosStore } from '../stores/domicilios.js'

defineEmits(['new', 'open', 'bill'])
const store = useDomiciliosStore()
const toast = inject('toast')

const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO')
const fee = (d) => (d.items || []).filter(i => i.kind === 'domicilio').reduce((s, i) => s + i.qty * i.price, 0)
const total = (d) => (d.items || []).reduce((s, i) => s + i.qty * i.price - (Number(i.discount) || 0), 0)
function summary(d) {
  const t = (d.items || []).filter(i => i.kind !== 'domicilio').map(i => `${i.qty} ${i.name}`).join(' · ')
  return t.length > 80 ? t.slice(0, 77) + '…' : t
}

// "hace 4 min": se refresca solo cada 30 segundos
const now = ref(Date.now())
function ago(iso) {
  const m = Math.max(0, Math.round((now.value - new Date(iso).getTime()) / 60000))
  if (m < 1) return 'hace un momento'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  return h < 24 ? `hace ${h} h ${m % 60} min` : 'hace más de un día'
}

async function toggle(d) {
  try { await store.setStatus(d.id, d.status === 'en_camino' ? 'por_enviar' : 'en_camino') }
  catch (e) { toast(e.response?.data?.error || 'No se pudo cambiar el estado', 'error') }
}
async function cancel(d) {
  if (!window.confirm(`¿Cancelar el domicilio de ${d.name} por ${money(total(d))}? No se factura y no se puede deshacer.`)) return
  try { await store.cancel(d.id); toast('Domicilio cancelado', 'success') }
  catch (e) { toast(e.response?.data?.error || 'No se pudo cancelar', 'error'); store.fetch() }
}

// La lista se actualiza sola (otro cajero puede crear o facturar uno)
let tick = null, poll = null
onMounted(() => {
  store.fetch()
  tick = setInterval(() => { now.value = Date.now() }, 30000)
  poll = setInterval(() => store.fetch(), 20000)
})
onUnmounted(() => { clearInterval(tick); clearInterval(poll) })
</script>

<style scoped>
.dm-sec { margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--border); }
.dm-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.dm-title { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px; margin: 0; }
.dm-count { background: var(--text); color: var(--surface); border-radius: 99px; font-size: 12px; padding: 1px 9px; font-weight: 700; }
.dm-empty { color: var(--text-muted); font-size: 13px; margin: 0; padding: 14px; border: 1px dashed var(--border); border-radius: 12px; }
.dm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
.dm-card { background: var(--surface); border: 1px solid var(--border); border-left: 4px solid #f59e0b; border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
.dm-card.sent { border-left-color: var(--success, #16a34a); }
.dm-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.dm-name { font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dm-pill { border-radius: 99px; padding: 3px 10px; font-size: 11px; font-weight: 700; white-space: nowrap; }
.dm-ship { border: 1px dashed var(--success, #16a34a); background: rgba(22, 163, 74, .08); color: #15803d; border-radius: 8px; padding: 6px 10px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; }
.dm-ship:hover { background: rgba(22, 163, 74, .16); }
.dm-ship.back { border-color: var(--border); background: transparent; color: var(--text-muted); font-weight: 500; }
.dm-pill.wait { background: rgba(245, 158, 11, .18); color: #b45309; }
.dm-pill.go { background: rgba(22, 163, 74, .16); color: #15803d; }
.dm-info { margin: 0; font-size: 12px; color: var(--text-muted); display: flex; flex-direction: column; gap: 1px; }
.dm-items { margin: 0; font-size: 13px; }
.dm-foot { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-top: 2px; }
.dm-meta { font-size: 12px; color: var(--text-muted); }
.dm-total { font-size: 17px; }
.dm-actions { display: flex; gap: 8px; margin-top: 4px; align-items: center; }
.dm-actions .btn { flex: 1; justify-content: center; }
.dm-cancel { border: 1px solid var(--border); background: transparent; border-radius: 8px; min-width: 36px; height: 32px; cursor: pointer; }
.dm-cancel:hover { border-color: var(--danger, #dc2626); }
</style>
