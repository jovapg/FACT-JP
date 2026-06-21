<template>
  <PageLayout title="Salidas">
        <div class="page-header">
          <div>
            <h1 class="page-title">Salidas</h1>
            <p class="page-subtitle">Compras, gastos, nómina, arriendo y créditos — todo el dinero que sale</p>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <span v-if="hasDraft" class="draft-badge">📝 Borrador guardado</span>
            <button class="btn btn-primary" @click="openNew">
              {{ hasDraft ? '↩ Continuar borrador' : '+ Registrar salida' }}
            </button>
          </div>
        </div>

        <div class="card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Área</th>
                  <th>Pago</th>
                  <th>Detalle</th>
                  <th>Total</th>
                  <th>Registrado por</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in salidas" :key="s.id">
                  <td>{{ formatDate(s.date) }}</td>
                  <td><span class="kind-tag">{{ kindLabel(s.kind) }}</span></td>
                  <td>
                    <span :class="['badge', 'area-badge', (s.area || 'bar')]">
                      {{ (s.area || 'bar') === 'restaurante' ? '🍽️ Rest.' : '🍺 Bar' }}
                    </span>
                  </td>
                  <td>{{ s.paidWith === 'banco' ? '🏦 Banco' : '💵 Efectivo' }}</td>
                  <td>{{ s.detail || '-' }}</td>
                  <td class="currency">{{ formatCOP(s.total) }}</td>
                  <td>{{ s.by || '-' }}</td>
                  <td>
                    <div class="action-btns" v-if="s._source === 'purchase'">
                      <button class="btn btn-sm btn-outline" @click="verDetalle(s._raw)">👁 Ver</button>
                      <button v-if="s.kind === 'reponer'" class="btn btn-sm btn-outline" @click="openEdit(s._raw)">✏️ Editar</button>
                    </div>
                  </td>
                </tr>
                <tr v-if="salidas.length === 0">
                  <td colspan="8" style="text-align:center;color:var(--text-light);padding:32px">
                    No hay salidas registradas
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Purchase detail modal -->
        <div class="modal-overlay" v-if="showDetail" @click.self="showDetail = false">
          <div class="modal" style="max-width:600px">
            <div class="modal-header">
              <h3 class="modal-title">Detalle de compra</h3>
              <button class="btn-close" @click="showDetail = false">×</button>
            </div>
            <div class="modal-body" v-if="selectedPurchase">
              <div class="detail-meta">
                <div class="detail-meta-item">
                  <span class="meta-label">Fecha</span>
                  <span>{{ formatDate(selectedPurchase.date) }}</span>
                </div>
                <div class="detail-meta-item">
                  <span class="meta-label">Bolsillo</span>
                  <span>{{ (selectedPurchase.area || 'bar') === 'restaurante' ? '🍽️ Restaurante' : '🍺 Bar' }}</span>
                </div>
                <div class="detail-meta-item" v-if="selectedPurchase.type !== 'gasto'">
                  <span class="meta-label">Proveedor</span>
                  <span>{{ getSupplierName(selectedPurchase.supplierId) }}</span>
                </div>
                <div class="detail-meta-item" v-if="selectedPurchase.type === 'gasto'">
                  <span class="meta-label">Detalle</span>
                  <span>{{ selectedPurchase.description || '-' }}</span>
                </div>
                <div class="detail-meta-item">
                  <span class="meta-label">Registrado por</span>
                  <span>{{ selectedPurchase.createdBy }}</span>
                </div>
                <div class="detail-meta-item" v-if="selectedPurchase.notes">
                  <span class="meta-label">Notas</span>
                  <span>{{ selectedPurchase.notes }}</span>
                </div>
              </div>

              <div v-if="selectedPurchase.type === 'gasto'" class="gasto-detail-total">
                Total del gasto: <strong>{{ formatCOP(selectedPurchase.total) }}</strong>
              </div>

              <table v-else class="table" style="margin-top:16px">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style="text-align:right">Cantidad</th>
                    <th style="text-align:right">Costo unit.</th>
                    <th style="text-align:right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in selectedPurchase.items" :key="item.inventoryId">
                    <td>{{ getProductName(item.inventoryId) }}</td>
                    <td style="text-align:right">{{ item.quantity }}</td>
                    <td style="text-align:right">{{ formatCOP(item.unitCost) }}</td>
                    <td style="text-align:right" class="currency">{{ formatCOP(item.quantity * item.unitCost) }}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3" style="text-align:right;font-weight:700;padding-top:10px">TOTAL</td>
                    <td style="text-align:right;font-weight:700;color:var(--success);padding-top:10px">{{ formatCOP(selectedPurchase.total) }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div class="modal-footer">
              <button class="btn btn-primary" @click="showDetail = false">Cerrar</button>
            </div>
          </div>
        </div>

        <!-- New purchase modal (+ quick create panel al lado) -->
        <div :class="['modal-overlay', { 'modal-dual': showQuickCreate }]" v-if="showModal" @click.self="closeModal">
          <div class="modal" style="max-width:820px">
            <div class="modal-header">
              <div>
                <h3 class="modal-title">{{ isEditing ? 'Editar compra' : 'Registrar compra' }}</h3>
                <span v-if="hasDraft && !isEditing" class="draft-indicator">📝 Borrador auto-guardado</span>
              </div>
              <button class="btn-close" @click="closeModal">×</button>
            </div>
            <div class="modal-body">
              <!-- Tipo de salida -->
              <div class="form-group">
                <label class="form-label">Tipo de salida</label>
                <div class="type-picker type-picker-wrap">
                  <button type="button" :class="['type-opt', { active: form.type === 'reponer' }]" @click="setType('reponer')">🛒 Compra<br><small>entra al inventario</small></button>
                  <button type="button" :class="['type-opt', { active: form.type === 'gasto' }]" @click="setType('gasto')">💸 Gasto<br><small>mercado, servicios</small></button>
                  <button type="button" :class="['type-opt', { active: form.type === 'nomina' }]" @click="setType('nomina')">👤 Nómina<br><small>pago a empleado</small></button>
                  <button type="button" :class="['type-opt', { active: form.type === 'arriendo' }]" @click="setType('arriendo')">🏠 Arriendo<br><small>pago del local</small></button>
                  <button type="button" :class="['type-opt', { active: form.type === 'credito' }]" @click="setType('credito')">💳 Crédito<br><small>cuota / abono</small></button>
                </div>
              </div>

              <!-- Área (Bar / Restaurante) -->
              <div class="form-group">
                <label class="form-label">Área (¿de quién es la salida?)</label>
                <div class="type-picker">
                  <button type="button" :class="['type-opt area-bar', { active: form.area === 'bar' }]" @click="form.area = 'bar'">🍺 Bar</button>
                  <button type="button" :class="['type-opt area-rest', { active: form.area === 'restaurante' }]" @click="form.area = 'restaurante'">🍽️ Restaurante</button>
                </div>
              </div>

              <!-- Común a todas: con qué se pagó + fecha -->
              <div class="grid grid-2">
                <div class="form-group">
                  <label class="form-label">¿Con qué pagaste?</label>
                  <div class="type-picker">
                    <button type="button" :class="['type-opt pay-ef', { active: form.paidWith === 'efectivo' }]" @click="form.paidWith = 'efectivo'">💵 Efectivo</button>
                    <button type="button" :class="['type-opt pay-bk', { active: form.paidWith === 'banco' }]" @click="form.paidWith = 'banco'">🏦 Banco</button>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Fecha</label>
                  <input v-model="form.date" type="date" class="form-control" />
                </div>
              </div>

              <!-- ── GASTO o ARRIENDO: valor + detalle ── -->
              <template v-if="form.type === 'gasto' || form.type === 'arriendo'">
                <div class="form-group">
                  <label class="form-label">Valor (COP) *</label>
                  <input v-model.number="form.amount" type="number" min="0" :class="['form-control', { 'input-error': submitted && !(form.amount > 0) }]" placeholder="Ej: 300000" />
                </div>
                <div class="form-group">
                  <label class="form-label">Detalle *</label>
                  <input v-model="form.description" class="form-control" :placeholder="form.type === 'arriendo' ? 'Ej: Arriendo de junio' : 'Ej: Carne, verduras y pan del mercado'" />
                </div>
                <div class="form-group">
                  <label class="form-label">Notas</label>
                  <input v-model="form.notes" class="form-control" placeholder="Opcional" />
                </div>
                <div class="purchase-total"><strong>Total: {{ formatCOP(purchaseTotal) }}</strong></div>
              </template>

              <!-- ── NÓMINA: empleado + monto ── -->
              <template v-else-if="form.type === 'nomina'">
                <div class="form-group">
                  <label class="form-label">Empleado *</label>
                  <select v-model="form.employeeId" :class="['form-control', { 'input-error': submitted && !form.employeeId }]">
                    <option value="">— Seleccionar empleado —</option>
                    <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.name }}{{ e.cargo ? ' · ' + e.cargo : '' }} — debe {{ formatCOP(e.totalDebt) }}</option>
                  </select>
                  <p v-if="employees.length === 0" class="text-muted" style="font-size:12px;margin-top:4px">No hay empleados. Créalos en "Directorio de pagos".</p>
                </div>
                <div class="form-group">
                  <label class="form-label">Monto a pagar (COP) *</label>
                  <input v-model.number="form.amount" type="number" min="0" :class="['form-control', { 'input-error': submitted && !(form.amount > 0) }]" placeholder="Ej: 200000" />
                </div>
                <div class="form-group">
                  <label class="form-label">Notas</label>
                  <input v-model="form.notes" class="form-control" placeholder="Ej: Quincena, semana..." />
                </div>
                <div class="purchase-total"><strong>Total: {{ formatCOP(purchaseTotal) }}</strong></div>
              </template>

              <!-- ── CRÉDITO: crédito + monto ── -->
              <template v-else-if="form.type === 'credito'">
                <div class="form-group">
                  <label class="form-label">Crédito *</label>
                  <select v-model="form.creditId" :class="['form-control', { 'input-error': submitted && !form.creditId }]">
                    <option value="">— Seleccionar crédito —</option>
                    <option v-for="c in credits" :key="c.id" :value="c.id">{{ c.name }} — saldo {{ formatCOP(c.totalDebt) }}</option>
                  </select>
                  <p v-if="credits.length === 0" class="text-muted" style="font-size:12px;margin-top:4px">No hay créditos. Créalos en "Directorio de pagos".</p>
                </div>
                <div class="form-group">
                  <label class="form-label">Monto de la cuota (COP) *</label>
                  <input v-model.number="form.amount" type="number" min="0" :class="['form-control', { 'input-error': submitted && !(form.amount > 0) }]" placeholder="Ej: 150000" />
                </div>
                <div class="form-group">
                  <label class="form-label">Notas</label>
                  <input v-model="form.notes" class="form-control" placeholder="Opcional" />
                </div>
                <div class="purchase-total"><strong>Total: {{ formatCOP(purchaseTotal) }}</strong></div>
              </template>

              <!-- ── COMPRA (reponer): itemizada que entra al inventario ── -->
              <template v-else>
              <div class="grid grid-2">
                <div class="form-group">
                  <label class="form-label">Proveedor</label>
                  <select v-model="form.supplierId" class="form-control">
                    <option value="">Sin proveedor</option>
                    <option v-for="s in providers" :key="s.id" :value="s.id">{{ s.name }}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Notas</label>
                  <input v-model="form.notes" class="form-control" placeholder="Opcional" />
                </div>
              </div>

              <!-- Items -->
              <div class="purchase-items">
                <div class="items-header">
                  <h4>Productos comprados</h4>
                  <button class="btn btn-sm btn-outline" @click="openQuickCreate(null)">+ Crear nuevo producto</button>
                </div>

                <!-- Buscador: escribe y agrega el producto al instante -->
                <div class="item-search-box">
                  <input v-model="itemSearch" class="form-control" placeholder="🔍 Escribe para buscar y agregar un producto..." />
                  <div v-if="itemSearch.trim()" class="item-search-results">
                    <button
                      v-for="inv in itemSearchResults"
                      :key="inv.id"
                      type="button"
                      class="item-search-opt"
                      @click="addItemById(inv)"
                    >
                      <span class="opt-name">{{ inv.name }}</span>
                      <span class="opt-meta">stock {{ inv.stock }} {{ inv.unit }} · costo {{ formatCOP(inv.cost) }}</span>
                    </button>
                    <div v-if="itemSearchResults.length === 0" class="item-search-empty">
                      Sin resultados ·
                      <button type="button" class="link-btn" @click="openQuickCreate(null)">crear nuevo producto</button>
                    </div>
                  </div>
                </div>

                <div class="table-wrap" v-if="form.items.length > 0">
                  <table class="table items-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th style="width:110px">Cantidad *</th>
                        <th style="width:170px">Costo unitario *</th>
                        <th style="width:120px">Subtotal</th>
                        <th style="width:40px"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(item, idx) in form.items" :key="item.inventoryId || idx">
                        <td><strong>{{ getProductName(item.inventoryId) }}</strong></td>
                        <td>
                          <input v-model.number="item.quantity" type="number" :class="['form-control', { 'input-error': submitted && !(item.quantity > 0) }]" min="0" placeholder="0" />
                        </td>
                        <td>
                          <input v-model.number="item.unitCost" type="number" :class="['form-control', { 'input-error': submitted && !(item.unitCost > 0) }]" min="0" placeholder="0" />
                          <span v-if="costChanged(item)" :class="['cost-hint', item.unitCost > costoAnterior(item) ? 'up' : 'down']">
                            antes {{ formatCOP(costoAnterior(item)) }} {{ item.unitCost > costoAnterior(item) ? '▲' : '▼' }}
                          </span>
                        </td>
                        <td class="subtotal-cell">{{ formatCOP(item.quantity * item.unitCost) }}</td>
                        <td><button class="btn btn-sm btn-danger" @click="removeItem(idx)">×</button></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p v-else class="text-muted" style="text-align:center;padding:16px 0;font-size:13px">
                  Busca arriba y agrega los productos de la compra
                </p>

                <div class="purchase-total">
                  <strong>Total: {{ formatCOP(purchaseTotal) }}</strong>
                </div>
              </div>
              </template>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="closeModal">Cancelar</button>
              <button v-if="hasDraft && !isEditing" class="btn btn-danger-outline" @click="clearDraft(); closeModal()">🗑 Descartar borrador</button>
              <button class="btn btn-primary" @click="savePurchase" :disabled="saving || (form.type === 'reponer' && form.items.length === 0)">
                {{ saving ? 'Guardando...' : (isEditing ? 'Guardar cambios' : saveLabel) }}
              </button>
            </div>
          </div>

          <!-- Panel nuevo producto — aparece al lado del modal de compra -->
          <div class="modal quick-panel" v-if="showQuickCreate">
            <div class="modal-header">
              <h3 class="modal-title">Nuevo producto</h3>
              <button class="btn-close" @click="showQuickCreate = false">×</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Nombre *</label>
                <input v-model="quickForm.name" class="form-control" placeholder="Ej: Cerveza Águila 330ml" />
              </div>
              <div class="form-group">
                <label class="form-label">Categoría</label>
                <select v-model="quickForm.category" class="form-control" v-if="!quickCatNew" @change="onQuickCatChange">
                  <option v-for="c in allCategories" :key="c" :value="c">{{ c }}</option>
                  <option value="__new__">➕ Nueva categoría…</option>
                </select>
                <input v-else v-model="quickForm.category" class="form-control" placeholder="Escribe la nueva categoría" />
              </div>
              <div class="form-group">
                <label class="form-label">Unidad</label>
                <input v-model="quickForm.unit" class="form-control" list="qunits" placeholder="unidad" />
                <datalist id="qunits">
                  <option value="unidad" /><option value="litro" />
                  <option value="kg" /><option value="porción" />
                </datalist>
              </div>
              <div class="form-group">
                <label class="form-label">Stock mínimo</label>
                <input v-model.number="quickForm.minStock" type="number" class="form-control" min="0" />
              </div>
              <div class="form-group">
                <label class="form-label">Precio de venta (COP)</label>
                <input v-model.number="quickForm.salePrice" type="number" class="form-control" min="0" placeholder="Opcional" />
              </div>
              <div class="form-group" v-if="!form.supplierId">
                <label class="form-label">Proveedor</label>
                <select v-model="quickForm.supplierId" class="form-control">
                  <option value="">— Seleccionar —</option>
                  <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
                </select>
              </div>
              <p class="text-muted" style="font-size:12px;margin-top:4px">El stock y costo se actualizan al guardar la compra.</p>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="showQuickCreate = false">Cancelar</button>
              <button class="btn btn-primary" @click="saveQuickProduct" :disabled="quickSaving">
                {{ quickSaving ? 'Creando...' : 'Crear producto' }}
              </button>
            </div>
          </div>
        </div>
  </PageLayout>
