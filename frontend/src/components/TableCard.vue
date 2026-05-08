<template>
  <div
    :class="['table-card', `table-${table.status}`]"
    @click="$emit('click', table)"
  >
    <div class="table-number">Mesa {{ table.number }}</div>
    <div class="table-status-dot"></div>

    <div class="table-status-text" v-if="table.status === 'libre'">
      Libre
    </div>

    <div class="table-order-info" v-else-if="table.order">
      <div class="order-count">{{ table.order.items?.length || 0 }} items</div>
      <div class="order-total">{{ formatCOP(orderTotal) }}</div>
      <div class="order-client" v-if="table.order.client">👤 {{ table.order.client }}</div>
      <div class="order-waiter" v-if="table.order.waiter && !table.order.client">🧑‍🍳 {{ table.order.waiter }}</div>
      <div class="order-time">{{ formatTime(table.order.createdAt) }}</div>
    </div>

    <div class="table-icon">
      🍽️
    </div>
  </div>
</template>

<script setup>
/**
 * TableCard.vue — Tarjeta individual de mesa
 *
 * Muestra el estado visual de una mesa en la vista de Mesas/POS.
 * Colores:
 *   - Verde (table-libre):   mesa disponible, sin pedido
 *   - Rojo (table-ocupada):  mesa ocupada, con pedido en curso
 *
 * Cuando está ocupada, muestra: número de ítems, total del pedido,
 * nombre del cliente (si hay), mesero y hora de apertura.
 * El punto rojo en la esquina tiene animación de pulso cuando está ocupada.
 *
 * Emite 'click' al padre (TablesView) para abrir el panel de pedidos.
 */
import { computed } from 'vue'

const props = defineProps({
  table: { type: Object, required: true }
})

defineEmits(['click'])

/**
 * Calcula el total del pedido activo sumando precio × cantidad de cada ítem.
 * Se usa para mostrar el valor acumulado en la tarjeta antes de facturar.
 */
const orderTotal = computed(() => {
  if (!props.table.order?.items) return 0
  return props.table.order.items.reduce((sum, item) => sum + (item.qty * item.price), 0)
})

/** Formatea valor numérico como precio COP */
function formatCOP(v) {
  return '$' + Number(v || 0).toLocaleString('es-CO')
}

/** Formatea una fecha ISO mostrando solo la hora: '10:30' */
function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.table-card {
  border-radius: var(--radius);
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-height: 150px;
  position: relative;
  box-shadow: var(--shadow);
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  /* Elimina el retraso de 300ms en pantallas táctiles */
  touch-action: manipulation;
}

.table-card:hover { transform: translateY(-3px); box-shadow: 0 6px 20px rgba(0,0,0,0.15); }
.table-card:active { transform: scale(0.97); }

.table-libre {
  background: linear-gradient(135deg, #e8f8f5, #d5f5e3);
  border: 2px solid #27ae60;
}

.table-ocupada {
  background: linear-gradient(135deg, #fde8e8, #f9c6c6);
  border: 2px solid #e74c3c;
}

.table-number {
  font-size: 18px;
  font-weight: 800;
  color: var(--text);
}

.table-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  position: absolute;
  top: 12px;
  right: 12px;
}
.table-libre .table-status-dot { background: #27ae60; }
.table-ocupada .table-status-dot { background: #e74c3c; animation: pulse 1.5s infinite; }

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.3); }
}

.table-status-text {
  font-size: 13px;
  font-weight: 600;
  color: #27ae60;
}

.table-order-info {
  text-align: center;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.order-count {
  font-size: 12px;
  color: var(--text-light);
}

.order-total {
  font-size: 16px;
  font-weight: 800;
  color: var(--danger);
}

.order-client {
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
}
.order-waiter {
  font-size: 11px;
  color: var(--text-light);
}

.order-time {
  font-size: 11px;
  color: var(--text-light);
}

.table-icon {
  font-size: 28px;
  margin-top: auto;
}

@media (max-width: 480px) {
  .table-card { min-height: 130px; padding: 12px; }
  .table-number { font-size: 15px; }
}
</style>
