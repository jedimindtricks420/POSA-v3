import prisma from '../../prisma/client.js';



// Главный вход в дашборд - перенаправляет в зависимости от роли
export const showAdminDashboard = async (req, res) => {
  const role = req.session.user?.role;

  if (role === 'financial_mgr') {
    return showFinanceDashboard(req, res);
  }
  if (role === 'content_mgr') {
    return showContentDashboard(req, res);
  }
  if (role === 'support_agent') {
    return showSupportDashboard(req, res);
  }

  // Если admin, показываем полный дашборд
  return showSuperAdminDashboard(req, res);
};

// --- Super Admin (Full) ---
const showSuperAdminDashboard = async (req, res) => {
  try {
    const usersCount = await prisma.user.count();
    const merchantsCount = await prisma.merchant.count();
    const salesCount = await prisma.sale.count();
    const vouchersCount = await prisma.voucher.count();
    const clientsCount = await prisma.client.count();

    res.render('pages/dashboard-admin', {
      user: req.session.user,
      stats: {
        users: usersCount,
        vendors: merchantsCount,
        merchants: merchantsCount,
        sales: salesCount,
        vouchers: vouchersCount,
        clients: clientsCount
      }
    });
  } catch (error) {
    console.error('Dashboard Error:', error);
    res.status(500).send('Ошибка при загрузке данных дашборда');
  }
};

// --- Finance Dashboard ---
const showFinanceDashboard = async (req, res) => {
  try {
    const [merchantDebtAgg, vendorDebtAgg] = await Promise.all([
      // Кто должен нам (мерчанты)
      prisma.voucherTransaction.aggregate({
        _sum: { merchantDebt: true },
        where: { status: 'PENDING' }
      }),
      // Кому должны мы (вендоры)
      prisma.voucherTransaction.aggregate({
        _sum: { vendorDebt: true },
        where: { status: 'PENDING' }
      })
    ]);

    const stats = {
      merchantDebt: merchantDebtAgg._sum.merchantDebt || 0,
      vendorDebt: vendorDebtAgg._sum.vendorDebt || 0,
    };

    res.render('pages/admin-dashboard-finance', {
      user: req.session.user,
      stats
    });
  } catch (err) {
    res.status(500).send('Finance Dashboard Error');
  }
};

// --- Content Dashboard ---
const showContentDashboard = async (req, res) => {
  try {
    const [productsCount, storesCount, lowStockProducts] = await Promise.all([
      prisma.product.count({ where: { status: 'on' } }),
      prisma.store.count({ where: { isActive: true } }),
      // Находим товары, где мало активных ваучеров (сложный запрос, упростим пока до списка)
      prisma.product.findMany({
        where: { status: 'on' },
        include: {
          _count: {
            select: { vouchers: { where: { status: 'active' } } }
          }
        }
      })
    ]);

    // Фильтруем на JS уровне те, у кого < 10
    const criticalProducts = lowStockProducts
      .filter(p => p._count.vouchers < 10)
      .map(p => ({ name: p.name, count: p._count.vouchers }));

    res.render('pages/admin-dashboard-content', {
      user: req.session.user,
      stats: {
        productsCount,
        storesCount,
        criticalProducts
      }
    });
  } catch (err) {
    res.status(500).send('Content Dashboard Error');
  }
};

// --- Support Dashboard ---
const showSupportDashboard = async (req, res) => {
  try {
    const [pendingRequests, recentActivations] = await Promise.all([
      prisma.manualActivationRequest.count({ where: { status: 'PENDING' } }),
      prisma.manualActivationRequest.findMany({
        where: { status: 'COMPLETED' },
        take: 10,
        orderBy: { updatedAt: 'desc' },
        include: { voucher: true }
      })
    ]);

    res.render('pages/admin-dashboard-support', {
      user: req.session.user,
      stats: {
        pendingRequests,
        recentActivations
      }
    });
  } catch (err) {
    res.status(500).send('Support Dashboard Error');
  }
};