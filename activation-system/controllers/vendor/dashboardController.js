import prisma from '../../prisma/client.js';

export const showVendorDashboard = (req, res) => {
  res.render('pages/dashboard-vendor', { user: req.session.user, error: null, success: null });
};

export const activateVoucher = async (req, res) => {
  const { code } = req.body;

  try {
    // Ищем ваучер по его значению (коду)
    const voucher = await prisma.voucher.findUnique({ 
      where: { value: code }, 
      include: { product: true } 
    });

    if (!voucher || voucher.status !== 'sold') {
      return res.render('pages/dashboard-vendor', { 
        error: 'Неверный или неактивный ваучер', 
        success: null, 
        user: req.session.user 
      });
    }

    // Ищем последнюю продажу этого ваучера, чтобы получить merchantUsername
    const sale = await prisma.sale.findFirst({
      where: { voucherValue: voucher.value },
      orderBy: { date: 'desc' }
    });

    if (!sale) {
      return res.render('pages/dashboard-vendor', {
        error: 'Продажа для этого ваучера не найдена',
        success: null,
        user: req.session.user
      });
    }

    // Находим мерчанта по merchantUsername
    const merchant = await prisma.merchant.findUnique({
      where: { username: sale.merchantUsername }
    });

    if (!merchant) {
      return res.render('pages/dashboard-vendor', {
        error: 'Мерчант не найден',
        success: null,
        user: req.session.user
      });
    }

    // Активируем ваучер
    await prisma.voucher.update({
      where: { id: voucher.id },
      data: { status: 'activated' }
    });

    // Рассчитываем adminDebt
    const adminDebt = voucher.product.price * (voucher.product.vendorCommissionPercent / 100);

    // Создаём транзакцию с корректным merchantId
    await prisma.voucherTransaction.create
    ({
      data: {
        voucherValue: voucher.value,
        productId: voucher.productId,
        productName: voucher.productName,
        price: voucher.product.price,
        adminDebt,
        merchantDebt: 0,
        vendorId: voucher.product.vendorId,
        merchantId: merchant.id, // 👈 Теперь корректно!
        status: 'COMPLETED',
      }
    });
    
    const vendorId = req.session.user.vendorId;
    const userId = req.session.user.id;

    if (!vendorId) {
      return res.render('pages/dashboard-vendor', {
        error: 'Ошибка: не удалось определить вендора пользователя',
        success: null,
        user: req.session.user
      });
    }

    await prisma.voucherActivation.create({
    data: {
      voucherId: voucher.id,
      activatedBy: req.session.user.id,
      vendorId: req.session.user.vendorId,
    }
    });


    res.render('pages/dashboard-vendor', { 
      success: 'Ваучер успешно активирован', 
      error: null, 
      user: req.session.user 
    });

  } catch (error) {
    console.error(error);
    res.render('pages/dashboard-vendor', { 
      error: 'Ошибка при активации', 
      success: null, 
      user: req.session.user 
    });
  }
};


