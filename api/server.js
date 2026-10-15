require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Advertencia si no hay JWT_SECRET configurado
if (!process.env.JWT_SECRET) {
  console.warn('[ADVERTENCIA] JWT_SECRET no está configurado. Usando clave por defecto — cámbiala en producción.');
}

// Directorio de datos: variable de entorno → volumen Railway → ruta local
const dataPath = process.env.DATA_PATH ||
  (fs.existsSync('/storage') ? '/storage' : './src/data');
if (!fs.existsSync(dataPath)) {
  fs.mkdirSync(dataPath, { recursive: true });
}
console.log(`[DATA] Ruta de datos: ${path.resolve(dataPath)}`);

/**
 * Migración única (pedido del dueño): poner el stock mínimo en 0 a TODOS los
 * productos de cada negocio. Se ejecuta al arrancar el servidor y se marca en
 * profile.minStockZeroed para no repetirse (así el dueño puede volver a fijar
 * mínimos después si quiere, sin que se reseteen en cada despliegue).
 */
(async () => {
  try {
    const { readJSON, writeJSON, getBusinessPath, getDataPath } = require('./src/services/fileStorage');
    const businesses = await readJSON(path.join(getDataPath(), 'businesses.json')) || [];
    for (const b of businesses) {
      const profilePath = path.join(getBusinessPath(b.id), 'profile.json');
      const profile = await readJSON(profilePath) || {};
      if (profile.minStockZeroed) continue; // ya migrado
      const invPath = path.join(getBusinessPath(b.id), 'inventory.json');
      const inventory = await readJSON(invPath);
      if (Array.isArray(inventory)) {
        for (const it of inventory) it.minStock = 0;
        await writeJSON(invPath, inventory);
      }
      profile.minStockZeroed = true;
      await writeJSON(profilePath, profile);
      console.log(`[migración] stock mínimo = 0 aplicado a ${b.id} (${Array.isArray(inventory) ? inventory.length : 0} productos)`);
    }
  } catch (e) {
    console.error('[migración minStock] error:', e);
  }
})();

// Subidas de imágenes: solo estos tipos, y la extensión se decide por el tipo MIME
// (no por el nombre del archivo). Así un SVG/HTML disfrazado de imagen no puede
// guardarse con una extensión que el navegador ejecute.
const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const imageFileFilter = (req, file, cb) => {
  if (IMAGE_TYPES[file.mimetype]) cb(null, true);
  else cb(new Error('Solo se permiten imágenes JPG, PNG, WEBP o GIF'));
};
const safeExt = (file) => IMAGE_TYPES[file.mimetype] || '.png';
// Deja el id solo con letras, números y guiones (evita ../ en el nombre del archivo)
const safeId = (v) => String(v || '').replace(/[^a-zA-Z0-9-]/g, '');

// Multer: saves logo to data/<businessId>/logo.<ext>, one file at a time
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(path.resolve(dataPath), req.params.businessId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = safeExt(file);
    cb(null, `logo${ext}`);
  }
});
const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: imageFileFilter
});

// Multer: saves payment QR to data/<businessId>/payment-qr.<ext>
const paymentQrStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(path.resolve(dataPath), req.params.businessId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = safeExt(file);
    cb(null, `payment-qr${ext}`);
  }
});
const uploadPaymentQr = multer({
  storage: paymentQrStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter
});

// Multer: saves product images to data/<businessId>/inv_<id>.<ext>
const productImgStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(path.resolve(dataPath), req.params.businessId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = safeExt(file);
    cb(null, `inv_${safeId(req.params.businessId)}_${safeId(req.params.id)}${ext}`);
  }
});
const uploadProductImg = multer({
  storage: productImgStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFileFilter
});

// Helmet: cabeceras de seguridad HTTP (HSTS, XSS protection, no-sniff, etc.)
// crossOriginResourcePolicy: false para que las imágenes /uploads sean accesibles desde el frontend
app.use(helmet({ crossOriginResourcePolicy: false }));

// Railway y otros proxies pasan el IP real en X-Forwarded-For
// Sin esto, express-rate-limit lanza error y el login no funciona
app.set('trust proxy', 1);

