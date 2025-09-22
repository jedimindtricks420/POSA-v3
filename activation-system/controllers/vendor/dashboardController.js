import prisma from '../../prisma/client.js';

const TREND_DAYS = 7;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatChartLabel(date) {
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

export const showDashboard = async (req, res) => {
  const user = req.session.user;
  const vendorId = user?.vendorId;

  if (!vendorId) {
    return res.status(403).send('Не удалось определить вендора для сессии');
  }

  const fromDate = startOfDay(new Date(Date.now() - (TREND_DAYS - 1) * 24 * 60 * 60 * 1000));

  try {
    const [vendorRaw, activationsRaw, pendingCount, soldCount, recentActivations, pendingQueue] = await Promise.all([
      prisma.vendor.findUnique({
        where: { id: vendorId },
        select: {
          id: true,
          name: true,
          balance: true,
          defaultCommissionPercent: true,
        },
      }),
      prisma.voucherActivation.findMany({
        where: {
          vendorId,
          activatedAt: {
            gte: fromDate,
          },
        },
        include: {
          voucher: {
            select: {
              value: true,
              productName: true,
              status: true,
            },
          },
        },
      }),
      prisma.voucher.count({
        where: {
          status: 'pending',
          product: {
            vendorId,
          },
        },
      }),
      prisma.voucher.count({
        where: {
          status: 'sold',
          product: {
            vendorId,
          },
        },
      }),
      prisma.voucherActivation.findMany({
        where: { vendorId },
        include: {
          voucher: {
            select: {
              value: true,
              productName: true,
            },
          },
        },
        orderBy: { activatedAt: 'desc' },
        take: 8,
      }),
      prisma.voucher.findMany({
        where: {
          status: {
            in: ['sold', 'pending'],
          },
          product: {
            vendorId,
          },
        },
        include: {
          product: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
    ]);

    const vendor = vendorRaw || {
      id: vendorId,
      name: '—',
      balance: 0,
      defaultCommissionPercent: 0,
    };

    const trendMap = new Map();
    for (let i = 0; i < TREND_DAYS; i += 1) {
      const date = new Date(fromDate);
      date.setDate(fromDate.getDate() + i);
      trendMap.set(date.toISOString().slice(0, 10), 0);
    }

    activationsRaw.forEach((record) => {
      const key = startOfDay(record.activatedAt).toISOString().slice(0, 10);
      if (trendMap.has(key)) {
        trendMap.set(key, trendMap.get(key) + 1);
      }
    });

    const activationTrend = Array.from(trendMap.entries()).map(([key, value]) => ({
      date: formatChartLabel(new Date(key)),
      count: value,
    }));

    const metrics = {
      balance: Number(vendor?.balance ?? 0),
      pendingCount,
      soldCount,
      activationsLast7Days: activationsRaw.length,
    };

    res.render('pages/vendor/dashboard', {
      user,
      vendor,
      metrics,
      activationTrend,
      recentActivations,
      pendingQueue,
    });
  } catch (error) {
    console.error('Vendor dashboard error:', error);
    res.render('pages/vendor/dashboard', {
      user,
      vendor: null,
      metrics: {
        balance: 0,
        pendingCount: 0,
        soldCount: 0,
        activationsLast7Days: 0,
      },
      activationTrend: [],
      recentActivations: [],
      pendingQueue: [],
      error: 'Не удалось загрузить данные дашборда',
    });
  }
};
