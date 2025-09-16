import express from 'express';
import * as publicController from '../controllers/publicController.js';

const router = express.Router();

// Перенаправление с главной страницы на страницу входа
router.get('/', (req, res) => {
  res.redirect('/auth/login');
});

// Клиент: шаг 1 — email + телефон (для прямого доступа)
router.get('/email', publicController.showEmailForm);
router.post('/email', publicController.handleEmailForm);

// Клиент: шаг 2 — ввод ваучера
router.get('/client/enter-voucher', publicController.showVoucherForm);
router.post('/client/enter-voucher', publicController.handleVoucherSubmit);

import { handleVoucherActivation } from '../controllers/publicController.js';
router.get('/activate', handleVoucherActivation);

export default router;