</template>

<script setup>
/**
 * PurchasesView.vue — Registro de compras a proveedores
 *
 * Permite registrar las compras de insumos que ingresan al inventario.
 * Al guardar una compra:
 *   - Se aumenta el stock de cada insumo comprado
 *   - Si hay proveedor seleccionado, se aumenta su deuda pendiente
 *
 * Funcionalidades:
 *   - Seleccionar proveedor (opcional)
 *   - Agregar ítems de inventario con cantidad y costo unitario
 *   - Calcular total automáticamente
 *   - Historial de compras anteriores
 *
 * El historial de compras es la fuente de datos del reporte de Rentabilidad
 * para calcular el egreso de "Compras a proveedores".
 */
import { ref, reactive, computed, watch, onMounted, inject } from 'vue'
import { useInventoryStore } from '../stores/inventory.js'
import api from '../services/api.js'
import { useAuthStore } from '../stores/auth.js'
import PageLayout from '../components/PageLayout.vue'

const inventoryStore = useInventoryStore()
const auth = useAuthStore()
const toast = inject('toast')

const purchases = ref([])
const suppliers = ref([])
const showModal = ref(false)
const saving = ref(false)
const showDetail = ref(false)
const selectedPurchase = ref(null)
const submitted = ref(false)       // true después del primer intento de guardar; activa los errores visuales en campos
const showQuickCreate = ref(false)
const quickSaving = ref(false)
const quickForm = reactive({ name: '', category: 'bebidas', unit: 'unidad', minStock: 0, salePrice: 0, supplierId: '' })
const quickCatNew = ref(false)
// Categorías para el desplegable: las existentes en inventario o una base por defecto
const allCategories = computed(() => {
  const cats = inventoryStore.categories || []
  return cats.length ? cats : ['bebidas', 'licores', 'alimentos', 'insumos']
})
/** Si elige "Nueva categoría…", muestra el campo de texto para escribirla */
function onQuickCatChange() {
  if (quickForm.category === '__new__') { quickForm.category = ''; quickCatNew.value = true }
}
const editPurchaseId = ref(null)   // null = nueva compra, string = editando compra existente
const hasDraft = ref(false)        // true si hay un borrador guardado en localStorage para este negocio

