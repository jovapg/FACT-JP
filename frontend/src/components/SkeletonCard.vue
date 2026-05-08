<template>
  <!--
    SkeletonCard.vue — Placeholder de carga con efecto shimmer

    Reemplaza los spinners por bloques que imitan la forma del contenido real,
    dando la sensación de que la app carga rápido (skeleton loading pattern).

    Props:
      type:  'stat'  → tarjetas de métricas (ícono + etiqueta + valor)
             'chart' → área de gráfica
             'table' → filas de tabla
      count: cuántos ítems mostrar (aplica a 'stat' y 'table')
  -->
  <div class="sk-wrap">

    <!-- Variante: tarjetas de métricas -->
    <template v-if="type === 'stat'">
      <div class="sk-stat-card" v-for="n in count" :key="n">
        <div class="sk-circle"></div>
        <div class="sk-lines">
          <div class="sk-line" style="width:52%;height:11px"></div>
          <div class="sk-line" style="width:68%;height:22px;margin-top:8px"></div>
        </div>
      </div>
    </template>

    <!-- Variante: área de gráfica -->
    <template v-else-if="type === 'chart'">
      <div class="sk-chart"></div>
    </template>

    <!-- Variante: filas de tabla -->
    <template v-else-if="type === 'table'">
      <div class="sk-table-row" v-for="n in count" :key="n">
        <div class="sk-line" style="width:22%;height:13px"></div>
        <div class="sk-line" style="width:32%;height:13px"></div>
        <div class="sk-line" style="width:14%;height:13px"></div>
        <div class="sk-line" style="width:10%;height:13px"></div>
      </div>
    </template>

  </div>
</template>

<script setup>
/**
 * Props del componente SkeletonCard.
 */
defineProps({
  type:  { type: String, default: 'stat' },   // 'stat' | 'chart' | 'table'
  count: { type: Number, default: 4 }          // cantidad de ítems a renderizar
})
</script>

<style scoped>
/*
  Animación shimmer: gradiente que barre de izquierda a derecha,
  simulando un reflejo de luz sobre el placeholder.
*/
@keyframes shimmer {
  0%   { background-position: -600px 0; }
  100% { background-position: 600px 0; }
}

/* Mixin base para todos los elementos shimmer */
.sk-line,
.sk-circle,
.sk-chart {
  background: linear-gradient(
    90deg,
    var(--border) 25%,
    var(--surface-2) 50%,
    var(--border) 75%
  );
  background-size: 1200px 100%;
  animation: shimmer 1.5s infinite linear;
  border-radius: 6px;
}

/*
  display: contents elimina el div wrapper del flujo de layout,
  haciendo que sus hijos participen directamente en el grid del padre.
  Esto permite usar <SkeletonCard> dentro de un .grid-4 sin romper la cuadrícula.
*/
.sk-wrap {
  display: contents;
}

/* ── Stat card skeleton ─────────────────────────────────────────── */
.sk-stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: var(--shadow-sm);
}

.sk-circle {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  flex-shrink: 0;
}

.sk-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.sk-line {
  display: block;
  height: 13px;
}

/* ── Chart skeleton ──────────────────────────────────────────────── */
.sk-chart {
  height: 100%;
  width: 100%;
  min-height: 200px;
  border-radius: var(--radius-sm);
}

/* ── Table rows skeleton ─────────────────────────────────────────── */
.sk-table-row {
  display: flex;
  gap: 20px;
  padding: 13px 0;
  border-bottom: 1px solid var(--border);
}

.sk-table-row:last-child {
  border-bottom: none;
}
</style>
