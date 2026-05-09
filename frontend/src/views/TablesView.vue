<template>
  <PageLayout title="Mesas - POS">

        <!-- Banner turno activo / sin turno -->
        <router-link
          v-if="shiftsStore.currentShift"
          to="/shifts"
          class="shift-banner shift-banner-open"
        >
          <span class="shift-dot"></span>
          <span>
            Turno abierto · <strong>{{ shiftsStore.currentShift.cashierName }}</strong>
            · Ventas efectivo: <strong>{{ formatCOP(shiftsStore.currentShift.totalCashSales) }}</strong>
          </span>
          <span class="shift-banner-link">Ver turno →</span>
        </router-link>

        <router-link v-else to="/shifts" class="shift-banner shift-banner-warn">
          <span>⚠️ Sin turno abierto — las ventas no quedarán registradas en ningún turno.</span>
          <span class="shift-banner-link">Abrir turno →</span>
        </router-link>

        <!-- Table filter bar -->
        <div class="tables-toolbar">
          <div class="status-pills">
            <button
              v-for="f in filters"
              :key="f.value"
              :class="['pill', { active: activeFilter === f.value }]"
              @click="activeFilter = f.value"
            >
              {{ f.label }} ({{ f.count }})
            </button>
          </div>
          <div class="toolbar-right">
            <button class="btn btn-outline btn-sm" @click="tablesStore.fetchTables()">↻</button>
          </div>
        </div>

        <div v-if="tablesStore.loading" class="loading">
          <div class="spinner"></div> Cargando mesas...
        </div>

        <div v-else-if="filteredTables.length === 0" class="empty-state">
          <div class="empty-state-icon">🪑</div>
          <p class="empty-state-text">No hay mesas configuradas</p>
          <button v-if="auth.isAdmin" class="btn btn-primary mt-2" @click="showInitModal = true">
            Configurar mesas
          </button>
        </div>

        <div v-else class="tables-grid">
          <TableCard
            v-for="table in filteredTables"
            :key="table.id"
            :table="table"
            @click="openTable(table)"
          />
        </div>

        <!-- Init tables modal -->
        <div class="modal-overlay" v-if="showInitModal" @click.self="showInitModal = false">
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title">Configurar mesas</h3>
              <button class="btn-close" @click="showInitModal = false">×</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Número de mesas</label>
                <input v-model.number="initCount" type="number" class="form-control" min="1" max="100" />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="showInitModal = false">Cancelar</button>
              <button class="btn btn-primary" @click="initTables">Crear mesas</button>
            </div>
          </div>
        </div>

        <!-- Order panel -->
        <transition name="slide-right">
          <div class="order-panel-overlay" v-if="tablesStore.selectedTable" @click.self="closePanel">
            <div class="order-panel">
              <OrderCart
                :table="tablesStore.selectedTable"
                @close="closePanel"
                @saved="handleOrderSaved"
                @sale-confirmed="handleSaleConfirmed"
              />
            </div>
          </div>
        </transition>

  </PageLayout>
</template>

<script setup>
/**
 * TablesView.vue — Vista de Mesas / Punto de Venta (POS)
 *
 * Es la vista principal de operación del negocio. Muestra la cuadrícula
 * de mesas con su estado (libre / ocupada) y al hacer clic en una mesa
 * abre el panel lateral OrderCart para gestionar su pedido.
 *
 * Funcionalidades:
 *   - Filtro de mesas: todas / libres / ocupadas
 *   - Tarjeta por mesa con estado visual, total del pedido, cliente y hora
 *   - Panel OrderCart deslizante para agregar/quitar ítems del menú
 *   - Al confirmar la venta: se genera la factura y se libera la mesa
 *
 * Flujo de uso:
 *   1. Clic en mesa → se selecciona y se abre OrderCart
 *   2. Agregar ítems del menú al pedido
 *   3. (Opcional) Escribir nombre del cliente
 *   4. "Guardar orden" → guarda el pedido sin facturar
 *   5. "Ver factura" → abre InvoicePreview para confirmar y facturar
 */
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useTablesStore } from '../stores/tables.js'
import { useInventoryStore } from '../stores/inventory.js'
import { useShiftsStore } from '../stores/shifts.js'
import PageLayout from '../components/PageLayout.vue'
import TableCard from '../components/TableCard.vue'
import OrderCart from '../components/OrderCart.vue'

