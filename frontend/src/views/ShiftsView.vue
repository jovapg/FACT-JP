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
              <button class="btn btn-outline btn-sm" @click="openSacarModal">
                <ArrowDownToLine :size="13" /> Sacar dinero de la caja
              </button>
              <button class="btn btn-danger btn-sm" @click="openCierreModal">
                <LogOut :size="13" /> Cerrar turno
              </button>
            </div>
          </div>

          <!-- Número gigante: efectivo que debe haber en la caja -->
          <div class="cash-hero">
            <p class="cash-hero-label">💵 Efectivo que debe haber en la caja ahora</p>
            <p class="cash-hero-value">{{ formatCOP(efectivoEnCaja) }}</p>
            <p class="cash-hero-formula">
              base {{ formatCOP(shiftsStore.currentShift.openingCash) }}
              + ventas en efectivo {{ formatCOP(shiftsStore.currentShift.totalCashSales) }}
              <template v-if="totalSalidasCaja > 0"> − salidas {{ formatCOP(totalSalidasCaja) }}</template>
            </p>
          </div>

          <!-- Ventas del turno (línea chiquita, no afecta la caja física) -->
          <p class="ventas-line">
            🧾 Ventas del turno: <strong>{{ shiftsStore.currentShift.salesCount || 0 }}</strong>
            · 💵 efectivo {{ formatCOP(shiftsStore.currentShift.totalCashSales) }}
            · 💳 tarjeta/transf. {{ formatCOP(shiftsStore.currentShift.totalOtherSales) }}
            · total {{ formatCOP(shiftsStore.currentShift.totalSales) }}
          </p>

          <!-- Salidas de caja del turno (gastos + retiros unificados) -->
          <div v-if="salidasCaja.length" class="withdrawals-section">
            <p class="withdrawals-title">Dinero sacado de la caja</p>
            <div class="withdrawals-list">
              <div v-for="s in salidasCaja" :key="s.id" class="withdrawal-row">
                <div class="withdrawal-info">
                  <ArrowDownToLine :size="13" />
                  <span v-if="s.category" class="expense-badge">{{ s.category }}</span>
                  <span>{{ s.description || s.reason }}</span>
                  <span class="withdrawal-time">{{ formatTime(s.date) }}</span>
                </div>
                <span class="withdrawal-amount">-{{ formatCOP(s.amount) }}</span>
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
                <div class="detail-divider"></div>
                <!-- Ventas por área (lo que se sube a Finanzas) -->
                <div class="detail-row"><span class="detail-label fw-700">🍺 Bar</span><span class="fw-700">{{ formatCOP(areaTotal(selectedShift,'bar')) }}</span></div>
                <div class="detail-row"><span class="detail-label" style="padding-left:14px">💵 Efectivo / 🏦 Banco</span><span>{{ formatCOP(ibVal(selectedShift,'bar','efectivo')) }} / {{ formatCOP(ibVal(selectedShift,'bar','banco')) }}</span></div>
                <div class="detail-row"><span class="detail-label fw-700">🍽️ Restaurante</span><span class="fw-700">{{ formatCOP(areaTotal(selectedShift,'restaurante')) }}</span></div>
                <div class="detail-row"><span class="detail-label" style="padding-left:14px">💵 Efectivo / 🏦 Banco</span><span>{{ formatCOP(ibVal(selectedShift,'restaurante','efectivo')) }} / {{ formatCOP(ibVal(selectedShift,'restaurante','banco')) }}</span></div>
                <div class="detail-row"><span class="detail-label">Total ventas</span><span class="success fw-700">{{ formatCOP(selectedShift.totalSales) }}</span></div>
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
            <div class="modal-footer">
              <button class="btn btn-outline" @click="selectedShift = null">Cerrar</button>
              <button class="btn btn-whatsapp" @click="shareShiftWhatsApp(selectedShift)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Enviar al admin
              </button>
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
              <div class="form-group">
                <label class="form-label" style="font-size:15px;font-weight:700">Cuenta TODO el efectivo de la caja y escríbelo aquí:</label>
                <input
                  v-model.number="cierreForm.closingCash"
                  type="number"
                  class="form-control cierre-input"
                  min="0"
                  step="1000"
                  placeholder="Ej: 388500"
                  ref="closingInput"
                />
              </div>

              <!-- Resultado grande y claro -->
              <div v-if="cierreForm.closingCash !== ''" :class="['cuadre-result', calcDiff === 0 ? 'ok' : calcDiff > 0 ? 'over' : 'under']">
                <span class="cuadre-emoji">{{ calcDiff === 0 ? '✅' : calcDiff > 0 ? '⬆️' : '⬇️' }}</span>
                <span class="cuadre-text">
                  {{ calcDiff === 0 ? '¡Cuadra perfecto!' : calcDiff > 0 ? `Te sobran ${formatCOP(calcDiff)}` : `Te faltan ${formatCOP(-calcDiff)}` }}
                </span>
              </div>

              <p class="cierre-hint">En la caja deberían haber <strong>{{ formatCOP(efectivoEnCaja) }}</strong></p>
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

        <!-- ── Modal: Sacar dinero de la caja ───────────────────── -->
        <div class="modal-overlay" v-if="showSacarModal" @click.self="showSacarModal = false">
          <div class="modal" style="max-width:400px">
            <div class="modal-header">
              <h3 class="modal-title">Sacar dinero de la caja</h3>
              <button class="btn-close" @click="showSacarModal = false"><X :size="18" /></button>
            </div>
            <div class="modal-body">
              <p class="modal-desc">Registra el dinero que sacas de la caja (un gasto, pago a proveedor, etc.).</p>
              <div class="form-group">
                <label class="form-label">¿Cuánto sacaste?</label>
                <input v-model.number="sacarForm.amount" type="number" class="form-control"
                  :class="{ 'input-error': sacarSubmitted && !sacarForm.amount }"
                  min="1" step="1000" placeholder="Ej: 20000" ref="sacarInput" />
              </div>
              <div class="form-group">
                <label class="form-label">¿Para qué?</label>
                <input v-model="sacarForm.description" type="text" class="form-control"
                  :class="{ 'input-error': sacarSubmitted && !sacarForm.description }"
                  placeholder="Ej: Bolsa de hielo, pago domicilio, proveedor..." />
              </div>
              <div class="form-group">
                <label class="form-label">Tipo (opcional)</label>
                <select v-model="sacarForm.category" class="form-control">
                  <option value="insumos">🧹 Insumos (hielo, servilletas…)</option>
                  <option value="servicios">⚡ Servicios (domicilio, transporte…)</option>
                  <option value="mercado">🛒 Mercado / compra rápida</option>
                  <option value="proveedor">🚚 Pago a proveedor</option>
                  <option value="otros">📌 Otros</option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="showSacarModal = false">Cancelar</button>
              <button class="btn btn-primary" @click="handleSacar" :disabled="saving">
                <div class="spinner" v-if="saving" style="width:14px;height:14px;border-width:2px"></div>
                {{ saving ? 'Guardando...' : 'Registrar' }}
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

              <!-- Ventas por área (lo que se sube a Finanzas) -->
              <div class="resumen-section">
                <p class="resumen-section-title">💰 Ventas del turno ({{ resumenShift?.salesCount || 0 }} ventas)</p>

                <div class="resumen-area">
                  <div class="resumen-area-head">🍺 Bar</div>
                  <div class="resumen-row indent"><span>💵 Efectivo</span><span>{{ formatCOP(ibVal(resumenShift,'bar','efectivo')) }}</span></div>
                  <div class="resumen-row indent"><span>🏦 Banco</span><span>{{ formatCOP(ibVal(resumenShift,'bar','banco')) }}</span></div>
                  <div class="resumen-row indent area-total"><span>Total Bar</span><span class="fw-700">{{ formatCOP(areaTotal(resumenShift,'bar')) }}</span></div>
                </div>

                <div class="resumen-area">
                  <div class="resumen-area-head">🍽️ Restaurante</div>
                  <div class="resumen-row indent"><span>💵 Efectivo</span><span>{{ formatCOP(ibVal(resumenShift,'restaurante','efectivo')) }}</span></div>
                  <div class="resumen-row indent"><span>🏦 Banco</span><span>{{ formatCOP(ibVal(resumenShift,'restaurante','banco')) }}</span></div>
                  <div class="resumen-row indent area-total"><span>Total Restaurante</span><span class="fw-700">{{ formatCOP(areaTotal(resumenShift,'restaurante')) }}</span></div>
                </div>

                <div class="resumen-row resumen-grandtotal">
                  <span>TOTAL VENTAS</span>
                  <span class="resumen-val success">{{ formatCOP(ventasTotal(resumenShift)) }}</span>
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
              <button class="btn btn-outline" @click="printResumen">🖨️ Imprimir</button>
              <button class="btn btn-whatsapp" @click="shareShiftWhatsApp()">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Enviar al admin
              </button>
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
const showSacarModal  = ref(false)
const selectedShift   = ref(null)
const saving          = ref(false)
const showResumenModal = ref(false)
const resumenShift = ref(null)

