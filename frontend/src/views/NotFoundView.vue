<template>
  <!--
    NotFoundView.vue — Página 404 personalizada

    Se muestra cuando el usuario accede a una ruta que no existe.
    Mantiene la identidad visual de la app con el logo y la paleta de colores.
  -->
  <div class="nf-layout">
    <div class="nf-card">

      <!-- Marca / logo -->
      <div class="nf-brand">
        <UtensilsCrossed :size="30" color="#f59e0b" />
        <span class="nf-brand-name">facJp</span>
      </div>

      <!-- Número de error con gradiente de marca -->
      <div class="nf-code">404</div>

      <h1 class="nf-title">Página no encontrada</h1>
      <p class="nf-subtitle">
        La ruta <code class="nf-path">{{ $route.path }}</code> no existe
        o fue movida a otra ubicación.
      </p>

      <!-- Acciones de navegación -->
      <div class="nf-actions">
        <router-link to="/dashboard" class="btn btn-primary">
          ← Volver al Dashboard
        </router-link>
        <router-link to="/tables" class="btn btn-outline">
          Ir a Mesas
        </router-link>
      </div>

    </div>
  </div>
</template>

<script setup>
import { UtensilsCrossed } from 'lucide-vue-next'
</script>

<style scoped>
.nf-layout {
  min-height: 100vh;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.nf-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 52px 44px;
  text-align: center;
  max-width: 440px;
  width: 100%;
  border: 1px solid var(--border);
}

/* Logo / marca */
.nf-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 36px;
}
.nf-brand-name {
  font-size: 22px;
  font-weight: 900;
  color: var(--text);
  letter-spacing: -0.04em;
}

/* Número 404 con gradiente de marca */
.nf-code {
  font-size: 100px;
  font-weight: 900;
  line-height: 1;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 18px;
  letter-spacing: -0.04em;
}

.nf-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 10px;
  letter-spacing: -0.02em;
}

.nf-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 36px;
  line-height: 1.65;
}

/* Ruta de la URL que no existe */
.nf-path {
  font-family: 'Inter', monospace;
  background: var(--surface-2);
  padding: 2px 8px;
  border-radius: 5px;
  font-size: 13px;
  border: 1px solid var(--border);
  color: var(--accent);
}

/* Botones de acción */
.nf-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}
</style>
