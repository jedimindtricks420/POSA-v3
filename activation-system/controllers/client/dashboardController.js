import prisma from '../../prisma/client.js';

const STATUS_META = {
  active: { label: 'Активен', color: 'bg-emerald-400' },
  activated: { label: 'Активирован', color: 'bg-emerald-500' },
  pending: { label: 'Ожидает', color: 'bg-amber-400' },
  sold: { label: 'Ожидает активации', color: 'bg-amber-500' },
  deleted: { label: 'Недоступен', color: 'bg-rose-400' },
  used: { label: 'Использован', color: 'bg-slate-400' },
};

function formatVoucher(raw) {
  const meta = STATUS_META[raw.voucher.status] || STATUS_META.active;
  return {
    id: raw.voucher.id,
    onlineVoucherId: raw.id,
    value: raw.voucher.value,
    displayValue: raw.voucher.value.slice(0, 4) + ' •••• ' + raw.voucher.value.slice(-4),
    status: raw.voucher.status,
    statusLabel: meta.label,
    statusColor: meta.color,
    productName: raw.voucher.product?.name || raw.voucher.productName || 'Ваучер',
    assignedAt: raw.assignedAt.toLocaleDateString('ru-RU'),
    assignedAtISO: raw.assignedAt.toISOString(),
  };
}

export async function showDashboard(req, res) {
  const phone = req.session?.client?.phone;
  if (!phone) {
    return res.redirect('/wallet');
  }

  try {
    console.log('Rendering client dashboard for', phone);
    let client = await prisma.client.findUnique({
      where: { phoneNumber: phone },
      include: {
        onlineVouchers: {
          include: {
            voucher: {
              include: {
                product: true,
              },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    if (!client) {
      client = await prisma.client.create({
        data: { phoneNumber: phone },
        include: {
          onlineVouchers: {
            include: {
              voucher: {
                include: { product: true },
              },
            },
            orderBy: { assignedAt: 'desc' },
          },
        },
      });
    }

    const vouchers = (client.onlineVouchers || [])
      .filter((item) => !['activated', 'used', 'deleted'].includes(item.voucher.status))
      .map(formatVoucher);

    res.render('pages/client-dashboard', {
      phone,
      vouchers,
      pushPublicKey: process.env.WALLET_VAPID_PUBLIC_KEY || null,
    });
  } catch (error) {
    console.error('Client dashboard error:', error);
    console.error('Client dashboard error:', error);
    res.status(500).render('pages/client-dashboard', {
      phone,
      vouchers: [],
      pushPublicKey: process.env.WALLET_VAPID_PUBLIC_KEY || null,
    });
  }
}