const abrirSubmitted  = ref(false)
const sacarSubmitted  = ref(false)

const openingCashInput = ref(null)
const sacarInput = ref(null)
const closingInput = ref(null)

const abrirForm  = ref({ openingCash: 0, notes: '' })
const cierreForm = ref({ closingCash: '' })
const sacarForm  = ref({ amount: '', category: 'insumos', description: '' })

// ── Computeds ────────────────────────────────────────────────────
const closedShifts = computed(() =>
  shiftsStore.shifts.filter(s => s.status === 'closed')
)

/** Efectivo que debe haber físicamente en la caja en este momento */
const efectivoEnCaja = computed(() => {
  const s = shiftsStore.currentShift
  if (!s) return 0
  return (s.openingCash || 0) + (s.totalCashSales || 0) - (s.totalWithdrawals || 0) - (s.totalExpenses || 0)
})

/** Total de dinero sacado de la caja (gastos + retiros) */
const totalSalidasCaja = computed(() =>
  (shiftsStore.currentShift?.totalWithdrawals || 0) + (shiftsStore.currentShift?.totalExpenses || 0)
)

/** Lista unificada del dinero sacado de la caja (gastos + retiros) */
const salidasCaja = computed(() => {
  const s = shiftsStore.currentShift
  if (!s) return []
  const exp = (s.expenses || []).map(e => ({ ...e }))
  const wd = (s.withdrawals || []).map(w => ({ id: w.id, amount: w.amount, description: w.reason, date: w.date }))
  return [...exp, ...wd].sort((a, b) => new Date(b.date) - new Date(a.date))
})

