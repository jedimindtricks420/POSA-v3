import prisma from '../../prisma/client.js';
import { fetchActivationKeyFromTelegram } from '../../utils/telegramHelper.js';

const ALLOWED_STATUSES = new Set(['sold', 'pending']);

function buildViewModel({ user, form = {}, error = null, success = null }) {
  return {
    user,
    form: {
      code: form.code ?? '',
    },
    error,
    success,
  };
}

export const showActivationForm = (req, res) => {
  const user = req.session.user;
  res.render('pages/vendor/activate', buildViewModel({ user }));
};

export const handleActivation = async (req, res) => {
  const user = req.session.user;
  const vendorId = user?.vendorId;

  if (!vendorId) {
    return res.status(403).send('Не удалось определить вендора для сессии');
  }

  const code = (req.body?.code || '').trim();

  if (!code) {
    return res.render('pages/vendor/activate', buildViewModel({
      user,
      form: { code },
      error: 'Введите код ваучера',
    }));
  }

  try {
    const voucher = await prisma.voucher.findFirst({
      where: { value: code },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            vendorId: true,
          },
        },
        onlineVouchers: {
          include: {
            client: {
              select: {
                id: true,
                phoneNumber: true,
                name: true,
              },
            },
          },
          orderBy: { assignedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!voucher || voucher.product.vendorId !== vendorId) {
      return res.render('pages/vendor/activate', buildViewModel({
        user,
        form: { code },
        error: 'Ваучер не найден или не принадлежит вашему вендору',
      }));
    }

    if (!ALLOWED_STATUSES.has(voucher.status)) {
      return res.render('pages/vendor/activate', buildViewModel({
        user,
        form: { code },
        error: `Ваучер нельзя активировать из статуса «${voucher.status}»`,
      }));
    }

    let activationKey;

    if (voucher.type === 'Telegram') {
      activationKey = await fetchActivationKeyFromTelegram(voucher.value);
    }

    const transaction = await prisma.voucherTransaction.findFirst({
      where: { voucherValue: voucher.value },
      orderBy: { createdAt: 'desc' },
    });

    const clientId = voucher.onlineVouchers?.[0]?.clientId ?? null;

    await prisma.$transaction(async (tx) => {
      await tx.voucher.update({
        where: { id: voucher.id },
        data: {
          status: 'activated',
        },
      });

      if (transaction && transaction.status !== 'COMPLETED') {
        await tx.voucherTransaction.update({
          where: { id: transaction.id },
          data: {
            status: 'COMPLETED',
          },
        });
      }

      await tx.voucherActivation.create({
        data: {
          voucherId: voucher.id,
          activatedBy: user.id,
          vendorId,
          clientId,
        },
      });
    });

    const successPayload = {
      code: voucher.value,
      productName: voucher.product.name,
      activationKey: activationKey || voucher.value,
    };

    res.render('pages/vendor/activate', buildViewModel({
      user,
      success: successPayload,
    }));
  } catch (error) {
    console.error('Vendor activation error:', error);
    res.render('pages/vendor/activate', buildViewModel({
      user,
      form: { code },
      error: 'Не удалось активировать ваучер. Попробуйте ещё раз или обратитесь к администратору.',
    }));
  }
};
