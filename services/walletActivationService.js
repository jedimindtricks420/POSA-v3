import prisma from '../prisma/client.js';
import rokkyService from './rokkyService.js';
import drwebService from './drwebService.js';
import manastoreService from './manastoreService.js';
import telegramService from './telegramService.js';

// Типы вендоров, для которых в кошельке доступна кнопка "Получить код".
// VOUCHER сюда не входит — там код известен клиенту сразу, без вызова API.
const ONDEMAND_TYPES = ['ROKKY', 'DRWEB', 'MANASTORE', 'MANUAL'];

export class WalletActivationError extends Error {
  constructor(message, code = 'ACTIVATION_FAILED', status = 400) {
    super(message);
    this.name = 'WalletActivationError';
    this.code = code;
    this.status = status;
  }
}

async function loadOnlineVoucher(voucherId, clientId) {
  const online = await prisma.onlineVoucher.findFirst({
    where: { voucherId, clientId },
    include: {
      client: true,
      voucher: {
        include: {
          product: { include: { vendor: true, store: true } },
          rokkyOrder: true,
          drwebOrder: true,
          manastoreOrder: true,
          manualActivationRequest: true,
        },
      },
    },
  });

  if (!online) {
    throw new WalletActivationError('Ваучер не найден в вашем кошельке', 'NOT_FOUND', 404);
  }
  return online;
}

function assertOnDemandEligible(voucher) {
  const productType = voucher.product?.vendor?.productType;
  if (!ONDEMAND_TYPES.includes(productType)) {
    throw new WalletActivationError('Получение кода по запросу недоступно для этого товара', 'NOT_ELIGIBLE', 400);
  }
  if (!voucher.product.walletOnDemandEnabled) {
    throw new WalletActivationError('Получение кода по запросу пока не включено для этого товара', 'NOT_ENABLED', 400);
  }
}

/**
 * Собирает текущее состояние без вызова внешних API — только чтение уже
 * сохранённых заказов/заявок. Используется и для request-code (идемпотентность),
 * и для отдельного поллинга статуса.
 */
export function resolveStatusPayload(voucher) {
  const productType = voucher.product?.vendor?.productType;

  if (voucher.status === 'activated') {
    let key = null;
    if (productType === 'ROKKY') key = voucher.rokkyOrder?.key || null;
    else if (productType === 'DRWEB') key = voucher.drwebOrder?.key || null;
    else if (productType === 'MANASTORE') key = voucher.manastoreOrder?.key || null;
    else if (productType === 'MANUAL') key = voucher.manualActivationRequest?.key || null;
    return { status: 'ready', key };
  }

  if (productType === 'MANUAL') {
    const req = voucher.manualActivationRequest;
    if (req?.status === 'PENDING') return { status: 'pending', requestId: req.id };
    if (req?.status === 'REJECTED') return { status: 'error', message: 'Заявка отклонена оператором. Обратитесь в поддержку.' };
  }
  if (productType === 'MANASTORE') {
    const order = voucher.manastoreOrder;
    if (order?.status === 'PENDING') return { status: 'pending' };
    if (order?.status === 'FAILED') return { status: 'error', message: 'Поставщик временно недоступен' };
  }
  if (productType === 'ROKKY' && voucher.rokkyOrder?.status === 'FAILED') {
    return { status: 'error', message: 'Поставщик временно недоступен' };
  }
  if (productType === 'DRWEB' && voucher.drwebOrder?.status === 'FAILED') {
    return { status: 'error', message: 'Поставщик временно недоступен' };
  }

  return { status: 'idle' };
}

async function finalizeActivation({ voucherId, vendorId, clientId }) {
  await prisma.$transaction([
    prisma.voucher.update({ where: { id: voucherId }, data: { status: 'activated' } }),
    prisma.voucherActivation.create({
      data: { voucherId, vendorId, clientId, activatedBy: null },
    }),
  ]);
}

async function notifyManualRequest({ voucher, client, manualRequest }) {
  try {
    if (voucher.product.storeId) {
      const notification = telegramService.formatActivationNotification(
        voucher, client, voucher.product.store, voucher.product, manualRequest.id
      );
      await telegramService.sendNotificationToStore(voucher.product.storeId, notification);
      return;
    }

    // У товара нет привязанного магазина (обычный случай для wallet-заявок) —
    // шлём во все активные боты, чтобы заявка точно не потерялась и не
    // зависла без уведомления оператору.
    const notification = telegramService.formatActivationNotification(
      voucher, client, { name: 'Кошелёк (без магазина)' }, voucher.product, manualRequest.id
    );
    const bots = await prisma.telegramBot.findMany({ where: { isActive: true } });
    if (bots.length === 0) {
      console.warn(`[WalletActivation] Manual request #${manualRequest.id}: no active Telegram bots configured at all.`);
      return;
    }
    for (const bot of bots) {
      await telegramService.sendNotificationToBot(bot.id, notification);
    }
  } catch (notifyError) {
    console.error('[WalletActivation] Telegram notify failed:', notifyError);
  }
}

