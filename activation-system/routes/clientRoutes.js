import express from 'express';
import * as authController from '../controllers/client/authController.js';
import { showDashboard } from '../controllers/client/dashboardController.js';
import { isClientAuthenticated } from '../middleware/authClient.js';
import { otpVerifyLimiter, registerLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

router.use((req, res, next) => {
  res.locals.appRole = 'Client';
  res.locals.isClient = true;
  const ua = req.headers['user-agent'] || '';
  res.locals.isIPhone = /iPhone|iPod/i.test(ua);
  next();
});

// Главная точка входа: обрабатываем только реальный '/'
router.get('/', (req, res, next) => {
  if (req.baseUrl && req.baseUrl !== '') {
    return next();
  }
  return req.session?.client ? res.redirect('/client/dashboard') : res.redirect('/wallet');
});

// Аутентификация
router.get('/wallet', authController.showLogin);
router.post('/wallet', authController.handleLogin);
router.get('/client-register', authController.showRegister);
router.post('/client-register', registerLimiter, authController.handleRegister);
router.get('/client-verify', authController.showOtpPage);
router.post('/client-verify', otpVerifyLimiter, authController.verifyOtp);
router.get('/client/logout', authController.logout);
router.get('/logout', authController.logout);
router.post('/refresh', authController.refreshSession);
router.post('/client/delete-account', isClientAuthenticated, authController.deleteAccount);

// Клиентские страницы
router.get('/client/dashboard', isClientAuthenticated, showDashboard);
router.get('/client/profile', isClientAuthenticated, (req, res) => {
  res.render('pages/client-profile', {
    phone: req.session.client.phone,
    pushPublicKey: process.env.WALLET_VAPID_PUBLIC_KEY || null,
  });
});
router.get('/client/qr-scanner', isClientAuthenticated, (req, res) => {
  res.render('pages/client-qr-scanner', {
    phone: req.session.client.phone,
    pushPublicKey: process.env.WALLET_VAPID_PUBLIC_KEY || null,
  });
});

export default router;