// Rate limiting en login: máximo 10 intentos por IP cada 15 minutos
// Previene ataques de fuerza bruta a contraseñas
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10,
  message: { error: 'Demasiados intentos fallidos. Espera 5 minutos e intenta de nuevo.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth/login', loginLimiter);

// Middleware
// Permitido: sin origen (curl/Postman), el mismo sitio (la app se sirve desde este
// mismo servidor), localhost y redes locales (desarrollo) y FRONTEND_URL.
// Ya NO se acepta cualquier subdominio .railway.app (cualquiera puede crear uno).
app.use(cors((req, callback) => {
  const origin = req.headers.origin;
  const sameSite = origin && origin.replace(/^https?:\/\//, '') === req.headers.host;
  const allowed =
    !origin ||
    sameSite ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.') ||
    origin.startsWith('http://192.168.') ||
    origin.startsWith('http://10.') ||
    origin.startsWith('http://172.') ||
    origin === FRONTEND_URL;
  callback(allowed ? null : new Error('Not allowed by CORS'), { origin: allowed, credentials: true });
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// Servir archivos de la carpeta data/ como estáticos, PERO solo imágenes.
// Sin este filtro, cualquier persona podría descargar sales.json, users.json, etc.
// con solo abrir /uploads/<businessId>/sales.json en el navegador.
app.use('/uploads', (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  const tiposPermitidos = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico']; // sin .svg: un SVG puede ejecutar scripts
  if (tiposPermitidos.includes(ext)) return next();
  // Cualquier otro tipo de archivo (JSON, txt, etc.) → acceso denegado
  return res.status(403).end();
}, express.static(path.resolve(dataPath)));

// Routes
const authRoutes = require('./src/routes/auth');
const businessRoutes = require('./src/routes/businesses');
const inventoryRoutes = require('./src/routes/inventory');
const recipesRoutes = require('./src/routes/recipes');
const tablesRoutes = require('./src/routes/tables');
const salesRoutes = require('./src/routes/sales');
const purchasesRoutes = require('./src/routes/purchases');
const suppliersRoutes = require('./src/routes/suppliers');
const reportsRoutes = require('./src/routes/reports');
const invoicesRoutes = require('./src/routes/invoices');
const shiftsRoutes = require('./src/routes/shifts');
const debtorsRoutes = require('./src/routes/debtors');
const financeRoutes = require('./src/routes/finance');
const payrollRoutes = require('./src/routes/payroll');
const auditRoutes = require('./src/routes/audit');
const { router: shortlinksRouter, handleShortlink } = require('./src/routes/shortlinks');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/backups', require('./src/routes/backups'));   // respaldos (solo superadmin)

// Rutas de negocio: authenticate + requireBusinessAccess aplicados a nivel de mount.
// Esto garantiza que cualquier usuario no-superadmin solo pueda acceder a su propio negocio.
// Las rutas individuales también llaman a authenticate internamente (sin conflicto).
const { authenticate, requireBusinessAccess } = require('./src/middleware/auth');
const bizAccess = [authenticate, requireBusinessAccess];

// Módulos que el superadmin puede apagar por negocio (Franquicias). Un módulo apagado
// responde 403 aunque alguien escriba la ruta a mano. (Reportes solo se oculta en la
// pantalla: el Dashboard usa sus datos.)
function moduleGuard(key) {
  return async (req, res, next) => {
    try {
      const { readJSON: rj, getBusinessPath: gp } = require('./src/services/fileStorage');
      const profile = await rj(path.join(gp(req.params.businessId), 'profile.json')) || {};
      if (profile.modules && profile.modules[key] === false) {
        return res.status(403).json({ error: 'Este módulo no está habilitado para este negocio' });
      }
    } catch { /* si no se puede leer el perfil, no se bloquea */ }
    next();
  };
}
app.use('/api/:businessId/debtors', bizAccess, moduleGuard('debtors'));
app.use('/api/:businessId/payroll', bizAccess, moduleGuard('payroll'));
app.use('/api/:businessId/finance', bizAccess, moduleGuard('finance'));
app.use('/api/:businessId/audit', bizAccess, moduleGuard('audit'));

app.use('/api/:businessId/inventory/:id/image', bizAccess, uploadProductImg.single('image'));
app.use('/api/:businessId', bizAccess, inventoryRoutes);
app.use('/api/:businessId', bizAccess, recipesRoutes);
app.use('/api/:businessId', bizAccess, tablesRoutes);
app.use('/api/:businessId', bizAccess, salesRoutes);
app.use('/api/:businessId', bizAccess, purchasesRoutes);
app.use('/api/:businessId', bizAccess, suppliersRoutes);
app.use('/api/:businessId', bizAccess, reportsRoutes);
app.use('/api/:businessId', bizAccess, invoicesRoutes);
app.use('/api/:businessId', bizAccess, shiftsRoutes);
app.use('/api/:businessId', bizAccess, debtorsRoutes);
app.use('/api/:businessId', bizAccess, financeRoutes);
app.use('/api/:businessId', bizAccess, payrollRoutes);
app.use('/api/:businessId', bizAccess, auditRoutes);
app.use('/api/:businessId', bizAccess, shortlinksRouter);

// Ruta pública para links cortos de PDF — no requiere autenticación
app.get('/f/:code', handleShortlink);

// Business profile routes
const { readJSON, writeJSON, getBusinessPath, getDataPath } = require('./src/services/fileStorage');

app.get('/api/:businessId/profile', ...bizAccess, async (req, res) => {
  try {
    const profilePath = path.join(getBusinessPath(req.params.businessId), 'profile.json');
    const profile = await readJSON(profilePath);
    res.json(profile || {});
  } catch {
    res.status(404).json({ error: 'Profile not found' });
  }
});

app.put('/api/:businessId/profile', ...bizAccess, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const profilePath = path.join(getBusinessPath(req.params.businessId), 'profile.json');
    const existing = await readJSON(profilePath) || {};
    const updated = { ...existing, ...req.body, id: req.params.businessId };
    // Recetas, ícono y forma de trabajo de los espacios los define solo el superadmin (desde Franquicias)
    if (req.user.role !== 'superadmin') {
      for (const k of ['usesRecipes', 'icon', 'spaceLabel', 'spaceLabelPlural', 'recipesLabel', 'multiOrders', 'spaceNames', 'modules']) {
        if (existing[k] === undefined) delete updated[k];
        else updated[k] = existing[k];
      }
    }
    await writeJSON(profilePath, updated);
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Error al guardar el perfil' });
  }
});

// Upload payment QR code — saves image to data/<businessId>/payment-qr.<ext>
// Used for transfer payments: cashier shows QR, client scans to pay
app.post('/api/:businessId/profile/payment-qr', ...bizAccess, uploadPaymentQr.single('paymentQr'), async (req, res) => {
  try {
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });

    const ext = path.extname(req.file.filename);
    const qrUrl = `/uploads/${req.params.businessId}/payment-qr${ext}`;

    const profilePath = path.join(getBusinessPath(req.params.businessId), 'profile.json');
    const existing = await readJSON(profilePath) || {};
    const updated = { ...existing, paymentQr: qrUrl, id: req.params.businessId };
    await writeJSON(profilePath, updated);

    res.json({ paymentQr: qrUrl });
  } catch {
    res.status(500).json({ error: 'Error al subir el QR' });
  }
});

