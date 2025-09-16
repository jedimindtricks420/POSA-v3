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


export default router;
