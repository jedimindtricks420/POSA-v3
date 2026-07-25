import express from 'express';
import * as clickController from '../controllers/payment/clickController.js';
import * as paymeController from '../controllers/payment/paymeController.js';
import * as alifController from '../controllers/payment/alifController.js';

const router = express.Router();

// Click callbacks (per-kassa)
router.post('/api/payments/click/:kassaId/prepare', clickController.handlePrepare);
router.post('/api/payments/click/:kassaId/complete', clickController.handleComplete);

// Payme webhook (per-kassa)
router.post('/api/payments/payme/:kassaId', paymeController.handlePayme);

// Alifpay webhook (per-kassa)
// req.rawBody уже подготовлен глобальным express.json({ verify }) в index.js
router.post('/api/payments/alif/:kassaId/webhook', alifController.handleWebhook);

export default router;
