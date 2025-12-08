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
  const [vendorsRaw, transactionAgg, vendorPaymentsAgg] = await Promise.all([
    prisma.vendor.findMany({ orderBy: { id: 'desc' } }),
    prisma.voucherTransaction.aggregate({
      _sum: {
        vendorDebt: true,
        adminDebt: true,
        price: true,
      },
      _count: { id: true },
    }),
    prisma.vendorPayment.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const vendors = vendorsRaw.map((vendor) => ({
    ...vendor,
    balance: Number(vendor.balance ?? 0),
  }));

  const totalOutstanding = vendors.reduce((sum, vendor) => sum + Number(vendor.balance ?? 0), 0);
  const totalTransactions = Number(transactionAgg._count?.id ?? 0);
  const totalSalesVolume = Number(transactionAgg._sum?.price ?? 0);
  const vendorPayoutAccrued = Number(transactionAgg._sum?.vendorDebt ?? 0);
  const vendorPayoutPaid = Number(vendorPaymentsAgg._sum?.amount ?? 0);
  const platformRevenueShare = Number(transactionAgg._sum?.adminDebt ?? 0);
  const vendorPaymentsCount = Number(vendorPaymentsAgg._count?._all ?? 0);

  const stats = {
    totalVendors: vendors.length,
    vendorOutstanding: totalOutstanding,
    vendorPayoutAccrued,
    vendorPayoutPaid,
    platformRevenueShare,
    totalTransactions,
    totalSalesVolume,
    averageTransactionValue: totalTransactions > 0 ? totalSalesVolume / totalTransactions : 0,
    averageVendorPayout: totalTransactions > 0 ? vendorPayoutAccrued / totalTransactions : 0,
    averageVendorPayment: vendorPaymentsCount > 0 ? vendorPayoutPaid / vendorPaymentsCount : 0,
  };

  res.render('pages/admin-vendors', {
    vendors,
    stats,
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

  try {
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
  } catch (error) {
    console.error('Error updating vendor:', error);
    // Fetch vendor again to render the form
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

    const schema = parseReceiptSchema(vendor.receiptTemplate, vendor.name);

    res.render('pages/admin-edit-vendor', {
      vendor: { ...vendor, name, category, productType, description, defaultCommissionPercent }, // Preserve user input
      user: req.session.user,
      templateSchema: JSON.stringify(schema),
      sampleProduct: vendor.products?.[0] || null,
      error: 'Ошибка при обновлении вендора. Проверьте введенные данные.'
    });
  }
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
    error: null,
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
    return res.status(400).render('pages/admin-pay-vendor', {
      vendor,
      error: 'Сумма пополнения должна быть больше нуля',
      user: req.session.user
    });
  }

  const balanceBefore = Number(vendor.balance ?? 0);
  const balanceAfter = balanceBefore - paymentAmount;

  await prisma.$transaction(async (tx) => {
    await tx.vendorPayment.create({
      data: {
        vendorId,
        amount: paymentAmount,
        comment: comment || '',
        balanceBefore,
        balanceAfter,
      }
    });

    await tx.vendor.update({
      where: { id: vendorId },
      data: { balance: balanceAfter }
    });

    // Гасим начисления для вендора (PENDING) на сумму выплаты
    let remaining = paymentAmount;
    const pendingTx = await tx.voucherTransaction.findMany({
      where: { vendorId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });

    for (const row of pendingTx) {
      if (remaining <= 0) break;
      const payout = Number(row.vendorDebt ?? row.adminDebt ?? 0);
      if (payout <= 0) {
        await tx.voucherTransaction.update({
          where: { id: row.id },
          data: { status: 'COMPLETED' },
        });
        continue;
      }

      if (remaining >= payout) {
        remaining -= payout;
        await tx.voucherTransaction.update({
          where: { id: row.id },
          data: {
            status: 'COMPLETED',
            vendorDebt: 0,
          },
        });
      } else {
        const updatedDebt = Math.max(0, payout - remaining);
        remaining = 0;
        await tx.voucherTransaction.update({
          where: { id: row.id },
          data: { vendorDebt: updatedDebt },
        });
      }
    }
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
