<template>
  <div class="login-page">
    <!-- Panel izquierdo: branding -->
    <div class="login-brand">
      <div class="brand-content">
        <div class="brand-logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="14" fill="#f59e0b"/>
            <path d="M14 34V18a2 2 0 012-2h4v-2a2 2 0 012-2h4a2 2 0 012 2v2h4a2 2 0 012 2v16" stroke="#1a0a00" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M18 34v-8h12v8" stroke="#1a0a00" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M21 26h6" stroke="#1a0a00" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span class="brand-name">facJp</span>
        </div>
        <h1 class="brand-headline">Gestión inteligente para tu negocio</h1>
        <p class="brand-desc">Inventario, ventas, proveedores y reportes en un solo lugar. Diseñado para bares y restaurantes.</p>

        <div class="brand-features">
          <div class="feature-item">
            <span class="feature-dot"></span>
            <span>Registro de ventas por mesa en segundos</span>
          </div>
          <div class="feature-item">
            <span class="feature-dot"></span>
            <span>Control de inventario y stock mínimo</span>
          </div>
          <div class="feature-item">
            <span class="feature-dot"></span>
            <span>Reportes de rentabilidad en tiempo real</span>
          </div>
          <div class="feature-item">
            <span class="feature-dot"></span>
            <span>Facturas electrónicas con un clic</span>
          </div>
        </div>
      </div>

      <!-- Decoración de fondo -->
      <div class="brand-deco deco-1"></div>
      <div class="brand-deco deco-2"></div>
    </div>

    <!-- Panel derecho: formulario -->
    <div class="login-form-panel">
      <div class="login-form-wrap">
        <div class="form-header">
          <h2 class="form-title">Bienvenido de nuevo</h2>
          <p class="form-sub">Ingresa tus credenciales para continuar</p>
        </div>

        <form @submit.prevent="handleLogin" class="login-form" autocomplete="on">
          <div class="alert alert-danger" v-if="error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {{ error }}
          </div>

          <div class="form-group">
            <label class="form-label">Usuario</label>
            <div class="input-icon-wrap">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <input
                v-model="form.username"
                type="text"
                class="form-control has-icon"
                placeholder="Tu usuario"
                autocomplete="username"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Contraseña</label>
            <div class="input-icon-wrap">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              <input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                class="form-control has-icon has-addon"
                placeholder="Tu contraseña"
                autocomplete="current-password"
                required
              />
              <button type="button" class="input-eye" @click="showPassword = !showPassword" tabindex="-1">
                <svg v-if="!showPassword" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              </button>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-block btn-login" :disabled="loading">
            <span v-if="loading" class="spinner" style="width:16px;height:16px;border-width:2px;flex-shrink:0"></span>
            <span>{{ loading ? 'Ingresando...' : 'Ingresar' }}</span>
          </button>
        </form>

        <p class="login-footer">facJp © {{ new Date().getFullYear() }} — Sistema de gestión</p>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * LoginView.vue — Pantalla de inicio de sesión (diseño split-screen)
 *
 * Panel izquierdo: branding del producto con características clave.
 * Panel derecho: formulario de usuario/contraseña.
 *
 * Después del login exitoso:
 *   - Múltiples negocios → selector de negocio
 *   - Un negocio (o pre-seleccionado) → dashboard directo
 */
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({ username: '', password: '' })
const loading = ref(false)
const error = ref('')
const showPassword = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    const data = await auth.login(form.username, form.password)
    if (data.businesses?.length > 1 && !data.currentBusiness) {
      router.push('/select-business')
    } else {
      router.push('/dashboard')
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Usuario o contraseña incorrectos'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
}

/* ── Panel izquierdo: branding ── */
.login-brand {
  flex: 1;
  background: var(--primary);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
}

.brand-content {
  position: relative;
  z-index: 1;
  max-width: 420px;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 40px;
}
.brand-name {
  font-size: 28px;
  font-weight: 900;
  color: white;
  letter-spacing: -0.04em;
}

.brand-headline {
  font-size: 28px;
  font-weight: 800;
  color: white;
  line-height: 1.25;
  letter-spacing: -0.03em;
  margin-bottom: 14px;
}

.brand-desc {
  font-size: 15px;
  color: rgba(255,255,255,0.6);
  line-height: 1.6;
  margin-bottom: 36px;
}

.brand-features {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: rgba(255,255,255,0.8);
  font-weight: 500;
}
.feature-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

/* Círculos decorativos de fondo */
.brand-deco {
  position: absolute;
  border-radius: 50%;
  opacity: 0.06;
  background: white;
}
.deco-1 { width: 500px; height: 500px; bottom: -180px; right: -160px; }
.deco-2 { width: 300px; height: 300px; top: -80px;   left: -100px; }

/* ── Panel derecho: formulario ── */
.login-form-panel {
  width: 480px;
  flex-shrink: 0;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 40px;
}

.login-form-wrap {
  width: 100%;
  max-width: 360px;
}

.form-header { margin-bottom: 32px; }
.form-title {
  font-size: 24px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.03em;
  margin-bottom: 6px;
}
.form-sub { font-size: 14px; color: var(--text-light); }

/* Input con ícono SVG */
.input-icon-wrap {
  position: relative;
}
.input-icon {
  position: absolute;
  left: 13px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-light);
  pointer-events: none;
}
.form-control.has-icon { padding-left: 40px; }
.form-control.has-addon { padding-right: 40px; }

.input-eye {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-light);
  padding: 4px;
  display: flex;
  align-items: center;
  border-radius: 4px;
}
.input-eye:hover { color: var(--text); }

.btn-login {
  height: 48px;
  font-size: 15px;
  margin-top: 8px;
  border-radius: var(--radius-sm);
  letter-spacing: -0.01em;
}

.login-footer {
  text-align: center;
  font-size: 12px;
  color: var(--text-light);
  margin-top: 32px;
}

/* ── Responsive: en móvil solo panel formulario ── */
@media (max-width: 768px) {
  .login-brand { display: none; }
  .login-form-panel {
    width: 100%;
    padding: 32px 24px;
    background: var(--primary);
  }
  .login-form-wrap {
    max-width: 100%;
  }
  .form-title, .form-sub { color: white; }
  .form-sub { color: rgba(255,255,255,0.6); }
  .login-footer { color: rgba(255,255,255,0.4); }
  .form-control { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.15); color: white; }
  .form-control::placeholder { color: rgba(255,255,255,0.4); }
  .form-control:focus { border-color: var(--accent); background: rgba(255,255,255,0.12); }
  .form-label { color: rgba(255,255,255,0.7); }
  .input-icon { color: rgba(255,255,255,0.4); }
  .input-eye { color: rgba(255,255,255,0.4); }
}
</style>
