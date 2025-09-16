import prisma from '../../prisma/client.js';

// Панель и история продаж
export const showMerchantDashboard = async (req, res) => {
  const username = req.session.user.username;

  const merchant = await prisma.merchant.findUnique({
    where: { username },
  });

  const sales = await prisma.sale.findMany({
    where: { merchantUsername: username },
    orderBy: { date: 'desc' },
  });

  res.render('pages/merchant-sales', {
    sales,
    user: req.session.user || null
  });
};

export const showMerchantSales = async (req, res) => {
  const user = req.session.user;

  const sales = await prisma.sale.findMany({
    where: { merchantUsername: user.username },
    orderBy: { date: 'desc' },
  });

  const maskedSales = sales.map(sale => ({
    ...sale,
    maskedVoucher: sale.voucherValue.slice(0, 3) + '******'
  }));

  res.render('pages/merchant-sales', {
    sales: maskedSales,
    user
  });
};