/** Fecha de hoy en formato yyyy-mm-dd para el input date */
function todayStr() { return new Date().toISOString().slice(0, 10) }

const form = reactive({
  type: 'reponer',      // 'reponer' (compra) | 'gasto' | 'arriendo' | 'nomina' | 'credito'
  area: 'bar',          // área: 'bar' | 'restaurante'
  paidWith: 'efectivo', // 'efectivo' | 'banco'
  date: todayStr(),     // fecha de la salida
  supplierId: '', notes: '', items: [],
  amount: 0, description: '',  // gasto / arriendo / nomina / credito
  employeeId: '', creditId: ''  // nomina / credito
})
const bizId = computed(() => auth.currentBusiness?.id)

// Listas del directorio segmentadas por tipo
const providers = computed(() => suppliers.value.filter(s => !s.tipo || s.tipo === 'proveedor'))
const employees = computed(() => suppliers.value.filter(s => s.tipo === 'empleado'))
const credits   = computed(() => suppliers.value.filter(s => s.tipo === 'credito'))

/** Texto del botón guardar según el tipo de salida */
const saveLabel = computed(() => ({
  reponer: 'Finalizar compra', gasto: 'Registrar gasto', arriendo: 'Registrar arriendo',
  nomina: 'Registrar pago', credito: 'Registrar pago'
}[form.type] || 'Registrar'))

