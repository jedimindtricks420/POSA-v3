import prisma from '../prisma/client.js';
import { fetchActivationKeyFromTelegram } from '../utils/telegramHelper.js';

export class ActivationError extends Error {
  constructor(message, code = 'ACTIVATION_FAILED', status = 400) {
    super(message);
    this.name = 'ActivationError';
    this.code = code;
    this.status = status;
  }
}

export async function activateVoucherForVendor({ voucherCode, vendorId, userId }) {
  if (!voucherCode || typeof voucherCode !== 'string') {
    throw new ActivationError('Не указан код ваучера', 'INVALID_INPUT');
  }
  if (!vendorId) {
    throw new ActivationError('Не удалось определить вендора для сессии', 'UNAUTHORIZED', 403);
  }

  const trimmedCode = voucherCode.trim();

  const voucher = await prisma.voucher.findFirst({
    where: { value: trimmedCode },
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

  if (!voucher) {
    throw new ActivationError('Ваучер не найден', 'NOT_FOUND', 404);
  }

  if (!voucher.product || voucher.product.vendorId !== vendorId) {
    throw new ActivationError('Ваучер не принадлежит вашему вендору', 'FORBIDDEN', 403);
  }

  if (!['sold', 'pending'].includes(voucher.status)) {
    throw new ActivationError(`Ваучер нельзя активировать из статуса «${voucher.status}»`, 'INVALID_STATUS', 409);
  }

  const onlineAssignment = voucher.onlineVouchers?.[0] ?? null;
  const clientId = onlineAssignment?.clientId ?? null;

  let activationKey = voucher.value;

  if (voucher.type === 'Telegram') {
    activationKey = await fetchActivationKeyFromTelegram(voucher.value);
  }

  const transaction = await prisma.voucherTransaction.findFirst({
    where: { voucherValue: voucher.value },
    orderBy: { createdAt: 'desc' },
  });

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
        activatedBy: userId ?? null,
        vendorId,
        clientId,
      },
    });

    if (onlineAssignment) {
      await tx.onlineVoucher.deleteMany({
        where: { voucherId: voucher.id },
      });

      await tx.voucherWalletLog.create({
        data: {
          voucherId: voucher.id,
          clientId: onlineAssignment.clientId,
          isAddedToWallet: false,
          pkpassId: 'voucher.activated_vendor',
        },
      });
    }
  });

  return {
    voucher,
    productName: voucher.product?.name || voucher.productName || 'Ваучер',
    activationKey,
    client: onlineAssignment?.client || null,
    wasLinkedToClient: Boolean(onlineAssignment),
  };
}
