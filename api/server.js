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

// Multer: saves logo to data/<businessId>/logo.<ext>, one file at a time
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(path.resolve(dataPath), req.params.businessId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `logo${ext}`);
  }
});
const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
});

// Multer: saves payment QR to data/<businessId>/payment-qr.<ext>
const paymentQrStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(path.resolve(dataPath), req.params.businessId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `payment-qr${ext}`);
  }
});
const uploadPaymentQr = multer({
  storage: paymentQrStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
});

// Multer: saves product images to data/<businessId>/inv_<id>.<ext>
const productImgStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(path.resolve(dataPath), req.params.businessId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `inv_${req.params.businessId}_${req.params.id}${ext}`);
  }
});
const uploadProductImg = multer({
  storage: productImgStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
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
app.use(cors({
  origin: (origin, callback) => {
    // Permitir: sin origen (curl/Postman), localhost, redes locales,
    // Railway (.up.railway.app) y el dominio configurado en FRONTEND_URL
    if (
      !origin ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.') ||
      origin.startsWith('http://192.168.') ||
      origin.startsWith('http://10.') ||
      origin.startsWith('http://172.') ||
      origin.endsWith('.railway.app') ||
      origin === FRONTEND_URL
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// Servir archivos de la carpeta data/ como estáticos, PERO solo imágenes.
// Sin este filtro, cualquier persona podría descargar sales.json, users.json, etc.
// con solo abrir /uploads/<businessId>/sales.json en el navegador.
app.use('/uploads', (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  const tiposPermitidos = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'];
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
const { router: shortlinksRouter, handleShortlink } = require('./src/routes/shortlinks');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);

// Rutas de negocio: authenticate + requireBusinessAccess aplicados a nivel de mount.
// Esto garantiza que cualquier usuario no-superadmin solo pueda acceder a su propio negocio.
// Las rutas individuales también llaman a authenticate internamente (sin conflicto).
const { authenticate, requireBusinessAccess } = require('./src/middleware/auth');
const bizAccess = [authenticate, requireBusinessAccess];

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
app.use('/api/:businessId', bizAccess, shortlinksRouter);

// Ruta pública para links cortos de PDF — no requiere autenticación
app.get('/f/:code', handleShortlink);

// Business profile routes
const { readJSON, writeJSON, getBusinessPath } = require('./src/services/fileStorage');

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

app.post('/api/:businessId/users', ...bizAccess, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const bcrypt = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');
    const usersPath = path.join(getBusinessPath(req.params.businessId), 'users.json');
    const users = await readJSON(usersPath) || [];
    const hashed = await bcrypt.hash(req.body.password, 10);
    const newUser = { id: uuidv4(), ...req.body, password: hashed };
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
    const updated = { ...users[idx], ...req.body };
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
});

module.exports = app;