const auth = useAuthStore()
const tablesStore = useTablesStore()
const inventoryStore = useInventoryStore()
const shiftsStore = useShiftsStore()

const activeFilter = ref('all')
const showInitModal = ref(false)
const initCount = ref(10)

const filters = computed(() => [
  { value: 'all', label: 'Todas', count: tablesStore.tables.length },
  { value: 'libre', label: 'Libres', count: tablesStore.freeCount },
  { value: 'ocupada', label: 'Ocupadas', count: tablesStore.occupiedCount }
])

const filteredTables = computed(() => {
  if (activeFilter.value === 'all') return tablesStore.tables
  return tablesStore.tables.filter(t => t.status === activeFilter.value)
})

function openTable(table) {
  tablesStore.selectTable(table)
  inventoryStore.fetchRecipes()
}

function closePanel() {
  tablesStore.clearSelection()
}

async function handleOrderSaved() {
  await tablesStore.fetchTables()
}

async function handleSaleConfirmed() {
  await tablesStore.fetchTables()
  tablesStore.clearSelection()
}

async function initTables() {
  await tablesStore.initTables(initCount.value)
  showInitModal.value = false
}

/** Formatea número como moneda COP */
function formatCOP(v) { return '$' + Number(v || 0).toLocaleString('es-CO') }

onMounted(async () => {
  await Promise.all([
    tablesStore.fetchTables(),
    shiftsStore.fetchCurrentShift()
  ])
})
</script>

<style scoped>
/* Banner de turno de caja */
.shift-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  margin-bottom: 16px;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: opacity 0.18s;
}
.shift-banner:hover { opacity: 0.88; }
.shift-banner-open {
  background: var(--primary);
  color: rgba(255,255,255,0.85);
  border: 1px solid rgba(255,255,255,0.1);
}
.shift-banner-warn {
  background: var(--warning-light);
  color: #92400e;
  border: 1.5px solid #fcd34d;
}
.shift-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 0 3px rgba(74,222,128,0.25);
  flex-shrink: 0;
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%,100% { box-shadow: 0 0 0 3px rgba(74,222,128,0.25); }
  50%      { box-shadow: 0 0 0 6px rgba(74,222,128,0.1); }
}
.shift-banner-link {
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  opacity: 0.7;
}

.tables-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}

.status-pills { display: flex; gap: 8px; flex-wrap: wrap; }
.pill {
  padding: 6px 16px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  /* Elimina el retraso de 300ms y asegura objetivo táctil cómodo */
  touch-action: manipulation;
  min-height: 36px;
}
.pill.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.tables-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}

.mt-2 { margin-top: 12px; }

.order-panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 500;
  display: flex;
  justify-content: flex-end;
}

.order-panel {
  width: 100%;
  max-width: 560px;
  height: 100%;
  overflow-y: auto;
  background: var(--surface);
  box-shadow: -4px 0 20px rgba(0,0,0,0.15);
}

.slide-right-enter-active, .slide-right-leave-active { transition: all 0.3s; }
.slide-right-enter-from .order-panel, .slide-right-leave-to .order-panel {
  transform: translateX(100%);
}

@media (max-width: 768px) {
  .tables-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; }

  /* El panel de pedidos ocupa toda la pantalla en móvil */
  .order-panel { max-width: 100%; }

  /* El banner de turno apila el texto y el enlace en pantallas angostas */
  .shift-banner { flex-wrap: wrap; gap: 6px; }
  .shift-banner-link { margin-left: auto; }

  /* Pills de filtro con objetivo táctil adecuado */
  .pill { min-height: 40px; padding: 8px 16px; }
}

@media (max-width: 480px) {
  /* Mesas más compactas en celular para mostrar más en pantalla */
  .tables-grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; }
}
</style>
