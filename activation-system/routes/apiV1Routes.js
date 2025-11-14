import express from 'express';
import { isClientAuthenticated } from '../middleware/authClient.js';
import { logEvent } from '../controllers/client/api/voucherController.js';

const router = express.Router();

router.post('/voucher/:id/events', isClientAuthenticated, logEvent);

export default router;
