import express from 'express';
import { getStorePage, sendOtp, verifyOtp, activateVoucher, logout } from '../controllers/storeController.js';

const router = express.Router();

// API endpoints for Store
router.post('/:storeSlug/otp', sendOtp);
router.post('/:storeSlug/verify', verifyOtp);
router.post('/:storeSlug/activate', activateVoucher);
router.post('/:storeSlug/logout', logout);

// Page render (Catch-all for store slug)
// This should be mounted at root level or handled carefully
router.get('/:storeSlug', getStorePage);

export default router;
