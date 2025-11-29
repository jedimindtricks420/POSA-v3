import prisma from '../../prisma/client.js';

// Показать все продажи (для администратора)
export const showSales = async (req, res) => {
  const sales = await prisma.sale.findMany({
    orderBy: { date: 'desc' }
  });
  res.render('pages/admin-sales', { sales });
};

// Подтверждение продажи
export const confirmCheckout = async (req, res) => {
  const user = req.session.user; // merchant

  // Извлекаем корзину из сессии
  const cart = req.session.cart || [];

  if (!cart.length) {
    return res.redirect('/merchant/sell'); // если корзина пуста
  }

  for (const item of cart) {
    const { productId, quantity } = item;

    const product = await prisma.product.findUnique({ where: { id: productId } });

    const vouchers = await prisma.voucher.findMany({
      where: {
        productId,
        status: 'active'
      },
      take: quantity
    });

    if (vouchers.length < quantity) {
      return res.send('Недостаточно доступных ваучеров');
    }

    for (let i = 0; i < vouchers.length; i++) {
      const voucher = vouchers[i];

      await prisma.voucher.update({
        where: { id: voucher.id },
        data: { status: 'sold' }
      });

      await prisma.sale.create({
        data: {
          voucherValue: voucher.value,
          price: product.price,
          productId: product.id,
          productName: product.name,
          merchantUsername: user.username
        }
      });

      // создаём запись в таблице VoucherTransaction c едиными формулами комиссий
      const merchantDebt = product.price * (1 - product.merchantCommissionPercent / 100);
      const vendorPayout = product.price * (1 - product.vendorCommissionPercent / 100);
      const platformMargin = product.price * (product.vendorCommissionPercent / 100);

      // создаём запись в таблице VoucherTransaction
      const merchant = await prisma.merchant.findUnique({
        where: { username: user.username }
      });

      await prisma.voucherTransaction.create({
        data: {
          voucherValue: voucher.value,
          merchantId: merchant.id,
          vendorId: product.vendorId,
          productId: product.id,
          productName: product.name,
          price: product.price,
          merchantDebt,
          vendorDebt: vendorPayout,
          adminDebt: platformMargin
        }
      });

      // Изменяем баланс вендора (платформа должна ему)
      await prisma.vendor.update({
        where: { id: product.vendorId },
        data: {
          balance: {
            increment: vendorPayout
          }
        }
      });

      // Увеличиваем долг мерчанта (balance) на его payable
      await prisma.merchant.update({
        where: { username: user.username },
        data: {
          balance: {
            increment: merchantDebt
          }
        }
      });
    }
  }

  // очищаем корзину
  req.session.cart = [];

  res.redirect('/merchant/sales');
};
