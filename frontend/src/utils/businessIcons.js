/**
 * utils/businessIcons.js — Íconos que se pueden asignar a cada negocio/franquicia.
 *
 * El superadmin escoge uno al crear la franquicia (o después, desde su tarjeta).
 * Se guarda la clave (`icon`) en businesses.json y en profile.json; el menú
 * lateral dibuja el ícono correspondiente cuando el negocio no tiene logo.
 *
 * Las claves deben coincidir con BUSINESS_ICON_KEYS de api/src/routes/businesses.js.
 */

import {
  Store, Utensils, Beer, Coffee, Crosshair,
  Croissant, Dumbbell, Hotel, Wine, Briefcase
} from 'lucide-vue-next'

export const BUSINESS_ICONS = [
  { key: 'store',     label: 'Tienda',        icon: Store },
  { key: 'utensils',  label: 'Restaurante',   icon: Utensils },
  { key: 'beer',      label: 'Bar',           icon: Beer },
  { key: 'wine',      label: 'Licorería',     icon: Wine },
  { key: 'coffee',    label: 'Café',          icon: Coffee },
  { key: 'crosshair', label: 'Campo de tiro', icon: Crosshair },
  { key: 'croissant', label: 'Panadería',     icon: Croissant },
  { key: 'dumbbell',  label: 'Gimnasio',      icon: Dumbbell },
  { key: 'hotel',     label: 'Hotel',         icon: Hotel },
  { key: 'briefcase', label: 'Otro negocio',  icon: Briefcase }
]

/** Ícono por defecto: neutro (no de restaurante) */
export const DEFAULT_BUSINESS_ICON = 'store'

/** Devuelve el componente del ícono para una clave (o el neutro si no existe) */
export function businessIconFor(key) {
  return (BUSINESS_ICONS.find(i => i.key === key) || BUSINESS_ICONS[0]).icon
}
