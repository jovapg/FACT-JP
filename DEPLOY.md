# Guía de despliegue — facJp en VPS

## Qué necesitas comprar / conseguir

### 1. VPS (servidor)
Cómpralo en cualquiera de estas opciones (todas aceptan tarjeta o PayPal):

| Proveedor | Plan mínimo | Costo aprox. | Link |
|-----------|-------------|--------------|------|
| **DigitalOcean** | Droplet Basic 1GB | $6 USD/mes | digitalocean.com |
| **Contabo** | VPS S | €4.50/mes | contabo.com |
| **Hostinger** | VPS KVM 1 | ~$5 USD/mes | hostinger.com |
| **Hetzner** | CX11 | €3.79/mes | hetzner.com |

**Configuración al crear el VPS:**
- Sistema operativo: **Ubuntu 22.04 LTS** (es la opción más común)
- RAM: mínimo 1 GB
- Guarda bien la **IP pública** que te asignen (ej: `45.67.89.10`)

### 2. Dominio (opcional, para después)
No es necesario para arrancar. Con la IP sola ya funciona.
Cuando quieras un dominio (ej: `facjp.com`):
- Namecheap, GoDaddy, o Porkbun (~$10-15 USD/año)
- Después puedes agregar SSL gratis con Let's Encrypt

---

## Pasos de instalación en el VPS

### PASO 1 — Conectarte al servidor
Desde tu computador Windows, abre PowerShell o CMD:
```bash
ssh root@TU_IP_DEL_VPS
```
Te pedirá la contraseña que te enviaron por email al crear el VPS.

---

### PASO 2 — Instalar Node.js 18
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
node -v    # debe mostrar v18.x.x
```

---

### PASO 3 — Instalar PM2 (mantenedor de procesos)
```bash
npm install -g pm2
```

---

### PASO 4 — Subir el código al VPS

**Opción A — Con Git (recomendado):**
```bash
# En el VPS:
cd /root
git clone https://github.com/TU_USUARIO/TU_REPO.git facjp
```

**Opción B — Subir carpeta directamente (sin Git):**
Desde tu computador, en PowerShell:
```powershell
scp -r C:\Users\jovposga\facJp root@TU_IP_DEL_VPS:/root/facjp
```

---

### PASO 5 — Instalar dependencias
```bash
cd /root/facjp/api
npm install --omit=dev
```

---

### PASO 6 — Build del frontend
```bash
# En tu computador Windows (no en el VPS):
cd C:\Users\jovposga\facJp\frontend
npm run build
```
Luego sube la carpeta `dist/` al VPS:
```powershell
scp -r C:\Users\jovposga\facJp\frontend\dist root@TU_IP_DEL_VPS:/root/facjp/frontend/
```

---

### PASO 7 — Configurar variables de entorno en el VPS
```bash
# En el VPS, crear el archivo .env:
nano /root/facjp/api/.env
```
Contenido del archivo (reemplaza los valores):
```
NODE_ENV=production
PORT=3001
JWT_SECRET=pega_aqui_la_clave_que_generaste
DATA_PATH=/root/facjp/api/src/data
FRONTEND_URL=http://TU_IP_DEL_VPS:3001
```

**Generar JWT_SECRET seguro** (ejecuta esto en el VPS y copia el resultado):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Guarda con `Ctrl+O`, sale con `Ctrl+X`.

---

### PASO 8 — Abrir el puerto en el firewall
```bash
ufw allow 3001
ufw allow 22      # SSH — no lo cierres o perderás acceso
ufw enable
```

---

### PASO 9 — Arrancar con PM2
```bash
cd /root/facjp
pm2 start ecosystem.config.js --env production
pm2 save           # guarda para auto-arrancar
pm2 startup        # copia y ejecuta el comando que te muestre
```

---

### PASO 10 — Verificar que funciona
```bash
pm2 status         # debe mostrar "online"
pm2 logs           # muestra los logs en tiempo real
```

Abre en el navegador: `http://TU_IP_DEL_VPS:3001`

Usuario: `superadmin`  
Contraseña: `Admin2026!`  
**¡Cámbiala inmediatamente después del primer login!**

---

## Comandos útiles de PM2

```bash
pm2 status             # ver si está corriendo
pm2 logs facjp-api     # ver logs en vivo
pm2 restart facjp-api  # reiniciar (ej: después de actualizar)
pm2 stop facjp-api     # parar
```

## Actualizar el código

```bash
cd /root/facjp
git pull               # descarga cambios nuevos
cd api
npm install --omit=dev # por si hay dependencias nuevas
pm2 restart facjp-api
```

Si cambias el frontend, también hay que:
1. Hacer `npm run build` en tu computador
2. Subir el `dist/` nuevo al VPS
3. `pm2 restart facjp-api`

---

## SSL / HTTPS (opcional, para después)

Cuando tengas dominio apuntando al VPS:
```bash
apt install certbot
certbot certonly --standalone -d tudominio.com
```
Luego configura Nginx para redirigir HTTPS.
