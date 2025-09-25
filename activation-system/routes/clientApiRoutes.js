import express from 'express';
import * as voucherApi from '../controllers/client/api/voucherController.js';
import { isClientAuthenticated } from '../middleware/authClient.js';

const router = express.Router();

router.get('/vouchers', isClientAuthenticated, voucherApi.list);
router.get('/voucher/:id', isClientAuthenticated, voucherApi.show);
router.post('/voucher/:id/log', isClientAuthenticated, voucherApi.logEvent);
router.post('/push-subscription', isClientAuthenticated, voucherApi.subscribePush);

export default router;
