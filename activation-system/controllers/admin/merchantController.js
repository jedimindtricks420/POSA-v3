import prisma from '../../prisma/client.js';
import bcrypt from 'bcrypt';

// Список мерчантов с текущим долгом (по балансу)
export const showMerchantsWithDebt = async (req, res) => {
  const merchantsRaw = await prisma.merchant.findMany({
    orderBy: { id: 'asc' },
    select: {
      id: true,
      username: true,
      status: true,
      legalInfo: true,
      balance: true,
    },
  });

  const merchants = merchantsRaw.map((m) => {
    const balance = Number(m.balance ?? 0);
    return {
      ...m,
      balance,
      actualDebt: balance > 0 ? balance : 0,
    };
  });

  const stats = {
    total: merchants.length,
    active: merchants.filter((m) => m.status === 'active').length,
    suspended: merchants.filter((m) => m.status === 'off').length,
    totalDebt: merchants.reduce((sum, m) => sum + m.actualDebt, 0),
  };

  res.render('pages/admin-merchants', {
    merchants,
    stats,
    user: req.session.user,
  });
};

export const showAddMerchantForm = (req, res) => {
  res.render('pages/admin-add-merchant', {
    error: null,
    formData: {
      username: '',
      legalInfo: '',
      status: 'active',
    },
    user: req.session.user,
  });
};

export const handleAddMerchant = async (req, res) => {
  const normalizedUsername = req.body.username?.trim();
  const normalizedLegalInfo = req.body.legalInfo?.trim();
  const desiredStatus = req.body.status === 'off' ? 'off' : 'active';
  const password = req.body.password?.trim();

  const formData = {
    username: normalizedUsername || '',
    legalInfo: normalizedLegalInfo || '',
    status: desiredStatus,
  };

  if (!normalizedUsername || !password || !normalizedLegalInfo) {
    return res.status(400).render('pages/admin-add-merchant', {
      error: 'Заполните логин, пароль и юридическую информацию',
      formData,
      user: req.session.user,
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          username: normalizedUsername,
          password: hashedPassword,
          role: 'merchant',
        },
      });

      await tx.merchant.create({
        data: {
          username: normalizedUsername,
          legalInfo: normalizedLegalInfo,
          status: desiredStatus,
        },
      });
    });

    res.redirect('/admin/merchants');
  } catch (error) {
    console.error('Error creating merchant:', error);
    let errorMessage = 'Не удалось создать мерчанта. Проверьте данные и попробуйте снова.';
    if (error.code === 'P2002') {
      errorMessage = 'Мерчант с таким логином уже существует';
    }

    res.status(400).render('pages/admin-add-merchant', {
      error: errorMessage,
      formData,
      user: req.session.user,
    });
  }
};

export const showEditMerchantForm = async (req, res) => {
  const merchantId = Number(req.params.id);
  const merchantRecord = await prisma.merchant.findUnique({ where: { id: merchantId } });

  if (!merchantRecord) {
    return res.status(404).send('Merchant not found');
  }

  const merchant = {
    ...merchantRecord,
    balance: Number(merchantRecord.balance ?? 0),
  };

  res.render('pages/admin-edit-merchant', {
    merchant,
    error: null,
    user: req.session.user,
  });
};

export const handleEditMerchant = async (req, res) => {
  const merchantId = Number(req.params.id);
  const existing = await prisma.merchant.findUnique({ where: { id: merchantId } });

  if (!existing) {
    return res.status(404).send('Merchant not found');
  }

  const normalizedUsername = req.body.username?.trim();
  const normalizedLegalInfo = req.body.legalInfo?.trim();
  const desiredStatus = req.body.status === 'off' ? 'off' : 'active';
  const newPassword = req.body.password?.trim();

  const merchantView = {
    ...existing,
    username: normalizedUsername || '',
    legalInfo: normalizedLegalInfo || '',
    status: desiredStatus,
    balance: Number(existing.balance ?? 0),
  };

  if (!normalizedUsername || !normalizedLegalInfo) {
    return res.status(400).render('pages/admin-edit-merchant', {
      merchant: merchantView,
      error: 'Логин и юридическая информация обязательны',
      user: req.session.user,
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.merchant.update({
        where: { id: merchantId },
        data: {
          username: normalizedUsername,
          legalInfo: normalizedLegalInfo,
          status: desiredStatus,
        },
      });

      if (normalizedUsername !== existing.username) {
        await tx.user.updateMany({
          where: { username: existing.username, role: 'merchant' },
          data: { username: normalizedUsername },
        });
      }

      if (newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await tx.user.updateMany({
          where: { username: normalizedUsername, role: 'merchant' },
          data: { password: hashedPassword },
        });
      }
    });

    res.redirect('/admin/merchants');
  } catch (error) {
    console.error('Error updating merchant:', error);
    let errorMessage = 'Не удалось сохранить изменения мерчанта';
    if (error.code === 'P2002') {
      errorMessage = 'Мерчант с таким логином уже существует';
    }

    res.status(400).render('pages/admin-edit-merchant', {
      merchant: merchantView,
      error: errorMessage,
      user: req.session.user,
    });
  }
};

