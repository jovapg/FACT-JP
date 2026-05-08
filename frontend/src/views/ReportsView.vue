<template>
  <PageLayout title="Reportes">
        <div class="page-header">
          <div>
            <h1 class="page-title">Reportes</h1>
            <p class="page-subtitle">Análisis de ventas y rentabilidad</p>
          </div>
          <button class="btn btn-success" @click="activeTab === 'ventas' ? exportExcel() : exportRentabilidad()" :disabled="exporting">
            {{ exporting ? 'Generando...' : '📥 Exportar Excel' }}
          </button>
        </div>

        <!-- Tabs -->
        <div class="report-tabs mb-3">
          <button :class="['report-tab', activeTab === 'ventas' ? 'active' : '']" @click="activeTab = 'ventas'">
            📊 Ventas
          </button>
          <button :class="['report-tab', activeTab === 'rentabilidad' ? 'active' : '']" @click="activeTab = 'rentabilidad'; loadRentabilidad()">
            💹 Rentabilidad
          </button>
        </div>

        <!-- Filters -->
        <div class="card filters-card mb-3">
          <div class="filter-row">
            <div class="form-group">
              <label class="form-label">Período</label>
              <select v-model="periodType" class="form-control" @change="loadReport">
                <option value="day">Hoy</option>
                <option value="week">Esta semana</option>
                <option value="month">Este mes</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
            <template v-if="periodType === 'custom'">
              <div class="form-group">
                <label class="form-label">Desde</label>
                <input v-model="fromDate" type="date" class="form-control" @change="loadReport" />
              </div>
              <div class="form-group">
                <label class="form-label">Hasta</label>
                <input v-model="toDate" type="date" class="form-control" @change="loadReport" />
              </div>
            </template>
          </div>
        </div>

        <div v-if="loading" class="loading">
          <div class="spinner"></div> Generando reporte...
        </div>

        <!-- ── RENTABILIDAD TAB ── -->
        <template v-if="!loading && activeTab === 'rentabilidad'">
          <div class="grid grid-3 mb-4">
            <div class="stat-card gain-card">
              <div class="stat-icon" style="background:#d5f5e3">💰</div>
              <div>
                <p class="stat-label">Ventas netas</p>
                <p class="stat-value" style="color:var(--success)">{{ formatCOP(rent.ingresos?.ventasNetas || 0) }}</p>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#fde8e8">📉</div>
              <div>
                <p class="stat-label">Total egresos</p>
                <p class="stat-value" style="color:var(--danger)">{{ formatCOP(rent.egresos?.total || 0) }}</p>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" :style="{ background: rent.gananciaNeta >= 0 ? '#d5f5e3' : '#fde8e8' }">🏦</div>
              <div>
                <p class="stat-label">Ganancia neta</p>
                <p class="stat-value" :style="{ color: rent.gananciaNeta >= 0 ? 'var(--success)' : 'var(--danger)' }">
                  {{ formatCOP(rent.gananciaNeta || 0) }}
                </p>
              </div>
            </div>
          </div>

          <div class="grid grid-2 mb-4">
            <div class="card">
              <h3 class="section-title" style="color:var(--success)">📈 INGRESOS</h3>
              <div class="rent-row">
                <span>Ventas brutas</span>
                <span class="rent-val">{{ formatCOP(rent.ingresos?.ventasBruto || 0) }}</span>
              </div>
              <div class="rent-row" v-if="rent.ingresos?.descuentos > 0">
                <span>(-) Descuentos</span>
                <span class="rent-val text-danger">- {{ formatCOP(rent.ingresos.descuentos) }}</span>
              </div>
              <div class="rent-row rent-total">
                <span>Ventas netas</span>
                <span class="rent-val">{{ formatCOP(rent.ingresos?.ventasNetas || 0) }}</span>
              </div>
            </div>
            <div class="card">
              <h3 class="section-title" style="color:var(--danger)">📉 EGRESOS</h3>
              <div class="rent-row">
                <span>🏭 Compras a proveedores</span>
                <span class="rent-val">{{ formatCOP(rent.egresos?.compras || 0) }}</span>
              </div>
              <div class="rent-row">
                <span>👷 Nómina empleados</span>
                <span class="rent-val">{{ formatCOP(rent.egresos?.nomina || 0) }}</span>
              </div>
              <div class="rent-row">
                <span>🏠 Arriendo</span>
                <span class="rent-val">{{ formatCOP(rent.egresos?.arriendo || 0) }}</span>
              </div>
              <div class="rent-row">
                <span>💳 Créditos</span>
                <span class="rent-val">{{ formatCOP(rent.egresos?.creditos || 0) }}</span>
              </div>
              <div class="rent-row">
                <span>💵 Retiros de caja</span>
                <span class="rent-val">{{ formatCOP(rent.egresos?.retiros || 0) }}</span>
              </div>
              <div class="rent-row rent-total">
                <span>Total egresos</span>
                <span class="rent-val text-danger">{{ formatCOP(rent.egresos?.total || 0) }}</span>
              </div>
            </div>
          </div>

          <!-- Gráfica de dona: composición de los egresos por categoría -->
          <div class="card mb-4" v-if="egresosChartData.labels.length">
            <h3 class="section-title" style="color:var(--danger)">📉 Composición de egresos</h3>
            <div class="chart-donut-wrap chart-donut-lg">
              <Doughnut :data="egresosChartData" :options="doughnutOptions" />
            </div>
          </div>

          <div class="card rent-ganancia-card mb-4" :class="rent.gananciaNeta >= 0 ? 'ganancia-pos' : 'ganancia-neg'">
            <span>GANANCIA NETA</span>
            <span class="rent-ganancia-val">{{ formatCOP(rent.gananciaNeta || 0) }}</span>
          </div>
        </template>

        <template v-if="!loading && activeTab === 'ventas'">
          <!-- Summary cards -->
          <div class="grid grid-4 mb-4">
            <div class="stat-card">
              <div class="stat-icon" style="background:#d5f5e3">💰</div>
              <div>
                <p class="stat-label">Total Ventas</p>
                <p class="stat-value">{{ formatCOP(report.summary?.totalRevenue || 0) }}</p>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#d6eaf8">🧾</div>
              <div>
                <p class="stat-label">Transacciones</p>
                <p class="stat-value">{{ report.summary?.count || 0 }}</p>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#fef9e7">📊</div>
              <div>
                <p class="stat-label">Ticket promedio</p>
                <p class="stat-value">
                  {{ formatCOP(report.summary?.count ? (report.summary.totalRevenue / report.summary.count) : 0) }}
                </p>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" style="background:#fde8e8">💳</div>
              <div>
                <p class="stat-label">Efectivo</p>
                <p class="stat-value">{{ formatCOP(report.summary?.byPayment?.efectivo || 0) }}</p>
              </div>
            </div>
          </div>

          <div class="grid grid-2 mb-4">
            <!-- Gráfica de dona: distribución por método de pago -->
            <div class="card">
              <h3 class="section-title">Por método de pago</h3>
              <div v-if="paymentChartData.labels.length" class="chart-donut-wrap">
                <Doughnut :data="paymentChartData" :options="doughnutOptions" />
              </div>
              <p v-else class="text-muted" style="text-align:center;padding:32px">Sin ventas en el período</p>
            </div>

            <!-- Gráfica de barras: top productos más vendidos -->
            <div class="card">
              <h3 class="section-title">Productos más vendidos</h3>
              <div v-if="topProductsChartData.labels.length" class="chart-bar-wrap">
                <Bar :data="topProductsChartData" :options="barOptions" />
              </div>
              <p v-else class="text-muted" style="text-align:center;padding:32px">Sin datos de productos</p>
            </div>
          </div>

          <!-- Sales by day -->
          <div class="card mb-4" v-if="Object.keys(report.summary?.byDay || {}).length > 0">
            <h3 class="section-title">Ventas por día</h3>
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr><th>Fecha</th><th>Transacciones</th><th>Total</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(data, day) in report.summary?.byDay" :key="day">
                    <td>{{ formatDateStr(day) }}</td>
                    <td>{{ data.count }}</td>
                    <td class="currency">{{ formatCOP(data.total) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Sales list -->
          <div class="card">
            <h3 class="section-title">Detalle de ventas ({{ report.sales?.length || 0 }})</h3>
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Factura</th>
                    <th>Fecha/Hora</th>
                    <th>Mesa</th>
                    <th>Cajero</th>
                    <th>Método</th>
                    <th>Descuento</th>
                    <th>Total</th>
                    <th>PDF</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="sale in report.sales" :key="sale.id">
                    <td><code>{{ sale.invoiceNumber }}</code></td>
                    <td>{{ formatDateTime(sale.createdAt) }}</td>
                    <td>{{ sale.tableNumber || '-' }}</td>
                    <td>{{ sale.cashier }}</td>
                    <td><span :class="['badge', payBadge(sale.paymentMethod)]">{{ sale.paymentMethod }}</span></td>
                    <td class="currency" style="color:var(--danger)">{{ sale.discount > 0 ? '- ' + formatCOP(sale.discount) : '-' }}</td>
                    <td class="currency">{{ formatCOP(sale.total) }}</td>
                    <td>
                      <a :href="`/api/${bizId}/invoices/${sale.id}/pdf?token=${token}`" target="_blank" class="btn btn-sm btn-outline">
                        PDF
                      </a>
                    </td>
                  </tr>
                  <tr v-if="!report.sales?.length">
                    <td colspan="8" style="text-align:center;color:var(--text-light);padding:32px">Sin ventas en el período</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
  </PageLayout>
</template>

<script setup>
/**
 * ReportsView.vue — Módulo de Reportes y Rentabilidad
 *
 * Contiene dos tabs:
 *
 * 📊 Tab "Ventas":
 *   - Resumen: total de ventas, transacciones, ticket promedio, efectivo
 *   - Gráfico de barras por método de pago
 *   - Top 8 productos más vendidos
 *   - Tabla de ventas por día
 *   - Tabla de detalle de ventas con enlace a PDF
 *   - Exportar a Excel
 *
 * 💹 Tab "Rentabilidad":
 *   - INGRESOS: ventas brutas, descuentos, ventas netas
 *   - EGRESOS: compras, nómina (empleados), arriendo, créditos
 *   - GANANCIA NETA = ventas netas - total egresos
 *   - Exportar a Excel (con hojas de detalle: Ventas, Compras, Nómina, etc.)
 *
 * Los egresos se calculan desde los pagos a proveedores clasificados
 * por su `tipo` (proveedor, empleado, arriendo, credito).
 *
 * Todos los filtros de fecha aplican a ambos tabs.
 */
import { ref, computed, onMounted, inject } from 'vue'
import { Doughnut, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS, ArcElement, BarElement,
  CategoryScale, LinearScale, Tooltip, Legend
} from 'chart.js'
import { useSalesStore } from '../stores/sales.js'
import { useAuthStore } from '../stores/auth.js'
import api from '../services/api.js'
import PageLayout from '../components/PageLayout.vue'

// Registrar los tipos de gráfica usados en esta vista: dona (Doughnut) y barras (Bar)
ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const salesStore = useSalesStore()
const auth = useAuthStore()
const toast = inject('toast')

const bizId = computed(() => auth.currentBusiness?.id)
const token = computed(() => auth.token)
const activeTab = ref('ventas')
const periodType = ref('day')
const fromDate = ref('')
const toDate = ref('')
const loading = ref(false)
const exporting = ref(false)
const report = ref({ sales: [], summary: {} })
const rent = ref({ ingresos: {}, egresos: {}, gananciaNeta: 0 })

// ── Colores de métodos de pago (consistentes entre texto y gráfica) ─────────
const paymentColors = {
  efectivo:      '#10b981',  // verde — pago en mano
  transferencia: '#3b82f6',  // azul — pago digital
  tarjeta:       '#f59e0b',  // ámbar — tarjeta débito/crédito
}
function colorForMethod(method) {
  return paymentColors[method?.toLowerCase()] || '#94a3b8'
}

/**
 * Datos para el gráfico de dona (Doughnut) de métodos de pago en el tab "Ventas".
 * Se recalcula cada vez que cambia el reporte.
 */
const paymentChartData = computed(() => {
  const bp = report.value.summary?.byPayment || {}
  const labels = Object.keys(bp)
  return {
    labels,
    datasets: [{
      data: labels.map(l => bp[l]),
      backgroundColor: labels.map(l => colorForMethod(l)),
      borderWidth: 2,
      borderColor: '#ffffff',
      hoverOffset: 6
    }]
  }
})

/**
 * Datos para el gráfico de barras (Bar) de top productos en el tab "Ventas".
 * Muestra hasta 8 productos ordenados por total vendido.
 */
const topProductsChartData = computed(() => {
  const top = (report.value.summary?.topProducts || []).slice(0, 8)
  return {
    labels: top.map(p => p.name),
    datasets: [{
      label: 'Total vendido',
      data: top.map(p => p.total),
      backgroundColor: '#f59e0b',
      borderRadius: 6,
      borderSkipped: false
    }]
  }
})

/**
 * Datos para el gráfico de dona de egresos en el tab "Rentabilidad".
 * Excluye categorías con valor 0 para no llenar la dona de slices vacíos.
 */
const egresosChartData = computed(() => {
  const e = rent.value.egresos || {}
  const categorias = [
    { label: 'Compras',     value: e.compras  || 0, color: '#f59e0b' },
    { label: 'Nómina',      value: e.nomina   || 0, color: '#3b82f6' },
    { label: 'Arriendo',    value: e.arriendo || 0, color: '#8b5cf6' },
    { label: 'Créditos',    value: e.creditos || 0, color: '#ef4444' },
    { label: 'Retiros',     value: e.retiros  || 0, color: '#f97316' },
  ].filter(c => c.value > 0)  // Solo mostrar categorías con monto real
  return {
    labels: categorias.map(c => c.label),
    datasets: [{
      data: categorias.map(c => c.value),
      backgroundColor: categorias.map(c => c.color),
      borderWidth: 2,
      borderColor: '#ffffff',
      hoverOffset: 6
    }]
  }
})

/** Opciones compartidas para todos los gráficos de dona */
const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',          // Grosor del anillo — mayor = más delgado
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        padding: 14,
        font: { size: 12, family: 'Inter' },
        usePointStyle: true,
        pointStyleWidth: 8
      }
    },
    tooltip: {
      backgroundColor: '#0f172a',
      titleColor: '#94a3b8',
      bodyColor: '#f1f5f9',
      padding: 12,
      cornerRadius: 10,
      callbacks: {
        // Muestra el valor en COP dentro del tooltip
        label: ctx => '  $' + Number(ctx.raw || 0).toLocaleString('es-CO')
      }
    }
  }
}

