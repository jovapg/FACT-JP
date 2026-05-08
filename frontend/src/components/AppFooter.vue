<template>
  <!--
    AppFooter.vue — Barra de pie de página global

    Se muestra al final de cada vista autenticada, pegada al fondo del área
    principal gracias al layout flex-column de .main-content:
      .main-content (flex-column)
        NavBar
        .content-area (flex: 1 → empuja el footer hacia abajo)
        AppFooter  ← siempre visible al fondo

    Contiene:
      - Izquierda: logo + nombre de la app + versión
      - Derecha:   año y copyright
    Estilo minimalista para no competir con el contenido.
  -->
  <footer class="app-footer">

    <!-- Marca -->
    <div class="footer-brand">
      <div class="footer-logo">
        <UtensilsCrossed :size="12" />
      </div>
      <span class="footer-name">facJp</span>
      <span class="footer-sep">·</span>
      <span class="footer-tagline">Gestión para bares y restaurantes</span>
    </div>

    <!-- Copyright -->
    <div class="footer-copy">
      © {{ year }} · Todos los derechos reservados
    </div>

  </footer>
</template>

<script setup>
import { UtensilsCrossed } from 'lucide-vue-next'

/** Año actual para el texto de copyright — se actualiza solo cada año */
const year = new Date().getFullYear()
</script>

<style scoped>
/*
  El footer ocupa el ancho completo del área principal.
  El border-top separa visualmente el contenido del pie.
  La altura es intencioalmente pequeña (40px) para no ocupar espacio valioso.
*/
.app-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  height: 40px;
  flex-shrink: 0;               /* No se comprime aunque haya poco espacio */
  border-top: 1px solid var(--border);
  background: var(--surface);
  transition: background var(--transition), border-color var(--transition);
}

/* Grupo izquierdo: ícono + nombre + separador + tagline */
.footer-brand {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-light);
  font-size: 11.5px;
}

/* Ícono de marca en un cuadrado ámbar pequeño */
.footer-logo {
  width: 20px;
  height: 20px;
  background: var(--accent);
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1a0a00;
  flex-shrink: 0;
}

.footer-name {
  font-weight: 800;
  font-size: 12px;
  color: var(--text-secondary);
  letter-spacing: -0.03em;
}

.footer-sep {
  color: var(--border);
}

/* El tagline se oculta en pantallas pequeñas para no romper el layout */
.footer-tagline {
  color: var(--text-light);
  font-size: 11px;
}

/* Texto de copyright: alineado a la derecha */
.footer-copy {
  font-size: 11px;
  color: var(--text-light);
  white-space: nowrap;
}

@media (max-width: 768px) {
  .app-footer { padding: 0 16px; }
  .footer-tagline { display: none; }   /* Ocultar tagline en móvil para ahorrar espacio */
  .footer-sep     { display: none; }
}

/* En pantallas pequeñas el footer ocupa espacio valioso — se oculta */
@media (max-width: 480px) {
  .app-footer { display: none; }
}
</style>
