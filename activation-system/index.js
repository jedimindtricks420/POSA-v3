import express from 'express';
import cors from 'cors';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';

import adminRoutes from './routes/adminRoutes.js';
import authRoutes from './routes/authRoutes.js';
import merchantRoutes from './routes/merchantRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import clientApiRoutes from './routes/clientApiRoutes.js';
import { checkSubdomain } from './middleware/checkSubdomain.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;

// __dirname support
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// View engine
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const walletStaticPath = path.join(__dirname, 'public', 'wallet');
const pwaIconsPath = path.join(__dirname, 'views', 'partials', 'client', 'pwa');

app.use('/wallet', express.static(walletStaticPath, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
  },
}));

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

app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecretkey',
  resave: false,
  saveUninitialized: true,
}));
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Определяем роль по субдомену
app.use(checkSubdomain);

// Подключаем маршруты
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/merchant', merchantRoutes);
app.use('/vendor', vendorRoutes);
app.use('/api/client', clientApiRoutes);
app.use('/receipts', express.static(path.join(__dirname, 'receipts')));

// Перенаправляем запросы в зависимости от субдомена
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

// Временно подключаем клиентские роуты для тестирования
app.use('/wallet', clientRoutes);
app.use('/client', clientRoutes);

// Остальные маршруты (публичные)
app.use('/', publicRoutes);

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Backend API listening on http://localhost:${PORT}`);
});
