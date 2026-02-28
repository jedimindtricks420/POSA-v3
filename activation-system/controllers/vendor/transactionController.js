import prisma from '../../prisma/client.js';

function maskVoucherValue(value = '') {
  const raw = String(value || '').trim();
  if (raw.length <= 4) {
    return raw.replace(/.(?=..)/g, '*');
  }
  const head = raw.slice(0, 2);
  const tail = raw.slice(-2);
  return `${head}${'*'.repeat(Math.max(0, raw.length - 4))}${tail}`;
}

export const showTransactions = async (req, res) => {
  const user = req.session.user;
  const vendorId = user?.vendorId;

  if (!vendorId) {
    return res.status(403).send('Не удалось определить вендора для сессии');
  }

  try {
    const [
      transactions,
      payments,
      pendingVendorAgg,
      pendingAdminAgg,
      totalVendorAgg,
      totalAdminAgg,
    ] = await Promise.all([
      prisma.voucherTransaction.findMany({
        where: { vendorId },
        include: {
          merchant: {
            select: {
              username: true,
              legalInfo: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.vendorPayment.findMany({
        where: { vendorId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.voucherTransaction.aggregate({
        where: {
          vendorId,
          status: 'PENDING',
        },
        _sum: {
          vendorDebt: true,
        },
      }),
      prisma.voucherTransaction.aggregate({
        where: { vendorId },
        _sum: {
          kassaDebt: true,
        },
      }),
      prisma.voucherTransaction.aggregate({
        where: { vendorId },
        _sum: {
          vendorDebt: true,
        },
      }),
      prisma.voucherTransaction.aggregate({
        where: { vendorId },
        _sum: {
          kassaDebt: true,
        },
      }),
    ]);

    const maskedTransactions = transactions.map((row) => {
      const payoutAmount = Number(row.vendorDebt ?? row.kassaDebt ?? 0);
      return {
        ...row,
        payoutAmount,
        maskedVoucherValue: maskVoucherValue(row.voucherValue),
      };
    });

    const summary = {
      pendingAmount: Number(pendingVendorAgg?._sum?.vendorDebt ?? pendingAdminAgg?._sum?.kassaDebt ?? 0),
      totalAmount: Number(totalVendorAgg?._sum?.vendorDebt ?? totalAdminAgg?._sum?.kassaDebt ?? 0),
      lastPayment: payments[0] ? payments[0].createdAt : null,
    };

    res.render('pages/vendor/transactions', {
      user,
      transactions: maskedTransactions,
      payments,
      summary,
    });
  } catch (error) {
    console.error('Vendor transactions error:', error);
    res.render('pages/vendor/transactions', {
      user,
      transactions: [],
      payments: [],
      summary: {
        pendingAmount: 0,
        totalAmount: 0,
        lastPayment: null,
      },
      error: 'Не удалось загрузить финансовые данные',
    });
  }
};
