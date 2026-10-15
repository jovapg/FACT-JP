/**
 * utils/updateBanner.js — Aviso "Hay una versión nueva" (PWA)
 *
 * Cuando el service worker detecta una versión nueva de la app, se muestra una barra
 * abajo con un botón para actualizar. No recarga sola para no interrumpir a alguien que
 * está armando una venta (el pedido en pantalla se perdería).
 *
 * Es DOM puro (sin Vue) para que funcione aunque la app esté en cualquier pantalla.
 */

export function showUpdateBanner() {
  if (document.getElementById('update-banner')) return

  const bar = document.createElement('div')
  bar.id = 'update-banner'
  bar.setAttribute('role', 'status')
  bar.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:16px', 'transform:translateX(-50%)', 'z-index:10000',
    'display:flex', 'align-items:center', 'gap:12px', 'padding:10px 14px',
    'background:#0f172a', 'color:#f1f5f9', 'border:1px solid #f59e0b', 'border-radius:12px',
    'font:600 13px Inter,system-ui,sans-serif', 'box-shadow:0 8px 24px rgba(0,0,0,.35)',
    'max-width:calc(100vw - 24px)'
  ].join(';')

  const text = document.createElement('span')
  text.textContent = 'Hay una versión nueva de la app'

  const update = document.createElement('button')
  update.textContent = 'Actualizar'
  update.style.cssText = 'background:#f59e0b;color:#1a0a00;border:0;border-radius:8px;padding:6px 12px;font:700 13px Inter,system-ui,sans-serif;cursor:pointer'
  update.onclick = () => window.location.reload()

  const close = document.createElement('button')
  close.textContent = '✕'
  close.setAttribute('aria-label', 'Cerrar aviso')
  close.style.cssText = 'background:none;border:0;color:#94a3b8;font-size:14px;cursor:pointer;padding:2px 4px'
  close.onclick = () => bar.remove()

  bar.append(text, update, close)
  document.body.appendChild(bar)
}
