/**
 * composables/useSpaces.js — Cómo se llaman los "espacios" de venta de cada negocio
 *
 * El superadmin define en Franquicias si un negocio usa Mesas, Campos, Pistas…,
 * si los espacios tienen nombre propio (Alfa, Mega, Beta), si cada uno guarda varias
 * ventas abiertas (multi) y cómo se llama el módulo de recetas (Recetas, Combos…).
 * Todo viene del perfil del negocio activo; sin configurar, es un restaurante clásico.
 */

import { computed, reactive } from 'vue'
import { useBusinessStore } from '../stores/business.js'

export function useSpaces() {
  const businessStore = useBusinessStore()

  const label = computed(() => businessStore.profile?.spaceLabel || 'Mesa')
  const plural = computed(() => businessStore.profile?.spaceLabelPlural || label.value + 's')
  const multi = computed(() => !!businessStore.profile?.multiOrders)
  const recipesLabel = computed(() => businessStore.profile?.recipesLabel || 'Recetas')

  /** ¿El negocio usa este módulo? (debtors, payroll, finance, reports, audit). Sin dato = sí */
  const has = (key) => businessStore.profile?.modules?.[key] !== false

  /** Nombre corto del espacio: "Alfa" o "3" */
  const shortName = (t) => String(t?.name || t?.number || '')
  /** Nombre completo del espacio: "Campo Alfa" o "Mesa 3" */
  const nameOf = (t) => `${label.value} ${shortName(t)}`.trim()

  // reactive() deja usar spaces.label / spaces.plural directo en las plantillas
  return reactive({ label, plural, multi, recipesLabel, has, shortName, nameOf })
}