/** Cambia el tipo de salida y ajusta el área por defecto según el caso típico */
function setType(t) {
  form.type = t
  // Por defecto: gasto/nómina suelen ser del Restaurante; compra del Bar
  if (t === 'gasto' || t === 'nomina') form.area = 'restaurante'
  else form.area = 'bar'
}

// Clave única por negocio para evitar que borradores de distintos negocios se mezclen
const draftKey = computed(() => `facjp_draft_purchase_${bizId.value}`)
const isEditing = computed(() => !!editPurchaseId.value)

/** Suma del total de la salida en curso. Para 'gasto' es el valor; para 'reponer' suma de ítems. */
const purchaseTotal = computed(() => {
  if (form.type === 'reponer') return form.items.reduce((s, i) => s + (i.quantity || 0) * (i.unitCost || 0), 0)
  return Number(form.amount) || 0
})

/**
 * Lista unificada de salidas: compras/gastos/arriendos (purchases) +
 * pagos de nómina/crédito/proveedor (suppliers.payments), ordenada por fecha.
 */
const salidas = computed(() => {
  const rows = []
  // Compras, gastos y arriendos
  for (const p of purchases.value) {
    rows.push({
      id: p.id, date: p.date, kind: p.type || 'reponer',
      area: p.area || 'bar', paidWith: p.paidWith || 'efectivo', total: p.total || 0,
      detail: p.type === 'reponer'
        ? (getSupplierName(p.supplierId) !== '-' ? getSupplierName(p.supplierId) + ' · ' : '') + (p.items?.length || 0) + ' productos'
        : (p.description || '—'),
      by: p.createdBy, _source: 'purchase', _raw: p
    })
  }
  // Pagos a proveedores/empleados/créditos
  for (const s of suppliers.value) {
    for (const pay of (s.payments || [])) {
      const kind = s.tipo === 'empleado' ? 'nomina' : s.tipo === 'credito' ? 'credito' : 'proveedor'
      rows.push({
        id: pay.id, date: pay.date, kind,
        area: pay.area || 'bar', paidWith: pay.paidWith || (pay.method === 'banco' ? 'banco' : 'efectivo'),
        total: pay.amount || 0, detail: s.name + (pay.notes ? ' · ' + pay.notes : ''),
        by: '—', _source: 'payment', _raw: pay
      })
    }
  }
  return rows.sort((a, b) => new Date(b.date) - new Date(a.date))
})