// Форма оплаты долга мерчанта
export const showPaymentForm = async (req, res) => {
  const merchantId = Number(req.params.id);
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });

  const { _sum } = await prisma.voucherTransaction.aggregate({
    where: { merchantId, status: 'PENDING' },
    _sum: { merchantDebt: true },
  });

  const actualDebt = Number(_sum.merchantDebt ?? 0);

  res.render('pages/admin-pay-merchant', {
    merchant,
    actualDebt,
    error: null,
    user: req.session.user,
  });
};

// Обработка платежа мерчанта: фиксируем платеж, уменьшаем баланс и гасим PENDING транзакции
export const handleMerchantPayment = async (req, res) => {
  const merchantId = Number(req.params.id);
  const { amount, comment } = req.body;

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) return res.status(404).send('Merchant not found');

  const paymentAmount = parseFloat(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    const { _sum } = await prisma.voucherTransaction.aggregate({
      where: { merchantId, status: 'PENDING' },
      _sum: { merchantDebt: true },
    });
    const actualDebt = Number(_sum.merchantDebt ?? 0);

    return res.status(400).render('pages/admin-pay-merchant', {
      merchant,
      actualDebt,
      user: req.session.user,
      error: 'Сумма платежа должна быть больше нуля',
    });
  }

  const balanceBefore = Number(merchant.balance ?? 0);
  const balanceAfter = balanceBefore - paymentAmount;

  await prisma.$transaction(async (tx) => {
    await tx.merchantPayment.create({
      data: {
        merchantId,
        amount: paymentAmount,
        comment: comment || '',
        balanceBefore,
        balanceAfter,
      },
    });

    await tx.merchant.update({
      where: { id: merchantId },
      data: { balance: balanceAfter },
    });

    // Гасим PENDING транзакции на сумму платежа
    let remaining = paymentAmount;
    const pendingTx = await tx.voucherTransaction.findMany({
      where: { merchantId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });

    for (const row of pendingTx) {
      if (remaining <= 0) break;
      const debt = Number(row.merchantDebt ?? 0);

      if (debt <= 0) {
        await tx.voucherTransaction.update({
          where: { id: row.id },
          data: { status: 'COMPLETED' },
        });
        continue;
      }

      if (remaining >= debt) {
        remaining -= debt;
        await tx.voucherTransaction.update({
          where: { id: row.id },
          data: {
            status: 'COMPLETED',
            merchantDebt: 0,
          },
        });
      } else {
        const updatedDebt = Math.max(0, debt - remaining);
        remaining = 0;
        await tx.voucherTransaction.update({
          where: { id: row.id },
          data: { merchantDebt: updatedDebt },
        });
      }
    }
  });

  res.redirect('/admin/merchants');
};

// История транзакций мерчанта (продажи)
export const showMerchantTransactions = async (req, res) => {
  const merchantId = Number(req.params.id);

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  const transactions = await prisma.voucherTransaction.findMany({
    where: { merchantId },
    orderBy: { createdAt: 'desc' },
  });

  res.render('pages/admin-merchant-transactions', {
    merchant,
    transactions,
    user: req.session.user,
  });
};

// История платежей мерчанта
export const showMerchantPaymentHistory = async (req, res) => {
  const merchantId = Number(req.params.id);

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: {
      payments: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!merchant) {
    return res.status(404).send('Мерчант не найден');
  }

  res.render('pages/admin-merchant-payments', {
    merchant,
    payments: merchant.payments,
  });
};
