import express from 'express';
import * as authController from '../controllers/client/authController.js';
import prisma from '../prisma/client.js';
import { isClientAuthenticated } from '../middleware/authClient.js';

const router = express.Router();

// === Главная страница клиента ===
// Авторизованных отправляем на /client/dashboard, остальных на логин
router.get('/', (req, res) => {
  return req.session?.client ? res.redirect('/client/dashboard') : res.redirect('/wallet');
});

// === Логин ===
router.get('/wallet', authController.showLogin);
router.post('/wallet', authController.handleLogin);

// === Регистрация ===
router.get('/client-register', authController.showRegister);
router.post('/client-register', authController.handleRegister);

// === OTP проверка ===
router.get('/client-verify', authController.showOtpPage);
router.post('/client-verify', authController.verifyOtp);

// === Выход из аккаунта ===
router.get('/client/logout', authController.logout);

// === Личный кабинет клиента ===
router.get('/client/dashboard', isClientAuthenticated, async (req, res) => {
  try {
    let client = await prisma.client.findFirst({
      where: { phoneNumber: req.session.client.phone },
      include: { 
        onlineVouchers: { 
          include: { 
            voucher: {
              include: {
                product: true
              }
            }
          },
          orderBy: {
            assignedAt: 'desc'
          }
        } 
      },
    });

    // Если клиент не найден, создаем его
    if (!client) {
      client = await prisma.client.create({
        data: {
          phoneNumber: req.session.client.phone,
        },
        include: { 
          onlineVouchers: { 
            include: { 
              voucher: {
                include: {
                  product: true
                }
              }
            },
            orderBy: {
              assignedAt: 'desc'
            }
          } 
        },
      });
    }

    const vouchers = client?.onlineVouchers?.map((ov) => ({
      value: ov.voucher.value,
      status: ov.voucher.status || 'ACTIVE',
      productName: ov.voucher.product?.name || 'Неизвестный продукт',
      purchaseDate: ov.assignedAt
    })) || [];

    res.render('pages/client-dashboard', {
      phone: req.session.client.phone,
      vouchers,
    });
  } catch (err) {
    console.error('Ошибка при получении данных клиента:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// === Профиль клиента ===
router.get('/client/profile', isClientAuthenticated, (req, res) => {
  res.render('pages/client-profile', {
    phone: req.session.client.phone,
  });
});

// === QR Сканер ===
router.get('/client/qr-scanner', isClientAuthenticated, (req, res) => {
  res.render('pages/client-qr-scanner', {
    phone: req.session.client.phone,
  });
});

export default router;
