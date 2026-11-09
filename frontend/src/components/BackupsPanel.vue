<template>
  <div class="card bp">
    <div class="bp-head">
      <div>
        <h3 class="bp-title">Respaldos de seguridad</h3>
        <p class="bp-text">Cada 6 horas se crea uno con todos los datos y las fotos. Se guardan los últimos {{ info.keep }} en el servidor y, si configuras el respaldo externo, también <b>cifrados</b> en Backblaze, fuera de Railway.</p>
      </div>
      <div class="bp-btns">
        <button class="btn btn-sm btn-outline" :disabled="busy" @click="makeLocal">Respaldar ahora</button>
        <button class="btn btn-sm btn-primary" :disabled="busy || !ready" :title="ready ? '' : 'Primero configura el respaldo externo'" @click="runRemote">{{ busy === 'run' ? 'Subiendo…' : 'Respaldar y subir' }}</button>
        <button class="btn btn-sm btn-outline" @click="openRestore(null)">♻️ Restaurar</button>
      </div>
    </div>

    <!-- Estado -->
    <div class="bp-status">
      <div :class="['bp-box', info.backups.length ? 'ok' : 'warn']">
        <span>Copia en el servidor</span>
        <b>{{ info.backups.length ? fmtDate(info.backups[0].createdAt) : 'Todavía no hay' }}</b>
        <small>Si se pierde el servidor, esta copia se pierde con él.</small>
      </div>
      <div :class="['bp-box', remoteState.cls]">
        <span>Copia externa (Backblaze)</span>
        <b>{{ remoteState.title }}</b>
        <small>{{ remoteState.detail }}</small>
      </div>
      <div v-if="ready" :class="['bp-box', verifyState.cls]">
        <span>Comprobación semanal</span>
        <b>{{ verifyState.title }}</b>
        <small>{{ verifyState.detail }}</small>
      </div>
    </div>

    <!-- Cómo configurar -->
    <div v-if="!info.offsite.configured" class="bp-help">
      <b>Falta configurar el respaldo externo.</b> En Railway → servicio FACT-JP → <b>Variables</b> agrega:
      <code>B2_KEY_ID</code>, <code>B2_APP_KEY</code>, <code>B2_BUCKET</code> y <code>B2_ENDPOINT</code> (los datos de tu cuenta de Backblaze). Después de que Railway despliegue, vuelve aquí.
    </div>
    <div v-else-if="!info.offsite.keyReady" class="bp-help">
      <b>Falta la clave de cifrado.</b> Los respaldos se cifran antes de salir del servidor. La clave se crea una sola vez y se muestra una sola vez: guárdala en dos lugares.
      <div style="margin-top:8px"><button class="btn btn-sm btn-primary" :disabled="busy" @click="makeKey">Crear la clave de cifrado</button></div>
    </div>
    <div v-else class="bp-row-actions">
      <button class="btn btn-sm btn-outline" :disabled="busy" @click="testConn">{{ busy === 'test' ? 'Probando…' : 'Probar conexión' }}</button>
      <button class="btn btn-sm btn-outline" :disabled="busy" @click="verifyNow">{{ busy === 'verify' ? 'Comprobando…' : 'Comprobar el último respaldo externo' }}</button>
    </div>

    <p v-if="!info.backups.length" class="bp-text">Todavía no hay respaldos. El primero se crea solo, un minuto después de que arranca el servidor.</p>
    <table v-else class="table bp-table">
      <thead><tr><th>Fecha</th><th>Tamaño</th><th></th></tr></thead>
      <tbody>
        <tr v-for="b in info.backups.slice(0, 12)" :key="b.name">
          <td>{{ fmtDate(b.createdAt) }}</td><td>{{ fmtSize(b.size) }}</td>
          <td class="bp-act">
            <button class="btn btn-sm btn-outline" @click="download(b)">⬇️ Descargar</button>
            <button class="btn btn-sm btn-outline" @click="openRestore({ source: 'local', name: b.name })">♻️ Restaurar</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="info.backups.length > 12" class="bp-text">Se muestran los 12 más recientes de {{ info.backups.length }}.</p>

    <!-- Clave de cifrado: se muestra una sola vez -->
    <div v-if="keyModal" class="modal-overlay">
      <div class="modal" style="max-width:520px">
        <div class="modal-header"><h3 class="modal-title">🔑 Tu clave de cifrado</h3></div>
        <div class="modal-body">
          <p class="bp-text"><b>Esta es la única vez que se muestra.</b> Sin esta clave, los respaldos cifrados <b>no se pueden abrir</b>, ni siquiera por nosotros. Guárdala en <b>dos lugares</b> (por ejemplo, tu administrador de contraseñas y una nota impresa).</p>
          <code class="bp-key">{{ keyModal.key }}</code>
          <button class="btn btn-sm btn-outline" style="margin-top:8px" @click="copy(keyModal.key)">📋 Copiar</button>
          <label class="bp-check"><input type="checkbox" v-model="keyModal.ack" /> Ya la guardé en dos lugares.</label>
        </div>
        <div class="modal-footer"><button class="btn btn-primary" :disabled="!keyModal.ack" @click="keyModal = null">Listo</button></div>
      </div>
    </div>

    <!-- Restaurar -->
    <div v-if="rs" class="modal-overlay" @click.self="closeRestore">
      <div class="modal bp-modal">
        <div class="modal-header"><h3 class="modal-title">♻️ Restaurar datos</h3><button class="btn-close" @click="closeRestore">×</button></div>
        <div class="modal-body">
          <!-- 1 · Escoger el respaldo -->
          <template v-if="!rs.summary && !rs.result">
            <p class="bp-text">Escoge de dónde sale el respaldo. Todavía no se cambia nada: primero lo abres y ves qué trae.</p>
            <div class="bp-seg">
              <button :class="{ on: rs.source === 'local' }" @click="rs.source = 'local'; rs.name = info.backups[0]?.name || ''">En el servidor</button>
              <button :class="{ on: rs.source === 'offsite' }" :disabled="!info.offsite.configured" @click="rs.source = 'offsite'; loadRemote()">Externo (Backblaze)</button>
              <button :class="{ on: rs.source === 'upload' }" @click="rs.source = 'upload'; rs.name = ''">Subir un archivo</button>
            </div>
            <div v-if="rs.source === 'local'" class="form-group">
              <label class="form-label">Respaldo</label>
              <select v-model="rs.name" class="form-control"><option v-for="b in info.backups" :key="b.name" :value="b.name">{{ fmtDate(b.createdAt) }} · {{ fmtSize(b.size) }}</option></select>
            </div>
            <div v-else-if="rs.source === 'offsite'" class="form-group">
              <label class="form-label">Respaldo externo</label>
              <select v-model="rs.name" class="form-control"><option v-for="o in remote" :key="o.key" :value="o.key">{{ fmtDate(o.lastModified) }} · {{ fmtSize(o.size) }} · {{ o.key.replace('backups/', '') }}</option></select>
              <p v-if="!remote.length" class="bp-text">No hay respaldos externos todavía.</p>
            </div>
            <div v-else class="form-group">
              <label class="form-label">Archivo de respaldo (.json.gz o .enc)</label>
              <input type="file" class="form-control" @change="rs.file = $event.target.files[0]" />
            </div>
            <div v-if="rs.source !== 'local'" class="form-group">
              <label class="form-label">Clave de cifrado</label>
              <input v-model="rs.key" class="form-control" placeholder="xxxxxxxx-xxxxxxxx-…" autocomplete="off" />
              <small class="bp-text">Hace falta si el archivo está cifrado.</small>
            </div>
          </template>

          <!-- 2 · Qué trae -->
          <template v-else-if="rs.summary">
            <p class="bp-text">Respaldo del <b>{{ fmtDate(rs.summary.createdAt) }}</b>: {{ rs.summary.files }} archivos y {{ rs.summary.photos }} fotos. Escoge qué restaurar.</p>
            <label class="bp-check bp-all"><input type="radio" value="all" v-model="rs.scope" /> <b>Todo</b> (reemplaza los archivos de todas las franquicias que trae el respaldo)</label>
            <label class="bp-check bp-all"><input type="radio" value="some" v-model="rs.scope" /> <b>Solo estas franquicias:</b></label>
            <div v-if="rs.scope === 'some'" class="bp-biz">
              <label v-for="b in rs.summary.businesses" :key="b.id" class="bp-check">
                <input type="checkbox" :value="b.id" v-model="rs.ids" />
                <span><b>{{ b.name }}</b> · {{ b.sales }} ventas, {{ b.pedidos }} pedidos, {{ b.products }} productos, {{ b.users }} usuarios<template v-if="b.lastSale"> · última venta {{ fmtDate(b.lastSale) }}</template></span>
              </label>
            </div>
            <div class="bp-warn">⚠️ Lo que se hizo <b>después</b> de la fecha del respaldo, en lo que restaures, se pierde. Antes de empezar, la app guarda un respaldo de seguridad de lo que hay ahora. Hazlo cuando no haya movimiento en esa franquicia.</div>
            <div class="form-group"><label class="form-label">Escribe RESTAURAR para confirmar</label><input v-model="rs.confirm" class="form-control" autocomplete="off" /></div>
          </template>

          <!-- 3 · Listo -->
          <template v-else-if="rs.result">
            <div class="bp-ok">✅ <b>Restauración lista.</b> {{ rs.result.files }} archivos y {{ rs.result.photos }} fotos restaurados.</div>
            <p class="bp-text">Antes se guardó un respaldo de seguridad: <code>{{ rs.result.safetyBackup }}</code>. Si algo no quedó como esperabas, se puede volver a ese.</p>
            <p class="bp-text">Pídele a quien use esa franquicia que <b>actualice la app</b> (Ctrl+Shift+R) para ver los datos restaurados.</p>
          </template>

          <p v-if="rs.err" class="bp-err">{{ rs.err }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="closeRestore">{{ rs.result ? 'Cerrar' : 'Cancelar' }}</button>
          <button v-if="!rs.summary && !rs.result" class="btn btn-primary" :disabled="rs.busy" @click="inspect">{{ rs.busy ? 'Abriendo…' : 'Abrir respaldo' }}</button>
          <button v-else-if="rs.summary" class="btn btn-danger" :disabled="rs.busy || rs.confirm !== 'RESTAURAR' || (rs.scope === 'some' && !rs.ids.length)" @click="doRestore">{{ rs.busy ? 'Restaurando…' : 'Restaurar ahora' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * BackupsPanel.vue — Respaldos: estado, respaldo externo cifrado y restauración (solo superadmin).
 */
import { ref, reactive, computed, onMounted, inject } from 'vue'
import api from '../services/api.js'
import { downloadProtected } from '../utils/download.js'

const toast = inject('toast', () => {})
const info = reactive({ keep: 40, backups: [], offsite: { configured: false, keyReady: false, last: null, verify: null } })
const busy = ref('')
const keyModal = ref(null)
const rs = ref(null)
const remote = ref([])

const ready = computed(() => info.offsite.configured && info.offsite.keyReady)
const fmtDate = (iso) => new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const fmtSize = (n) => n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB'
const errMsg = (e, fb) => e.response?.data?.error || fb

const remoteState = computed(() => {
  const o = info.offsite
  if (!o.configured) return { cls: 'warn', title: 'No configurada', detail: 'Faltan las variables de Backblaze en Railway.' }
  if (!o.keyReady) return { cls: 'warn', title: 'Falta la clave de cifrado', detail: 'Créala para empezar a subir respaldos.' }
  if (!o.last) return { cls: 'warn', title: 'Lista, aún no sube nada', detail: 'El primer respaldo externo se sube solo en unos minutos, o toca "Respaldar y subir".' }
  if (!o.last.ok) return { cls: 'bad', title: 'Falló la última subida', detail: o.last.error || 'Revisa las variables de Railway.' }
  return { cls: 'ok', title: 'Subido ' + fmtDate(o.last.at), detail: 'Cifrado, ' + fmtSize(o.last.size) + '.' }
})
const verifyState = computed(() => {
  const v = info.offsite.verify
  if (!v) return { cls: 'warn', title: 'Aún no se ha comprobado', detail: 'Se hace sola una vez por semana, o toca "Comprobar".' }
  if (!v.ok) return { cls: 'bad', title: 'La comprobación falló', detail: v.error || '' }
  return { cls: 'ok', title: 'OK · ' + fmtDate(v.at), detail: 'Se descargó, se descifró y se leyeron ' + v.files + ' archivos y ' + (v.photos || 0) + ' fotos.' }
})

async function load() {
  try { Object.assign(info, (await api.get('/api/backups')).data) } catch { /* sin datos */ }
}
async function makeLocal() {
  busy.value = 'local'
  try { await api.post('/api/backups'); await load(); toast('Respaldo creado', 'success') }
  catch (e) { toast(errMsg(e, 'No se pudo crear el respaldo'), 'error') } finally { busy.value = '' }
}
async function runRemote() {
  busy.value = 'run'
  try { await api.post('/api/backups/offsite/run'); await load(); toast('Respaldo creado y subido', 'success') }
  catch (e) { await load(); toast(errMsg(e, 'No se pudo subir'), 'error') } finally { busy.value = '' }
}
async function makeKey() {
  busy.value = 'key'
  try { keyModal.value = { key: (await api.post('/api/backups/key')).data.key, ack: false }; await load() }
  catch (e) { toast(errMsg(e, 'No se pudo crear la clave'), 'error') } finally { busy.value = '' }
}
async function testConn() {
  busy.value = 'test'
  try { await api.post('/api/backups/offsite/test'); toast('Conexión con Backblaze: OK', 'success') }
  catch (e) { toast(errMsg(e, 'No se pudo conectar'), 'error') } finally { busy.value = '' }
}
async function verifyNow() {
  busy.value = 'verify'
  try { await api.post('/api/backups/offsite/verify'); await load(); toast('El último respaldo externo se abrió y se leyó bien', 'success') }
  catch (e) { await load(); toast(errMsg(e, 'La comprobación falló'), 'error') } finally { busy.value = '' }
}
async function download(b) {
  try { await downloadProtected(`/api/backups/${b.name}/download`, b.name) } catch { toast('No se pudo descargar el respaldo', 'error') }
}
async function copy(t) {
  try { await navigator.clipboard.writeText(t); toast('Copiado', 'success') } catch { window.prompt('Copia la clave:', t) }
}

// ── Restaurar ──
async function loadRemote() {
  try { remote.value = (await api.get('/api/backups/offsite/list')).data.items || []; if (rs.value) rs.value.name = remote.value[0]?.key || '' }
  catch (e) { rs.value.err = errMsg(e, 'No se pudo leer el almacenamiento externo') }
}
function openRestore(pre) {
  rs.value = { source: pre?.source || 'local', name: pre?.name || info.backups[0]?.name || '', key: '', file: null, busy: false, err: '', summary: null, token: '', scope: 'some', ids: [], confirm: '', result: null }
}
function closeRestore() { rs.value = null; load() }
async function inspect() {
  const r = rs.value; r.busy = true; r.err = ''
  try {
    let res
    if (r.source === 'upload') {
      if (!r.file) throw { response: { data: { error: 'Escoge el archivo de respaldo' } } }
      res = await api.post('/api/backups/inspect-upload', await r.file.arrayBuffer(), { headers: { 'Content-Type': 'application/octet-stream', 'x-backup-key': r.key }, timeout: 120000 })
    } else {
      res = await api.post('/api/backups/inspect', { source: r.source, name: r.name, key: r.key })
    }
    r.token = res.data.token; r.summary = res.data.summary
  } catch (e) { r.err = errMsg(e, 'No se pudo abrir el respaldo') } finally { r.busy = false }
}
async function doRestore() {
  const r = rs.value; r.busy = true; r.err = ''
  try { r.result = (await api.post('/api/backups/restore', { token: r.token, scope: r.scope === 'all' ? 'all' : r.ids, confirm: r.confirm }, { timeout: 120000 })).data; r.summary = null }
  catch (e) { r.err = errMsg(e, 'No se pudo restaurar') } finally { r.busy = false }
}

onMounted(load)
</script>

<style scoped>
.bp-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.bp-title { margin: 0 0 4px; font-size: 16px; } .bp-text { margin: 0 0 8px; color: var(--text-secondary); font-size: 13px; line-height: 1.45; max-width: 640px; }
.bp-btns { display: flex; gap: 6px; flex-wrap: wrap; }
.bp-status { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-bottom: 12px; }
.bp-box { border: 1px solid var(--border); border-left-width: 4px; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; background: var(--surface-2); }
.bp-box span { font-size: 12px; color: var(--text-secondary); } .bp-box b { font-size: 14px; } .bp-box small { font-size: 12px; color: var(--text-secondary); }
.bp-box.ok { border-left-color: var(--success); } .bp-box.warn { border-left-color: var(--warning); } .bp-box.bad { border-left-color: var(--danger); }
.bp-help { border: 1px dashed var(--warning); border-radius: 10px; padding: 10px 12px; font-size: 13px; line-height: 1.5; margin-bottom: 12px; }
.bp-help code, .bp-text code { background: var(--surface-2); border-radius: 6px; padding: 1px 6px; font-size: 12px; }
.bp-row-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.bp-act { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
.bp-key { display: block; font-size: 15px; letter-spacing: .5px; word-break: break-all; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin-top: 6px; }
.bp-check { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; line-height: 1.4; margin-top: 8px; cursor: pointer; }
.bp-modal { max-width: 640px; width: 100%; max-height: 92vh; display: flex; flex-direction: column; }
.bp-modal .modal-body { overflow-y: auto; }
.bp-seg { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
.bp-seg button { border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 999px; padding: 7px 14px; font-weight: 600; font-size: 13px; cursor: pointer; }
.bp-seg button.on { background: #f59e0b; border-color: #f59e0b; color: #1a0a00; } .bp-seg button:disabled { opacity: .4; cursor: default; }
.bp-biz { display: flex; flex-direction: column; gap: 4px; margin: 4px 0 8px 24px; }
.bp-warn { border: 1px solid var(--warning); background: var(--warning-light); color: var(--text); border-radius: 10px; padding: 10px 12px; font-size: 13px; line-height: 1.45; margin: 12px 0; }
.bp-ok { font-size: 15px; margin-bottom: 8px; } .bp-err { color: var(--danger); font-weight: 600; font-size: 13px; margin: 10px 0 0; }
</style>
