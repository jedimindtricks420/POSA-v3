import express from 'express';
import * as clickController from '../controllers/payment/clickController.js';
import * as paymeController from '../controllers/payment/paymeController.js';

const router = express.Router();

// Click callbacks (per-kassa)
router.post('/api/payments/click/:kassaId/prepare', clickController.handlePrepare);
router.post('/api/payments/click/:kassaId/complete', clickController.handleComplete);

// Payme webhook (per-kassa)
router.post('/api/payments/payme/:kassaId', paymeController.handlePayme);

export default router;
