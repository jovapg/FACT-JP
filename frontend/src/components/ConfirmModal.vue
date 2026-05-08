<template>
  <!--
    ConfirmModal.vue — Modal de confirmación reutilizable para acciones destructivas

    Reemplaza el alert/confirm nativo del navegador (el cuadro feo del sistema)
    por un modal propio, coherente con el diseño de la app.

    Se usa con Teleport para montarse directamente en <body>,
    evitando problemas de z-index cuando se llama desde dentro de tablas o modales.

    Uso:
      <ConfirmModal
        :visible="mostrar"
        title="Eliminar producto"
        :message="`¿Eliminar &quot;${item.name}&quot;?`"
        confirmText="Sí, eliminar"
        type="danger"
        @confirm="hacer()"
        @cancel="mostrar = false"
      />

    Props:
      visible:     boolean   — controla si el modal está abierto
      title:       string    — título del modal
      message:     string    — mensaje de confirmación
      confirmText: string    — texto del botón de confirmar
      type:        string    — 'danger' | 'warning' | 'info' (afecta color del ícono)
  -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="visible"
        class="confirm-overlay"
        @click.self="$emit('cancel')"
        role="dialog"
        aria-modal="true"
      >
        <div class="confirm-box">

          <!-- Ícono visual según el tipo de acción -->
          <div class="confirm-icon" :class="type">
            <span class="confirm-icon-emoji">{{ iconEmoji }}</span>
          </div>

          <h3 class="confirm-title">{{ title }}</h3>
          <p class="confirm-message">{{ message }}</p>

          <div class="confirm-actions">
            <button class="btn btn-outline" @click="$emit('cancel')">Cancelar</button>
            <button
              :class="['btn', type === 'danger' ? 'btn-danger' : type === 'warning' ? 'btn-warning' : 'btn-primary']"
              @click="$emit('confirm')"
            >
              {{ confirmText }}
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible:     { type: Boolean, default: false },
  title:       { type: String,  default: '¿Confirmar acción?' },
  message:     { type: String,  default: '¿Estás seguro de que deseas continuar? Esta acción no se puede deshacer.' },
  confirmText: { type: String,  default: 'Confirmar' },
  type:        { type: String,  default: 'danger' }   // 'danger' | 'warning' | 'info'
})

defineEmits(['confirm', 'cancel'])

/** Ícono emoji según el tipo de confirmación */
const iconEmoji = computed(() => ({
  danger:  '🗑️',
  warning: '⚠️',
  info:    'ℹ️'
}[props.type] || '❓'))
</script>

<style scoped>
/* Fondo semitransparente con blur */
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

/* Caja del modal */
.confirm-box {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  max-width: 380px;
  width: 100%;
  padding: 36px 32px 28px;
  text-align: center;
  animation: confirmIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Entrada con rebote suave */
@keyframes confirmIn {
  from { opacity: 0; transform: scale(0.85) translateY(16px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

/* Ícono de tipo */
.confirm-icon {
  width: 68px;
  height: 68px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  font-size: 30px;
}
.confirm-icon.danger  { background: var(--danger-light); }
.confirm-icon.warning { background: var(--warning-light); }
.confirm-icon.info    { background: var(--info-light); }

.confirm-title {
  font-size: 19px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 10px;
  letter-spacing: -0.02em;
}

.confirm-message {
  font-size: 13.5px;
  color: var(--text-secondary);
  line-height: 1.65;
  margin-bottom: 28px;
}

.confirm-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}
.confirm-actions .btn {
  min-width: 110px;
}

/* Botón warning (sin clase btn-warning en main.css, lo definimos aquí) */
.btn-warning {
  background: var(--warning);
  color: #1a0a00;
  border: none;
  font-weight: 700;
}
.btn-warning:hover {
  background: #d97706;
}

/* Transición de entrada/salida del overlay */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.22s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
