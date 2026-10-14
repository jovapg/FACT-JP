/**
 * utils/download.js — Abre o descarga archivos protegidos (PDF, Excel) sin poner
 * el token de la sesión en la URL.
 *
 * El archivo se pide con axios (que envía el token en el header Authorization) y
 * se muestra desde una URL temporal del navegador (blob). Así el token no queda en
 * el historial, en los logs del servidor ni en enlaces que se puedan compartir.
 */
import api from '../services/api.js'

/** Abre un archivo (por ejemplo un PDF) en una pestaña nueva */
export async function openProtected(url) {
  // La pestaña se abre ya, dentro del clic, para que el navegador no la bloquee
  const tab = window.open('', '_blank')
  try {
    const res = await api.get(url, { responseType: 'blob' })
    const blobUrl = URL.createObjectURL(res.data)
    if (tab) tab.location.href = blobUrl
    else window.location.href = blobUrl
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60 * 1000)
  } catch (err) {
    if (tab) tab.close()
    throw err
  }
}

/** Descarga un archivo (por ejemplo un Excel) con el nombre indicado */
export async function downloadProtected(url, filename) {
  const res = await api.get(url, { responseType: 'blob' })
  const blobUrl = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60 * 1000)
}