// Upload logo for a business — saves image to data/<businessId>/logo.<ext>
// Returns the public URL so the frontend can store it in profile.logo
app.post('/api/:businessId/profile/logo', ...bizAccess, uploadLogo.single('logo'), async (req, res) => {
  try {
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });

    const ext = path.extname(req.file.filename);
    // Public URL served by the /uploads static route
    const logoUrl = `/uploads/${req.params.businessId}/logo${ext}`;

    // Persist the URL in profile.json
    const profilePath = path.join(getBusinessPath(req.params.businessId), 'profile.json');
    const existing = await readJSON(profilePath) || {};
    const updated = { ...existing, logo: logoUrl, id: req.params.businessId };
    await writeJSON(profilePath, updated);

    res.json({ logo: logoUrl });
  } catch {
    res.status(500).json({ error: 'Error al subir el logo' });
  }
});

// Users routes
app.get('/api/:businessId/users', ...bizAccess, async (req, res) => {
  try {
    const usersPath = path.join(getBusinessPath(req.params.businessId), 'users.json');
    const users = await readJSON(usersPath) || [];
    res.json(users.map(u => ({ ...u, password: undefined })));
  } catch {
    res.json([]);
  }
});

// Roles que se pueden asignar a usuarios de un negocio. 'superadmin' nunca:
// de lo contrario un admin podría darse acceso a todos los negocios.
const ASSIGNABLE_ROLES = ['admin', 'cajero'];

