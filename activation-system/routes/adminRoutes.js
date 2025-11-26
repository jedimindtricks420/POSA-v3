import express from 'express';
import { ensureAdmin } from '../middleware/auth.js';

// Контроллеры по модулям
import * as dashboardController from '../controllers/admin/dashboardController.js';
import * as productController from '../controllers/admin/productController.js';
import * as voucherController from '../controllers/admin/voucherController.js';
import * as saleController from '../controllers/admin/saleController.js';
import * as userController from '../controllers/admin/userController.js';
import * as vendorController from '../controllers/admin/vendorController.js';
import * as passwordController from '../controllers/admin/passwordController.js';
import * as merchantController from '../controllers/admin/merchantController.js';
import * as clientController from '../controllers/admin/clientController.js';
import * as storeController from '../controllers/admin/storeController.js';
import * as rokkyController from '../controllers/admin/rokkyController.js';
import * as telegramBotController from '../controllers/admin/telegramBotController.js';
import * as manualActivationController from '../controllers/admin/manualActivationController.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Дашборд
router.get('/dashboard', ensureAdmin, dashboardController.showAdminDashboard);
router.get('/merchants', ensureAdmin, merchantController.showMerchantsWithDebt);

// Клиенты
router.get('/clients', ensureAdmin, clientController.showAllClients);
router.get('/clients/:id', ensureAdmin, clientController.showClientDetails);
router.post('/clients/:id/delete', ensureAdmin, clientController.deleteClient);


// Товары
router.get('/products', ensureAdmin, productController.showAllProducts);
router.get('/add-product', ensureAdmin, productController.showAddProductForm);
router.post('/add-product', ensureAdmin, productController.handleAddProduct);
router.get('/edit-product/:id', ensureAdmin, productController.showEditProductForm);
router.post('/edit-product/:id', ensureAdmin, productController.handleEditProduct);
router.post('/delete-product/:id', ensureAdmin, productController.handleDeleteProduct);
router.post('/products/:id/receipt/preview', ensureAdmin, productController.previewProductReceiptTemplate);


// Ваучеры
router.get('/vouchers', ensureAdmin, voucherController.showAllVouchers);
router.get('/add-voucher', ensureAdmin, voucherController.showAddVoucherForm);
router.post('/add-voucher', ensureAdmin, voucherController.handleAddVoucher);
router.get('/vouchers/add', ensureAdmin, voucherController.showAddVouchersPage);
router.post('/vouchers/add', ensureAdmin, voucherController.addVouchers);
router.post('/vouchers/generate', ensureAdmin, voucherController.generateVouchers);

// Продажи
router.get('/sales', ensureAdmin, saleController.showSales);

// Пользователи
router.get('/add-user', ensureAdmin, userController.showCreateUserForm);
router.post('/add-user', ensureAdmin, userController.handleCreateUser);
router.get('/users', ensureAdmin, userController.showUsersList);
router.get('/users/:id/delete', ensureAdmin, userController.deleteUser);

// Пароли
router.get('/users/:id/password', ensureAdmin, passwordController.showChangePasswordForm);
router.post('/users/:id/password', ensureAdmin, passwordController.changeUserPassword);

// Вендоры
router.get('/vendors', ensureAdmin, vendorController.showVendors);
router.get('/add-vendor', ensureAdmin, vendorController.showAddVendorForm);
router.post('/add-vendor', ensureAdmin, vendorController.handleAddVendor);
router.get('/vendors/edit/:id', ensureAdmin, vendorController.showEditVendorForm);
router.post('/vendors/edit/:id', ensureAdmin, vendorController.handleEditVendor);
router.post('/vendors/:id/receipt/preview', ensureAdmin, vendorController.previewReceiptTemplate);

// Оплаты и страница погашения долга
router.get('/merchants', ensureAdmin, merchantController.showMerchantsWithDebt);
router.get('/merchant/:id/pay', ensureAdmin, merchantController.showPaymentForm);
router.post('/merchant/:id/pay', ensureAdmin, merchantController.handleMerchantPayment);

router.get('/merchant/:id/transactions', ensureAdmin, merchantController.showMerchantTransactions);

import {
  showAddVendorUserForm,
  createVendorUser,
} from '../controllers/admin/vendorController.js';

router.get('/add-vendor-users', ensureAdmin, showAddVendorUserForm);
router.post('/add-vendor-users', ensureAdmin, createVendorUser);

router.get('/merchant/:id/payments', ensureAdmin, merchantController.showMerchantPaymentHistory);


router.get('/vendor/:id/pay', ensureAdmin, vendorController.showVendorPaymentForm);
router.post('/vendor/:id/pay', ensureAdmin, vendorController.handleVendorPayment);
router.get('/vendor/:id/transactions', ensureAdmin, vendorController.showVendorTransactions);

// Stores (Магазины активации)
router.get('/stores', ensureAdmin, storeController.showStores);
router.get('/stores/add', ensureAdmin, storeController.showAddStoreForm);
router.post('/stores/add', ensureAdmin, storeController.handleAddStore);
router.get('/stores/edit/:id', ensureAdmin, storeController.showEditStoreForm);
router.post('/stores/edit/:id', ensureAdmin, upload.single('logo'), storeController.handleEditStore);

// Rokky (Админ-панель Rokky)
router.get('/rokky', ensureAdmin, rokkyController.showRokkyDashboard);
router.get('/rokky/skus', ensureAdmin, rokkyController.showRokkySkus);
router.get('/rokky/skus/add', ensureAdmin, rokkyController.showAddSkuForm);
router.post('/rokky/skus/add', ensureAdmin, rokkyController.handleAddSku);
router.get('/rokky/skus/edit/:id', ensureAdmin, rokkyController.showEditSkuForm);
router.post('/rokky/skus/edit/:id', ensureAdmin, rokkyController.handleEditSku);
router.get('/rokky/products', ensureAdmin, rokkyController.showRokkyProducts);
router.post('/rokky/products/:id/bind', ensureAdmin, rokkyController.handleBindSku);
router.get('/rokky/activations', ensureAdmin, rokkyController.showRokkyActivations);
router.get('/rokky/finance', ensureAdmin, rokkyController.showRokkyFinance);

// Telegram боты
router.get('/telegram-bots', ensureAdmin, telegramBotController.listBots);
router.get('/telegram-bots/create', ensureAdmin, telegramBotController.showCreateForm);
router.post('/telegram-bots/create', ensureAdmin, telegramBotController.createBot);
router.get('/telegram-bots/:id/edit', ensureAdmin, telegramBotController.showEditForm);
router.post('/telegram-bots/:id/edit', ensureAdmin, telegramBotController.updateBot);
router.post('/telegram-bots/:id/delete', ensureAdmin, telegramBotController.deleteBot);
router.post('/telegram-bots/:id/test', ensureAdmin, telegramBotController.testBot);

// Ручные активации
router.get('/manual-activations', ensureAdmin, manualActivationController.listRequests);
router.get('/manual-activations/:id', ensureAdmin, manualActivationController.showRequestDetails);
router.post('/manual-activations/:id/complete', ensureAdmin, manualActivationController.completeRequest);
router.post('/manual-activations/:id/reject', ensureAdmin, manualActivationController.rejectRequest);


export default router;
