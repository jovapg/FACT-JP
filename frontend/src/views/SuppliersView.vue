<template>
  <PageLayout title="Proveedores">
        <div class="page-header">
          <div>
            <h1 class="page-title">Proveedores y Empleados</h1>
            <p class="page-subtitle">Gestión de proveedores, empleados, arriendos y créditos</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button v-if="filterTipo === 'empleado'" class="btn btn-outline" @click="showNominaReport = true">
              📊 Reporte nómina
            </button>
            <button class="btn btn-primary" @click="openCreate">+ Nuevo</button>
          </div>
        </div>

        <!-- Filter tabs -->
        <div class="tipo-tabs mb-3">
          <button
            v-for="t in tipoOptions"
            :key="t.value"
            :class="['tipo-tab', filterTipo === t.value ? 'active' : '']"
            @click="filterTipo = t.value"
          >
            {{ t.icon }} {{ t.label }}
            <span class="tab-count">{{ countByTipo(t.value) }}</span>
          </button>
        </div>

        <!-- Resumen nómina (solo pestaña empleados) -->
        <div class="nomina-summary card mb-3" v-if="filterTipo === 'empleado' && empleados.length > 0">
          <div class="nomina-stat">
            <span class="nomina-label">👷 Empleados</span>
            <span class="nomina-val">{{ empleados.length }}</span>
          </div>
          <div class="nomina-stat">
            <span class="nomina-label">💰 Nómina de referencia</span>
            <span class="nomina-val">{{ formatCOP(totalNomina) }}</span>
          </div>
        </div>

        <div class="suppliers-grid">
          <div class="card supplier-card" v-for="s in filteredSuppliers" :key="s.id">
            <div class="supplier-header">
              <div>
                <h4 class="supplier-name">{{ s.name }}</h4>
                <p class="supplier-sub" v-if="s.tipo === 'empleado' && s.cargo">💼 {{ s.cargo }}</p>
                <p class="supplier-sub" v-else-if="s.nit">NIT: {{ s.nit }}</p>
                <span :class="['tipo-badge', 'tipo-' + (s.tipo || 'proveedor')]">
                  {{ tipoLabel(s.tipo) }}
                </span>
              </div>
              <div v-if="s.tipo !== 'empleado'" :class="['debt-badge', 'badge', s.totalDebt > 0 ? 'badge-danger' : 'badge-success']">
                {{ s.totalDebt > 0 ? 'Debe: ' + formatCOP(s.totalDebt) : 'Al día' }}
              </div>
            </div>

            <!-- Info empleado -->
            <div class="supplier-info" v-if="s.tipo === 'empleado'">
              <span v-if="s.cedula">🪪 CC: {{ s.cedula }}</span>
              <span v-if="s.salarioBase">💵 {{ formatCOP(s.salarioBase) }} / {{ s.periodoPago || 'mensual' }}
                <em style="font-size:11px;opacity:0.7">({{ formatCOP(tarifaDiariaOf(s)) }}/día)</em>
              </span>
              <span v-if="s.phone">📞 {{ s.phone }}</span>
              <span v-if="s.fechaIngreso">📅 Ingreso: {{ formatDate(s.fechaIngreso) }}</span>
            </div>
            <!-- Info arriendo -->
            <div class="supplier-info" v-else-if="s.tipo === 'arriendo'">
              <span v-if="s.montoMensual">🏠 {{ formatCOP(s.montoMensual) }} / mes</span>
              <span v-if="s.contact">👤 {{ s.contact }}</span>
              <span v-if="s.phone">📞 {{ s.phone }}</span>
              <span v-if="s.address">📍 {{ s.address }}</span>
            </div>
            <!-- Info crédito -->
            <div class="supplier-info" v-else-if="s.tipo === 'credito'">
              <span v-if="s.montoTotal">💰 Total: {{ formatCOP(s.montoTotal) }}</span>
              <span v-if="s.cuotaMensual">📅 Cuota: {{ formatCOP(s.cuotaMensual) }}/mes</span>
              <span v-if="s.contact">🏦 {{ s.contact }}</span>
              <span v-if="s.phone">📞 {{ s.phone }}</span>
            </div>
            <!-- Info proveedor -->
            <div class="supplier-info" v-else>
              <span v-if="s.phone">📞 {{ s.phone }}</span>
              <span v-if="s.email">✉️ {{ s.email }}</span>
              <span v-if="s.contact">👤 {{ s.contact }}</span>
            </div>

            <div class="supplier-actions">
              <!-- Empleado: pagar nómina siempre visible -->
              <button v-if="s.tipo === 'empleado'" class="btn btn-sm btn-success" @click="openNominaPago(s)">
                💵 Pagar nómina
              </button>
              <!-- Arriendo: pagar arriendo siempre visible -->
              <button v-else-if="s.tipo === 'arriendo'" class="btn btn-sm btn-success" @click="openPayment(s, 'arriendo')">
                🏠 Pagar arriendo
              </button>
              <!-- Crédito: registrar cuota siempre visible -->
              <button v-else-if="s.tipo === 'credito'" class="btn btn-sm btn-success" @click="openPayment(s, 'credito')">
                💳 Registrar cuota
              </button>
              <!-- Proveedor: pagar deuda solo si existe -->
              <button v-else-if="s.totalDebt > 0" class="btn btn-sm btn-success" @click="openPayment(s)">
                💳 Registrar pago
              </button>
              <button class="btn btn-sm btn-outline" @click="openPayments(s)">
                Pagos ({{ s.payments?.length || 0 }})
              </button>
              <button class="btn btn-sm btn-outline" @click="openEdit(s)">✏️</button>
              <button class="btn btn-sm btn-danger" @click="confirmDelete(s)">🗑️</button>
            </div>
          </div>

          <div v-if="filteredSuppliers.length === 0" class="empty-state" style="grid-column:1/-1">
            <div class="empty-state-icon">{{ filterTipo === 'empleado' ? '👷' : '🏭' }}</div>
            <p class="empty-state-text">No hay {{ filterTipo === 'todos' ? 'registros' : tipoOptions.find(t=>t.value===filterTipo)?.label?.toLowerCase() }}</p>
          </div>
        </div>

        <!-- ── Modal crear/editar ── -->
        <div class="modal-overlay" v-if="showModal" @click.self="closeModal">
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title">
                {{ editSupplier
                  ? (form.tipo === 'empleado' ? 'Editar empleado' : 'Editar proveedor')
                  : (form.tipo === 'empleado' ? 'Nuevo empleado' : 'Nuevo proveedor') }}
              </h3>
              <button class="btn-close" @click="closeModal">×</button>
            </div>
            <div class="modal-body">
              <div class="grid grid-2">
                <div class="form-group" style="grid-column:1/-1">
                  <label class="form-label">Nombre *</label>
                  <input v-model="form.name" class="form-control" :placeholder="form.tipo === 'empleado' ? 'Nombre completo' : 'Nombre de la empresa'" />
                </div>
                <div class="form-group" style="grid-column:1/-1">
                  <label class="form-label">Tipo</label>
                  <select v-model="form.tipo" class="form-control">
                    <option value="proveedor">🏭 Proveedor</option>
                    <option value="empleado">👷 Empleado</option>
                    <option value="arriendo">🏠 Arriendo</option>
                    <option value="credito">💳 Crédito</option>
                  </select>
                </div>

                <!-- Campos EMPLEADO -->
                <template v-if="form.tipo === 'empleado'">
                  <div class="form-group">
                    <label class="form-label">Cédula (CC)</label>
                    <input v-model="form.cedula" class="form-control" placeholder="Número de cédula" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Cargo / Rol</label>
                    <input v-model="form.cargo" class="form-control" placeholder="Ej: Barista, Mesero, Cocinero..." />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Salario de referencia (COP)</label>
                    <input v-model.number="form.salarioBase" type="number" min="0" class="form-control" placeholder="0" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Período</label>
                    <select v-model="form.periodoPago" class="form-control">
                      <option value="semanal">Semanal</option>
                      <option value="quincenal">Quincenal</option>
                      <option value="mensual">Mensual</option>
                    </select>
                  </div>
                  <div class="form-group" v-if="form.salarioBase > 0" style="grid-column:1/-1">
                    <p class="tarifa-hint">
                      Tarifa diaria calculada:
                      <strong>{{ formatCOP(Math.round(form.salarioBase / periodDivisor(form.periodoPago))) }} / día</strong>
                    </p>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Teléfono</label>
                    <input v-model="form.phone" class="form-control" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Fecha de ingreso</label>
                    <input v-model="form.fechaIngreso" type="date" class="form-control" />
                  </div>
                </template>

                <!-- Campos ARRIENDO -->
                <template v-else-if="form.tipo === 'arriendo'">
                  <div class="form-group">
                    <label class="form-label">Monto mensual (COP)</label>
                    <input v-model.number="form.montoMensual" type="number" min="0" class="form-control" placeholder="Ej: 1500000" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Teléfono propietario</label>
                    <input v-model="form.phone" class="form-control" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Contacto / Propietario</label>
                    <input v-model="form.contact" class="form-control" />
                  </div>
                  <div class="form-group" style="grid-column:1/-1">
                    <label class="form-label">Dirección del local</label>
                    <input v-model="form.address" class="form-control" />
                  </div>
                </template>

                <!-- Campos CRÉDITO -->
                <template v-else-if="form.tipo === 'credito'">
                  <div class="form-group">
                    <label class="form-label">Monto total de la deuda (COP)</label>
                    <input v-model.number="form.montoTotal" type="number" min="0" class="form-control" placeholder="Ej: 5000000" :disabled="!!editSupplier" />
                    <span class="form-hint" v-if="editSupplier">El monto total no se puede editar. La deuda actual es {{ formatCOP(editSupplier.totalDebt) }}.</span>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Cuota mensual (COP)</label>
                    <input v-model.number="form.cuotaMensual" type="number" min="0" class="form-control" placeholder="Ej: 300000" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Entidad / Acreedor</label>
                    <input v-model="form.contact" class="form-control" placeholder="Ej: Bancolombia, Persona X" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Teléfono</label>
                    <input v-model="form.phone" class="form-control" />
                  </div>
                </template>

                <!-- Campos PROVEEDOR (default) -->
                <template v-else>
                  <div class="form-group">
                    <label class="form-label">NIT</label>
                    <input v-model="form.nit" class="form-control" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Teléfono</label>
                    <input v-model="form.phone" class="form-control" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Contacto</label>
                    <input v-model="form.contact" class="form-control" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Email</label>
                    <input v-model="form.email" class="form-control" type="email" />
                  </div>
                  <div class="form-group" style="grid-column:1/-1">
                    <label class="form-label">Dirección</label>
                    <input v-model="form.address" class="form-control" />
                  </div>
                </template>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="closeModal">Cancelar</button>
              <button class="btn btn-primary" @click="saveSupplier" :disabled="saving">Guardar</button>
            </div>
          </div>
        </div>

        <!-- ── Modal pagar nómina (empleados) ── -->
        <div class="modal-overlay" v-if="nominaPagoSupplier" @click.self="nominaPagoSupplier = null">
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title">💵 Pagar nómina — {{ nominaPagoSupplier?.name }}</h3>
              <button class="btn-close" @click="nominaPagoSupplier = null">×</button>
            </div>
            <div class="modal-body">
              <!-- Info de referencia -->
              <div class="nomina-ref-box mb-3">
                <div class="nomina-ref-item">
                  <span class="nomina-label">Cargo</span>
                  <span>{{ nominaPagoSupplier?.cargo || '—' }}</span>
                </div>
                <div class="nomina-ref-item">
                  <span class="nomina-label">Salario {{ nominaPagoSupplier?.periodoPago }}</span>
                  <span><strong>{{ formatCOP(nominaPagoSupplier?.salarioBase) }}</strong></span>
                </div>
                <div class="nomina-ref-item">
                  <span class="nomina-label">Tarifa por día</span>
                  <span><strong class="text-primary">{{ formatCOP(activeTarifaDiaria) }}</strong></span>
                </div>
              </div>

              <div class="grid grid-2">
                <div class="form-group">
                  <label class="form-label">Días trabajados</label>
                  <input
                    v-model.number="nominaPagoForm.diasTrabajados"
                    type="number" min="0" max="31"
                    class="form-control"
                    @input="recalcNomina"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">Período (YYYY-MM)</label>
                  <input v-model="nominaPagoForm.period" class="form-control" placeholder="2026-05" />
                </div>
                <div class="form-group" style="grid-column:1/-1">
                  <label class="form-label">Total a pagar</label>
                  <input v-model.number="nominaPagoForm.amount" type="number" min="0" class="form-control form-control-lg" />
                  <p class="field-hint" v-if="nominaPagoForm.diasTrabajados > 0">
                    {{ nominaPagoForm.diasTrabajados }} días × {{ formatCOP(activeTarifaDiaria) }} = {{ formatCOP(nominaPagoForm.diasTrabajados * activeTarifaDiaria) }}
                  </p>
                </div>
                <div class="form-group">
                  <label class="form-label">Método de pago</label>
                  <select v-model="nominaPagoForm.method" class="form-control">
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Notas</label>
                  <input v-model="nominaPagoForm.notes" class="form-control" placeholder="Opcional" />
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="nominaPagoSupplier = null">Cancelar</button>
              <button class="btn btn-success" @click="saveNominaPago" :disabled="saving || !nominaPagoForm.amount">
                💵 Registrar pago — {{ formatCOP(nominaPagoForm.amount) }}
              </button>
            </div>
          </div>
        </div>

        <!-- ── Modal registrar pago (no empleados) ── -->
        <div class="modal-overlay" v-if="paymentSupplier" @click.self="paymentSupplier = null">
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title">
                {{ paymentSupplier?.tipo === 'arriendo' ? '🏠 Pagar arriendo' :
                   paymentSupplier?.tipo === 'credito'  ? '💳 Registrar cuota' : '💳 Registrar pago' }}
                — {{ paymentSupplier?.name }}
              </h3>
              <button class="btn-close" @click="paymentSupplier = null">×</button>
            </div>
            <div class="modal-body">
              <!-- Info arriendo -->
              <div class="payment-ref-box mb-2" v-if="paymentSupplier?.tipo === 'arriendo'">
                <span>🏠 Monto mensual: <strong>{{ formatCOP(paymentSupplier?.montoMensual) }}</strong></span>
              </div>
              <!-- Info crédito -->
              <div class="payment-ref-box mb-2" v-else-if="paymentSupplier?.tipo === 'credito'">
                <span>💰 Deuda restante: <strong class="text-danger">{{ formatCOP(paymentSupplier?.totalDebt) }}</strong></span>
                <span v-if="paymentSupplier?.cuotaMensual">📅 Cuota mensual: <strong>{{ formatCOP(paymentSupplier?.cuotaMensual) }}</strong></span>
              </div>
              <!-- Info proveedor con deuda -->
              <p class="mb-2" v-else-if="paymentSupplier?.totalDebt > 0">Pendiente: <strong class="text-danger">{{ formatCOP(paymentSupplier?.totalDebt) }}</strong></p>
              <div class="form-group">
                <label class="form-label">Monto</label>
                <input v-model.number="paymentForm.amount" type="number" class="form-control" />
              </div>
              <div class="form-group">
                <label class="form-label">Método</label>
                <select v-model="paymentForm.method" class="form-control">
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Notas</label>
                <input v-model="paymentForm.notes" class="form-control" />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="paymentSupplier = null">Cancelar</button>
              <button class="btn btn-success" @click="savePayment" :disabled="saving">Registrar pago</button>
            </div>
          </div>
        </div>

        <!-- ── Modal historial de pagos ── -->
        <div class="modal-overlay" v-if="paymentsSupplier" @click.self="paymentsSupplier = null">
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title">Pagos — {{ paymentsSupplier?.name }}</h3>
              <button class="btn-close" @click="paymentsSupplier = null">×</button>
            </div>
            <div class="modal-body">
              <div v-if="!paymentsSupplier?.payments?.length" class="text-muted">Sin pagos registrados</div>
              <div class="table-wrap" v-else>
                <table class="table">
                  <thead>
                    <tr><th>Fecha</th><th>Monto</th><th>Método</th><th>Notas</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in paymentsSupplier.payments" :key="p.id">
                      <td>{{ formatDate(p.date) }}</td>
                      <td class="currency">{{ formatCOP(p.amount) }}</td>
                      <td>{{ p.method }}</td>
                      <td>{{ p.notes || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="paymentsSupplier = null">Cerrar</button>
            </div>
          </div>
        </div>

        <!-- Modal: Reporte de nómina -->
        <div class="modal-overlay" v-if="showNominaReport" @click.self="showNominaReport = false">
          <div class="modal" style="max-width:640px">
            <div class="modal-header">
              <h3 class="modal-title">📊 Reporte de nómina</h3>
              <button class="btn-close" @click="showNominaReport = false">×</button>
            </div>
            <div class="modal-body" id="nomina-report-print">
              <div class="report-biz-header">
                <strong>{{ auth?.currentBusiness?.name || 'Negocio' }}</strong>
                <span>Reporte de nómina</span>
              </div>
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
                <label class="form-label" style="margin:0;white-space:nowrap">Período:</label>
                <input v-model="reportMonth" type="month" class="form-control" style="max-width:180px" />
              </div>
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Empleado</th>
                      <th>Cargo</th>
                      <th>Salario ref.</th>
                      <th>Pagos</th>
                      <th>Total pagado</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="emp in nominaReportData" :key="emp.name">
                      <td><strong>{{ emp.name }}</strong></td>
                      <td>{{ emp.cargo }}</td>
                      <td>{{ formatCOP(emp.salarioBase) }} / {{ emp.periodoPago }}</td>
                      <td><span class="badge badge-default">{{ emp.pagos }}</span></td>
                      <td class="currency"><strong>{{ formatCOP(emp.totalPagado) }}</strong></td>
                    </tr>
                    <tr v-if="nominaReportData.length === 0">
                      <td colspan="5" style="text-align:center;color:var(--text-light);padding:20px">
                        Sin empleados registrados
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr class="report-total-row">
                      <td colspan="4"><strong>Total nómina {{ reportMonth }}</strong></td>
                      <td class="currency"><strong>{{ formatCOP(reportTotal) }}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="showNominaReport = false">Cerrar</button>
              <button class="btn btn-primary" @click="window.print()">🖨️ Imprimir</button>
            </div>
          </div>
        </div>

  </PageLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import api from '../services/api.js'
import { useAuthStore } from '../stores/auth.js'
import PageLayout from '../components/PageLayout.vue'

const auth = useAuthStore()
const toast = inject('toast')
const bizId = computed(() => auth.currentBusiness?.id)

const suppliers = ref([])
const showModal = ref(false)
const editSupplier = ref(null)
const paymentSupplier = ref(null)
const paymentsSupplier = ref(null)
const nominaPagoSupplier = ref(null)
const filterTipo = ref('todos')
const saving = ref(false)
const showNominaReport = ref(false)
const reportMonth = ref(new Date().toISOString().slice(0, 7))

const tipoOptions = [
  { value: 'todos',     label: 'Todos',       icon: '📋' },
  { value: 'proveedor', label: 'Proveedores',  icon: '🏭' },
  { value: 'empleado',  label: 'Empleados',    icon: '👷' },
  { value: 'arriendo',  label: 'Arriendo',     icon: '🏠' },
  { value: 'credito',   label: 'Créditos',     icon: '💳' }
]

const filteredSuppliers = computed(() => {
  if (filterTipo.value === 'todos') return suppliers.value
  return suppliers.value.filter(s => (s.tipo || 'proveedor') === filterTipo.value)
})

const empleados = computed(() => suppliers.value.filter(s => s.tipo === 'empleado'))
const totalNomina = computed(() => empleados.value.reduce((s, e) => s + (e.salarioBase || 0), 0))

const nominaReportData = computed(() => {
  return suppliers.value
    .filter(s => s.tipo === 'empleado')
    .map(emp => {
      const pagos = (emp.payments || []).filter(p => p.date?.slice(0, 7) === reportMonth.value)
      return {
        name: emp.name,
        cargo: emp.cargo || '—',
        salarioBase: emp.salarioBase || 0,
        periodoPago: emp.periodoPago || 'mensual',
        pagos: pagos.length,
        totalPagado: pagos.reduce((s, p) => s + (p.amount || 0), 0),
        detalle: pagos
      }
    })
})
const reportTotal = computed(() => nominaReportData.value.reduce((s, e) => s + e.totalPagado, 0))

function countByTipo(tipo) {
  if (tipo === 'todos') return suppliers.value.length
  return suppliers.value.filter(s => (s.tipo || 'proveedor') === tipo).length
}

function tipoLabel(tipo) {
  const map = { proveedor: '🏭 Proveedor', empleado: '👷 Empleado', arriendo: '🏠 Arriendo', credito: '💳 Crédito' }
  return map[tipo] || '🏭 Proveedor'
}

/** Días divisores según período para calcular tarifa diaria */
function periodDivisor(periodo) {
  return periodo === 'semanal' ? 7 : periodo === 'quincenal' ? 15 : 30
}

/** Tarifa diaria de un empleado específico */
function tarifaDiariaOf(emp) {
  if (!emp.salarioBase) return 0
  return Math.round(emp.salarioBase / periodDivisor(emp.periodoPago || 'mensual'))
}

/** Tarifa diaria del empleado activo en el modal de nómina */
const activeTarifaDiaria = computed(() => tarifaDiariaOf(nominaPagoSupplier.value || {}))

const form = reactive({
  name: '', tipo: 'proveedor',
  nit: '', phone: '', contact: '', email: '', address: '',
  cedula: '', cargo: '', salarioBase: 0, periodoPago: 'mensual', fechaIngreso: '',
  montoMensual: 0, montoTotal: 0, cuotaMensual: 0
})
const paymentForm = reactive({ amount: 0, method: 'efectivo', notes: '' })
const nominaPagoForm = reactive({ diasTrabajados: 0, amount: 0, period: '', method: 'efectivo', notes: '' })

function formatCOP(v) { return '$' + Number(v || 0).toLocaleString('es-CO') }
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

async function loadSuppliers() {
  const res = await api.get(`/api/${bizId.value}/suppliers`)
  suppliers.value = res.data
}

function resetForm() {
  Object.assign(form, {
    name: '', tipo: 'proveedor',
    nit: '', phone: '', contact: '', email: '', address: '',
    cedula: '', cargo: '', salarioBase: 0, periodoPago: 'mensual', fechaIngreso: '',
    montoMensual: 0, montoTotal: 0, cuotaMensual: 0
  })
}

function openCreate() {
  editSupplier.value = null
  resetForm()
  showModal.value = true
}

function openEdit(s) {
  editSupplier.value = s
  Object.assign(form, {
    name: s.name || '', tipo: s.tipo || 'proveedor',
    nit: s.nit || '', phone: s.phone || '', contact: s.contact || '',
    email: s.email || '', address: s.address || '',
    cedula: s.cedula || '', cargo: s.cargo || '',
    salarioBase: s.salarioBase || 0, periodoPago: s.periodoPago || 'mensual',
    fechaIngreso: s.fechaIngreso || '',
    montoMensual: s.montoMensual || 0, montoTotal: s.montoTotal || 0, cuotaMensual: s.cuotaMensual || 0
  })
  showModal.value = true
}

function closeModal() { showModal.value = false }

async function saveSupplier() {
  if (!form.name.trim()) return
  // Validar duplicado por nombre (solo al crear)
  if (!editSupplier.value) {
    const nombre = form.name.trim().toLowerCase()
    const existe = suppliers.value.some(s => s.name.trim().toLowerCase() === nombre)
    if (existe) { toast(`Ya existe un registro con el nombre "${form.name.trim()}"`, 'warning'); return }
  }
  saving.value = true
  try {
    const label = form.tipo === 'empleado' ? 'Empleado' : 'Proveedor'
    if (editSupplier.value) {
      const res = await api.put(`/api/${bizId.value}/suppliers/${editSupplier.value.id}`, { ...form })
      const idx = suppliers.value.findIndex(s => s.id === editSupplier.value.id)
      if (idx !== -1) suppliers.value[idx] = res.data
      toast(`${label} actualizado`, 'success')
    } else {
      const payload = { ...form }
      // Crédito: la deuda inicial = montoTotal
      if (form.tipo === 'credito' && form.montoTotal > 0) payload.totalDebt = form.montoTotal
      const res = await api.post(`/api/${bizId.value}/suppliers`, payload)
      suppliers.value.push(res.data)
      toast(`${label} creado`, 'success')
    }
    closeModal()
  } catch {
    toast('Error al guardar', 'error')
  } finally {
    saving.value = false
  }
}

async function confirmDelete(s) {
  if (!confirm(`¿Eliminar "${s.name}"?`)) return
  await api.delete(`/api/${bizId.value}/suppliers/${s.id}`)
  suppliers.value = suppliers.value.filter(x => x.id !== s.id)
  toast('Eliminado', 'success')
}

// ── Pago nómina (empleados) ──────────────────────────────────────────────────
function openNominaPago(s) {
  nominaPagoSupplier.value = s
  const now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  Object.assign(nominaPagoForm, { diasTrabajados: 0, amount: 0, period, method: 'efectivo', notes: '' })
}

function recalcNomina() {
  nominaPagoForm.amount = nominaPagoForm.diasTrabajados * activeTarifaDiaria.value
}

async function saveNominaPago() {
  if (!nominaPagoForm.amount) return
  saving.value = true
  try {
    const notes = nominaPagoForm.diasTrabajados > 0
      ? `${nominaPagoForm.diasTrabajados} días trabajados${nominaPagoForm.notes ? ' — ' + nominaPagoForm.notes : ''} · ${nominaPagoForm.period}`
      : (nominaPagoForm.notes || nominaPagoForm.period)

    const res = await api.post(`/api/${bizId.value}/suppliers/${nominaPagoSupplier.value.id}/payment`, {
      amount: nominaPagoForm.amount,
      method: nominaPagoForm.method,
      notes
    })
    const idx = suppliers.value.findIndex(s => s.id === nominaPagoSupplier.value.id)
    if (idx !== -1) suppliers.value[idx] = res.data
    toast(`Nómina de ${formatCOP(nominaPagoForm.amount)} registrada para ${nominaPagoSupplier.value.name}`, 'success')
    nominaPagoSupplier.value = null
  } catch {
    toast('Error al registrar pago', 'error')
  } finally {
    saving.value = false
  }
}

// ── Pago genérico (no empleados) ─────────────────────────────────────────────
function openPayment(s) {
  paymentSupplier.value = s
  // Pre-llenar con el monto correspondiente al tipo
  const prefill = s.tipo === 'arriendo' ? (s.montoMensual || 0)
                : s.tipo === 'credito'  ? (s.cuotaMensual || s.totalDebt || 0)
                : (s.totalDebt || 0)
  Object.assign(paymentForm, { amount: prefill, method: 'efectivo', notes: '' })
}

async function savePayment() {
  saving.value = true
  try {
    const res = await api.post(`/api/${bizId.value}/suppliers/${paymentSupplier.value.id}/payment`, { ...paymentForm })
    const idx = suppliers.value.findIndex(s => s.id === paymentSupplier.value.id)
    if (idx !== -1) suppliers.value[idx] = res.data
    toast('Pago registrado', 'success')
    paymentSupplier.value = null
  } catch {
    toast('Error al registrar pago', 'error')
  } finally {
    saving.value = false
  }
}

function openPayments(s) { paymentsSupplier.value = s }

onMounted(loadSuppliers)
</script>

<style scoped>
.mb-3 { margin-bottom: 16px; }
.mb-2 { margin-bottom: 10px; }

.tipo-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.tipo-tab {
  padding: 7px 14px; border-radius: 20px; border: 2px solid var(--border);
  background: var(--surface); color: var(--text); cursor: pointer; font-size: 13px;
  display: flex; align-items: center; gap: 6px; transition: all 0.2s;
}
.tipo-tab.active { background: var(--primary); color: white; border-color: var(--primary); }
.tab-count { background: rgba(0,0,0,0.15); border-radius: 10px; padding: 1px 7px; font-size: 11px; font-weight: 700; }

/* Resumen nómina */
.nomina-summary { display: flex; align-items: center; gap: 32px; flex-wrap: wrap; padding: 14px 20px; }
.nomina-stat { display: flex; flex-direction: column; gap: 2px; }
.nomina-label { font-size: 11px; color: var(--text-light); text-transform: uppercase; font-weight: 600; letter-spacing: 0.04em; }
.nomina-val { font-size: 20px; font-weight: 800; }

/* Info box en modal nómina */
.nomina-ref-box {
  display: flex; gap: 16px; flex-wrap: wrap;
  background: var(--surface-2); border-radius: 10px; padding: 12px 16px;
}
.nomina-ref-item { display: flex; flex-direction: column; gap: 2px; }
.text-primary { color: var(--primary); }

/* Hint de cálculo */
.field-hint { font-size: 12px; color: var(--text-light); margin-top: 4px; }
.tarifa-hint { font-size: 13px; color: var(--text-secondary); background: var(--surface-2); padding: 8px 12px; border-radius: 8px; }
.form-control-lg { font-size: 18px; font-weight: 700; text-align: right; }

.tipo-badge {
  display: inline-block; font-size: 11px; padding: 2px 8px;
  border-radius: 10px; margin-top: 3px; font-weight: 600;
}
.tipo-proveedor { background: #eaf4fb; color: #2980b9; }
.tipo-empleado  { background: #f5eef8; color: #8e44ad; }
.tipo-arriendo  { background: #fef9e7; color: #d68910; }
.tipo-credito   { background: #fde8e8; color: #e74c3c; }

.suppliers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
.supplier-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
.supplier-name { font-weight: 700; font-size: 16px; }
.supplier-sub { font-size: 12px; color: var(--text-light); margin: 2px 0; }
.supplier-info { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-light); margin-bottom: 12px; }
.supplier-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.text-muted { color: var(--text-light); font-size: 13px; }
.text-danger { color: var(--danger); }

.report-biz-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px; font-size: 14px; color: var(--text-light); border-bottom: 2px solid var(--border); padding-bottom: 10px; }
.report-biz-header strong { font-size: 16px; color: var(--text); }
.report-total-row { background: var(--surface-2); font-weight: 700; }
.currency { text-align: right; }

.payment-ref-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  font-size: 13px;
  color: var(--text-secondary);
}
@media print {
  body > * { display: none !important; }
  #nomina-report-print { display: block !important; position: fixed; top: 0; left: 0; width: 100%; padding: 20px; }
}
</style>
