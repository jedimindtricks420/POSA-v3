import express from 'express';

// Контроллеры по модулям

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
import * as qrLinkController from '../controllers/admin/qrLinkController.js';
import { ensureAdmin, ensureAuthenticated, allowFinance, allowContent, allowSupport, allowFinanceOrContent } from '../middleware/auth.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { generationLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Дашборд
router.get('/dashboard', ensureAuthenticated, dashboardController.showAdminDashboard);

// 1. Финансовый/Коммерческий блок (Admin + Finance)
// ----------------------------------------------------
router.get('/sales', allowFinance, saleController.showSales);
router.get('/merchants', allowFinance, merchantController.showMerchantsWithDebt);
router.get('/merchant/:id/pay', allowFinance, merchantController.showPaymentForm);
router.post('/merchant/:id/pay', allowFinance, merchantController.handleMerchantPayment);
router.get('/merchant/:id/transactions', allowFinance, merchantController.showMerchantTransactions);
router.get('/merchant/:id/payments', allowFinance, merchantController.showMerchantPaymentHistory);

router.get('/vendor/:id/pay', allowFinance, vendorController.showVendorPaymentForm);
router.post('/vendor/:id/pay', allowFinance, vendorController.handleVendorPayment);
router.get('/vendor/:id/transactions', allowFinance, vendorController.showVendorTransactions);


// 2. Мерчанты: Управление (Admin only - они создаются редко)
// ----------------------------------------------------
router.get('/add-merchant', ensureAdmin, merchantController.showAddMerchantForm);
router.post('/add-merchant', ensureAdmin, merchantController.handleAddMerchant);
router.get('/merchants/edit/:id', ensureAdmin, merchantController.showEditMerchantForm);
router.post('/merchants/edit/:id', ensureAdmin, merchantController.handleEditMerchant);

// 3. Клиенты: Просмотр (Admin + Support)
// ----------------------------------------------------
router.get('/clients', allowSupport, clientController.showAllClients);
router.get('/clients/:id', allowSupport, clientController.showClientDetails);
router.post('/clients/:id/delete', ensureAdmin, clientController.deleteClient); // Удалять - только Админ

// 4. Товары и Контент (Admin + Content)
// ----------------------------------------------------
router.get('/products', allowContent, productController.showAllProducts);
router.get('/add-product', allowContent, productController.showAddProductForm);
router.post('/add-product', allowContent, productController.handleAddProduct);
router.get('/edit-product/:id', allowContent, productController.showEditProductForm);
router.post('/edit-product/:id', allowContent, productController.handleEditProduct);
router.post('/delete-product/:id', allowContent, productController.handleDeleteProduct);
router.post('/products/:id/receipt/preview', allowContent, productController.previewProductReceiptTemplate);

router.get('/vouchers', allowContent, voucherController.showAllVouchers);
router.get('/add-voucher', allowContent, voucherController.showAddVoucherForm);
router.post('/add-voucher', allowContent, voucherController.handleAddVoucher);
router.get('/vouchers/add', allowContent, voucherController.showAddVouchersPage);
router.post('/vouchers/add', allowContent, voucherController.addVouchers);
router.post('/vouchers/generate', ensureAdmin, generationLimiter, voucherController.generateVouchers); // Генерация - только админ

router.get('/stores', allowContent, storeController.showStores);
router.get('/stores/add', allowContent, storeController.showAddStoreForm);
router.post('/stores/add', allowContent, storeController.handleAddStore);
router.get('/stores/edit/:id', allowContent, storeController.showEditStoreForm);
router.post('/stores/edit/:id', allowContent, upload.single('logo'), storeController.handleEditStore);

// 5. Вендоры: Список (Content + Finance + Admin)
// Финансисту нужен доступ для выплат долгов, контент-менеджеру для привязки товаров к вендорам.
router.get('/vendors', allowFinanceOrContent, vendorController.showVendors);
router.get('/add-vendor', allowContent, vendorController.showAddVendorForm);
router.post('/add-vendor', allowContent, vendorController.handleAddVendor);
router.get('/vendors/edit/:id', allowContent, vendorController.showEditVendorForm);
router.post('/vendors/edit/:id', allowContent, vendorController.handleEditVendor);
router.post('/vendors/:id/receipt/preview', allowContent, vendorController.previewReceiptTemplate);

import {
  showAddVendorUserForm,
  createVendorUser,
} from '../controllers/admin/vendorController.js';

router.get('/add-vendor-users', ensureAdmin, showAddVendorUserForm);
router.post('/add-vendor-users', ensureAdmin, createVendorUser);


// 6. Пользователи (Admin only)
// ----------------------------------------------------
router.get('/add-user', ensureAdmin, userController.showCreateUserForm);
router.post('/add-user', ensureAdmin, userController.handleCreateUser);
router.get('/users', ensureAdmin, userController.showUsersList);
router.get('/users/:id/delete', ensureAdmin, userController.deleteUser);
router.get('/users/:id/password', ensureAdmin, passwordController.showChangePasswordForm);
router.post('/users/:id/password', ensureAdmin, passwordController.changeUserPassword);


// 7. Rokky (Admin only - техническая интеграция)
// ----------------------------------------------------
router.get('/rokky', ensureAdmin, rokkyController.showRokkyDashboard);
router.get('/rokky/skus', ensureAdmin, rokkyController.showRokkySkus);
router.get('/rokky/skus/add', ensureAdmin, rokkyController.showAddSkuForm);
router.post('/rokky/skus/add', ensureAdmin, rokkyController.handleAddSku);
router.get('/rokky/skus/edit/:id', ensureAdmin, rokkyController.showEditSkuForm);
router.post('/rokky/skus/edit/:id', ensureAdmin, rokkyController.handleEditSku);
router.get('/rokky/products', ensureAdmin, rokkyController.showRokkyProducts);
router.post('/rokky/products/:id/bind', ensureAdmin, rokkyController.handleBindSku);
router.get('/rokky/activations', ensureAdmin, rokkyController.showRokkyActivations);
router.get('/rokky/finance', allowFinance, rokkyController.showRokkyFinance); // Финансы можно видет финансисту

// 8. Telegram боты (Admin only)
// ----------------------------------------------------
router.get('/telegram-bots', ensureAdmin, telegramBotController.listBots);
router.get('/telegram-bots/create', ensureAdmin, telegramBotController.showCreateForm);
router.post('/telegram-bots/create', ensureAdmin, telegramBotController.createBot);
router.get('/telegram-bots/:id/edit', ensureAdmin, telegramBotController.showEditForm);
router.post('/telegram-bots/:id/edit', ensureAdmin, telegramBotController.updateBot);
router.post('/telegram-bots/:id/delete', ensureAdmin, telegramBotController.deleteBot);
router.post('/telegram-bots/:id/test', ensureAdmin, telegramBotController.testBot);

// 9. Ручные активации (Support + Admin)
// ----------------------------------------------------
router.get('/manual-activations', allowSupport, manualActivationController.listRequests);
router.get('/manual-activations/:id', allowSupport, manualActivationController.showRequestDetails);
router.post('/manual-activations/:id/complete', allowSupport, manualActivationController.completeRequest);
router.post('/manual-activations/:id/reject', allowSupport, manualActivationController.rejectRequest);

// 10. QR Payment Links (Admin + Content)
// ----------------------------------------------------
router.get('/qr-links', allowContent, qrLinkController.showQrLinksPage);
router.post('/qr-links/generate', allowContent, qrLinkController.generateLink);
router.get('/qr-links/:id/download', allowContent, qrLinkController.downloadQr);


export default router;