/**
 * ¿El nombre de usuario ya existe en algún negocio o es el del superadmin?
 * El login busca el usuario en todos los negocios, así que debe ser único
 * en todo el sistema para que un cliente no entre al negocio de otro.
 */
async function usernameTaken(username, exceptUserId = null) {
  const wanted = String(username || '').trim().toLowerCase();
  const superadmin = await readJSON(path.join(getDataPath(), 'superadmin.json'));
  if (superadmin && String(superadmin.username).toLowerCase() === wanted) return true;
  const businesses = await readJSON(path.join(getDataPath(), 'businesses.json')) || [];
  for (const b of businesses) {
    const list = await readJSON(path.join(getBusinessPath(b.id), 'users.json'));
    if (Array.isArray(list) && list.some(u => u.id !== exceptUserId && String(u.username).toLowerCase() === wanted)) return true;
  }
  return false;
}

app.post('/api/:businessId/users', ...bizAccess, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!req.body.username?.trim() || !req.body.password) {
      return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
    }
    if (!ASSIGNABLE_ROLES.includes(req.body.role)) {
      return res.status(400).json({ error: 'Rol no permitido' });
    }
    if (await usernameTaken(req.body.username)) {
      return res.status(409).json({ error: 'Ese nombre de usuario ya existe. Usa otro (ej: prefijo del negocio).' });
    }
    const bcrypt = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');
    const usersPath = path.join(getBusinessPath(req.params.businessId), 'users.json');
    const users = await readJSON(usersPath) || [];
    const hashed = await bcrypt.hash(req.body.password, 10);
    const newUser = { ...req.body, id: uuidv4(), username: req.body.username.trim(), password: hashed };
    users.push(newUser);
    await writeJSON(usersPath, users);
    res.status(201).json({ ...newUser, password: undefined });
  } catch {
    res.status(500).json({ error: 'Error al crear el usuario' });
  }
});

app.put('/api/:businessId/users/:id', ...bizAccess, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const bcrypt = require('bcryptjs');
    const usersPath = path.join(getBusinessPath(req.params.businessId), 'users.json');
    let users = await readJSON(usersPath) || [];
    const idx = users.findIndex(u => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    if (req.body.role !== undefined && !ASSIGNABLE_ROLES.includes(req.body.role)) {
      return res.status(400).json({ error: 'Rol no permitido' });
    }
    if (req.body.username !== undefined && req.body.username.trim() !== users[idx].username) {
      if (!req.body.username.trim()) return res.status(400).json({ error: 'El usuario no puede quedar vacío' });
      if (await usernameTaken(req.body.username, users[idx].id)) {
        return res.status(409).json({ error: 'Ese nombre de usuario ya existe. Usa otro (ej: prefijo del negocio).' });
      }
    }
    const updated = { ...users[idx], ...req.body, id: users[idx].id };
    if (req.body.password) {
      updated.password = await bcrypt.hash(req.body.password, 10);
    }
    users[idx] = updated;
    await writeJSON(usersPath, users);
    res.json({ ...updated, password: undefined });
  } catch {
    res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
});

app.delete('/api/:businessId/users/:id', ...bizAccess, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const usersPath = path.join(getBusinessPath(req.params.businessId), 'users.json');
    let users = await readJSON(usersPath) || [];
    users = users.filter(u => u.id !== req.params.id);
    await writeJSON(usersPath, users);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Error al eliminar el usuario' });
  }
});

