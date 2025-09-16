import express from 'express';
import { ensureMerchant } from '../middleware/auth.js';

import * as dashboardController from '../controllers/merchant/dashboardController.js';
import * as cartController from '../controllers/merchant/cartController.js';
import * as saleController from '../controllers/merchant/saleController.js';
import * as publicController from '../controllers/publicController.js';

const router = express.Router();

// 📊 Панель мерчанта
router.get('/dashboard', ensureMerchant, dashboardController.showMerchantDashboard);

// 💳 Продажи
router.get('/sales', ensureMerchant, saleController.showMerchantSales);
router.post('/checkout/confirm', ensureMerchant, saleController.confirmCheckout);

// 🛒 Корзина и товары
router.get('/sell', ensureMerchant, cartController.showProductsForSale);
router.post('/add-to-cart', ensureMerchant, cartController.addToCart);
router.get('/checkout', ensureMerchant, cartController.showCart);
router.post('/update-cart', ensureMerchant, cartController.updateCart);
router.get('/cart/remove/:id', ensureMerchant, cartController.removeFromCart);

// 🔐 Активация (временный публичный маршрут)
router.get('/activate', publicController.handleVoucherActivation);
router.post('/activate', publicController.handleVoucherActivation);


export default router;
