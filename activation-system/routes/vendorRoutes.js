import express from 'express';
import { showVendorDashboard, activateVoucher } from '../controllers/vendor/dashboardController.js';

const router = express.Router();

router.get('/dashboard', showVendorDashboard);
router.post('/activate', activateVoucher);

export default router;
