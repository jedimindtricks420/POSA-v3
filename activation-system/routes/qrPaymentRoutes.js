import express from 'express';
import * as qrPaymentController from '../controllers/public/qrPaymentController.js';

const router = express.Router();

// QR Payment Flow (публичные страницы)
router.get('/pay/:token', qrPaymentController.showProductPage);
router.get('/pay/:token/checkout', qrPaymentController.showCheckoutPage);
router.post('/pay/:token/checkout', qrPaymentController.processCheckout);
router.get('/pay/:token/result/:attemptId', qrPaymentController.showResultPage);
router.get('/pay/:token/receipt/:attemptId', qrPaymentController.downloadReceipt);

export default router;