/** Diferencia en tiempo real mientras se cuenta en el modal de cierre */
const calcDiff = computed(() => {
  if (cierreForm.value.closingCash === '') return 0
  return Number(cierreForm.value.closingCash) - efectivoEnCaja.value
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
  nextTick(() => closingInput.value?.focus())
}

function openSacarModal() {
  sacarForm.value = { amount: '', category: 'insumos', description: '' }
  sacarSubmitted.value = false
  showSacarModal.value = true
  nextTick(() => sacarInput.value?.focus())
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

async function handleSacar() {
  sacarSubmitted.value = true
  if (!sacarForm.value.amount || !sacarForm.value.description) return
  saving.value = true
  try {
    await shiftsStore.addExpense(
      shiftsStore.currentShift.id,
      sacarForm.value.amount,
      sacarForm.value.category,
      sacarForm.value.description
    )
    showSacarModal.value = false
    toast(`Salida de ${formatCOP(sacarForm.value.amount)} registrada`, 'success')
  } catch (err) {
    toast(err.response?.data?.error || 'Error al registrar', 'error')
  } finally {
    saving.value = false
  }
}

// ── Desglose de ventas por área × bucket (recibe el turno) ───────
function ibVal(s, area, bucket) {
  return s?.incomeByAreaBucket?.[area]?.[bucket] || 0
}
function areaTotal(s, area) {
  return ibVal(s, area, 'efectivo') + ibVal(s, area, 'banco')
}
function ventasTotal(s) {
  return areaTotal(s, 'bar') + areaTotal(s, 'restaurante')
}

function printResumen() {
  window.print()
}

/** Arma el mensaje de cierre para WhatsApp (bonito y legible) */
function buildShiftText(s) {
  if (!s) return ''
  const f = (v) => '$' + Number(v || 0).toLocaleString('es-CO')
  const diff = s.difference || 0
  const diffTxt = diff === 0 ? '✅ cuadra' : diff > 0 ? '⬆️ sobrante' : '⬇️ faltante'
  const L = []
  L.push(`📊 *CIERRE DE CAJA* — ${auth.currentBusiness?.name || 'Negocio'}`)
  L.push(`👤 Cajero: ${s.cashierName}`)
  L.push(`🕒 ${formatDateTime(s.openedAt)} → ${formatDateTime(s.closedAt)}`)
  L.push('')
  L.push('🍺 *BAR*')
  L.push(`   💵 Efectivo: ${f(ibVal(s, 'bar', 'efectivo'))}`)
  L.push(`   🏦 Banco: ${f(ibVal(s, 'bar', 'banco'))}`)
  L.push(`   Total Bar: ${f(areaTotal(s, 'bar'))}`)
  L.push('')
  L.push('🍽️ *RESTAURANTE*')
  L.push(`   💵 Efectivo: ${f(ibVal(s, 'restaurante', 'efectivo'))}`)
  L.push(`   🏦 Banco: ${f(ibVal(s, 'restaurante', 'banco'))}`)
  L.push(`   Total Restaurante: ${f(areaTotal(s, 'restaurante'))}`)
  L.push('')
  L.push(`💰 *TOTAL VENTAS: ${f(ventasTotal(s))}*`)
  if ((s.totalWithdrawals || 0) + (s.totalExpenses || 0) > 0) {
    L.push('')
    L.push(`📤 Dinero sacado de caja: ${f((s.totalWithdrawals || 0) + (s.totalExpenses || 0))}`)
  }
  L.push('')
  L.push('🏦 *Cuadre de caja*')
  L.push(`   Efectivo esperado: ${f(s.expectedCash)}`)
  L.push(`   Efectivo contado: ${f(s.closingCash)}`)
  L.push(`   Diferencia: ${diff >= 0 ? '+' : ''}${f(diff)} ${diffTxt}`)
  return L.join('\n')
}

/** Abre WhatsApp con el resumen del cierre para enviárselo al administrador */
function shareShiftWhatsApp(shift) {
  const text = encodeURIComponent(buildShiftText(shift || resumenShift.value))
  window.open(`https://wa.me/?text=${text}`, '_blank')
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

/* Número gigante: efectivo que debe haber en la caja */
.cash-hero {
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: var(--radius);
  padding: 22px 20px;
  text-align: center;
  margin-bottom: 14px;
}
.cash-hero-label { font-size: 13px; color: rgba(255,255,255,0.75); margin-bottom: 8px; }
.cash-hero-value { font-size: clamp(34px, 9vw, 46px); font-weight: 900; color: #fff; letter-spacing: -0.03em; line-height: 1; }
.cash-hero-formula { font-size: 12px; color: rgba(255,255,255,0.55); margin-top: 10px; }
.ventas-line { font-size: 12.5px; color: rgba(255,255,255,0.7); text-align: center; margin-bottom: 4px; }

/* Cierre simple */
.cierre-input { font-size: 22px; font-weight: 800; text-align: center; }
.cuadre-result {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 16px; border-radius: var(--radius); margin: 16px 0 10px; font-weight: 800;
}
.cuadre-result.ok    { background: #f0fdf4; color: #15803d; border: 1.5px solid #bbf7d0; }
.cuadre-result.over  { background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe; }
.cuadre-result.under { background: #fef2f2; color: #dc2626; border: 1.5px solid #fecaca; }
.cuadre-emoji { font-size: 26px; }
.cuadre-text  { font-size: 18px; }
.cierre-hint  { font-size: 13px; color: var(--text-light); text-align: center; }

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

/* Desglose por área en el resumen */
.resumen-area { margin-bottom: 8px; }
.resumen-area-head { font-size: 13.5px; font-weight: 700; color: var(--text); margin: 4px 0 2px; }
.resumen-row.area-total { border-top: 1px dashed var(--border); margin-top: 2px; padding-top: 5px; color: var(--text); }
.resumen-grandtotal {
  border-top: 2px solid var(--border); margin-top: 8px; padding-top: 10px;
  font-size: 15px; font-weight: 800; color: var(--text);
}

/* Botón WhatsApp */
.btn-whatsapp {
  background: #25D366; color: white; border: none;
  display: flex; align-items: center; gap: 6px; font-weight: 600;
}
.btn-whatsapp:hover { background: #1ebe5d; }
.resumen-cuadre { background: var(--surface-2); }
.resumen-diff-row { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); }
.resumen-diff { font-weight: 700; font-size: 14px; }
@media print {
  body > * { display: none !important; }
  #resumen-print { display: block !important; position: fixed; top: 0; left: 0; width: 100%; }
}
</style>