/** Etiqueta legible para el tipo de salida */
function kindLabel(kind) {
  return ({ reponer: '🛒 Compra', gasto: '💸 Gasto', arriendo: '🏠 Arriendo',
    nomina: '👤 Nómina', credito: '💳 Crédito', proveedor: '🚚 Proveedor' }[kind] || kind)
}

/**
 * Filtra el inventario para la tabla de "reponer":
 *   - Por bolsillo (Bar / Restaurante) según el área elegida
 *   - Y, si hay proveedor, por los productos vinculados a ese proveedor
 */
const filteredInventory = computed(() => {
  let list = inventoryStore.items.filter(i => (i.area || 'bar') === form.area)
  if (form.supplierId) list = list.filter(i => i.supplierId === form.supplierId)
  return list
})

/**
 * Auto-guarda el borrador en localStorage con debounce de 600ms.
 * Solo activo cuando el modal está abierto y NO estamos editando
 * (los borradores solo aplican a nuevas compras, no a ediciones).
 */
let draftTimer = null
watch(() => ({ ...form, items: form.items.map(i => ({ ...i })) }), (val) => {
  if (!showModal.value || isEditing.value) return
  clearTimeout(draftTimer)
  draftTimer = setTimeout(() => {
    if (val.items.length > 0) {
      localStorage.setItem(draftKey.value, JSON.stringify(val))
      hasDraft.value = true
    }
  }, 600)
}, { deep: true })

/** Formatea un número como moneda colombiana (ej: $12.500) */
function formatCOP(v) { return '$' + Number(v || 0).toLocaleString('es-CO') }

/** Formatea una fecha ISO a dd/mm/aaaa en zona horaria de Colombia */
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Retorna el nombre del proveedor por ID, o '-' si no existe */
function getSupplierName(id) { return suppliers.value.find(s => s.id === id)?.name || '-' }

/** Retorna el nombre del producto de inventario por ID, o el ID si no se encuentra */
function getProductName(inventoryId) { return inventoryStore.items.find(i => i.id === inventoryId)?.name || inventoryId }

/** Abre el modal de detalle de una compra ya registrada (solo lectura) */
function verDetalle(purchase) {
  selectedPurchase.value = purchase
  showDetail.value = true
}

/**
 * Abre el modal en modo "nueva compra".
 * Si existe un borrador guardado para este negocio, lo restaura en el formulario
 * y muestra un aviso al usuario. Si no hay borrador, limpia el formulario.
 */
