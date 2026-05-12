<template>
  <PageLayout title="Dashboard">


        <div class="page-header">
          <div>
            <h1 class="page-title">Dashboard</h1>
            <p class="page-subtitle">{{ formatDateLong(new Date()) }} · {{ auth.currentBusiness?.name }}</p>
          </div>
          <button class="btn btn-outline btn-sm" @click="loadData" :disabled="loadingData">
            <RefreshCw :size="13" :class="{ spinning: loadingData }" />
            Actualizar
          </button>
        </div>

        <!-- Tarjetas de métricas — mientras carga se muestra el skeleton en lugar del spinner -->
        <div class="grid grid-4 mb-4">
          <!-- Skeleton: 4 tarjetas placeholder mientras los datos llegan -->
          <SkeletonCard v-if="loadingData" type="stat" :count="4" />

          <template v-if="!loadingData">
            <div class="stat-card">
              <div class="stat-icon-wrap" style="background:#fef3c7">
                <DollarSign :size="20" color="#d97706" />
              </div>
              <div>
                <p class="stat-label">Ventas hoy</p>
                <p class="stat-value">{{ formatCOP(todaySales.total) }}</p>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon-wrap" style="background:#d1fae5">
                <ShoppingBag :size="20" color="#059669" />
              </div>
              <div>
                <p class="stat-label">Transacciones hoy</p>
                <p class="stat-value">{{ todaySales.count }}</p>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon-wrap" style="background:#dbeafe">
                <TableIcon :size="20" color="#2563eb" />
              </div>
              <div>
                <p class="stat-label">Mesas ocupadas</p>
                <p class="stat-value">{{ occupiedTables }}<span class="stat-denom"> / {{ totalTables }}</span></p>
              </div>
            </div>

            <div class="stat-card" :class="{ 'stat-alert': lowStock.length > 0 }">
              <div class="stat-icon-wrap" :style="lowStock.length > 0 ? 'background:#fef3c7' : 'background:#f1f5f9'">
                <AlertTriangle :size="20" :color="lowStock.length > 0 ? '#d97706' : '#94a3b8'" />
              </div>
              <div>
                <p class="stat-label">Stock bajo</p>
                <p class="stat-value" :style="lowStock.length > 0 ? 'color:var(--warning)' : ''">
                  {{ lowStock.length }} <span class="stat-denom">items</span>
                </p>
              </div>
            </div>
          </template>
        </div>

        <!-- Nómina del mes -->
        <div class="card nomina-card mb-4" v-if="!loadingData && suppliers.some(s => s.tipo === 'empleado')">
          <div class="nomina-header">
            <div class="nomina-title-wrap">
              <div class="nomina-icon-wrap">
                <Users :size="18" color="#7c3aed" />
              </div>
              <div>
                <h3 class="section-title">Nómina — {{ new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }) }}</h3>
                <p class="section-sub">Total pagado a empleados este mes</p>
              </div>
            </div>
            <div class="nomina-total-badge">
              <span class="nomina-total-label">Total</span>
              <span class="nomina-total-val">{{ formatCOP(totalNominaMes) }}</span>
            </div>
          </div>

          <div class="nomina-rows" v-if="nominaMes.length">
            <div v-for="emp in nominaMes" :key="emp.id" class="nomina-row">
              <div class="nomina-emp-info">
                <span class="nomina-emp-name">{{ emp.name }}</span>
                <span class="nomina-emp-cargo" v-if="emp.cargo">{{ emp.cargo }}</span>
              </div>
              <div class="nomina-bar-wrap">
                <div class="nomina-bar">
                  <div class="nomina-bar-fill" :style="{ width: (emp.total / maxNominaEmp * 100) + '%' }"></div>
                </div>
                <span class="nomina-emp-total">{{ formatCOP(emp.total) }}</span>
              </div>
              <span class="nomina-emp-count">{{ emp.pagos }} pago{{ emp.pagos !== 1 ? 's' : '' }}</span>
            </div>
          </div>
          <div v-else class="nomina-empty">Sin pagos de nómina registrados este mes</div>
        </div>

        <!-- Gráfica de ventas de los últimos 7 días -->
        <div class="card mb-4">
          <div class="chart-header">
            <div>
              <h3 class="section-title">Ventas últimos 7 días</h3>
              <p class="section-sub">Total acumulado: {{ formatCOP(weekTotal) }}</p>
            </div>
            <div class="week-total-badge">
              <TrendingUp :size="14" />
              {{ weekSales.length }} días con ventas
            </div>
          </div>
          <div class="chart-wrap">
            <div v-if="loadingData" class="chart-loading">
              <div class="spinner"></div>
            </div>
            <Line v-else-if="chartData.labels.length" :data="chartData" :options="chartOptions" />
            <div v-else class="empty-state" style="padding:32px 20px">
              <BarChart3 :size="36" class="empty-icon" />
              <p class="empty-state-title">Sin ventas esta semana</p>
              <p class="empty-state-text">Las ventas aparecerán aquí automáticamente</p>
            </div>
          </div>
        </div>

        <div class="grid grid-2 mb-4">
          <!-- Acceso rápido -->
          <div class="card">
            <h3 class="section-title">Acceso rápido</h3>
            <div class="quick-actions">
              <router-link to="/tables" class="quick-btn">
                <UtensilsCrossed :size="22" />
                <span>Registrar Venta</span>
              </router-link>
              <router-link to="/inventory" class="quick-btn" v-if="auth.isAdmin">
                <Package :size="22" />
                <span>Inventario</span>
              </router-link>
              <router-link to="/reports" class="quick-btn" v-if="auth.isAdmin">
                <BarChart3 :size="22" />
                <span>Reportes</span>
              </router-link>
              <router-link to="/invoices" class="quick-btn">
                <Receipt :size="22" />
                <span>Facturas</span>
              </router-link>
            </div>
          </div>

          <!-- Métodos de pago del día -->
          <div class="card">
            <h3 class="section-title">Métodos de pago hoy</h3>
            <div v-if="paymentMethods.length" class="payment-list">
              <div v-for="pm in paymentMethods" :key="pm.method" class="payment-row">
                <div class="payment-info">
                  <component :is="paymentIcon(pm.method)" :size="14" />
                  <span class="payment-method">{{ pm.method }}</span>
                  <span class="payment-count">{{ pm.count }} ventas</span>
                </div>
                <span class="payment-amount">{{ formatCOP(pm.total) }}</span>
              </div>
            </div>
            <div v-else class="empty-small">Sin ventas hoy</div>
          </div>
        </div>

        <!-- Alertas de stock bajo -->
        <div class="card mb-4" v-if="lowStock.length > 0">
          <h3 class="section-title warning-title">
            <AlertTriangle :size="16" color="var(--warning)" />
            Stock bajo ({{ lowStock.length }} productos)
          </h3>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Stock actual</th>
                  <th>Mínimo</th>
                  <th>Unidad</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in lowStock" :key="item.id">
                  <td><strong>{{ item.name }}</strong></td>
                  <td><span class="badge badge-default">{{ item.category }}</span></td>
                  <td><span class="badge badge-danger">{{ item.stock }}</span></td>
                  <td>{{ item.minStock }}</td>
                  <td class="text-muted">{{ item.unit }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Ventas recientes -->
        <div class="card" v-if="recentSales.length > 0">
          <h3 class="section-title">Ventas recientes</h3>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Mesa</th>
                  <th>Cajero</th>
                  <th>Método</th>
                  <th>Total</th>
                  <th>Hora</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="sale in recentSales" :key="sale.id">
                  <td><code class="invoice-code">{{ sale.invoiceNumber }}</code></td>
                  <td>{{ sale.tableNumber ? 'Mesa ' + sale.tableNumber : '-' }}</td>
                  <td>{{ sale.cashier }}</td>
                  <td>
                    <span :class="['badge', paymentBadge(sale.paymentMethod)]">{{ sale.paymentMethod }}</span>
                  </td>
                  <td class="currency">{{ formatCOP(sale.total) }}</td>
                  <td class="text-muted">{{ formatTime(sale.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

  </PageLayout>
</template>

<script setup>
/**
 * DashboardView.vue — Panel principal con métricas, gráfica de 7 días y accesos rápidos.
 */
import { ref, computed, onMounted } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { useAuthStore } from '../stores/auth.js'
import { useInventoryStore } from '../stores/inventory.js'
import { useTablesStore } from '../stores/tables.js'
import { useSalesStore } from '../stores/sales.js'
import api from '../services/api.js'
import PageLayout from '../components/PageLayout.vue'
import SkeletonCard from '../components/SkeletonCard.vue'
import {
  RefreshCw, DollarSign, ShoppingBag, AlertTriangle, TrendingUp,
  BarChart3, UtensilsCrossed, Package, Receipt, Banknote, CreditCard, Smartphone,
  Table as TableIcon, Users
} from 'lucide-vue-next'

// Registrar módulos de Chart.js
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const auth = useAuthStore()
const inventoryStore = useInventoryStore()
const tablesStore = useTablesStore()
const salesStore = useSalesStore()

const loadingData = ref(false)
const todaySales = ref({ total: 0, count: 0 })
const recentSales = ref([])
const weekSales = ref([])     // Array de { date, total } para la gráfica
const paymentMethods = ref([]) // Array de { method, count, total } para hoy
const suppliers = ref([])

const lowStock = computed(() => inventoryStore.lowStockItems)
const occupiedTables = computed(() => tablesStore.occupiedCount)
const totalTables = computed(() => tablesStore.tables.length)
const weekTotal = computed(() => weekSales.value.reduce((s, d) => s + d.total, 0))

// ── Nómina del mes ───────────────────────────────────────────────
const currentMonth = new Date().toISOString().slice(0, 7) // 'YYYY-MM'

const nominaMes = computed(() => {
  const empleados = suppliers.value.filter(s => s.tipo === 'empleado')
  return empleados.map(emp => {
    const pagos = (emp.payments || []).filter(p => p.date?.slice(0, 7) === currentMonth)
    const total = pagos.reduce((s, p) => s + (p.amount || 0), 0)
    return { id: emp.id, name: emp.name, cargo: emp.cargo || '', total, pagos: pagos.length }
  }).filter(e => e.total > 0 || e.pagos === 0)
    .sort((a, b) => b.total - a.total)
})

const totalNominaMes = computed(() => nominaMes.value.reduce((s, e) => s + e.total, 0))
const maxNominaEmp = computed(() => Math.max(...nominaMes.value.map(e => e.total), 1))

// ── Gráfica de ventas 7 días ─────────────────────────────────────
const isDark = computed(() => document.documentElement.classList.contains('dark'))

const chartData = computed(() => {
  const labels = weekSales.value.map(d => formatDayLabel(d.date))
  const data = weekSales.value.map(d => d.total)
  const accent = '#f59e0b'
  return {
    labels,
    datasets: [{
      label: 'Ventas',
      data,
      fill: true,
      backgroundColor: 'rgba(245,158,11,0.10)',
      borderColor: accent,
      borderWidth: 2.5,
      pointBackgroundColor: accent,
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 7,
      tension: 0.4
    }]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0f172a',
      titleColor: '#94a3b8',
      bodyColor: '#f59e0b',
      bodyFont: { weight: '700', size: 14 },
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
      ticks: { font: { size: 12, family: 'Inter' }, color: '#94a3b8' },
      border: { display: false }
    },
    y: {
      grid: { color: 'rgba(148,163,184,0.1)' },
      ticks: {
        font: { size: 11, family: 'Inter' },
        color: '#94a3b8',
        callback: v => '$' + Number(v).toLocaleString('es-CO')
      },
      border: { display: false }
    }
  }
}

// ── Helpers de formato ───────────────────────────────────────────
function formatCOP(v) { return '$' + Number(v || 0).toLocaleString('es-CO') }
function formatDateLong(d) {
  return d.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}
function formatDayLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })
}

function paymentBadge(method) {
  const map = { efectivo: 'badge-success', transferencia: 'badge-info', tarjeta: 'badge-warning' }
  return map[method] || 'badge-default'
}
function paymentIcon(method) {
  if (method === 'efectivo') return Banknote
  if (method === 'tarjeta') return CreditCard
  return Smartphone
}

// ── Carga de datos ───────────────────────────────────────────────
async function loadData() {
  loadingData.value = true
  try {
    const bizId = auth.currentBusiness?.id
    const [, , suppRes] = await Promise.all([
      inventoryStore.fetchInventory(),
      tablesStore.fetchTables(),
      api.get(`/api/${bizId}/suppliers`)
    ])
    suppliers.value = suppRes.data || []

    // Reporte del día: ventas de hoy y métricas de pago
    const dayReport = await salesStore.fetchReports({ period: 'day' })
    todaySales.value = { total: dayReport.summary?.totalRevenue || 0, count: dayReport.summary?.count || 0 }
    recentSales.value = (dayReport.sales || []).slice(-10).reverse()

    // Métodos de pago del día
    const byPayment = dayReport.summary?.byPayment || {}
    paymentMethods.value = Object.entries(byPayment)
      .map(([method, data]) => ({ method, count: data.count || 0, total: data.total || 0 }))
      .filter(p => p.count > 0)
      .sort((a, b) => b.total - a.total)

    // Reporte de la semana para la gráfica
    const weekReport = await salesStore.fetchReports({ period: 'week' })
    buildWeekData(weekReport)
  } catch { /* silenciar errores parciales para no bloquear la UI */ } finally {
    loadingData.value = false
  }
}

/**
 * Construye el array de 7 días para la gráfica, rellenando con 0
 * los días que no tuvieron ventas.
 */
function buildWeekData(report) {
  const byDay = report.summary?.byDay || {}
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10) // 'YYYY-MM-DD'
    days.push({ date: key, total: byDay[key]?.total || 0 })
  }
  weekSales.value = days
}

