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

  let total = 0;

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

      // считаем сумму
      total += product.price;

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
          merchantDebt: product.price, // пока без учёта комиссий
          adminDebt: product.price * (product.vendorCommissionPercent / 100)
        }
      });
    }
  }

  // Изменение баланса Вендора
  await prisma.vendor.update({
    where: { id: product.vendorId },
    data: {
      balance: {
        increment: product.price * (product.vendorCommissionPercent / 100)
      }
    }
  });

  // Увеличиваем долг мерчанта (balance)
  await prisma.merchant.update({
    where: { username: user.username },
    data: {
      balance: {
        increment: total
      }
    }
  });

  // очищаем корзину
  req.session.cart = [];

  res.redirect('/merchant/sales');
};
