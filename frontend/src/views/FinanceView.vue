<template>
  <PageLayout title="Finanzas">
    <div class="page-header">
      <div>
        <h1 class="page-title">Finanzas</h1>
        <p class="page-subtitle">Cuánto tienes en efectivo y banco, por Bar y Restaurante</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-whatsapp" @click="sendDailyReport" :disabled="reporting">
          <div class="spinner" v-if="reporting" style="width:14px;height:14px;border-width:2px"></div>
          📲 Reporte del día
        </button>
        <button class="btn btn-outline" @click="openConfig">⚙️ Saldo inicial</button>
        <button class="btn btn-primary" @click="openManual">+ Movimiento</button>
      </div>
    </div>

    <!-- Selector de área + periodo -->
    <div class="card filters-bar mb-3">
      <div class="seg">
        <button v-for="a in areas" :key="a.value" :class="['seg-btn', { active: area === a.value }]" @click="area = a.value">{{ a.label }}</button>
      </div>
      <div class="seg">
        <button v-for="p in periods" :key="p.value" :class="['seg-btn', { active: period === p.value }]" @click="setPeriod(p.value)">{{ p.label }}</button>
      </div>
      <!-- Navegador de mes: solo visible cuando el periodo es "Mes" -->
      <div class="month-nav" v-if="period === 'mes'">
        <button class="mn-btn" @click="shiftMonth(-1)" title="Mes anterior">◀</button>
        <span class="mn-label">{{ monthLabel }}</span>
        <button class="mn-btn" @click="shiftMonth(1)" :disabled="isCurrentMonth" title="Mes siguiente">▶</button>
      </div>
    </div>

    <div v-if="finance.loading && !finance.data" class="loading"><div class="spinner"></div></div>

    <template v-else>
      <!-- Tarjetas de saldo -->
      <div class="cards-grid mb-3">
        <div class="fcard efectivo">
          <p class="fcard-label">💵 Efectivo</p>
          <p class="fcard-value">{{ formatCOP(sel.efectivo) }}</p>
          <div v-if="area === 'total'" class="fcard-sub">
            <span>🍺 {{ formatCOP(bal.bar.efectivo) }}</span>
            <span>🍽️ {{ formatCOP(bal.restaurante.efectivo) }}</span>
          </div>
        </div>
        <div class="fcard banco">
          <p class="fcard-label">🏦 Banco</p>
          <p class="fcard-value">{{ formatCOP(sel.banco) }}</p>
          <div v-if="area === 'total'" class="fcard-sub">
            <span>🍺 {{ formatCOP(bal.bar.banco) }}</span>
            <span>🍽️ {{ formatCOP(bal.restaurante.banco) }}</span>
          </div>
        </div>
        <div class="fcard total">
          <p class="fcard-label">💰 Dinero que debería tener</p>
          <p class="fcard-value">{{ formatCOP(sel.efectivo + sel.banco) }}</p>
          <div class="fcard-sub"><span>Efectivo + banco (salidas ya restadas)</span></div>
        </div>
      </div>

      <!-- Resumen del mes (referencia, no afecta saldos) -->
      <div class="card ref-card mb-3">
        <div class="ref-head">
          <span>📋 Resumen del mes <em>(referencia · no afecta los saldos)</em></span>
          <button class="btn btn-sm btn-outline" @click="openRef">✏️ Editar</button>
        </div>
        <div class="ref-body">
          <div class="ref-item"><span class="ref-l">Ventas del mes</span><span class="ref-v pos">{{ formatCOP(refSel.ventas) }}</span></div>
          <div class="ref-item"><span class="ref-l">Salidas del mes</span><span class="ref-v neg">{{ formatCOP(refSel.salidas) }}</span></div>
          <div class="ref-item"><span class="ref-l">Neto</span><span class="ref-v" :class="(refSel.ventas - refSel.salidas) < 0 ? 'neg' : 'pos'">{{ formatCOP(refSel.ventas - refSel.salidas) }}</span></div>
        </div>
      </div>

      <!-- Análisis de costo (food cost) — DESACTIVADO temporalmente (v-if="false").
           Para reactivarlo, quitar el v-if. -->
      <div class="card cost-card mb-3" v-if="false">
        <div class="cost-head">
          <span>📊 Análisis de costo y ganancia — <strong>{{ areaLabel }}</strong></span>
          <button class="cost-meta-target" @click="openTarget" title="Editar meta">
            🎯 Meta de costo: {{ costTarget.min }}–{{ costTarget.max }}% ✏️
          </button>
        </div>
        <div v-if="periodIngresos > 0" class="cost-body">
          <div class="cost-row"><span class="cost-l">Ventas</span><span class="cost-v">{{ formatCOP(periodIngresos) }}</span></div>
          <div class="cost-row">
            <span class="cost-l">Costo de insumos <em>(compras · mercado · proveedores)</em></span>
            <span class="cost-v">{{ formatCOP(costoInsumos) }} <span :class="['cost-badge', costoClass]">{{ costoPct.toFixed(0) }}%</span></span>
          </div>
          <div class="cost-row"><span class="cost-l">Otros gastos <em>(nómina · arriendo · etc.)</em></span><span class="cost-v">{{ formatCOP(otrosGastos) }}</span></div>
          <div class="cost-row total">
            <span class="cost-l">Ganancia del periodo</span>
            <span :class="['cost-v', ganancia >= 0 ? 'pos' : 'neg']">{{ formatCOP(ganancia) }} <span class="cost-margin">margen {{ margenPct.toFixed(0) }}%</span></span>
          </div>
          <p :class="['cost-tip', costoClass]">
            {{ costoClass === 'good' ? '✅ Costo dentro de la meta — buena ganancia' : costoClass === 'warn' ? '⚠️ Costo un poco alto, vigila los insumos' : '🔴 Costo alto: revisa precios o porciones' }}
          </p>
        </div>
        <div v-else class="cost-empty">
          Aún no hay ventas en este periodo (las ventas entran al cerrar turno). Cierra un turno para ver el costo %.
        </div>
      </div>

      <!-- Resumen de ingresos y salidas por tipo -->
      <div class="card sum-card mb-3">
        <div class="sum-head">
          <span>📊 Ingresos y salidas por tipo <em>(en el periodo seleccionado)</em></span>
          <span class="sum-total-badge" :class="netoRow.total >= 0 ? 'pos' : 'neg'">Neto: {{ formatCOP(netoRow.total) }}</span>
        </div>
        <div class="sum-table-wrap">
          <table class="sum-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <template v-if="showAreaCols">
                  <th class="r">🍺 Bar</th>
                  <th class="r">🍽️ Restaurante</th>
                  <th class="r" v-if="showGeneralCol">General</th>
                </template>
                <th class="r">{{ showAreaCols ? 'Total' : totalColLabel }}</th>
              </tr>
            </thead>
            <tbody>
              <!-- ↑ Ingresos -->
              <tr class="sum-section in"><td :colspan="colCount">↑ Ingresos</td></tr>
              <tr v-for="row in ingresosSummary" :key="'in-' + row.kind">
                <td>{{ row.label }}</td>
                <template v-if="showAreaCols">
                  <td class="r">{{ formatCOP(row.bar) }}</td>
                  <td class="r">{{ formatCOP(row.restaurante) }}</td>
                  <td class="r" v-if="showGeneralCol">{{ formatCOP(row.general) }}</td>
                </template>
                <td class="r strong pos">{{ formatCOP(row.total) }}</td>
              </tr>
              <tr v-if="ingresosSummary.length === 0">
                <td :colspan="colCount" class="sum-empty">Sin ingresos en el periodo</td>
              </tr>
              <tr v-if="ingresosSummary.length" class="sum-subtotal">
                <td>Subtotal ingresos</td>
                <template v-if="showAreaCols">
                  <td class="r">{{ formatCOP(ingresosTotals.bar) }}</td>
                  <td class="r">{{ formatCOP(ingresosTotals.restaurante) }}</td>
                  <td class="r" v-if="showGeneralCol">{{ formatCOP(ingresosTotals.general) }}</td>
                </template>
                <td class="r strong pos">{{ formatCOP(ingresosTotals.total) }}</td>
              </tr>

              <!-- ↓ Salidas -->
              <tr class="sum-section out"><td :colspan="colCount">↓ Salidas</td></tr>
              <tr v-for="row in salidasSummary" :key="'out-' + row.kind">
                <td>{{ row.label }}</td>
                <template v-if="showAreaCols">
                  <td class="r">{{ formatCOP(row.bar) }}</td>
                  <td class="r">{{ formatCOP(row.restaurante) }}</td>
                  <td class="r" v-if="showGeneralCol">{{ formatCOP(row.general) }}</td>
                </template>
                <td class="r strong neg">{{ formatCOP(row.total) }}</td>
              </tr>
              <tr v-if="salidasSummary.length === 0">
                <td :colspan="colCount" class="sum-empty">Sin salidas en el periodo</td>
              </tr>
              <tr v-if="salidasSummary.length" class="sum-subtotal">
                <td>Subtotal salidas</td>
                <template v-if="showAreaCols">
                  <td class="r">{{ formatCOP(salidasTotals.bar) }}</td>
                  <td class="r">{{ formatCOP(salidasTotals.restaurante) }}</td>
                  <td class="r" v-if="showGeneralCol">{{ formatCOP(salidasTotals.general) }}</td>
                </template>
                <td class="r strong neg">{{ formatCOP(salidasTotals.total) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="sum-net">
                <td>💰 Total ganancia (ingresos − salidas)</td>
                <template v-if="showAreaCols">
                  <td class="r" :class="netoRow.bar >= 0 ? 'pos' : 'neg'">{{ formatCOP(netoRow.bar) }}</td>
                  <td class="r" :class="netoRow.restaurante >= 0 ? 'pos' : 'neg'">{{ formatCOP(netoRow.restaurante) }}</td>
                  <td class="r" v-if="showGeneralCol" :class="netoRow.general >= 0 ? 'pos' : 'neg'">{{ formatCOP(netoRow.general) }}</td>
                </template>
                <td class="r strong" :class="netoRow.total >= 0 ? 'pos' : 'neg'">{{ formatCOP(netoRow.total) }}</td>
              </tr>
              <tr class="sum-pct">
                <td>📈 % de ganancia <em>(sobre ingresos)</em></td>
                <template v-if="showAreaCols">
                  <td class="r">{{ fmtPct(netoRow.bar, ingresosTotals.bar) }}</td>
                  <td class="r">{{ fmtPct(netoRow.restaurante, ingresosTotals.restaurante) }}</td>
                  <td class="r" v-if="showGeneralCol">{{ fmtPct(netoRow.general, ingresosTotals.general) }}</td>
                </template>
                <td class="r strong">{{ fmtPct(netoRow.total, ingresosTotals.total) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Listas Entradas / Salidas -->
      <div class="ledger-grid">
        <div class="card ledger-col">
          <div class="ledger-head entradas-head">↑ Entradas <span>{{ formatCOP(periodIngresos) }}</span></div>
          <div v-if="entradas.length === 0" class="ledger-empty">Sin entradas en el periodo</div>
          <div v-for="m in entradas" :key="m.id" class="mov">
            <div class="mov-info">
              <span class="mov-label">{{ m.label }}</span>
              <span class="mov-meta">{{ formatDate(m.date) }} · {{ areaTag(m.area) }} · {{ bucketIcon(m.bucket) }}</span>
            </div>
            <span class="mov-amount pos">+{{ formatCOP(m.amount) }}</span>
          </div>
        </div>

        <div class="card ledger-col">
          <div class="ledger-head salidas-head">↓ Salidas <span>{{ formatCOP(periodEgresos) }}</span></div>
          <div v-if="salidas.length === 0" class="ledger-empty">Sin salidas en el periodo</div>
          <div v-for="m in salidas" :key="m.id" class="mov">
            <div class="mov-info">
              <span class="mov-label">{{ m.label }}</span>
              <span class="mov-meta">{{ formatDate(m.date) }} · {{ areaTag(m.area) }} · {{ bucketIcon(m.bucket) }}</span>
            </div>
            <div class="mov-right">
              <span :class="['mov-amount', m.type === 'traslado' ? 'tras' : 'neg']">
                {{ m.type === 'traslado' ? '↔' : '−' }}{{ formatCOP(m.amount) }}
              </span>
              <button v-if="!m.locked" class="mov-del" title="Eliminar" @click="removeManual(m)">🗑</button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Modal: Saldo inicial ── -->
    <div class="modal-overlay" v-if="showConfig" @click.self="showConfig = false">
      <div class="modal" style="max-width:460px">
        <div class="modal-header">
          <h3 class="modal-title">⚙️ Saldo inicial</h3>
          <button class="btn-close" @click="showConfig = false">×</button>
        </div>
        <div class="modal-body">
          <p class="text-muted" style="font-size:12.5px;margin-bottom:12px">
            Cuánto tienes HOY en efectivo y banco (incluye la base de caja). Desde la fecha de inicio,
            cierres de turno, compras y pagos se suman/restan sobre estos saldos.
          </p>
          <div class="form-group">
            <label class="form-label">Fecha de inicio</label>
            <input v-model="configForm.openingDate" type="date" class="form-control" />
          </div>
          <div class="config-grid">
            <div></div><div class="ch">💵 Efectivo</div><div class="ch">🏦 Banco</div>
            <div class="rh">🍺 Bar</div>
            <input v-model.number="configForm.bar.efectivo" type="number" min="0" class="form-control" />
            <input v-model.number="configForm.bar.banco" type="number" min="0" class="form-control" />
            <div class="rh">🍽️ Restaurante</div>
            <input v-model.number="configForm.restaurante.efectivo" type="number" min="0" class="form-control" />
            <input v-model.number="configForm.restaurante.banco" type="number" min="0" class="form-control" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showConfig = false">Cancelar</button>
          <button class="btn btn-primary" @click="saveConfig" :disabled="saving">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
        </div>
      </div>
    </div>

    <!-- ── Modal: Resumen del mes (referencia) ── -->
    <div class="modal-overlay" v-if="showRef" @click.self="showRef = false">
      <div class="modal" style="max-width:460px">
        <div class="modal-header">
          <h3 class="modal-title">📋 Resumen del mes (referencia)</h3>
          <button class="btn-close" @click="showRef = false">×</button>
        </div>
        <div class="modal-body">
          <p class="text-muted" style="font-size:12.5px;margin-bottom:12px">
            Son cifras solo para verlas como referencia (lo que vendiste y gastaste este mes).
            <strong>No cambian los saldos de efectivo ni banco.</strong>
          </p>
          <div class="config-grid">
            <div></div><div class="ch">Ventas</div><div class="ch">Salidas</div>
            <div class="rh">🍺 Bar</div>
            <input v-model.number="refForm.bar.ventas" type="number" min="0" class="form-control" />
            <input v-model.number="refForm.bar.salidas" type="number" min="0" class="form-control" />
            <div class="rh">🍽️ Restaurante</div>
            <input v-model.number="refForm.restaurante.ventas" type="number" min="0" class="form-control" />
            <input v-model.number="refForm.restaurante.salidas" type="number" min="0" class="form-control" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showRef = false">Cancelar</button>
          <button class="btn btn-primary" @click="saveRef" :disabled="saving">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
        </div>
      </div>
    </div>

    <!-- ── Modal: Movimiento manual ── -->
    <div class="modal-overlay" v-if="showManual" @click.self="showManual = false">
      <div class="modal" style="max-width:440px">
        <div class="modal-header">
          <h3 class="modal-title">+ Movimiento manual</h3>
          <button class="btn-close" @click="showManual = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Tipo</label>
            <div class="seg">
              <button :class="['seg-btn', { active: manualForm.type === 'ingreso' }]" @click="manualForm.type = 'ingreso'">↑ Entrada</button>
              <button :class="['seg-btn', { active: manualForm.type === 'egreso' }]" @click="manualForm.type = 'egreso'">↓ Salida</button>
              <button :class="['seg-btn', { active: manualForm.type === 'traslado' }]" @click="manualForm.type = 'traslado'">↔ Traslado</button>
            </div>
          </div>

          <!-- Categoría de la salida: cae en la fila correcta del resumen -->
          <div class="form-group" v-if="manualForm.type === 'egreso'">
            <label class="form-label">Categoría de la salida</label>
            <select v-model="manualForm.category" class="form-control">
              <option value="reponer">🛒 Compra / mercancía</option>
              <option value="gasto">💸 Gasto</option>
              <option value="proveedor">🚚 Proveedor</option>
              <option value="nomina">👥 Nómina</option>
              <option value="arriendo">🏠 Arriendo</option>
              <option value="credito">💳 Crédito</option>
              <option value="manual">✏️ Otro</option>
            </select>
          </div>

          <div class="grid grid-2">
            <div class="form-group">
              <label class="form-label">Área</label>
              <select v-model="manualForm.area" class="form-control">
                <option value="bar">🍺 Bar</option>
                <option value="restaurante">🍽️ Restaurante</option>
                <option value="general">General</option>
              </select>
            </div>
            <div class="form-group" v-if="manualForm.type !== 'traslado'">
              <label class="form-label">¿Dónde?</label>
              <select v-model="manualForm.bucket" class="form-control">
                <option value="efectivo">💵 Efectivo</option>
                <option value="banco">🏦 Banco</option>
              </select>
            </div>
            <div class="form-group" v-else>
              <label class="form-label">Desde</label>
              <select v-model="manualForm.from" class="form-control">
                <option value="efectivo">💵 Efectivo → 🏦 Banco</option>
                <option value="banco">🏦 Banco → 💵 Efectivo</option>
              </select>
            </div>
          </div>

          <div class="grid grid-2">
            <div class="form-group">
              <label class="form-label">Monto (COP) *</label>
              <input v-model.number="manualForm.amount" type="number" min="0" class="form-control" placeholder="0" />
            </div>
            <div class="form-group">
              <label class="form-label">Fecha</label>
              <input v-model="manualForm.date" type="date" class="form-control" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Detalle</label>
            <input v-model="manualForm.description" class="form-control" placeholder="Ej: Depósito al banco, inyección de capital..." />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showManual = false">Cancelar</button>
          <button class="btn btn-primary" @click="saveManual" :disabled="saving">{{ saving ? 'Guardando...' : 'Registrar' }}</button>
        </div>
      </div>
    </div>
    <!-- ── Modal: Meta de costo ── -->
    <div class="modal-overlay" v-if="showTarget" @click.self="showTarget = false">
      <div class="modal" style="max-width:400px">
        <div class="modal-header">
          <h3 class="modal-title">🎯 Meta de costo</h3>
          <button class="btn-close" @click="showTarget = false">×</button>
        </div>
        <div class="modal-body">
          <p class="text-muted" style="font-size:12.5px;margin-bottom:12px">
            Define el rango de costo ideal (food cost %). El semáforo se pone verde si el costo
            queda hasta el máximo, amarillo si se pasa un poco, y rojo si está muy alto.
          </p>
          <div class="grid grid-2">
            <div class="form-group">
              <label class="form-label">Mínimo (%)</label>
              <input v-model.number="targetForm.min" type="number" min="0" max="100" class="form-control" placeholder="30" />
            </div>
            <div class="form-group">
              <label class="form-label">Máximo (%)</label>
              <input v-model.number="targetForm.max" type="number" min="0" max="100" class="form-control" placeholder="40" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showTarget = false">Cancelar</button>
          <button class="btn btn-primary" @click="saveTarget" :disabled="saving">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
        </div>
      </div>
    </div>

  </PageLayout>
</template>

<script setup>
/**
 * FinanceView.vue — Módulo de Finanzas / flujo de caja
 *
 * Muestra los saldos de efectivo y banco (por Bar / Restaurante / Total),
 * las entradas y salidas del periodo, y permite fijar el saldo inicial y
 * registrar movimientos manuales (incluido el traslado efectivo↔banco).
 */
import { ref, computed, onMounted, inject } from 'vue'
import { useFinanceStore } from '../stores/finance.js'
import { useAuthStore } from '../stores/auth.js'
import PageLayout from '../components/PageLayout.vue'

const finance = useFinanceStore()
const auth = useAuthStore()
const toast = inject('toast')
const reporting = ref(false)

const area = ref('total')
const period = ref('mes')
// Mes que se está viendo (YYYY-MM). Por defecto el mes actual; el navegador ◀▶
// permite ir a meses pasados (julio, junio…) para leer su balance.
function currentYm() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}` }
const monthCursor = ref(currentYm())
const isCurrentMonth = computed(() => monthCursor.value >= currentYm())
const monthLabel = computed(() => {
  const [y, m] = monthCursor.value.split('-').map(Number)
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
})
const saving = ref(false)
const showConfig = ref(false)
const showManual = ref(false)
const showRef = ref(false)
const showTarget = ref(false)
const targetForm = ref({ min: 30, max: 40 })

const areas = [
  { value: 'total', label: 'Total' },
  { value: 'bar', label: '🍺 Bar' },
  { value: 'restaurante', label: '🍽️ Restaurante' }
]
const periods = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'todo', label: 'Todo' }
]

const emptyArea = () => ({ efectivo: 0, banco: 0 })
const bal = computed(() => finance.data?.balances || { bar: emptyArea(), restaurante: emptyArea(), general: emptyArea() })
const sel = computed(() => {
  if (!finance.data) return emptyArea()
  return area.value === 'total' ? finance.data.totals : bal.value[area.value]
})

const movsAll = computed(() => finance.data?.movements || [])
const movs = computed(() => area.value === 'total' ? movsAll.value : movsAll.value.filter(m => m.area === area.value))
const entradas = computed(() => movs.value.filter(m => m.type === 'ingreso'))
const salidas = computed(() => movs.value.filter(m => m.type === 'egreso' || m.type === 'traslado'))
const periodIngresos = computed(() => entradas.value.reduce((s, m) => s + m.amount, 0))
const periodEgresos = computed(() => movs.value.filter(m => m.type === 'egreso').reduce((s, m) => s + m.amount, 0))
const neto = computed(() => periodIngresos.value - periodEgresos.value)

// ── Resumen de salidas por tipo (nómina, arriendo, crédito, compras…) ──
// Se arma con TODAS las salidas del periodo (no depende del filtro de área),
// para poder comparar y validar Bar vs Restaurante de un vistazo.
const KIND_LABELS = {
  reponer: '🛒 Compras / mercancía',
  gasto: '💸 Gastos',
  proveedor: '🚚 Proveedores',
  nomina: '👥 Nómina',
  arriendo: '🏠 Arriendo',
  credito: '💳 Crédito',
  retiro: '🏧 Retiros de caja',
  cajamenor: '🧾 Caja menor',
  manual: '✏️ Otros (manual)'
}
const KIND_ORDER = ['reponer', 'gasto', 'proveedor', 'nomina', 'arriendo', 'credito', 'retiro', 'cajamenor', 'manual']

const salidasSummary = computed(() => {
  const rows = {}
  // Respeta el filtro de área de arriba: 'movs' ya viene filtrado por Bar/Rest/Total
  for (const m of movs.value) {
    if (m.type !== 'egreso') continue // los traslados no son salida real
    const k = m.kind || 'manual'
    const r = rows[k] || (rows[k] = { kind: k, label: KIND_LABELS[k] || k, bar: 0, restaurante: 0, general: 0, total: 0 })
    const a = ['bar', 'restaurante', 'general'].includes(m.area) ? m.area : 'general'
    r[a] += m.amount
    r.total += m.amount
  }
  const ordered = KIND_ORDER.filter(k => rows[k]).map(k => rows[k])
  for (const k in rows) if (!KIND_ORDER.includes(k)) ordered.push(rows[k]) // tipos no previstos al final
  return ordered
})
const salidasTotals = computed(() => {
  const t = { bar: 0, restaurante: 0, general: 0, total: 0 }
  for (const r of salidasSummary.value) { t.bar += r.bar; t.restaurante += r.restaurante; t.general += r.general; t.total += r.total }
  return t
})
// ── Resumen de INGRESOS por tipo (mismo formato que salidas) ──
const IN_KIND_LABELS = {
  shift: '🧾 Ventas (cierre de turno)',
  manual: '➕ Otros ingresos (manual)'
}
const IN_KIND_ORDER = ['shift', 'manual']
const ingresosSummary = computed(() => {
  const rows = {}
  for (const m of movs.value) {
    if (m.type !== 'ingreso') continue
    const k = m.kind || 'manual'
    const r = rows[k] || (rows[k] = { kind: k, label: IN_KIND_LABELS[k] || k, bar: 0, restaurante: 0, general: 0, total: 0 })
    const a = ['bar', 'restaurante', 'general'].includes(m.area) ? m.area : 'general'
    r[a] += m.amount
    r.total += m.amount
  }
  const ordered = IN_KIND_ORDER.filter(k => rows[k]).map(k => rows[k])
  for (const k in rows) if (!IN_KIND_ORDER.includes(k)) ordered.push(rows[k])
  return ordered
})
const ingresosTotals = computed(() => {
  const t = { bar: 0, restaurante: 0, general: 0, total: 0 }
  for (const r of ingresosSummary.value) { t.bar += r.bar; t.restaurante += r.restaurante; t.general += r.general; t.total += r.total }
  return t
})

// Neto (ingresos − salidas) por área, para la fila final
const netoRow = computed(() => ({
  bar: ingresosTotals.value.bar - salidasTotals.value.bar,
  restaurante: ingresosTotals.value.restaurante - salidasTotals.value.restaurante,
  general: ingresosTotals.value.general - salidasTotals.value.general,
  total: ingresosTotals.value.total - salidasTotals.value.total
}))

// Solo en modo "Total" se abren las columnas Bar/Restaurante; al filtrar por un
// área se muestra una sola columna con lo de esa área.
const showAreaCols = computed(() => area.value === 'total')
const showGeneralCol = computed(() => showAreaCols.value && (salidasTotals.value.general > 0 || ingresosTotals.value.general > 0))
const totalColLabel = computed(() => area.value === 'bar' ? '🍺 Bar' : area.value === 'restaurante' ? '🍽️ Restaurante' : 'Total')
const colCount = computed(() => 1 + (showAreaCols.value ? (2 + (showGeneralCol.value ? 1 : 0)) : 0) + 1)

// ── Análisis de costo (food cost) del periodo + área seleccionada ──
const areaLabel = computed(() => area.value === 'bar' ? 'Bar' : area.value === 'restaurante' ? 'Restaurante' : 'Total')
// Qué tipos cuentan como "costo de insumos" (mercancía/comida)
const COSTO_KINDS = ['reponer', 'gasto', 'proveedor']
const costoInsumos = computed(() =>
  movs.value.filter(m => m.type === 'egreso' && COSTO_KINDS.includes(m.kind)).reduce((s, m) => s + m.amount, 0)
)
const otrosGastos = computed(() => Math.max(0, periodEgresos.value - costoInsumos.value))
const costoPct = computed(() => periodIngresos.value > 0 ? (costoInsumos.value / periodIngresos.value * 100) : 0)
const ganancia = computed(() => periodIngresos.value - periodEgresos.value)
const margenPct = computed(() => periodIngresos.value > 0 ? (ganancia.value / periodIngresos.value * 100) : 0)
// Meta de costo configurable (food cost %)
const costTarget = computed(() => finance.data?.costTarget || { min: 30, max: 40 })
// Semáforo: ≤ max bien, hasta max+10 cuidado, más rojo
const costoClass = computed(() => {
  const max = costTarget.value.max || 40
  return costoPct.value <= max ? 'good' : costoPct.value <= max + 10 ? 'warn' : 'bad'
})

// Resumen del mes (referencia)
const refData = computed(() => finance.data?.reference || { bar: { ventas: 0, salidas: 0 }, restaurante: { ventas: 0, salidas: 0 } })
const refSel = computed(() => {
  const r = refData.value
  if (area.value === 'restaurante') return r.restaurante
  if (area.value === 'bar') return r.bar
  if (area.value === 'general') return { ventas: 0, salidas: 0 }
  return { ventas: (r.bar.ventas || 0) + (r.restaurante.ventas || 0), salidas: (r.bar.salidas || 0) + (r.restaurante.salidas || 0) }
})

function formatCOP(v) { return '$' + Number(v || 0).toLocaleString('es-CO') }
/** % de ganancia = ganancia ÷ ingresos. '—' si no hubo ingresos. */
function fmtPct(ganancia, ingresos) { return ingresos > 0 ? Math.round(ganancia / ingresos * 100) + '%' : '—' }
function formatDate(iso) { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
function areaTag(a) { return a === 'restaurante' ? '🍽️ Rest.' : a === 'bar' ? '🍺 Bar' : 'General' }
function bucketIcon(b) { return b === 'banco' ? '🏦 Banco' : '💵 Efectivo' }

/** Calcula el rango de fechas según el preset de periodo */
/** Rango [from, to] del mes que apunta el cursor (YYYY-MM). */
function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0).getDate() // último día del mes
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` }
}
function rangeFor(p) {
  const now = new Date()
  const iso = (d) => d.toISOString().slice(0, 10)
  if (p === 'hoy') return { from: iso(now), to: iso(now) }
  if (p === 'semana') { const f = new Date(now); f.setDate(f.getDate() - 6); return { from: iso(f), to: iso(now) } }
  if (p === 'mes') return monthRange(monthCursor.value)
  return {} // 'todo'
}

async function load() {
  try { await finance.fetchFinance(rangeFor(period.value)) }
  catch (err) { toast(err.response?.data?.error || 'Error al cargar finanzas', 'error') }
}
function setPeriod(p) {
  period.value = p
  if (p === 'mes') monthCursor.value = currentYm() // al pulsar "Mes" vuelve al mes actual
  load()
}
/** Mueve el navegador de mes (no permite ir al futuro). */
function shiftMonth(delta) {
  let [y, m] = monthCursor.value.split('-').map(Number)
  m += delta
  while (m < 1) { m += 12; y-- }
  while (m > 12) { m -= 12; y++ }
  const target = `${y}-${String(m).padStart(2, '0')}`
  if (target > currentYm()) return // no navegar al futuro
  monthCursor.value = target
  period.value = 'mes'
  load()
}

// ── Saldo inicial ──
const configForm = ref({ openingDate: '', bar: emptyArea(), restaurante: emptyArea() })
function openConfig() {
  const d = finance.data
  configForm.value = {
    openingDate: d?.openingDate ? d.openingDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    bar: { ...emptyArea(), ...(d?.opening?.bar || {}) },
    restaurante: { ...emptyArea(), ...(d?.opening?.restaurante || {}) }
  }
  showConfig.value = true
}
async function saveConfig() {
  saving.value = true
  try {
    await finance.setOpening(
      { bar: configForm.value.bar, restaurante: configForm.value.restaurante },
      configForm.value.openingDate
    )
    showConfig.value = false
    toast('Saldo inicial guardado', 'success')
    await load()
  } catch (err) {
    toast(err.response?.data?.error || 'Error al guardar', 'error')
  } finally { saving.value = false }
}

// ── Resumen del mes (referencia) ──
const refForm = ref({ bar: { ventas: 0, salidas: 0 }, restaurante: { ventas: 0, salidas: 0 } })
function openRef() {
  const r = refData.value
  refForm.value = {
    bar: { ventas: r.bar.ventas || 0, salidas: r.bar.salidas || 0 },
    restaurante: { ventas: r.restaurante.ventas || 0, salidas: r.restaurante.salidas || 0 }
  }
  showRef.value = true
}
async function saveRef() {
  saving.value = true
  try {
    await finance.setReference(refForm.value)
    showRef.value = false
    toast('Resumen guardado', 'success')
    await load()
  } catch (err) {
    toast(err.response?.data?.error || 'Error al guardar', 'error')
  } finally { saving.value = false }
}

// ── Movimiento manual ──
const manualForm = ref({ type: 'egreso', category: 'reponer', area: 'bar', bucket: 'efectivo', from: 'efectivo', amount: 0, description: '', date: '' })
function openManual() {
  manualForm.value = { type: 'egreso', category: 'reponer', area: area.value === 'total' ? 'bar' : area.value, bucket: 'efectivo', from: 'efectivo', amount: 0, description: '', date: new Date().toISOString().slice(0, 10) }
  showManual.value = true
}
async function saveManual() {
  if (!(Number(manualForm.value.amount) > 0)) { toast('El monto debe ser mayor a 0', 'warning'); return }
  saving.value = true
  try {
    await finance.addManual({ ...manualForm.value })
    showManual.value = false
    toast('Movimiento registrado', 'success')
    await load()
  } catch (err) {
    toast(err.response?.data?.error || 'Error al registrar', 'error')
  } finally { saving.value = false }
}
async function removeManual(m) {
  if (!confirm('¿Eliminar este movimiento manual?')) return
  try {
    await finance.deleteManual(m.id)
    toast('Movimiento eliminado', 'success')
    await load()
  } catch (err) {
    toast(err.response?.data?.error || 'Error al eliminar', 'error')
  }
}

// ── Meta de costo ──
function openTarget() {
  targetForm.value = { min: costTarget.value.min, max: costTarget.value.max }
  showTarget.value = true
}
async function saveTarget() {
  saving.value = true
  try {
    await finance.setCostTarget({ min: targetForm.value.min, max: targetForm.value.max })
    showTarget.value = false
    toast('Meta de costo guardada', 'success')
    await load()
  } catch (err) {
    toast(err.response?.data?.error || 'Error al guardar', 'error')
  } finally { saving.value = false }
}

// ── Reporte del día por WhatsApp ──
function buildDailyText(r) {
  const f = (v) => '$' + Number(v || 0).toLocaleString('es-CO')
  const fecha = new Date(r.date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const barT = (r.ventas.bar.efectivo || 0) + (r.ventas.bar.banco || 0)
  const restT = (r.ventas.restaurante.efectivo || 0) + (r.ventas.restaurante.banco || 0)
  const L = []
  L.push(`📊 *REPORTE DEL DÍA* — ${auth.currentBusiness?.name || 'Negocio'}`)
  L.push(`📅 ${fecha}`)
  L.push('')
  L.push(`💰 *VENTAS: ${f(r.ventas.total)}* (${r.ventas.count} ventas)`)
  L.push(`🍺 Bar: ${f(barT)}  (💵 ${f(r.ventas.bar.efectivo)} · 🏦 ${f(r.ventas.bar.banco)})`)
  L.push(`🍽️ Restaurante: ${f(restT)}  (💵 ${f(r.ventas.restaurante.efectivo)} · 🏦 ${f(r.ventas.restaurante.banco)})`)
  if (r.fiados.abonos > 0) L.push(`   (incluye ${f(r.fiados.abonos)} de abonos de fiado)`)
  L.push('')
  if (r.fiados.nuevos > 0) {
    L.push(`📥 Fiados nuevos a crédito: ${f(r.fiados.nuevos)}`)
    L.push('')
  }
  L.push(`📤 *Salidas del día: ${f(r.salidas.total)}*  (💵 ${f(r.salidas.efectivo)} · 🏦 ${f(r.salidas.banco)})`)
  L.push('')
  L.push('🏦 *Lo que deberías tener ahora:*')
  L.push(`   💵 Efectivo: ${f(r.saldos.efectivo)}`)
  L.push(`   🏦 Banco: ${f(r.saldos.banco)}`)
  L.push(`   💰 Total: ${f((r.saldos.efectivo || 0) + (r.saldos.banco || 0))}`)
  return L.join('\n')
}

async function sendDailyReport() {
  reporting.value = true
  try {
    const r = await finance.fetchDaily()
    const text = encodeURIComponent(buildDailyText(r))
    window.open(`https://wa.me/?text=${text}`, '_blank')
  } catch (err) {
    toast(err.response?.data?.error || 'Error al generar el reporte', 'error')
  } finally {
    reporting.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.mb-3 { margin-bottom: 16px; }
.btn-whatsapp { background: #25D366; color: white; border: none; display: inline-flex; align-items: center; gap: 6px; font-weight: 600; }
.btn-whatsapp:hover { background: #1ebe5d; }
.btn-whatsapp:disabled { opacity: 0.6; }
.filters-bar { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; padding: 12px 14px; }
.seg { display: inline-flex; gap: 4px; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 3px; flex-wrap: wrap; }
.seg-btn { border: none; background: none; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text-secondary); white-space: nowrap; }
.seg-btn.active { background: var(--accent); color: #1a0a00; }
.month-nav { display: inline-flex; align-items: center; gap: 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 3px 6px; }
.mn-btn { border: none; background: var(--surface); color: var(--text); width: 30px; height: 30px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 700; }
.mn-btn:hover:not(:disabled) { background: var(--accent); color: #1a0a00; }
.mn-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.mn-label { font-size: 13px; font-weight: 700; min-width: 120px; text-align: center; }

.cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.fcard { border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 18px; background: var(--surface); }
.fcard-label { font-size: 12px; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
.fcard-value { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; color: var(--text); }
.fcard-sub { display: flex; gap: 12px; margin-top: 8px; font-size: 12px; color: var(--text-light); }
.fcard.efectivo { border-left: 4px solid #16a34a; }
.fcard.banco { border-left: 4px solid #2563eb; }
.fcard.total { border-left: 4px solid var(--accent); }
.fcard.neto { border-left: 4px solid #16a34a; }
.fcard.neto.negative { border-left-color: var(--danger); }
.fcard.neto.negative .fcard-value { color: var(--danger); }
.fcard-sub .pos { color: #16a34a; font-weight: 700; }
.fcard-sub .neg { color: var(--danger); font-weight: 700; }

.ledger-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.ledger-col { padding: 0; overflow: hidden; }
.ledger-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; font-weight: 700; font-size: 14px; border-bottom: 1px solid var(--border); }
.entradas-head { background: #f0fdf4; color: #15803d; }
.salidas-head { background: #fef2f2; color: #dc2626; }
.ledger-empty { padding: 24px; text-align: center; color: var(--text-light); font-size: 13px; }
.mov { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 16px; border-bottom: 1px solid var(--border); }
.mov:last-child { border-bottom: none; }
.mov-info { display: flex; flex-direction: column; min-width: 0; }
.mov-label { font-size: 13.5px; font-weight: 600; color: var(--text); }
.mov-meta { font-size: 11.5px; color: var(--text-light); margin-top: 1px; }
.mov-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.mov-amount { font-size: 14px; font-weight: 800; white-space: nowrap; }
.mov-amount.pos { color: #16a34a; }
.mov-amount.neg { color: var(--danger); }
.mov-amount.tras { color: #2563eb; }
.mov-del { border: none; background: none; cursor: pointer; font-size: 14px; opacity: 0.6; }
.mov-del:hover { opacity: 1; }

.ref-card { padding: 0; }
.ref-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border); font-weight: 700; font-size: 13.5px; gap: 10px; flex-wrap: wrap; }
.ref-head em { font-weight: 500; font-style: normal; font-size: 12px; color: var(--text-light); }
.ref-body { display: flex; gap: 24px; padding: 14px 16px; flex-wrap: wrap; }
.ref-item { display: flex; flex-direction: column; gap: 2px; }
.ref-l { font-size: 11.5px; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.04em; }
.ref-v { font-size: 18px; font-weight: 800; }
.ref-v.pos { color: #16a34a; }
.ref-v.neg { color: var(--danger); }

/* Análisis de costo */
.cost-card { padding: 0; }
.cost-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: 14px; font-weight: 700; }
.cost-meta-target { font-size: 11.5px; font-weight: 600; color: var(--text-light); background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 4px 10px; cursor: pointer; }
.cost-meta-target:hover { border-color: var(--accent); color: var(--text); }
.cost-body { padding: 6px 16px 14px; }
.cost-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13.5px; }
.cost-row:last-of-type { border-bottom: none; }
.cost-row.total { border-top: 2px solid var(--border); margin-top: 4px; padding-top: 10px; font-weight: 800; font-size: 15px; }
.cost-l { color: var(--text-secondary); }
.cost-l em { font-style: normal; font-size: 11.5px; color: var(--text-light); }
.cost-v { font-weight: 700; white-space: nowrap; }
.cost-v.pos { color: #16a34a; }
.cost-v.neg { color: var(--danger); }
.cost-margin { font-size: 11.5px; font-weight: 600; color: var(--text-light); margin-left: 6px; }
.cost-badge { display: inline-block; margin-left: 6px; padding: 1px 8px; border-radius: 10px; font-size: 12px; font-weight: 800; }
.cost-badge.good { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
.cost-badge.warn { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
.cost-badge.bad  { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.cost-tip { font-size: 12.5px; margin-top: 10px; font-weight: 600; }
.cost-tip.good { color: #15803d; }
.cost-tip.warn { color: #b45309; }
.cost-tip.bad  { color: #dc2626; }
.cost-empty { padding: 16px; text-align: center; color: var(--text-light); font-size: 13px; }

/* Resumen de salidas por tipo */
.sum-card { padding: 0; }
.sum-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: 14px; font-weight: 700; }
.sum-head em { font-weight: 500; font-style: normal; font-size: 12px; color: var(--text-light); }
.sum-total-badge { font-size: 12.5px; font-weight: 800; border-radius: 8px; padding: 3px 10px; }
.sum-total-badge.pos { color: #15803d; background: #f0fdf4; border: 1px solid #bbf7d0; }
.sum-total-badge.neg { color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; }
.sum-table-wrap { overflow-x: auto; }
.sum-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.sum-table th { text-align: left; font-size: 11.5px; color: var(--text-light); font-weight: 600; padding: 8px 16px; border-bottom: 1px solid var(--border); text-transform: uppercase; letter-spacing: 0.03em; }
.sum-table td { padding: 9px 16px; border-bottom: 1px solid var(--border); color: var(--text-secondary); }
.sum-table .r { text-align: right; white-space: nowrap; }
.sum-table .strong { font-weight: 800; }
.sum-table .pos { color: #16a34a; }
.sum-table .neg { color: var(--danger); }
/* Encabezados de sección (Ingresos / Salidas) */
.sum-section td { font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; padding: 8px 16px; }
.sum-section.in td { background: #f0fdf4; color: #15803d; }
.sum-section.out td { background: #fef2f2; color: #dc2626; }
/* Subtotales por bloque */
.sum-subtotal td { font-weight: 700; color: var(--text); background: var(--bg); }
/* Fila de ganancia (neto) y % */
.sum-table tfoot .sum-net td { border-top: 2px solid var(--border); font-weight: 800; background: var(--surface-2); font-size: 14px; }
.sum-table tfoot .sum-pct td { font-weight: 700; background: var(--surface-2); color: var(--text-secondary); }
.sum-table tfoot .sum-pct em { font-style: normal; font-weight: 500; font-size: 11.5px; color: var(--text-light); }
.sum-table tfoot .sum-pct .strong { color: var(--text); }
.sum-empty { text-align: center; color: var(--text-light); padding: 20px; }

.config-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; align-items: center; }
.config-grid .ch { font-size: 12px; font-weight: 700; text-align: center; color: var(--text-light); }
.config-grid .rh { font-size: 13px; font-weight: 600; }

@media (max-width: 900px) { .cards-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 640px) { .ledger-grid { grid-template-columns: 1fr; } .cards-grid { grid-template-columns: 1fr 1fr; } }
</style>