function openNew() {
  editPurchaseId.value = null
  submitted.value = false
  // Valores por defecto: compra del Bar, pagada en efectivo, hoy
  Object.assign(form, { type: 'reponer', area: 'bar', paidWith: 'efectivo', date: todayStr(), supplierId: '', notes: '', items: [], amount: 0, description: '', employeeId: '', creditId: '' })
  const saved = localStorage.getItem(draftKey.value)
  if (saved) {
    try {
      const draft = JSON.parse(saved)
      Object.assign(form, {
        type: draft.type || 'reponer',
        area: draft.area || 'bar',
        supplierId: draft.supplierId || '',
        notes: draft.notes || '',
        amount: draft.amount || 0,
        description: draft.description || '',
        items: []
      })
      // splice para reemplazar reactivamente los ítems del borrador
      form.items.splice(0, form.items.length, ...(draft.items || []))
      hasDraft.value = true
      toast('Borrador restaurado', 'info')
    } catch { clearDraft() }
  } else {
    hasDraft.value = false
  }
  showModal.value = true
}

/**
 * Abre el modal en modo edición precargando los datos de una compra existente.
 * En modo edición el auto-guardado de borrador está desactivado.
 */
function openEdit(purchase) {
  editPurchaseId.value = purchase.id
  submitted.value = false
  Object.assign(form, {
    type: purchase.type || 'reponer',
    area: purchase.area || 'bar',
    paidWith: purchase.paidWith || 'efectivo',
    date: purchase.date ? purchase.date.slice(0, 10) : todayStr(),
    supplierId: purchase.supplierId || '',
    notes: purchase.notes || '',
    amount: purchase.total || 0,
    description: purchase.description || '',
    items: (purchase.items || []).map(i => ({ ...i })),  // Copia profunda para no mutar el objeto original
    employeeId: '', creditId: ''
  })
  showModal.value = true
}

/** Elimina el borrador del localStorage y actualiza el indicador en la UI */
function clearDraft() {
  localStorage.removeItem(draftKey.value)
  hasDraft.value = false
}

/**
 * Abre el panel de creación rápida de producto.
 * Pre-selecciona el proveedor del formulario principal si ya hay uno elegido,
 * para no tener que repetir la selección.
 */
function openQuickCreate() {
  quickCatNew.value = false
  Object.assign(quickForm, { name: '', category: allCategories.value[0] || 'bebidas', unit: 'unidad', minStock: 0, salePrice: 0, supplierId: form.supplierId || '' })
  showQuickCreate.value = true
}

/**
 * Crea un nuevo producto de inventario desde el panel rápido.
 * El stock inicial es 0 (se actualizará al guardar la compra).
 * Después de crear, refresca el inventario y agrega el nuevo producto
 * directamente como ítem en la tabla de la compra.
 */
async function saveQuickProduct() {
  if (!quickForm.name.trim()) { toast('El nombre es obligatorio', 'warning'); return }
  quickSaving.value = true
  try {
    const payload = {
      name: quickForm.name.trim(),
      category: quickForm.category || 'bebidas',
      unit: quickForm.unit || 'unidad',
      stock: 0,                          // El stock real se ingresa en la compra
      minStock: quickForm.minStock || 0,
      cost: 0,
      salePrice: quickForm.salePrice || 0,
      supplierId: quickForm.supplierId || form.supplierId || ''
    }
    const res = await api.post(`/api/${bizId.value}/inventory`, payload)
    await inventoryStore.fetchInventory()
    // Agregar el producto recién creado como ítem en la compra actual
    form.items.push({ inventoryId: res.data.id, quantity: 0, unitCost: 0 })
    showQuickCreate.value = false
    toast(`Producto "${res.data.name}" creado y agregado`, 'success')
  } catch (err) {
    toast(err.response?.data?.error || 'Error al crear producto', 'error')
  } finally {
    quickSaving.value = false
  }
}

/** Agrega una fila vacía en la tabla de ítems de la compra */
function addItem() { form.items.push({ inventoryId: '', quantity: 0, unitCost: 0 }) }

// ── Buscador de productos para agregar a la compra ──
const itemSearch = ref('')
const itemSearchResults = computed(() => {
  const q = itemSearch.value.trim().toLowerCase()
  if (!q) return []
  const used = new Set(form.items.map(i => i.inventoryId))
  return inventoryStore.items
    .filter(i => !used.has(i.id) && i.name.toLowerCase().includes(q))
    .slice(0, 12)
})
/** Agrega un producto a la compra (cantidad 1, costo precargado del inventario) */
function addItemById(inv) {
  if (!form.items.some(i => i.inventoryId === inv.id)) {
    form.items.push({ inventoryId: inv.id, quantity: 1, unitCost: inv.cost || 0 })
  }
  itemSearch.value = ''
}
/** Costo actual registrado del producto (para comparar con el nuevo) */
function costoAnterior(item) {
  const inv = inventoryStore.items.find(i => i.id === item.inventoryId)
  return inv ? (inv.cost || 0) : null
}
/** True si el costo ingresado difiere del costo registrado actual */
function costChanged(item) {
  const prev = costoAnterior(item)
  return prev !== null && Number(item.unitCost) > 0 && Number(item.unitCost) !== Number(prev)
}

