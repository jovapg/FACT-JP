# facJp - Sistema de Gestión Bar/Restaurante

Sistema completo de gestión para bares y restaurantes con soporte multi-franquicia.

## Características

- **Multi-franquicia**: Gestiona múltiples negocios desde una sola instalación
- **POS táctil**: Sistema de punto de venta optimizado para dispositivos móviles
- **Mesas**: Gestión visual de mesas con estados en tiempo real
- **Inventario**: Control de stock con alertas de stock bajo
- **Recetas**: Vinculación de platos a ingredientes para deducción automática
- **Compras**: Registro de compras que actualiza automáticamente el inventario
- **Proveedores**: Gestión de proveedores y seguimiento de deudas
- **Reportes**: Ventas por período con exportación a Excel
- **Facturas**: Generación de PDF al colombiana (IVA incluido)
- **PWA**: Funciona offline como aplicación instalable
- **Roles**: superadmin, admin, cajero

## Requisitos

- Node.js 18+
- npm 8+

## Instalación

### 1. Configurar la API

```bash
cd api
npm install
cp .env.example .env
# Editar .env con tus valores
```

### 2. Configurar el Frontend

```bash
cd frontend
npm install
```

### 3. Iniciar en desarrollo

**Terminal 1 - API:**
```bash
cd api
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Abrir: http://localhost:5173

## Credenciales iniciales

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| superadmin | Admin2026! | Super Administrador |

## Variables de entorno (api/.env)

```env
PORT=3000
JWT_SECRET=cambia-esto-en-produccion
DATA_PATH=./src/data
FRONTEND_URL=http://localhost:5173
```

## Estructura de datos

Los datos se almacenan como archivos JSON en `api/src/data/`:

```
api/src/data/
  superadmin.json          # Credenciales del superadmin
  businesses.json          # Lista de franquicias
  {businessId}/
    profile.json           # Perfil del negocio
    users.json             # Usuarios del negocio
    inventory.json         # Inventario
    recipes.json           # Recetas/Menú
    tables.json            # Estado de mesas
    sales.json             # Historial de ventas
    purchases.json         # Compras registradas
    suppliers.json         # Proveedores
```

## Flujo de uso

1. **Login** con superadmin
2. **Crear franquicia** en `/admin/franchises`
3. **Configurar perfil** del negocio en `/admin/setup`
4. **Agregar inventario** en `/inventory`
5. **Crear recetas** (menú) en `/recipes`, vinculando ingredientes
6. **Crear usuarios** (admin/cajero) en `/admin/setup` > Usuarios
7. **Iniciar turno**: ir a `/tables` y gestionar órdenes
8. **POS**: seleccionar mesa → agregar items → previsualizar factura → confirmar
9. **Reportes**: ver ventas y exportar Excel en `/reports`

## Rutas de la API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/auth/login | Iniciar sesión |
| GET | /api/businesses | Listar franquicias |
| POST | /api/businesses | Crear franquicia |
| GET | /api/:id/inventory | Listar inventario |
| POST | /api/:id/inventory | Crear producto |
| GET | /api/:id/recipes | Listar recetas |
| POST | /api/:id/recipes | Crear receta |
| GET | /api/:id/tables | Estado de mesas |
| POST | /api/:id/sales | Confirmar venta |
| GET | /api/:id/reports/sales | Reporte de ventas |
| GET | /api/:id/reports/export/excel | Exportar Excel |
| GET | /api/:id/invoices/:id/pdf | Descargar PDF |

## Producción

```bash
# Build frontend
cd frontend && npm run build

# La carpeta dist/ puede servirse con nginx o similar
# Configurar proxy de /api a http://localhost:3000
```

## Tecnologías

- **Backend**: Node.js + Express + JWT + bcryptjs
- **Frontend**: Vue 3 + Vite + Pinia + Vue Router
- **PDF**: PDFKit
- **Excel**: ExcelJS
- **PWA**: vite-plugin-pwa
- **Storage**: JSON files