onMounted(loadData)
</script>

<style scoped>
.mb-4 { margin-bottom: 24px; }

/* Stat cards */
.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: var(--shadow-sm);
  transition: all var(--transition);
}
.stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
.stat-card.stat-alert { border-left: 3px solid var(--warning); }

.stat-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-label { font-size: 11.5px; color: var(--text-light); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
.stat-value { font-size: 20px; font-weight: 800; color: var(--text); letter-spacing: -0.03em; }
.stat-denom { font-size: 14px; font-weight: 500; color: var(--text-light); }

/* Gráfica */
.chart-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}
.section-title { font-size: 15px; font-weight: 700; color: var(--text); letter-spacing: -0.02em; }
.section-sub { font-size: 12.5px; color: var(--text-light); margin-top: 3px; }
.week-total-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-light);
  padding: 4px 10px;
  border-radius: 20px;
}
.chart-wrap {
  height: 220px;
  position: relative;
}
.chart-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
.empty-icon { color: var(--text-light); margin-bottom: 10px; }

/* Acceso rápido */
.quick-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.quick-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 18px;
  background: var(--surface-2);
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  text-decoration: none;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  gap: 8px;
  min-width: 88px;
  transition: all var(--transition);
}
.quick-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-light);
  transform: translateY(-2px);
}