/**
 * Al seleccionar un producto, autocompleta el costo unitario con el costo
 * registrado en el inventario. El usuario puede sobrescribirlo si el precio
 * cambió. Si el producto no tiene costo (es nuevo), deja unitCost en 0.
 */
function onProductChange(item) {
  if (!item.inventoryId) { item.unitCost = 0; return }
  const inv = inventoryStore.items.find(i => i.id === item.inventoryId)
  if (inv && inv.cost > 0) item.unitCost = inv.cost
}

/** Elimina una fila de la tabla de ítems por índice */
function removeItem(idx) { form.items.splice(idx, 1) }

/**
 * Valida el formulario antes de guardar la compra.
 * Activa `submitted` para que los campos inválidos muestren borde rojo.
 * Retorna true si todo es válido, false si hay algún error.
 */
function validate() {
  submitted.value = true
  // Gasto / arriendo: solo se valida el valor
  if (form.type === 'gasto' || form.type === 'arriendo') {
    if (!(Number(form.amount) > 0)) { toast('El valor debe ser mayor a 0', 'warning'); return false }
    return true
  }
  // Nómina: empleado + monto
  if (form.type === 'nomina') {
    if (!form.employeeId) { toast('Selecciona el empleado', 'warning'); return false }
    if (!(Number(form.amount) > 0)) { toast('El monto debe ser mayor a 0', 'warning'); return false }
    return true
  }
  // Crédito: crédito + monto
  if (form.type === 'credito') {
    if (!form.creditId) { toast('Selecciona el crédito', 'warning'); return false }
    if (!(Number(form.amount) > 0)) { toast('El monto debe ser mayor a 0', 'warning'); return false }
    return true
  }
  // Reponer (compra): se validan los ítems
  if (form.items.length === 0) { toast('Agrega al menos un producto', 'warning'); return false }
  if (form.items.some(i => !i.inventoryId)) { toast('Selecciona el producto en todas las filas', 'warning'); return false }
  if (form.items.some(i => !(i.quantity > 0))) { toast('La cantidad debe ser mayor a 0', 'warning'); return false }
  if (form.items.some(i => !(i.unitCost > 0))) { toast('El costo unitario debe ser mayor a 0', 'warning'); return false }
  return true
}

/**
 * Guarda la compra en el backend (nueva o editada).
 *
 * Nueva compra (isEditing = false):
 *   - POST /purchases → crea registro, actualiza stock, aumenta deuda del proveedor
 *   - Limpia el borrador del localStorage
 *
 * Edición (isEditing = true):
 *   - PUT /purchases/:id → revierte stock original, aplica nuevo, ajusta deuda del proveedor
 *   - Actualiza la entrada en la lista local sin recargar todo
 *
 * En ambos casos: refresca el inventario del store para reflejar los cambios de stock.
 */
async function savePurchase() {
  if (!validate()) return
  saving.value = true
  try {
    // ── Nómina / crédito: es un PAGO a una entidad del directorio ──
    if (form.type === 'nomina' || form.type === 'credito') {
      const targetId = form.type === 'nomina' ? form.employeeId : form.creditId
      await api.post(`/api/${bizId.value}/suppliers/${targetId}/payment`, {
        amount: Number(form.amount) || 0,
        paidWith: form.paidWith,
        area: form.area,
        date: form.date,
        notes: form.notes
      })
      await loadData()   // Refresca proveedores (saldos) y la lista de salidas
      toast(form.type === 'nomina' ? 'Pago de nómina registrado.' : 'Pago de crédito registrado.', 'success')
      closeModal()
      return
    }

    // ── Compra / gasto / arriendo: van al módulo de compras ──
    const payload = form.type === 'reponer'
      ? { type: 'reponer', area: form.area, paidWith: form.paidWith, date: form.date, supplierId: form.supplierId, notes: form.notes, items: form.items.map(i => ({ ...i })) }
      : { type: form.type, area: form.area, paidWith: form.paidWith, date: form.date, amount: Number(form.amount) || 0, description: form.description, notes: form.notes }

    let res
    if (isEditing.value) {
      res = await api.put(`/api/${bizId.value}/purchases/${editPurchaseId.value}`, payload)
      const idx = purchases.value.findIndex(p => p.id === editPurchaseId.value)
      if (idx !== -1) purchases.value[idx] = res.data
      toast('Salida actualizada. Inventario recalculado.', 'success')
    } else {
      res = await api.post(`/api/${bizId.value}/purchases`, payload)
      purchases.value.unshift(res.data)
      clearDraft()
      toast(form.type === 'reponer' ? 'Compra registrada. Inventario actualizado.' : 'Salida registrada.', 'success')
    }
    await inventoryStore.fetchInventory()
    closeModal()
  } catch (err) {
    toast(err.response?.data?.error || 'Error al guardar', 'error')
  } finally {
    saving.value = false
  }
}

/** Cierra el modal de compra y limpia todo el estado del formulario */
function closeModal() {
  showModal.value = false
  showQuickCreate.value = false
  submitted.value = false
  editPurchaseId.value = null
  itemSearch.value = ''
  Object.assign(form, { type: 'reponer', area: 'bar', paidWith: 'efectivo', date: todayStr(), supplierId: '', notes: '', items: [], amount: 0, description: '', employeeId: '', creditId: '' })
}

