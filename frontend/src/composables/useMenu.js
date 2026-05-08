/**
 * useMenu.js — Composable para el menú lateral móvil
 *
 * Maneja el estado de apertura/cierre del menú lateral (SideMenu)
 * en dispositivos móviles. La ref `isMenuOpen` se declara FUERA
 * del composable para que sea un singleton: tanto NavBar (que tiene
 * el botón hamburguesa) como SideMenu (que se abre/cierra) comparten
 * exactamente la misma referencia.
 */

import { ref } from 'vue'

// Singleton — la misma ref es compartida entre NavBar y SideMenu
const isMenuOpen = ref(false)

export function useMenu() {
  /** Alterna el estado abierto/cerrado del menú */
  function toggleMenu() { isMenuOpen.value = !isMenuOpen.value }

  /** Cierra el menú (se llama al navegar o al tocar el overlay) */
  function closeMenu() { isMenuOpen.value = false }

  return { isMenuOpen, toggleMenu, closeMenu }
}
