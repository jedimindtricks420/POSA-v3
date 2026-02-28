import express from 'express';
import { ensureAuthenticated, ensureKassa, ensureKassaAdmin } from '../middleware/auth.js';
import * as kassaCabinetController from '../controllers/kassa/kassaCabinetController.js';

const router = express.Router();

// Все маршруты кассового кабинета требуют авторизации и роли kassa
router.use(ensureAuthenticated, ensureKassa);

// Дашборд
router.get('/dashboard', kassaCabinetController.showDashboard);

// Транзакции
router.get('/transactions', kassaCabinetController.showTransactions);

// Обязательства
router.get('/obligations', kassaCabinetController.showObligations);

// Выплаты
router.get('/payouts', kassaCabinetController.showPayouts);
router.post('/payouts', ensureKassaAdmin, kassaCabinetController.createPayout);

// Настройки
router.get('/settings', kassaCabinetController.showSettings);

export default router;
