import express from 'express';
import { ensureVendor } from '../middleware/auth.js';
import { showDashboard } from '../controllers/vendor/dashboardController.js';
import { showActivationForm, handleActivation } from '../controllers/vendor/activationController.js';
import { listVouchers } from '../controllers/vendor/voucherController.js';
import { showTransactions } from '../controllers/vendor/transactionController.js';
import { showSettings } from '../controllers/vendor/settingsController.js';

const router = express.Router();

router.use(ensureVendor);

router.get('/', (req, res) => res.redirect('/vendor/dashboard'));
router.get('/dashboard', showDashboard);
router.get('/activate', showActivationForm);
router.post('/activate', handleActivation);
router.get('/vouchers', listVouchers);
router.get('/transactions', showTransactions);
router.get('/settings', showSettings);

export default router;
