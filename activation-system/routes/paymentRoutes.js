import express from 'express';
import * as clickController from '../controllers/payment/clickController.js';
import * as paymeController from '../controllers/payment/paymeController.js';

const router = express.Router();

// Click callbacks
router.post('/api/payments/click/prepare', clickController.handlePrepare);
router.post('/api/payments/click/complete', clickController.handleComplete);

// Payme webhook
router.post('/api/payments/payme', paymeController.handlePayme);

export default router;
