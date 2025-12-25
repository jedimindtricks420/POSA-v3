import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';

import adminRoutes from './routes/adminRoutes.js';
import authRoutes from './routes/authRoutes.js';
import merchantRoutes from './routes/merchantRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import clientApiRoutes from './routes/clientApiRoutes.js';
import apiV1Routes from './routes/apiV1Routes.js';
import walletRoutes from './routes/wallet.js';
import storeRoutes from './routes/storeRoutes.js';
import qrPaymentRoutes from './routes/qrPaymentRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import { checkSubdomain } from './middleware/checkSubdomain.js';
import { SESSION_MAX_AGE, REMEMBER_ME_MAX_AGE } from './utils/authTokens.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;

// __dirname support
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set('trust proxy', 1);

// View engine
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

//const walletStaticPath = path.join(__dirname, 'public', 'wallet');
const pwaIconsPath = path.join(__dirname, 'views', 'partials', 'client', 'pwa');
const zxingStaticPath = path.join(__dirname, 'node_modules', '@zxing');

app.get('/wallet/icons/icon-192.png', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(path.join(pwaIconsPath, '192x192.png'));
});

app.get('/wallet/icons/icon-512.png', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(path.join(pwaIconsPath, '512x512.png'));
});

app.get('/wallet/icons/icon-512-maskable.png', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(path.join(pwaIconsPath, 'maskable-icon.png'));
});

app.get('/wallet/icons/vec-icon.png', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(path.join(pwaIconsPath, 'vec-icon.png'));
});

// Digital Asset Links для Android TWA
// КРИТИЧНО: Content-Type должен быть application/json БЕЗ charset=utf-8
// Google строго проверяет это для верификации TWA приложений
app.get('/.well-known/assetlinks.json', (req, res) => {
  try {
    const filePath = path.join(__dirname, 'public', '.well-known', 'assetlinks.json');
    const content = fs.readFileSync(filePath, 'utf8');

    // Используем res.end вместо res.send, чтобы Express не добавил charset=utf-8
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.end(content);
  } catch (error) {
    console.error('[assetlinks] Error:', error);
    res.status(500).send('Internal server error');
  }
});

app.use(express.static(path.join(__dirname, 'public'), {
  dotfiles: 'allow',
}));
if (fs.existsSync(zxingStaticPath)) {
  app.use('/vendor/zxing', express.static(zxingStaticPath));
}
app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecretkey',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 15 * 60 * 1000,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
}));
app.use((req, res, next) => {
  if (req.session?.user || req.session?.client) {
    const remember = Boolean(req.session.rememberMe);
    req.session.cookie.maxAge = remember ? REMEMBER_ME_MAX_AGE : SESSION_MAX_AGE;
  }
  next();
});
app.use((req, res, next) => {
  if (res.locals && typeof res.locals.include !== 'undefined' && typeof res.locals.include !== 'function') {
    delete res.locals.include;
  }
  next();
});

// Определяем роль по субдомену
app.use(checkSubdomain);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  let role = null;
  if (req.session?.client) {
    role = 'Client';
  } else if (req.session?.user?.role === 'merchant') {
    role = 'Merchant';
  } else if (req.session?.user?.role === 'vendor_user') {
    role = 'Vendor';
  } else if (req.session?.user?.role === 'admin') {
    role = 'Admin';
  } else if (req.appRole) {
    const map = {
      client: 'Client',
      merchant: 'Merchant',
      vendor: 'Vendor',
      admin: 'Admin',
      public: 'Public',
    };
    role = map[req.appRole] || 'Public';
  }
  res.locals.appRole = role || 'Public';
  res.locals.isClient = res.locals.appRole === 'Client';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.get('host');
  const fallbackOrigin = host ? `${protocol}://${host}` : null;
  res.locals.appBaseUrl = process.env.PUBLIC_BASE_URL
    || process.env.APP_BASE_URL
    || fallbackOrigin
    || 'https://wallet.namo.uz';
  next();
});

// Подключаем маршруты
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/merchant', merchantRoutes);
app.use('/vendor', vendorRoutes);
app.use('/api/client', clientApiRoutes);
app.use('/api/v1', apiV1Routes);
app.use('/receipts', express.static(path.join(__dirname, 'receipts')));

// 1) Wallet роуты — критично, чтобы pkpass отдавался до клиентских обработчиков
app.use('/', walletRoutes);

// 2) Клиентские роуты (SPA)
app.use('/wallet', clientRoutes);
app.use('/client', clientRoutes);

// Перенаправляем запросы в зависимости от субдомена (после walletRoutes, до публичных)
app.use((req, res, next) => {
  if (req.appRole === 'client') {
    return clientRoutes(req, res, next);
  } else if (req.appRole === 'merchant' || req.appRole === 'vendor') {
    // Если пользователь не авторизован, перенаправляем на страницу входа
    if (!req.session?.user) {
      return res.redirect('/auth/login');
    }
  }
  next();
});

// 2.5) Payment callbacks (Click/Payme) - BEFORE QR payment routes
app.use('/', paymentRoutes);

// 3) QR Payment Routes (Public, no auth required)
app.use('/', qrPaymentRoutes);

// 4) Store Routes (Dynamic slugs) - BEFORE public routes to avoid conflicts
app.use('/', storeRoutes);

// 5) Остальные маршруты (публичные)
app.use('/', publicRoutes);

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Backend API listening on http://localhost:${PORT}`);
});