/* Métodos de pago */
.payment-list { display: flex; flex-direction: column; gap: 8px; }
.payment-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--border);
}
.payment-info { display: flex; align-items: center; gap: 8px; color: var(--text-secondary); font-size: 13px; }
.payment-method { font-weight: 600; color: var(--text); text-transform: capitalize; }
.payment-count { font-size: 11.5px; color: var(--text-light); }
.payment-amount { font-weight: 700; font-size: 13px; color: var(--success); }
.empty-small { text-align: center; padding: 20px; color: var(--text-light); font-size: 13px; }

.warning-title { display: flex; align-items: center; gap: 8px; color: var(--warning); }

.invoice-code {
  font-family: 'Inter', monospace;
  font-size: 12px;
  background: var(--surface-2);
  padding: 2px 7px;
  border-radius: 5px;
  border: 1px solid var(--border);
}

/* Nómina del mes */
.nomina-card { padding: 20px; }
.nomina-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}
.nomina-title-wrap { display: flex; align-items: center; gap: 12px; }
.nomina-icon-wrap {
  width: 40px; height: 40px; border-radius: 10px;
  background: #ede9fe; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.nomina-total-badge {
  display: flex; flex-direction: column; align-items: flex-end;
  background: var(--surface-2); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 8px 16px;
}
.nomina-total-label { font-size: 11px; font-weight: 600; color: var(--text-light); text-transform: uppercase; letter-spacing: .05em; }
.nomina-total-val { font-size: 20px; font-weight: 800; color: #7c3aed; letter-spacing: -0.02em; }

.nomina-rows { display: flex; flex-direction: column; gap: 10px; }
.nomina-row {
  display: grid;
  grid-template-columns: 160px 1fr 72px;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}
.nomina-emp-info { display: flex; flex-direction: column; min-width: 0; }
.nomina-emp-name { font-size: 13px; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nomina-emp-cargo { font-size: 11px; color: var(--text-light); margin-top: 2px; }
.nomina-bar-wrap { display: flex; align-items: center; gap: 10px; }
.nomina-bar { flex: 1; height: 8px; background: var(--border); border-radius: 99px; overflow: hidden; }
.nomina-bar-fill { height: 100%; background: linear-gradient(90deg, #7c3aed, #a78bfa); border-radius: 99px; transition: width .4s ease; }
.nomina-emp-total { font-size: 12.5px; font-weight: 700; color: var(--text); white-space: nowrap; }
.nomina-emp-count { font-size: 11.5px; color: var(--text-light); text-align: right; }
.nomina-empty { text-align: center; padding: 16px; color: var(--text-light); font-size: 13px; }

@media (max-width: 600px) {
  .nomina-row { grid-template-columns: 1fr; gap: 6px; }
  .nomina-emp-count { text-align: left; }
}

/* Spinner en botón refresh */
.spinning { animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 768px) {
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
  .grid-2 { grid-template-columns: 1fr; }
  .chart-wrap { height: 180px; }
}
</style>