/**
 * Carga en paralelo las compras y los proveedores del negocio.
 * Las compras se invierten para mostrar las más recientes primero.
 */
async function loadData() {
  const [pRes, sRes] = await Promise.all([
    api.get(`/api/${bizId.value}/purchases`),
    api.get(`/api/${bizId.value}/suppliers`)
  ])
  purchases.value = pRes.data.reverse()
  suppliers.value = sRes.data
}

onMounted(async () => {
  await inventoryStore.fetchInventory()
  await loadData()
  // Verificar si hay borrador pendiente para mostrar el indicador en el header
  hasDraft.value = !!localStorage.getItem(draftKey.value)
})
</script>

<style scoped>
.detail-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  background: var(--bg);
  border-radius: 8px;
  padding: 14px;
}
.detail-meta-item { display: flex; flex-direction: column; gap: 2px; }
.meta-label { font-size: 11px; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.4px; }

.item-select-row { display: flex; gap: 8px; align-items: center; }
.item-select-row .form-control { flex: 1; }
.input-error { border-color: var(--danger) !important; background: #fff5f5; }
.draft-badge { font-size: 12px; color: var(--warning); font-weight: 600; }
.draft-indicator { font-size: 11px; color: var(--warning); margin-top: 2px; display: block; }
.btn-danger-outline { background: none; border: 1px solid var(--danger); color: var(--danger); padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; }
.btn-danger-outline:hover { background: #fde8e8; }
.action-btns { display: flex; gap: 6px; }

/* Overlay en modo dual: muestra ambos modales lado a lado */
.modal-dual {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 16px;
  padding: 40px 20px;
  overflow-y: auto;
}
.modal-dual .modal {
  position: static;
  transform: none;
  flex-shrink: 0;
  max-height: 90vh;
  overflow-y: auto;
}
.quick-panel {
  width: 340px;
  align-self: flex-start;
}
.purchase-items { margin-top: 20px; }

/* Buscador de productos para agregar a la compra */
.item-search-box { position: relative; margin-bottom: 12px; }
.item-search-results {
  margin-top: 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
  max-height: 240px;
  overflow-y: auto;
  background: var(--surface);
}
.item-search-opt {
  display: flex; flex-direction: column; gap: 2px;
  width: 100%; text-align: left;
  padding: 9px 12px; border: none; background: none; cursor: pointer;
  border-bottom: 1px solid var(--border);
}
.item-search-opt:last-child { border-bottom: none; }
.item-search-opt:hover { background: var(--surface-2); }
.opt-name { font-size: 13.5px; font-weight: 600; color: var(--text); }
.opt-meta { font-size: 11.5px; color: var(--text-light); }
.item-search-empty { padding: 12px; font-size: 13px; color: var(--text-light); }
.link-btn { background: none; border: none; color: var(--accent); cursor: pointer; font-weight: 600; padding: 0; text-decoration: underline; }
.cost-hint { display: block; font-size: 11px; font-weight: 700; margin-top: 2px; }
.cost-hint.up { color: var(--danger); }
.cost-hint.down { color: var(--success); }
.items-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
}
.items-table td { padding: 6px 8px; vertical-align: middle; }
.items-table .form-control { padding: 6px 8px; font-size: 13px; }
.subtotal-cell { font-weight: 700; color: var(--success); white-space: nowrap; }
.purchase-total { text-align: right; font-size: 16px; font-weight: 700; padding-top: 12px; color: var(--success); }
.currency { color: var(--success); font-weight: 700; }

/* Selector de tipo de salida y bolsillo */
.type-picker { display: flex; gap: 10px; }
.type-opt {
  flex: 1;
  padding: 12px;
  border-radius: 10px;
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  line-height: 1.3;
}
.type-opt small { font-weight: 500; font-size: 11px; color: var(--text-light); }
.type-opt.active { border-color: var(--accent); background: var(--accent-light); }
.type-opt.area-bar.active { border-color: #f59e0b; background: #fffbeb; color: #b45309; }
.type-opt.area-rest.active { border-color: #10b981; background: #ecfdf5; color: #047857; }
.type-opt.area-bar.active small, .type-opt.area-rest.active small { color: inherit; }

/* Selector de tipo con varias opciones: se envuelven en varias filas */
.type-picker-wrap { flex-wrap: wrap; }
.type-picker-wrap .type-opt { flex: 1 1 30%; min-width: 120px; font-size: 13px; }

/* Botones de forma de pago */
.type-opt.pay-ef.active { border-color: #16a34a; background: #f0fdf4; color: #15803d; }
.type-opt.pay-bk.active { border-color: #2563eb; background: #eff6ff; color: #1d4ed8; }

/* Etiqueta de tipo en la lista de salidas */
.kind-tag { font-size: 12.5px; font-weight: 600; white-space: nowrap; }

.area-badge { font-size: 10px; font-weight: 700; margin-right: 4px; }
.area-badge.bar { background: #f59e0b22; color: #b45309; }
.area-badge.restaurante { background: #10b98122; color: #047857; }
.gasto-detail-total { margin-top: 16px; text-align: right; font-size: 16px; color: var(--success); }
</style>