/** Opciones para el gráfico de barras de top productos */
const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0f172a',
      titleColor: '#94a3b8',
      bodyColor: '#f59e0b',
      bodyFont: { weight: '700' },
      padding: 12,
      cornerRadius: 10,
      callbacks: {
        label: ctx => '  $' + Number(ctx.raw || 0).toLocaleString('es-CO')
      }
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: 11, family: 'Inter' }, color: '#94a3b8', maxRotation: 30 },
      border: { display: false }
    },
    y: {
      grid: { color: 'rgba(148,163,184,0.12)' },
      ticks: {
        font: { size: 11, family: 'Inter' },
        color: '#94a3b8',
        callback: v => '$' + Number(v).toLocaleString('es-CO')
      },
      border: { display: false }
    }
  }
}

function formatCOP(v) { return '$' + Number(v || 0).toLocaleString('es-CO') }

/** Formatea 'YYYY-MM-DD' como 'lun. 31 mar' para la tabla de ventas por día */
function formatDateStr(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })
}

/** Formatea fecha ISO como 'DD/MM/YYYY HH:MM' */
function formatDateTime(iso) {
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Clase CSS del badge según el método de pago */
function payBadge(m) {
  return { efectivo: 'badge-success', transferencia: 'badge-info', tarjeta: 'badge-warning' }[m] || 'badge-default'
}

/**
 * Carga el reporte según el tab activo y los filtros de fecha.
 * Si estamos en el tab de rentabilidad, delega a loadRentabilidad().
 */
async function loadReport() {
  if (activeTab.value === 'rentabilidad') { loadRentabilidad(); return; }
  loading.value = true
  try {
    report.value = await salesStore.fetchReports(buildParams())
  } catch {
    toast('Error al cargar reporte', 'error')
  } finally {
    loading.value = false
  }
}

async function exportExcel() {
  exporting.value = true
  try {
    const params = {}
    if (periodType.value === 'custom') {
      if (fromDate.value) params.from = fromDate.value
      if (toDate.value) params.to = toDate.value
    }
    await salesStore.exportExcel(params.from, params.to)
    toast('Reporte generado', 'success')
  } catch {
    toast('Error al exportar', 'error')
  } finally {
    exporting.value = false
  }
}

/** Carga los datos del reporte de Rentabilidad desde el endpoint dedicado */
async function loadRentabilidad() {
  loading.value = true
  try {
    const params = buildParams()
    const res = await api.get(`/api/${bizId.value}/reports/rentabilidad`, { params })
    rent.value = res.data
  } catch {
    toast('Error al cargar rentabilidad', 'error')
  } finally {
    loading.value = false
  }
}

/**
 * Descarga el reporte de rentabilidad como Excel.
 * Usa un enlace <a> temporal para forzar la descarga sin pasar por axios
 * (ya que el token se pasa como query param para autenticar).
 */
async function exportRentabilidad() {
  exporting.value = true
  try {
    const params = buildParams()
    const qs = new URLSearchParams(params).toString()
    const link = document.createElement('a')
    link.href = `/api/${bizId.value}/reports/rentabilidad/excel?${qs}&token=${token.value}`
    link.download = 'rentabilidad.xlsx'
    link.click()
    toast('Descargando Excel...', 'success')
  } catch {
    toast('Error al exportar', 'error')
  } finally {
    exporting.value = false
  }
}

/**
 * Construye los query params de filtro según el tipo de período seleccionado.
 * Si es 'custom', usa from/to; si no, usa el shortcut de período.
 */
function buildParams() {
  const params = {}
  if (periodType.value !== 'custom') {
    params.period = periodType.value
  } else {
    if (fromDate.value) params.from = fromDate.value
    if (toDate.value) params.to = toDate.value
  }
  return params
}

onMounted(loadReport)
</script>

<style scoped>
.report-tabs { display: flex; gap: 8px; }
.report-tab {
  padding: 8px 20px; border-radius: 20px; border: 2px solid var(--border);
  background: white; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s;
}
.report-tab.active { background: var(--primary); color: white; border-color: var(--primary); }

.rent-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
.rent-row:last-child { border-bottom: none; }
.rent-total { font-weight: 700; font-size: 15px; }
.rent-val { font-weight: 600; }
.text-danger { color: var(--danger); }

.rent-ganancia-card {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 24px; border-radius: var(--radius); font-size: 20px; font-weight: 800;
}
.ganancia-pos { background: linear-gradient(135deg, #d5f5e3, #a9dfbf); color: #1e8449; }
.ganancia-neg { background: linear-gradient(135deg, #fde8e8, #f5b7b1); color: #c0392b; }
.rent-ganancia-val { font-size: 24px; }

.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

.filters-card { padding: 16px 20px; }
.filter-row { display: flex; gap: 16px; flex-wrap: wrap; }
.filter-row .form-group { min-width: 150px; margin-bottom: 0; }
.mb-3 { margin-bottom: 16px; }
.mb-4 { margin-bottom: 24px; }

.stat-card {
  background: white;
  border-radius: var(--radius);
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: var(--shadow);
}
.stat-icon {
  width: 48px; height: 48px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;
}
.stat-label { font-size: 12px; color: var(--text-light); }
.stat-value { font-size: 20px; font-weight: 800; }

.section-title { font-size: 15px; font-weight: 700; margin-bottom: 14px; }

/* ── Contenedores de gráficas ───────────────────────────────────────
   chart-donut-wrap: tamaño compacto para la dona de métodos de pago.
   chart-donut-lg:  variante más alta para la dona de egresos de rentabilidad.
   chart-bar-wrap:  altura fija para la gráfica de barras de productos.
   El canvas de Chart.js rellena el 100% del contenedor por maintainAspectRatio: false.
*/
.chart-donut-wrap {
  height: 260px;
  position: relative;
}
.chart-donut-lg {
  height: 320px;
}
.chart-bar-wrap {
  height: 260px;
  position: relative;
}

.text-muted { color: var(--text-light); font-size: 13px; }

@media (max-width: 768px) {
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
  .grid-3 { grid-template-columns: 1fr; }
  .grid-2 { grid-template-columns: 1fr; }
  .report-tabs { flex-wrap: wrap; }
  .chart-donut-wrap { height: 220px; }
  .chart-bar-wrap   { height: 200px; }
}
</style>