/**
 * Запросить код активации по требованию клиента из кошелька.
 * Идемпотентно: повторный вызов для уже запущенного/готового ваучера не
 * дублирует вызовы к внешним API (важно для ManaStore — createOrder списывает
 * реальный кошелёк).
 */
export async function requestVoucherCode({ voucherId, clientId }) {
  const online = await loadOnlineVoucher(voucherId, clientId);
  const voucher = online.voucher;
  assertOnDemandEligible(voucher);

  const existing = resolveStatusPayload(voucher);
  if (existing.status === 'ready') {
    return existing;
  }
  // MANUAL: заявка уже создана и ждёт оператора — переспрашивать нечего.
  if (existing.status === 'pending' && voucher.product.vendor.productType === 'MANUAL') {
    return existing;
  }
  // ROKKY/DRWEB/MANASTORE в статусе pending ниже не блокируются — код для них
  // сам решает, повторно опросить поставщика (ManaStore) или безопасно
  // повторить попытку (Rokky/DrWeb), как это делает и storeController.

  if (!['sold', 'pending'].includes(voucher.status)) {
    throw new WalletActivationError(`Ваучер нельзя активировать из статуса «${voucher.status}»`, 'INVALID_STATUS', 409);
  }

  const productType = voucher.product.vendor.productType;

  await prisma.voucher.update({ where: { id: voucher.id }, data: { status: 'pending' } });

  if (productType === 'MANUAL') {
    let manualRequest = voucher.manualActivationRequest;
    if (!manualRequest) {
      manualRequest = await prisma.manualActivationRequest.create({
        data: { voucherId: voucher.id, status: 'PENDING' },
      });
      await notifyManualRequest({ voucher, client: online.client, manualRequest });
    } else if (manualRequest.status === 'REJECTED') {
      // voucherId уникален в ManualActivationRequest — новую заявку не
      // создать, переоткрываем эту же (иначе клиент навсегда застрянет
      // на старом "отклонено" при повторной попытке).
      manualRequest = await prisma.manualActivationRequest.update({
        where: { id: manualRequest.id },
        data: { status: 'PENDING', key: null, operatorId: null },
      });
      await notifyManualRequest({ voucher, client: online.client, manualRequest });
    }
    return { status: 'pending', requestId: manualRequest.id };
  }

  if (productType === 'ROKKY') {
    const sku = voucher.product.rokkySku;
    if (!sku) throw new WalletActivationError('Товар не настроен для активации (нет Rokky SKU)', 'MISCONFIGURED', 500);

    let order;
    try {
      const result = await rokkyService.createOrder(sku, String(voucher.id), voucher.product.price);
      order = await prisma.rokkyOrder.upsert({
        where: { voucherId: voucher.id },
        update: { rokkyOrderId: result.rokkyOrderId, sku, status: result.status, key: result.key, errorMessage: null },
        create: { voucherId: voucher.id, rokkyOrderId: result.rokkyOrderId, sku, status: result.status, key: result.key },
      });
    } catch (apiError) {
      await prisma.rokkyOrder.upsert({
        where: { voucherId: voucher.id },
        update: { status: 'FAILED', errorMessage: apiError.message },
        create: { voucherId: voucher.id, rokkyOrderId: 'error', sku, status: 'FAILED', errorMessage: apiError.message },
      });
      throw new WalletActivationError('Не удалось получить код у поставщика. Попробуйте ещё раз.', 'PROVIDER_ERROR', 502);
    }

    if (order.status === 'COMPLETED' && order.key) {
      await finalizeActivation({ voucherId: voucher.id, vendorId: voucher.product.vendorId, clientId: online.clientId });
      return { status: 'ready', key: order.key };
    }
    return { status: 'pending' };
  }

  if (productType === 'DRWEB') {
    const sku = voucher.product.drwebSku;
    if (!sku) throw new WalletActivationError('Товар не настроен для активации (нет Dr.Web SKU)', 'MISCONFIGURED', 500);

    let order;
    try {
      const result = await drwebService.createOrder(sku, String(voucher.id), voucher.product.price);
      order = await prisma.drWebOrder.upsert({
        where: { voucherId: voucher.id },
        update: { drwebOrderId: result.drwebOrderId || null, sku, status: result.status, key: result.key, errorMessage: null },
        create: { voucherId: voucher.id, drwebOrderId: result.drwebOrderId || null, sku, status: result.status, key: result.key },
      });
    } catch (apiError) {
      await prisma.drWebOrder.upsert({
        where: { voucherId: voucher.id },
        update: { status: 'FAILED', errorMessage: apiError.message },
        create: { voucherId: voucher.id, drwebOrderId: 'error', sku, status: 'FAILED', errorMessage: apiError.message },
      });
      throw new WalletActivationError('Не удалось получить код у поставщика. Попробуйте ещё раз.', 'PROVIDER_ERROR', 502);
    }

    if (order.status === 'COMPLETED' && order.key) {
      await finalizeActivation({ voucherId: voucher.id, vendorId: voucher.product.vendorId, clientId: online.clientId });
      return { status: 'ready', key: order.key };
    }
    return { status: 'pending' };
  }

  if (productType === 'MANASTORE') {
    const variantId = voucher.product.manastoreVariantId;
    if (!variantId) throw new WalletActivationError('Товар не настроен для активации (нет ManaStore variant id)', 'MISCONFIGURED', 500);

    let order;
    try {
      const existingOrder = voucher.manastoreOrder;

      if (existingOrder && existingOrder.status === 'PENDING') {
        // Идемпотентность: НЕ вызываем createOrder повторно (он списывает
        // реальный кошелёк ManaStore) — просто перечитываем статус заказа.
        const statusResult = await manastoreService.getOrderStatus(existingOrder.manaOrderId);
        order = await prisma.manaStoreOrder.update({
          where: { voucherId: voucher.id },
          data: {
            fulfillmentStatus: statusResult.fulfillmentStatus,
            paymentStatus: statusResult.paymentStatus,
            status: statusResult.status,
            rawContent: JSON.stringify(statusResult.rawContent),
          },
        });

        if (order.status === 'COMPLETED' && !order.key) {
          const content = await manastoreService.getOrderContent(existingOrder.manaOrderId);
          if (content.ready && content.codes.length > 0) {
            order = await prisma.manaStoreOrder.update({
              where: { voucherId: voucher.id },
              data: { key: content.codes[0].code, codes: JSON.stringify(content.codes) },
            });
          }
        }
      } else if (existingOrder && existingOrder.status === 'COMPLETED') {
        order = existingOrder;
      } else {
        // Заказа ещё нет или предыдущая попытка FAILED — можно создавать.
        const result = await manastoreService.createOrder(variantId);
        order = await prisma.manaStoreOrder.upsert({
          where: { voucherId: voucher.id },
          update: {
            environment: manastoreService.environment,
            manaOrderId: result.manaOrderId,
            manaOrderNumber: result.manaOrderNumber,
            variantId,
            fulfillmentStatus: result.fulfillmentStatus,
            paymentStatus: result.paymentStatus,
            status: result.status,
            rawContent: JSON.stringify(result.rawContent),
            errorMessage: null,
          },
          create: {
            voucherId: voucher.id,
            environment: manastoreService.environment,
            manaOrderId: result.manaOrderId,
            manaOrderNumber: result.manaOrderNumber,
            variantId,
            fulfillmentStatus: result.fulfillmentStatus,
            paymentStatus: result.paymentStatus,
            status: result.status,
            rawContent: JSON.stringify(result.rawContent),
          },
        });

        if (order.status === 'COMPLETED') {
          const content = await manastoreService.getOrderContent(order.manaOrderId);
          if (content.ready && content.codes.length > 0) {
            order = await prisma.manaStoreOrder.update({
              where: { voucherId: voucher.id },
              data: { key: content.codes[0].code, codes: JSON.stringify(content.codes) },
            });
          }
        }
      }
    } catch (apiError) {
      await prisma.manaStoreOrder.upsert({
        where: { voucherId: voucher.id },
        update: { status: 'FAILED', errorMessage: apiError.message },
        create: {
          voucherId: voucher.id,
          environment: manastoreService.environment,
          manaOrderId: 'error',
          variantId,
          status: 'FAILED',
          errorMessage: apiError.message,
        },
      });
      throw new WalletActivationError('Не удалось получить код у поставщика. Попробуйте ещё раз.', 'PROVIDER_ERROR', 502);
    }

    if (order.status === 'COMPLETED' && order.key) {
      await finalizeActivation({ voucherId: voucher.id, vendorId: voucher.product.vendorId, clientId: online.clientId });
      return { status: 'ready', key: order.key };
    }
    return { status: 'pending' };
  }

  throw new WalletActivationError('Неизвестный тип вендора', 'UNKNOWN_VENDOR_TYPE', 500);
}

/**
 * Лёгкий поллинг статуса для уже запущенного запроса — не вызывает внешние
 * API повторно для мгновенных типов (Rokky/DrWeb), только перечитывает БД;
 * для ManaStore/Manual, где заказ асинхронный, тоже просто читает текущее
 * состояние (обновление статуса ManaStore происходит при повторном
 * request-code от клиента, а не здесь — это чтение "как есть").
 */
export async function getVoucherCodeStatus({ voucherId, clientId }) {
  const online = await loadOnlineVoucher(voucherId, clientId);
  assertOnDemandEligible(online.voucher);
  return resolveStatusPayload(online.voucher);
}
