/**
 * utils/payment.js — Helpers para mostrar los métodos de pago de forma consistente.
 *
 * Centraliza el formato visible (etiqueta, badge, icono) de los distintos
 * paymentMethod usados en el sistema para no duplicar el mapeo en cada vista.
 */

import { Banknote, Smartphone, CreditCard, Receipt, Wallet } from 'lucide-vue-next'

const LABELS = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  pago_fiado: 'Pago de fiado'
}

const BADGES = {
  efectivo: 'badge-success',
  transferencia: 'badge-info',
  tarjeta: 'badge-warning',
  pago_fiado: 'badge-purple'
}

const ICONS = {
  efectivo: Banknote,
  transferencia: Smartphone,
  tarjeta: CreditCard,
  pago_fiado: Wallet
}

/** Etiqueta legible: 'pago_fiado' → 'Pago de fiado' */
export function paymentLabel(method) {
  if (!method) return '—'
  return LABELS[method.toLowerCase()] || method
}

/** Clase CSS del badge: 'pago_fiado' → 'badge-purple' */
export function paymentBadge(method) {
  if (!method) return 'badge-default'
  return BADGES[method.toLowerCase()] || 'badge-default'
}

/** Componente de icono lucide para el método */
export function paymentIcon(method) {
  if (!method) return Receipt
  return ICONS[method.toLowerCase()] || Receipt
}
