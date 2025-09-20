import prisma from '../../prisma/client.js';
import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import {
  buildDefaultReceiptSchema,
  parseReceiptSchema,
  renderReceiptPreview,
  buildSampleReceiptData,
} from '../../utils/receiptRenderer.js';


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
      const schema = buildDefaultReceiptSchema(name);
      await prisma.vendor.create({
        data: {
          name,
          category,
          productType,
          description,
          defaultCommissionPercent: Number(defaultCommissionPercent),
          receiptTemplate: JSON.stringify(schema)
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
  const vendor = await prisma.vendor.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      products: {
        orderBy: { id: 'asc' },
        take: 1,
      },
    },
  });

  if (!vendor) {
    return res.status(404).send('Вендор не найден');
  }

  const schema = parseReceiptSchema(vendor.receiptTemplate, vendor.name);

  res.render('pages/admin-edit-vendor', {
    vendor,
    user: req.session.user,
    templateSchema: JSON.stringify(schema),
    sampleProduct: vendor.products?.[0] || null,
  });
};
  
  // Обработка редактирования
export const handleEditVendor = async (req, res) => {
  const {
    name,
    category,
    productType,
    description,
    templateSchema,
    defaultCommissionPercent,
  } = req.body;

  const vendorId = Number(req.params.id);

  let schemaToSave;
  try {
    schemaToSave = parseReceiptSchema(templateSchema, name);
  } catch (error) {
    schemaToSave = buildDefaultReceiptSchema(name);
  }

  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      name,
      category,
      productType,
      description,
      receiptTemplate: JSON.stringify(schemaToSave),
      defaultCommissionPercent: Number(defaultCommissionPercent),
    },
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

export const previewReceiptTemplate = async (req, res) => {
  const vendorId = Number(req.params.id);
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      products: {
        orderBy: { id: 'asc' },
        take: 1,
      },
    },
  });

  if (!vendor) {
    return res.status(404).send('Вендор не найден');
  }

  const incomingSchema = req.body?.schema;
  const schema = parseReceiptSchema(incomingSchema || vendor.receiptTemplate, vendor.name);

  const sampleProduct = vendor.products?.[0] || {
    name: 'Цифровой продукт',
    price: 100000,
  };

  const samplePayload = buildSampleReceiptData({
    vendorName: vendor.name,
    product: sampleProduct,
  });

  try {
    const html = await renderReceiptPreview(schema, samplePayload);
    res.send(html);
  } catch (error) {
    console.error('Receipt preview error:', error);
    res.status(500).send('<h1>Ошибка рендера чека</h1><p>Проверьте структуру шаблона.</p>');
  }
};
