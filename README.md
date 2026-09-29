# 🍽️ facJp — Sistema de gestión para bares y restaurantes

![Vue](https://img.shields.io/badge/Vue_3-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white)
![Pinia](https://img.shields.io/badge/Pinia-FFD859?style=for-the-badge&logo=pinia&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)

Aplicación web **full stack** para administrar la operación diaria de bares y restaurantes: ventas por mesa, facturación, inventario, recetas, nómina, cartera y reportes financieros. Soporta **múltiples negocios y franquicias** desde una sola instalación y funciona como **PWA** instalable en celular o tablet.

🌐 **Demo en vivo:** [fact-jp-production.up.railway.app](https://fact-jp-production.up.railway.app)

> 📸 *Agrega aquí 2 o 3 capturas: dashboard, mesas y facturación.*
<img width="959" height="519" alt="FACT-JP  mesas" src="https://github.com/user-attachments/assets/18f351bc-8245-4d2a-9027-b0e283a1011c" />
<img width="958" height="512" alt="fac-jp dashboard" src="https://github.com/user-attachments/assets/b0ec3326-222a-466c-8a64-ce672413ac2d" />
<img width="955" height="518" alt="FACT-JP finanzas" src="https://github.com/user-attachments/assets/16feb314-113b-48ae-b602-ab34b3b2fc99" />

---

## ✨ Funcionalidades

| Módulo | Qué hace |
|---|---|
| **Mesas y pedidos** | Toma de pedidos por mesa con carrito, cierre de cuenta y pago |
| **Facturación** | Emisión de facturas con vista previa y descarga en PDF |
| **Inventario** | Control de stock, ajustes, imágenes de producto y descuento automático por venta |
| **Recetas** | Costeo de platos a partir de ingredientes del inventario |
| **Compras y proveedores** | Registro de compras y directorio de proveedores |
| **Cartera (deudores)** | Cargos, abonos e historial por cliente |
| **Nómina y turnos** | Liquidación de pagos al personal y apertura/cierre de turnos |
| **Finanzas** | Movimientos diarios, ingresos y egresos manuales |
| **Reportes** | Cierre de caja, ventas, rentabilidad y exportación a Excel |
| **Auditoría** | Registro de acciones de los usuarios |
| **Multi-negocio** | Gestión de varios negocios y franquicias con roles (incluye superadmin) |

## 🔐 Seguridad

- Autenticación con **JWT** y contraseñas cifradas con **bcrypt**
- Cabeceras de seguridad con **Helmet** y límite de peticiones (**rate limiting**)
- Aislamiento de datos por negocio mediante middleware de contexto

## 🏗️ Arquitectura

```
FACT-JP/
├── api/          # API REST — Node.js + Express
│   └── src/
│       ├── routes/       # Endpoints por módulo
│       ├── middleware/   # Autenticación y contexto de negocio
│       └── services/     # PDF, Excel, inventario, auditoría, almacenamiento
└── frontend/     # SPA — Vue 3 + Pinia + Vue Router + Chart.js (PWA)
```

## 🚀 Instalación local

```bash
# Backend
cd api
npm install
npm run dev

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

Crea un archivo `.env` en `api/` con tus variables (por ejemplo `JWT_SECRET` y `PORT`).

## ☁️ Despliegue

Preparado para **Railway** (`railway.json`, `nixpacks.toml`) y para **VPS** con PM2 (`ecosystem.config.js`). Guía paso a paso en [`DEPLOY.md`](DEPLOY.md).

---

👤 Desarrollado por **Jovany Posada** · [GitHub](https://github.com/jovapg)
