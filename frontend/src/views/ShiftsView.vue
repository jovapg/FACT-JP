<template>
  <PageLayout title="Turnos de Caja">

        <div class="page-header">
          <div>
            <h1 class="page-title">Turnos de Caja</h1>
            <p class="page-subtitle">Control de apertura, cierre y retiros de efectivo</p>
          </div>
          <button
            v-if="!shiftsStore.currentShift"
            class="btn btn-primary"
            @click="openAbrirModal"
          >
            <LogIn :size="15" /> Abrir turno
          </button>
        </div>

        <!-- ── Turno activo ──────────────────────────────────────── -->
        <div v-if="shiftsStore.currentShift" class="shift-active-card mb-4">
          <div class="shift-active-header">
            <div class="shift-active-info">
              <div class="shift-status-dot"></div>
              <div>
                <p class="shift-active-title">Turno en curso</p>
                <p class="shift-active-sub">
                  Abierto por <strong>{{ shiftsStore.currentShift.cashierName }}</strong>
                  · {{ formatDateTime(shiftsStore.currentShift.openedAt) }}
                </p>
              </div>
            </div>
            <div class="shift-active-actions">
              <button class="btn btn-outline btn-sm" @click="openGastoModal">
                <Receipt :size="13" /> Registrar gasto
              </button>
              <button class="btn btn-outline btn-sm" @click="openRetiroModal">
                <ArrowDownToLine :size="13" /> Registrar retiro
              </button>
              <button class="btn btn-danger btn-sm" @click="openCierreModal">
                <LogOut :size="13" /> Cerrar turno
              </button>
            </div>
          </div>

          <!-- Métricas del turno activo -->
          <div class="shift-metrics">
            <div class="shift-metric">
              <p class="metric-label">Apertura</p>
              <p class="metric-value">{{ formatCOP(shiftsStore.currentShift.openingCash) }}</p>
            </div>
            <div class="shift-metric highlight">
              <p class="metric-label">Ventas efectivo</p>
              <p class="metric-value success">{{ formatCOP(shiftsStore.currentShift.totalCashSales) }}</p>
            </div>
            <div class="shift-metric">
              <p class="metric-label">Otras ventas</p>
              <p class="metric-value">{{ formatCOP(shiftsStore.currentShift.totalOtherSales) }}</p>
            </div>
            <div class="shift-metric">
              <p class="metric-label">Retiros</p>
              <p class="metric-value danger">{{ formatCOP(shiftsStore.currentShift.totalWithdrawals) }}</p>
            </div>
            <div class="shift-metric">
              <p class="metric-label">Gastos caja</p>
              <p class="metric-value danger">{{ formatCOP(shiftsStore.currentShift.totalExpenses) }}</p>
            </div>
            <div class="shift-metric highlight-main">
              <p class="metric-label">Efectivo esperado</p>
              <p class="metric-value accent">
                {{ formatCOP(
                  shiftsStore.currentShift.openingCash +
                  shiftsStore.currentShift.totalCashSales -
                  shiftsStore.currentShift.totalWithdrawals -
                  (shiftsStore.currentShift.totalExpenses || 0)
                ) }}
              </p>
            </div>
            <div class="shift-metric">
              <p class="metric-label">Ventas totales</p>
              <p class="metric-value">{{ formatCOP(shiftsStore.currentShift.totalSales) }}</p>
            </div>
          </div>

          <!-- Gastos del turno -->
          <div v-if="shiftsStore.currentShift.expenses?.length" class="withdrawals-section">
            <p class="withdrawals-title">Gastos de caja menor</p>
            <div class="withdrawals-list">
              <div v-for="e in shiftsStore.currentShift.expenses" :key="e.id" class="withdrawal-row">
                <div class="withdrawal-info">
                  <Receipt :size="13" />
                  <span class="expense-badge">{{ e.category }}</span>
                  <span>{{ e.description }}</span>
                  <span class="withdrawal-time">{{ formatTime(e.date) }}</span>
                </div>
                <span class="withdrawal-amount">-{{ formatCOP(e.amount) }}</span>
              </div>
            </div>
          </div>

          <!-- Retiros del turno -->
          <div v-if="shiftsStore.currentShift.withdrawals?.length" class="withdrawals-section">
            <p class="withdrawals-title">Retiros registrados</p>
            <div class="withdrawals-list">
              <div v-for="w in shiftsStore.currentShift.withdrawals" :key="w.id" class="withdrawal-row">
                <div class="withdrawal-info">
                  <ArrowDownToLine :size="13" />
                  <span>{{ w.reason }}</span>
                  <span class="withdrawal-by">por {{ w.registeredBy }}</span>
                  <span class="withdrawal-time">{{ formatTime(w.date) }}</span>
                </div>
                <span class="withdrawal-amount">-{{ formatCOP(w.amount) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Sin turno activo -->
        <div v-else class="no-shift-banner mb-4">
          <AlertTriangle :size="18" />
          <div>
            <strong>No hay turno abierto.</strong>
            Las ventas que se registren no estarán asociadas a ningún turno.
          </div>
          <button class="btn btn-primary btn-sm" @click="openAbrirModal">
            <LogIn :size="13" /> Abrir ahora
          </button>
        </div>

        <!-- ── Historial de turnos ───────────────────────────────── -->
        <div class="card">
          <h3 class="section-title mb-3">Historial de turnos</h3>

          <div v-if="shiftsStore.loading" class="loading">
            <div class="spinner"></div>
          </div>

          <div v-else-if="closedShifts.length === 0" class="empty-state">
            <Clock :size="36" class="empty-icon" />
            <p class="empty-state-title">Sin turnos cerrados</p>
            <p class="empty-state-text">El historial aparecerá aquí cuando cierres tu primer turno</p>
          </div>

          <div v-else class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Cajero</th>
                  <th>Apertura</th>
                  <th>Cierre</th>
                  <th>Duración</th>
                  <th>Ventas</th>
                  <th>Efectivo esperado</th>
                  <th>Efectivo contado</th>
                  <th>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="shift in closedShifts" :key="shift.id" @click="selectShift(shift)" class="shift-row">
                  <td><strong>{{ shift.cashierName }}</strong></td>
                  <td class="text-muted">{{ formatDateTime(shift.openedAt) }}</td>
                  <td class="text-muted">{{ formatDateTime(shift.closedAt) }}</td>
                  <td>{{ calcDuration(shift.openedAt, shift.closedAt) }}</td>
                  <td>
                    <span class="badge badge-info">{{ shift.salesCount }} ventas</span>
                    <span class="sales-total">{{ formatCOP(shift.totalSales) }}</span>
                  </td>
                  <td class="currency">{{ formatCOP(shift.expectedCash) }}</td>
                  <td class="currency">{{ formatCOP(shift.closingCash) }}</td>
                  <td>
                    <span :class="['badge', diffBadge(shift.difference)]">
                      {{ shift.difference > 0 ? '+' : '' }}{{ formatCOP(shift.difference) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ── Detalle de turno seleccionado ────────────────────── -->
        <div class="modal-overlay" v-if="selectedShift" @click.self="selectedShift = null">
          <div class="modal" style="max-width:520px">
            <div class="modal-header">
              <h3 class="modal-title">Detalle del turno</h3>
              <button class="btn-close" @click="selectedShift = null"><X :size="18" /></button>
            </div>
            <div class="modal-body">
              <div class="detail-grid">
                <div class="detail-row"><span class="detail-label">Cajero</span><span>{{ selectedShift.cashierName }}</span></div>
                <div class="detail-row"><span class="detail-label">Apertura</span><span>{{ formatDateTime(selectedShift.openedAt) }}</span></div>
                <div class="detail-row"><span class="detail-label">Cierre</span><span>{{ formatDateTime(selectedShift.closedAt) }}</span></div>
                <div class="detail-row"><span class="detail-label">Duración</span><span>{{ calcDuration(selectedShift.openedAt, selectedShift.closedAt) }}</span></div>
                <div class="detail-divider"></div>
                <div class="detail-row"><span class="detail-label">Efectivo inicial</span><span class="fw-700">{{ formatCOP(selectedShift.openingCash) }}</span></div>
                <div class="detail-row"><span class="detail-label">Ventas efectivo</span><span class="success">{{ formatCOP(selectedShift.totalCashSales) }}</span></div>
                <div class="detail-row"><span class="detail-label">Otras ventas</span><span>{{ formatCOP(selectedShift.totalOtherSales) }}</span></div>
                <div class="detail-row"><span class="detail-label">Retiros</span><span class="danger">-{{ formatCOP(selectedShift.totalWithdrawals) }}</span></div>
                <div class="detail-row" v-if="selectedShift.totalExpenses"><span class="detail-label">Gastos caja menor</span><span class="danger">-{{ formatCOP(selectedShift.totalExpenses) }}</span></div>
                <div class="detail-divider"></div>
                <div class="detail-row"><span class="detail-label">Efectivo esperado</span><span class="fw-700">{{ formatCOP(selectedShift.expectedCash) }}</span></div>
                <div class="detail-row"><span class="detail-label">Efectivo contado</span><span class="fw-700">{{ formatCOP(selectedShift.closingCash) }}</span></div>
                <div class="detail-row">
                  <span class="detail-label">Diferencia</span>
                  <span :class="['fw-700', selectedShift.difference >= 0 ? 'success' : 'danger']">
                    {{ selectedShift.difference >= 0 ? '+' : '' }}{{ formatCOP(selectedShift.difference) }}
                  </span>
                </div>
              </div>

              <div v-if="selectedShift.expenses?.length" class="mt-3">
                <p class="withdrawals-title">Gastos de caja menor</p>
                <div class="withdrawals-list">
                  <div v-for="e in selectedShift.expenses" :key="e.id" class="withdrawal-row">
                    <div class="withdrawal-info">
                      <span class="expense-badge">{{ e.category }}</span>
                      <span>{{ e.description }}</span>
                      <span class="withdrawal-time">{{ formatTime(e.date) }}</span>
                    </div>
                    <span class="withdrawal-amount">-{{ formatCOP(e.amount) }}</span>
                  </div>
                </div>
              </div>

              <div v-if="selectedShift.withdrawals?.length" class="mt-3">
                <p class="withdrawals-title">Retiros</p>
                <div class="withdrawals-list">
                  <div v-for="w in selectedShift.withdrawals" :key="w.id" class="withdrawal-row">
                    <div class="withdrawal-info">
                      <span>{{ w.reason }}</span>
                      <span class="withdrawal-time">{{ formatTime(w.date) }}</span>
                    </div>
                    <span class="withdrawal-amount">-{{ formatCOP(w.amount) }}</span>
                  </div>
                </div>
              </div>

              <div v-if="selectedShift.notes" class="shift-notes mt-3">
                <p class="detail-label">Notas</p>
                <p>{{ selectedShift.notes }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Modal: Abrir turno ───────────────────────────────── -->
        <div class="modal-overlay" v-if="showAbrirModal" @click.self="showAbrirModal = false">
          <div class="modal" style="max-width:420px">
            <div class="modal-header">
              <h3 class="modal-title">Abrir turno de caja</h3>
              <button class="btn-close" @click="showAbrirModal = false"><X :size="18" /></button>
            </div>
            <div class="modal-body">
              <p class="modal-desc">
                Cuenta el efectivo que hay en la caja ahora mismo y regístralo aquí.
              </p>
              <div class="form-group">
                <label class="form-label">Efectivo inicial en caja</label>
                <input
                  v-model.number="abrirForm.openingCash"
                  type="number"
                  class="form-control"
                  :class="{ 'input-error': abrirSubmitted && abrirForm.openingCash < 0 }"
                  min="0"
                  step="1000"
                  placeholder="Ej: 50000"
                  ref="openingCashInput"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Notas (opcional)</label>
                <input v-model="abrirForm.notes" type="text" class="form-control" placeholder="Ej: Turno mañana" />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="showAbrirModal = false">Cancelar</button>
              <button class="btn btn-primary" @click="handleOpenShift" :disabled="saving">
                <div class="spinner" v-if="saving" style="width:14px;height:14px;border-width:2px"></div>
                {{ saving ? 'Abriendo...' : 'Abrir turno' }}
              </button>
            </div>
          </div>
        </div>

        <!-- ── Modal: Cerrar turno ──────────────────────────────── -->
        <div class="modal-overlay" v-if="showCierreModal" @click.self="showCierreModal = false">
          <div class="modal" style="max-width:460px">
            <div class="modal-header">
              <h3 class="modal-title">Cerrar turno</h3>
              <button class="btn-close" @click="showCierreModal = false"><X :size="18" /></button>
            </div>
            <div class="modal-body">
              <div class="cierre-summary mb-3">
                <div class="cierre-row">
                  <span>Efectivo inicial</span>
                  <span>{{ formatCOP(shiftsStore.currentShift?.openingCash) }}</span>
                </div>
                <div class="cierre-row">
                  <span>+ Ventas en efectivo</span>
                  <span class="success">{{ formatCOP(shiftsStore.currentShift?.totalCashSales) }}</span>
                </div>
                <div class="cierre-row">
                  <span>- Retiros</span>
                  <span class="danger">{{ formatCOP(shiftsStore.currentShift?.totalWithdrawals) }}</span>
                </div>
                <div class="cierre-row" v-if="shiftsStore.currentShift?.totalExpenses">
                  <span>- Gastos caja menor</span>
                  <span class="danger">{{ formatCOP(shiftsStore.currentShift?.totalExpenses) }}</span>
                </div>
                <div class="cierre-row total">
                  <span>= Efectivo esperado</span>
                  <span class="accent fw-700">
                    {{ formatCOP(
                      (shiftsStore.currentShift?.openingCash || 0) +
                      (shiftsStore.currentShift?.totalCashSales || 0) -
                      (shiftsStore.currentShift?.totalWithdrawals || 0) -
                      (shiftsStore.currentShift?.totalExpenses || 0)
                    ) }}
                  </span>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Efectivo contado en caja ahora</label>
                <input
                  v-model.number="cierreForm.closingCash"
                  type="number"
                  class="form-control"
                  min="0"
                  step="1000"
                  placeholder="Cuenta el dinero físico e ingresa el total"
                />
                <span v-if="cierreForm.closingCash !== ''" class="field-hint">
                  Diferencia:
                  <strong :class="calcDiff >= 0 ? 'success' : 'danger'">
                    {{ calcDiff >= 0 ? '+' : '' }}{{ formatCOP(calcDiff) }}
                  </strong>
                </span>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="showCierreModal = false">Cancelar</button>
              <button class="btn btn-danger" @click="handleCloseShift" :disabled="saving">
                <div class="spinner" v-if="saving" style="width:14px;height:14px;border-width:2px"></div>
                {{ saving ? 'Cerrando...' : 'Cerrar turno' }}
              </button>
            </div>
          </div>
        </div>

        <!-- ── Modal: Registrar gasto ────────────────────────────── -->
        <div class="modal-overlay" v-if="showGastoModal" @click.self="showGastoModal = false">
          <div class="modal" style="max-width:400px">
            <div class="modal-header">
              <h3 class="modal-title">Registrar gasto de caja</h3>
              <button class="btn-close" @click="showGastoModal = false"><X :size="18" /></button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Categoría</label>
                <select v-model="gastoForm.category" class="form-control">
                  <option value="insumos">🧹 Insumos (hielo, servilletas, limpieza…)</option>
                  <option value="servicios">⚡ Servicios (domicilio, transporte…)</option>
                  <option value="mercado">🛒 Mercado / Compra rápida</option>
                  <option value="otros">📌 Otros</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Descripción</label>
                <input v-model="gastoForm.description" type="text" class="form-control"
                  :class="{ 'input-error': gastoSubmitted && !gastoForm.description }"
                  placeholder="Ej: Bolsa de hielo, Domicilio proveedor" />
              </div>
              <div class="form-group">
                <label class="form-label">Monto</label>
                <input v-model.number="gastoForm.amount" type="number" class="form-control"
                  :class="{ 'input-error': gastoSubmitted && !gastoForm.amount }"
                  min="1" step="1000" placeholder="Ej: 5000" />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="showGastoModal = false">Cancelar</button>
              <button class="btn btn-primary" @click="handleGasto" :disabled="saving">
                <div class="spinner" v-if="saving" style="width:14px;height:14px;border-width:2px"></div>
                {{ saving ? 'Guardando...' : 'Registrar gasto' }}
              </button>
            </div>
          </div>
        </div>

        <!-- ── Modal: Registrar retiro ──────────────────────────── -->
        <div class="modal-overlay" v-if="showRetiroModal" @click.self="showRetiroModal = false">
          <div class="modal" style="max-width:400px">
            <div class="modal-header">
              <h3 class="modal-title">Registrar retiro de caja</h3>
              <button class="btn-close" @click="showRetiroModal = false"><X :size="18" /></button>
            </div>
            <div class="modal-body">
              <p class="modal-desc">
                Registra cuando sacas dinero de la caja (pago a proveedor, gastos, etc.)
              </p>
              <div class="form-group">
                <label class="form-label">Monto retirado</label>
                <input
                  v-model.number="retiroForm.amount"
                  type="number"
                  class="form-control"
                  :class="{ 'input-error': retiroSubmitted && !retiroForm.amount }"
                  min="1"
                  step="1000"
                  placeholder="Ej: 20000"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Motivo</label>
                <input
                  v-model="retiroForm.reason"
                  type="text"
                  class="form-control"
                  :class="{ 'input-error': retiroSubmitted && !retiroForm.reason }"
                  placeholder="Ej: Pago a proveedor de bebidas"
                />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="showRetiroModal = false">Cancelar</button>
              <button class="btn btn-primary" @click="handleWithdrawal" :disabled="saving">
                <div class="spinner" v-if="saving" style="width:14px;height:14px;border-width:2px"></div>
                {{ saving ? 'Guardando...' : 'Registrar retiro' }}
              </button>
            </div>
          </div>
        </div>

        <!-- ── Modal: Resumen del turno cerrado ────────────────────── -->
        <div class="modal-overlay" v-if="showResumenModal" @click.self="showResumenModal = false">
          <div class="modal resumen-modal" style="max-width:500px">
            <div class="modal-header">
              <h3 class="modal-title">✅ Turno cerrado — Resumen</h3>
              <button class="btn-close" @click="showResumenModal = false"><X :size="18" /></button>
            </div>
            <div class="modal-body resumen-body" id="resumen-print">
              <!-- Header info -->
              <div class="resumen-header-info">
                <div class="resumen-biz">{{ auth.currentBusiness?.name }}</div>
                <div class="resumen-sub">
                  Cajero: <strong>{{ resumenShift?.cashierName }}</strong> ·
                  {{ formatDateTime(resumenShift?.openedAt) }} → {{ formatDateTime(resumenShift?.closedAt) }} ·
                  {{ calcDuration(resumenShift?.openedAt, resumenShift?.closedAt) }}
                </div>
              </div>

              <!-- Ventas -->
              <div class="resumen-section">
                <p class="resumen-section-title">💰 Ventas del turno</p>
                <div class="resumen-row">
                  <span>Total ventas</span>
                  <span class="resumen-val success">{{ formatCOP(resumenShift?.totalSales) }}</span>
                </div>
                <div class="resumen-row">
                  <span>Ventas ({{ resumenShift?.salesCount || 0 }} transacciones)</span>
                  <span></span>
                </div>
                <div class="resumen-row indent">
                  <span>💵 Efectivo</span>
                  <span>{{ formatCOP(resumenShift?.totalCashSales) }}</span>
                </div>
                <div class="resumen-row indent">
                  <span>💳 Otras (tarjeta / transferencia)</span>
                  <span>{{ formatCOP(resumenShift?.totalOtherSales) }}</span>
                </div>
              </div>

              <!-- Movimientos -->
              <div class="resumen-section" v-if="(resumenShift?.totalWithdrawals || 0) > 0 || (resumenShift?.totalExpenses || 0) > 0">
                <p class="resumen-section-title">📤 Salidas de caja</p>
                <div class="resumen-row" v-if="resumenShift?.totalWithdrawals > 0">
                  <span>Retiros</span>
                  <span class="danger">-{{ formatCOP(resumenShift?.totalWithdrawals) }}</span>
                </div>
                <div class="resumen-row" v-if="resumenShift?.totalExpenses > 0">
                  <span>Gastos caja menor</span>
                  <span class="danger">-{{ formatCOP(resumenShift?.totalExpenses) }}</span>
                </div>
              </div>

              <!-- Cuadre -->
              <div class="resumen-section resumen-cuadre">
                <p class="resumen-section-title">🏦 Cuadre de caja</p>
                <div class="resumen-row">
                  <span>Efectivo inicial</span>
                  <span>{{ formatCOP(resumenShift?.openingCash) }}</span>
                </div>
                <div class="resumen-row">
                  <span>Efectivo esperado</span>
                  <span class="fw-700">{{ formatCOP(resumenShift?.expectedCash) }}</span>
                </div>
                <div class="resumen-row">
                  <span>Efectivo contado</span>
                  <span class="fw-700">{{ formatCOP(resumenShift?.closingCash) }}</span>
                </div>
                <div class="resumen-row resumen-diff-row">
                  <span>Diferencia</span>
                  <span :class="['resumen-diff', (resumenShift?.difference || 0) >= 0 ? 'success' : 'danger']">
                    {{ (resumenShift?.difference || 0) >= 0 ? '+' : '' }}{{ formatCOP(resumenShift?.difference) }}
                    {{ (resumenShift?.difference || 0) === 0 ? '✅ Cuadre perfecto' : (resumenShift?.difference || 0) > 0 ? '⬆️ Sobrante' : '⬇️ Faltante' }}
                  </span>
                </div>
              </div>

              <!-- Gastos detalle -->
              <div class="resumen-section" v-if="resumenShift?.expenses?.length">
                <p class="resumen-section-title">🧾 Gastos de caja menor</p>
                <div class="resumen-row" v-for="e in resumenShift.expenses" :key="e.id">
                  <span>{{ e.category }} — {{ e.description }}</span>
                  <span class="danger">-{{ formatCOP(e.amount) }}</span>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="showResumenModal = false">Cerrar</button>
              <button class="btn btn-primary" @click="printResumen">🖨️ Imprimir resumen</button>
            </div>
          </div>
        </div>

  </PageLayout>
</template>

<script setup>
/**
 * ShiftsView.vue — Módulo de turnos de caja
 *
 * Permite abrir/cerrar turnos y registrar retiros de caja.
 * El turno activo muestra las métricas en tiempo real.
 * El historial muestra todos los turnos cerrados con su diferencia.
 */
import { ref, computed, onMounted, nextTick, inject } from 'vue'
import { useShiftsStore } from '../stores/shifts.js'
import { useAuthStore } from '../stores/auth.js'
import PageLayout from '../components/PageLayout.vue'
import {
  LogIn, LogOut, ArrowDownToLine, AlertTriangle, Clock, X, Receipt
} from 'lucide-vue-next'

const shiftsStore = useShiftsStore()
const auth = useAuthStore()
const toast = inject('toast')

// ── Estado de modales ────────────────────────────────────────────
const showAbrirModal  = ref(false)
const showCierreModal = ref(false)
const showRetiroModal = ref(false)
const showGastoModal  = ref(false)
const selectedShift   = ref(null)
const saving          = ref(false)
const showResumenModal = ref(false)
const resumenShift = ref(null)

const abrirSubmitted  = ref(false)
const retiroSubmitted = ref(false)
const gastoSubmitted  = ref(false)

const openingCashInput = ref(null)

const abrirForm  = ref({ openingCash: 0, notes: '' })
const cierreForm = ref({ closingCash: '' })
const retiroForm = ref({ amount: '', reason: '' })
const gastoForm  = ref({ amount: '', category: 'insumos', description: '' })

// ── Computeds ────────────────────────────────────────────────────
const closedShifts = computed(() =>
  shiftsStore.shifts.filter(s => s.status === 'closed')
)

/** Diferencia en tiempo real mientras el admin cuenta en el modal de cierre */
const calcDiff = computed(() => {
  const s = shiftsStore.currentShift
  if (!s || cierreForm.value.closingCash === '') return 0
  const expected = (s.openingCash || 0) + (s.totalCashSales || 0) - (s.totalWithdrawals || 0) - (s.totalExpenses || 0)
  return Number(cierreForm.value.closingCash) - expected
})

// ── Helpers de formato ───────────────────────────────────────────
function formatCOP(v) { return '$' + Number(v || 0).toLocaleString('es-CO') }
function formatDateTime(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}
function calcDuration(from, to) {
  if (!from || !to) return '-'
  const ms = new Date(to) - new Date(from)
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
function diffBadge(diff) {
  if (diff > 0)  return 'badge-success'
  if (diff < 0)  return 'badge-danger'
  return 'badge-default'
}

// ── Acciones ─────────────────────────────────────────────────────
function openAbrirModal() {
  abrirForm.value = { openingCash: 0, notes: '' }
  abrirSubmitted.value = false
  showAbrirModal.value = true
  nextTick(() => openingCashInput.value?.focus())
}

function openCierreModal() {
  cierreForm.value = { closingCash: '' }
  showCierreModal.value = true
}

function openRetiroModal() {
  retiroForm.value = { amount: '', reason: '' }
  retiroSubmitted.value = false
  showRetiroModal.value = true
}

function openGastoModal() {
  gastoForm.value = { amount: '', category: 'insumos', description: '' }
  gastoSubmitted.value = false
  showGastoModal.value = true
}

function selectShift(shift) {
  selectedShift.value = shift
}

async function handleOpenShift() {
  abrirSubmitted.value = true
  if (abrirForm.value.openingCash < 0) return
  saving.value = true
  try {
    await shiftsStore.openShift(abrirForm.value.openingCash, abrirForm.value.notes)
    showAbrirModal.value = false
    toast('Turno abierto', 'success')
  } catch (err) {
    toast(err.response?.data?.error || 'Error al abrir turno', 'error')
  } finally {
    saving.value = false
  }
}

async function handleCloseShift() {
  if (cierreForm.value.closingCash === '') return
  saving.value = true
  try {
    const closed = await shiftsStore.closeShift(
      shiftsStore.currentShift.id,
      cierreForm.value.closingCash
    )
    // Recargar historial para que aparezca el turno cerrado
    await shiftsStore.fetchShifts()
    showCierreModal.value = false
    resumenShift.value = closed
    showResumenModal.value = true
  } catch (err) {
    toast(err.response?.data?.error || 'Error al cerrar turno', 'error')
  } finally {
    saving.value = false
  }
}

async function handleGasto() {
  gastoSubmitted.value = true
  if (!gastoForm.value.amount || !gastoForm.value.description) return
  saving.value = true
  try {
    await shiftsStore.addExpense(
      shiftsStore.currentShift.id,
      gastoForm.value.amount,
      gastoForm.value.category,
      gastoForm.value.description
    )
    showGastoModal.value = false
    toast(`Gasto de ${formatCOP(gastoForm.value.amount)} registrado`, 'success')
  } catch (err) {
    toast(err.response?.data?.error || 'Error al registrar gasto', 'error')
  } finally {
    saving.value = false
  }
}

async function handleWithdrawal() {
  retiroSubmitted.value = true
  if (!retiroForm.value.amount || !retiroForm.value.reason) return
  saving.value = true
  try {
    await shiftsStore.addWithdrawal(
      shiftsStore.currentShift.id,
      retiroForm.value.amount,
      retiroForm.value.reason
    )
    showRetiroModal.value = false
    toast(`Retiro de ${formatCOP(retiroForm.value.amount)} registrado`, 'success')
  } catch (err) {
    toast(err.response?.data?.error || 'Error al registrar retiro', 'error')
  } finally {
    saving.value = false
  }
}

function printResumen() {
  window.print()
}

onMounted(async () => {
  await shiftsStore.fetchCurrentShift()
  await shiftsStore.fetchShifts()
})
</script>

<style scoped>
/* ── Tarjeta turno activo ── */
.shift-active-card {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
  border-radius: var(--radius-lg);
  padding: 24px;
  color: white;
  box-shadow: var(--shadow-lg);
}
.shift-active-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.shift-active-info { display: flex; align-items: center; gap: 14px; }
.shift-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 0 4px rgba(74,222,128,0.25);
  animation: pulse 2s infinite;
  flex-shrink: 0;
}
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(74,222,128,0.25); }
  50%       { box-shadow: 0 0 0 8px rgba(74,222,128,0.1); }
}
.shift-active-title { font-size: 16px; font-weight: 700; margin-bottom: 3px; }
.shift-active-sub   { font-size: 13px; color: rgba(255,255,255,0.6); }
.shift-active-actions { display: flex; gap: 8px; flex-wrap: wrap; }

/* Métricas del turno activo */
.shift-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.shift-metric {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-sm);
  padding: 14px 16px;
}
.shift-metric.highlight { background: rgba(245,158,11,0.12); border-color: rgba(245,158,11,0.3); }
.shift-metric.highlight-main { background: rgba(245,158,11,0.2); border-color: rgba(245,158,11,0.4); }
.metric-label { font-size: 11px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
.metric-value { font-size: 18px; font-weight: 800; color: white; letter-spacing: -0.02em; }
.metric-value.success { color: #4ade80; }
.metric-value.danger  { color: #f87171; }
.metric-value.accent  { color: var(--accent); }

/* Retiros */
.withdrawals-section { margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px; }
.withdrawals-title { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; }
.withdrawals-list { display: flex; flex-direction: column; gap: 6px; }
.withdrawal-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(255,255,255,0.05);
  border-radius: var(--radius-sm);
  font-size: 13px;
}
.withdrawal-info { display: flex; align-items: center; gap: 8px; color: rgba(255,255,255,0.7); }
.withdrawal-by   { color: rgba(255,255,255,0.4); font-size: 11.5px; }
.withdrawal-time { color: rgba(255,255,255,0.35); font-size: 11px; }
.withdrawal-amount { font-weight: 700; color: #f87171; font-size: 13px; }
.expense-badge {
  background: rgba(251,191,36,0.2);
  color: #fbbf24;
  border: 1px solid rgba(251,191,36,0.35);
  border-radius: 4px;
  padding: 1px 7px;
  font-size: 11px;
  font-weight: 600;
  text-transform: capitalize;
  white-space: nowrap;
}

/* Sin turno */
.no-shift-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--warning-light);
  border: 1.5px solid #fcd34d;
  color: #92400e;
  border-radius: var(--radius);
  padding: 16px 20px;
  font-size: 14px;
}
.no-shift-banner > div { flex: 1; }

/* Tabla de historial */
.shift-row { cursor: pointer; }
.section-title { font-size: 15px; font-weight: 700; color: var(--text); letter-spacing: -0.02em; }
.sales-total { font-size: 12px; color: var(--text-light); margin-left: 6px; }
.empty-icon { color: var(--text-light); margin-bottom: 12px; }

/* Modal cierre */
.cierre-summary {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 16px;
}
.cierre-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 0;
  font-size: 13.5px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
}
.cierre-row:last-child { border-bottom: none; }
.cierre-row.total {
  font-size: 15px;
  color: var(--text);
  font-weight: 700;
  border-top: 2px solid var(--border);
  padding-top: 10px;
  margin-top: 4px;
}
.field-hint { font-size: 12.5px; color: var(--text-light); margin-top: 6px; display: block; }

/* Detalle del turno */
.detail-grid { display: flex; flex-direction: column; gap: 0; }
.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 0;
  font-size: 13.5px;
  border-bottom: 1px solid var(--border);
}
.detail-row:last-child { border-bottom: none; }
.detail-label { color: var(--text-light); font-size: 12.5px; }
.detail-divider { height: 1px; background: var(--border); margin: 6px 0; }

.modal-desc { font-size: 13.5px; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.5; }
.shift-notes { background: var(--surface-2); border-radius: var(--radius-sm); padding: 12px; font-size: 13.5px; }

.success { color: var(--success); }
.danger  { color: var(--danger); }
.accent  { color: var(--accent); }

@media (max-width: 768px) {
  .shift-metrics { grid-template-columns: repeat(2, 1fr); }
  .shift-active-header { flex-direction: column; }
}
@media (max-width: 480px) {
  .shift-metrics { grid-template-columns: 1fr 1fr; }
}

/* Resumen de turno */
.resumen-body { padding: 0 !important; }
.resumen-header-info {
  background: var(--primary);
  color: white;
  padding: 16px 20px;
  border-radius: var(--radius) var(--radius) 0 0;
}
.resumen-biz { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
.resumen-sub { font-size: 12px; color: rgba(255,255,255,0.7); }
.resumen-section { padding: 14px 20px; border-bottom: 1px solid var(--border); }
.resumen-section:last-child { border-bottom: none; }
.resumen-section-title { font-size: 12px; font-weight: 700; color: var(--text-light); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 10px; }
.resumen-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13.5px; color: var(--text-secondary); padding: 4px 0;
}
.resumen-row.indent { padding-left: 16px; font-size: 13px; color: var(--text-light); }
.resumen-val { font-weight: 700; font-size: 15px; }
.resumen-cuadre { background: var(--surface-2); }
.resumen-diff-row { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); }
.resumen-diff { font-weight: 700; font-size: 14px; }
@media print {
  body > * { display: none !important; }
  #resumen-print { display: block !important; position: fixed; top: 0; left: 0; width: 100%; }
}
</style>
