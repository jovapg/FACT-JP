<template>
  <!--
    PageLayout.vue — Wrapper de layout para todas las vistas autenticadas

    Consolida el patrón repetido en cada vista:
      SideMenu + NavBar + content-area + AppFooter

    Antes, cada vista tenía:
      <div class="app-layout">
        <SideMenu />
        <div class="main-content">
          <NavBar title="X" />
          <div class="content-area"> ... </div>
        </div>
      </div>

    Ahora cada vista simplemente usa:
      <PageLayout title="X">
        ... contenido ...
      </PageLayout>

    El footer queda en un solo lugar y se actualiza automáticamente en toda la app.

    Props:
      title: string — Título que se pasa a la NavBar (nombre de la vista)
  -->
  <div class="app-layout">
    <SideMenu />
    <div class="main-content">
      <NavBar :title="title" />
      <div class="content-area">
        <!-- <slot> recibe todo el contenido de la vista hija -->
        <slot />
      </div>
      <!-- Footer global: siempre pegado al fondo gracias al flex layout -->
      <AppFooter />
    </div>
  </div>
</template>

<script setup>
import SideMenu   from './SideMenu.vue'
import NavBar     from './NavBar.vue'
import AppFooter  from './AppFooter.vue'

defineProps({
  /** Nombre de la vista actual, se muestra en la NavBar */
  title: { type: String, default: 'facJp' }
})
</script>
