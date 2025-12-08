import prisma from '../../prisma/client.js';

// Показать все продажи (для администратора)
export const showSales = async (req, res) => {
  const [sales, totalSalesCount, salesAmountAgg, onlineSalesCount, transactionTotals, vendorBalanceAgg] = await Promise.all([
    prisma.sale.findMany({ orderBy: { date: 'desc' } }),
    prisma.sale.count(),
    prisma.sale.aggregate({ _sum: { price: true } }),
    prisma.sale.count({ where: { saleType: 'ONLINE' } }),
    prisma.voucherTransaction.aggregate({
      _sum: {
        merchantDebt: true,
        vendorDebt: true,
        adminDebt: true,
        price: true,
      },
    }),
    prisma.vendor.aggregate({ _sum: { balance: true } }),
  ]);

  const totalSalesAmount = Number(salesAmountAgg._sum.price ?? 0);
  const platformRevenue = Number(transactionTotals._sum.adminDebt ?? 0);
  const totalMerchantDebt = Number(transactionTotals._sum.merchantDebt ?? 0);
  const totalMerchantCommission = Math.max(0, totalSalesAmount - totalMerchantDebt);
  const vendorPayoutTotal = Number(transactionTotals._sum.vendorDebt ?? 0);
  const vendorOutstanding = Number(vendorBalanceAgg._sum.balance ?? 0);
  const offlineSalesCount = Math.max(0, totalSalesCount - onlineSalesCount);
  const averageCheck = totalSalesCount > 0 ? totalSalesAmount / totalSalesCount : 0;

  const averageMerchantCommission = totalSalesCount > 0 ? totalMerchantCommission / totalSalesCount : 0;
  const averagePlatformRevenue = totalSalesCount > 0 ? platformRevenue / totalSalesCount : 0;

  const stats = {
    totalSales: totalSalesCount,
    onlineSales: onlineSalesCount,
    offlineSales: offlineSalesCount,
    totalAmount: totalSalesAmount,
    averageCheck,
    platformRevenue,
    averagePlatformRevenue,
    vendorPayoutTotal,
    vendorOutstanding,
    merchantCommission: totalMerchantCommission,
    averageMerchantCommission,
  };

  res.render('pages/admin-sales', {
    sales,
    stats,
    user: req.session.user,
  });
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
