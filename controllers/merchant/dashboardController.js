import prisma from '../../prisma/client.js';

// Панель и история продаж
export const showMerchantDashboard = async (req, res) => {
  const username = req.session.user.username;

  const merchant = await prisma.merchant.findUnique({
    where: { username },
    select: { id: true },
  });

  const sales = await prisma.sale.findMany({
    where: { merchantUsername: username },
    orderBy: { date: 'desc' },
  });
  const maskVoucher = (val = '') => {
    if (typeof val !== 'string') val = String(val || '');
    if (val.length <= 3) return val.replace(/.(?=.$)/g, '*');
    return `${val.slice(0, 2)}*******${val.slice(-1)}`;
  };

  const maskedSales = sales.map((s) => ({ ...s, maskedVoucher: maskVoucher(s.voucherValue) }));

  let merchantDebt = 0;
  if (merchant) {
    const { _sum } = await prisma.voucherTransaction.aggregate({
      where: {
        merchantId: merchant.id,
        status: 'PENDING',
      },
      _sum: { merchantDebt: true },
    });
    merchantDebt = Number(_sum.merchantDebt ?? 0);
  }

  // NOTE: сохраняем текущий рендер в merchant-sales (как в проекте), но уже с маской
  res.render('pages/merchant-sales', {
    sales: maskedSales,
    user: req.session.user || null,
    merchantDebt,
  });
};

export const showMerchantSales = async (req, res) => {
  const user = req.session.user;

  const sales = await prisma.sale.findMany({
    where: { merchantUsername: user.username },
    orderBy: { date: 'desc' },
  });

  const maskVoucher = (val = '') => {
    if (typeof val !== 'string') val = String(val || '');
    if (val.length <= 3) return val.replace(/.(?=.$)/g, '*');
    return `${val.slice(0, 2)}*******${val.slice(-1)}`;
  };

  const maskedSales = sales.map((sale) => ({
    ...sale,
    maskedVoucher: maskVoucher(sale.voucherValue),
  }));

  res.render('pages/merchant-sales', {
    sales: maskedSales,
    user
  });
};