// Backup — descarga todos los JSON del negocio en un solo archivo
app.get('/api/:businessId/backup', ...bizAccess, async (req, res) => {
  try {
    if (!['superadmin', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const bizPath = getBusinessPath(req.params.businessId);
    const fileNames = ['profile', 'users', 'inventory', 'recipes', 'sales', 'tables',
                       'purchases', 'suppliers', 'shifts', 'debtors'];
    const backup = { exportedAt: new Date().toISOString(), version: '1.0',
                     businessId: req.params.businessId, data: {} };
    for (const name of fileNames) {
      const data = await readJSON(path.join(bizPath, `${name}.json`));
      if (data) backup.data[name] = data;
    }
    const bizName = (backup.data.profile?.name || req.params.businessId)
      .replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="backup-${bizName}-${date}.json"`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Error al generar el backup' });
  }
});

/**
 * Reinicio para producción — pone en CERO los datos transaccionales de prueba,
 * conservando recetas, inventario, deudas, directorio (contactos), usuarios y config.
 * Requiere rol admin/superadmin y body { confirm: 'REINICIAR' }.
 * Limpia: ventas, salidas (compras), turnos, bitácora, finanzas; libera mesas;
 * conserva el directorio pero borra su historial de pagos y deudas; reinicia
 * el contador de facturas.
 */
app.post('/api/:businessId/reset-produccion', ...bizAccess, async (req, res) => {
  try {
    if (!['superadmin', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.body.confirm !== 'REINICIAR') {
      return res.status(400).json({ error: 'Confirmación inválida' });
    }
    const bizPath = getBusinessPath(req.params.businessId);
    const P = (n) => path.join(bizPath, `${n}.json`);
    const write = (n, data) => writeJSON(P(n), data);

    // Vaciar datos transaccionales
    await write('sales', []);
    await write('purchases', []);
    await write('shifts', []);
    await write('audit', []);

    // Finanzas: saldo inicial en 0, sin movimientos ni resumen (se conserva la meta de costo)
    const finance = await readJSON(P('finance')) || {};
    await write('finance', {
      opening: { bar: { efectivo: 0, banco: 0 }, restaurante: { efectivo: 0, banco: 0 } },
      openingDate: null,
      manual: [],
      reference: { bar: { ventas: 0, salidas: 0 }, restaurante: { ventas: 0, salidas: 0 } },
      costTarget: finance.costTarget || { min: 30, max: 40 }
    });

    // Directorio: conservar contactos, borrar historial de pagos y deudas
    const suppliers = await readJSON(P('suppliers')) || [];
    for (const s of suppliers) { s.payments = []; s.nominaHistory = []; s.totalDebt = 0; }
    await write('suppliers', suppliers);

    // Mesas: liberar (sin pedidos abiertos)
    const tables = await readJSON(P('tables')) || [];
    for (const t of tables) { t.status = 'libre'; t.order = null; }
    await write('tables', tables);

    // Facturas: reiniciar el contador
    const profile = await readJSON(P('profile')) || {};
    profile.invoiceCounter = 0;
    await write('profile', profile);

    res.json({ success: true });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Error al reiniciar' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Storage diagnostic — superadmin only
// Muestra la ruta de datos activa y el contenido del volumen para verificar persistencia
app.get('/api/admin/storage', authenticate, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const resolvedPath = path.resolve(dataPath);
    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true }).map(e => {
      if (e.isDirectory()) {
        const files = fs.readdirSync(path.join(resolvedPath, e.name)).map(f => {
          const stat = fs.statSync(path.join(resolvedPath, e.name, f));
          return { name: f, size: stat.size, modified: stat.mtime };
        });
        return { name: e.name, type: 'dir', files };
      }
      const stat = fs.statSync(path.join(resolvedPath, e.name));
      return { name: e.name, type: 'file', size: stat.size, modified: stat.mtime };
    });
    res.json({ dataPath: resolvedPath, persistent: resolvedPath.startsWith('/storage'), entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Sirve el frontend en producción ─────────────────────────────────────────
// Si existe la carpeta frontend/dist/ (generada con `npm run build`),
// Express la sirve como archivos estáticos. Cualquier ruta que no sea /api
// devuelve index.html para que Vue Router maneje la navegación.
// Esto permite desplegar con un solo puerto sin necesitar Nginx.
const DIST_PATH = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  });
  console.log(`[Frontend] Sirviendo dist desde ${DIST_PATH}`);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`facJp API corriendo en http://0.0.0.0:${PORT}`);
  console.log(`Accede en: http://localhost:${PORT}`);
  // Respaldo automático de los datos cada ~24 horas (se conservan los últimos 30)
  require('./src/services/backupService').scheduleBackups();
});

module.exports = app;
