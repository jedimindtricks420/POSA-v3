import prisma from '../../prisma/client.js';
import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';


// Показать список вендоров
export const showVendors = async (req, res) => {
  const vendors = await prisma.vendor.findMany({
    orderBy: { id: 'desc' },
    include: {
      transactions: true,
      payments: true
    }
  });

  // Добавим расчёт баланса
  res.render('pages/admin-vendors', {
    vendors,
    user: req.session.user
  });
  };

  
  // Показать форму добавления
  export const showAddVendorForm = (req, res) => {
    res.render('pages/admin-add-vendor', { error: null, user: req.session.user });
  };
  
  // Обработка создания
  export const handleAddVendor = async (req, res) => {
    const { name, category, productType, description, defaultCommissionPercent } = req.body;
    try {
      await prisma.vendor.create({
        data: {
          name,
          category,
          productType,
          description,
          defaultCommissionPercent: Number(defaultCommissionPercent),
          receiptTemplate: '{{product}} — {{voucher}} — {{price}} сум\nДата: {{date}}'
        },
      });
      res.redirect('/admin/vendors');
    } catch (error) {
      res.render('pages/admin-add-vendor', {
        error: 'Ошибка при добавлении вендора',
        user: req.session.user
      });
    }
  };
  
  // Показать форму редактирования
  export const showEditVendorForm = async (req, res) => {
    const vendor = await prisma.vendor.findUnique({ where: { id: Number(req.params.id) } });
    res.render('pages/admin-edit-vendor', { vendor, user: req.session.user });
  };
  
  // Обработка редактирования
  export const handleEditVendor = async (req, res) => {
    const { name, category, productType, description, receiptTemplate, defaultCommissionPercent } = req.body;
  
    await prisma.vendor.update({
      where: { id: Number(req.params.id) },
      data: {
        name,
        category,
        productType,
        description,
        receiptTemplate,
        defaultCommissionPercent: Number(defaultCommissionPercent)
      }
    });
  
    res.redirect('/admin/vendors');
  };
  

  // GET: страница с формой
export const showAddVendorUserForm = async (req, res) => {
  const vendors = await prisma.vendor.findMany();
  res.render('pages/admin-add-vendor-user', { vendors });
};

// POST: обработка формы
export const createVendorUser = async (req, res) => {
  const { vendorId, username, password, note } = req.body;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return res.send('Пользователь с таким логином уже существует.');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      role: Role.vendor_user,
      vendorId: parseInt(vendorId),
      note,
    },
  });

  res.redirect('/admin/vendors'); // можно поменять на flash-сообщение
};

// Показать форму пополнения баланса вендора
export const showVendorPaymentForm = async (req, res) => {
  const vendorId = Number(req.params.id);
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });

  res.render('pages/admin-pay-vendor', {
    vendor,
    user: req.session.user
  });
};


// Обработать пополнение баланса вендора
export const handleVendorPayment = async (req, res) => {
  const vendorId = Number(req.params.id);
  const { amount, comment } = req.body;

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return res.status(404).send('Vendor not found');

  const paymentAmount = parseFloat(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).send('Сумма должна быть больше нуля');
  }

  const balanceBefore = vendor.balance || 0;
  const balanceAfter = balanceBefore - paymentAmount;

  await prisma.vendorPayment.create({
    data: {
      vendorId,
      amount: paymentAmount,
      comment: comment || '',
      balanceBefore,
      balanceAfter,
    }
  });

  await prisma.vendor.update({
    where: { id: vendorId },
    data: { balance: balanceAfter }
  });

  res.redirect('/admin/vendors');
};

// Показать все транзакции по вендору
export const showVendorTransactions = async (req, res) => {
  const vendorId = Number(req.params.id);

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });

  const transactions = await prisma.vendorPayment.findMany({
    where: { vendorId },
    orderBy: { createdAt: 'desc' }
  });

  res.render('pages/admin-vendor-transactions', {
    vendor,
    transactions,
    user: req.session.user
  });
};

