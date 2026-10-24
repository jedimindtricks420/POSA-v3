// Приёмник «Универсального WEB-сервиса поставщика услуг» (UWS) — протокол Paynet.
// Направление вызовов: партнёр -> мы. Мы сервер, логин/пароль выдаём мы.
//
// Контракт выверен по официальному тестеру Paynet, он строже текста спецификации:
//  • неверные креды -> HTTP 401, а не JSON-RPC error;
//  • status в GetInformation — строка;
//  • timestamp строго «yyyy-MM-dd HH:mm:ss» в GMT+5;
//  • повторный transactionId -> ошибка 201, а НЕ повтор прежнего успеха;
//  • неудачный PerformTransaction не должен регистрировать transactionId
//    (тестер шлёт неудачные попытки с тем же tid, что и последующую успешную);
//  • в GetStatement попадают только успешные транзакции.
import bcrypt from 'bcrypt';
import prisma from '../../prisma/client.js';
import { PAYNET_ERRORS, PaynetError } from '../../utils/payment/paynetErrors.js';
import { formatPaynet, parsePaynet } from '../../utils/paynetTime.js';
import { normalizeUzMobile } from '../../utils/uzPhone.js';
import * as catalog from '../../services/partnerCatalogService.js';
import { isValidPrice, PRICE_STEP } from '../../utils/priceFormat.js';

// Имена ключей в fields согласовываются с партнёром (вопрос C1).
// До ответа держим их настраиваемыми, со списком вероятных синонимов.
const FIELD_PHONE = process.env.UWS_FIELD_PHONE || 'phone';
const FIELD_CODE = process.env.UWS_FIELD_CODE || 'code';
const PHONE_ALIASES = [FIELD_PHONE, 'phone', 'phone_number', 'msisdn', 'abonent'];
const CODE_ALIASES = [FIELD_CODE, 'code', 'product_code', 'product', 'tariff'];

const pick = (fields, names) => {
  for (const n of names) {
    if (fields && fields[n] != null && String(fields[n]).trim() !== '') return String(fields[n]).trim();
  }
  return null;
};

const isIntLike = (v) => /^\d{1,19}$/.test(String(v ?? '').trim());

export function makeUwsHandler({ partner = 'PAYNET' } = {}) {
  return async function handle(req, res) {
    const rawId = req.body?.id;

    // 1. HTTP Basic. Без заголовка или с неверной парой — строго 401.
    const svc = await authenticate(partner, req.headers.authorization);
    if (!svc) {
      res.set('WWW-Authenticate', 'Basic realm="uws"');
      return res.status(401).end();
    }

    if (req.body == null || typeof req.body !== 'object') return rpcError(res, rawId, PAYNET_ERRORS.PARSE_ERROR);
    const { method, params } = req.body;
    if (!method || typeof method !== 'string') return rpcError(res, rawId, PAYNET_ERRORS.INVALID_REQUEST);
    if (params == null || typeof params !== 'object') return rpcError(res, rawId, PAYNET_ERRORS.NO_PARAMS);

    try {
      const result = await dispatch(partner, svc, method, params);
      return res.json({ jsonrpc: '2.0', id: rawId, result });
    } catch (e) {
      if (e instanceof PaynetError) {
        return res.json({ jsonrpc: '2.0', id: rawId, error: { code: e.code, message: e.rpcMessage } });
      }
      console.error(`[UWS/${partner}] ${method} failed:`, e);
      return rpcError(res, rawId, PAYNET_ERRORS.INTERNAL);
    }
  };
}

function rpcError(res, id, err) {
  return res.json({ jsonrpc: '2.0', id, error: { code: err.code, message: err.message } });
}

async function authenticate(partner, header) {
  if (!header || !header.startsWith('Basic ')) return null;
  let login, password;
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const i = decoded.indexOf(':');
    if (i < 0) return null;
    login = decoded.slice(0, i);
    password = decoded.slice(i + 1);
  } catch { return null; }

  const svc = await catalog.findServiceByLogin(partner, login);
  if (!svc) return null;
  return (await bcrypt.compare(password, svc.passwordHash)) ? svc : null;
}

async function dispatch(partner, svc, method, params) {
  switch (method) {
    case 'GetInformation':    return getInformation(svc, params);
    case 'PerformTransaction':return performTransaction(partner, svc, params);
    case 'CheckTransaction':  return checkTransaction(partner, svc, params);
    case 'CancelTransaction': return cancelTransaction(partner, svc, params);
    case 'GetStatement':      return getStatement(partner, svc, params);
    default: throw new PaynetError(PAYNET_ERRORS.METHOD_NOT_FOUND, method);
  }
}


// Цена позиции обязана быть кратна PRICE_STEP. Если кто-то вписал в
// priceOverride произвольную сумму, продавать нельзя: в терминале с такой
// цены не дадут сдачи. Лучше отказать явно, чем списать неудобную сумму.
function channelPriceOf(item) {
  const price = catalog.effectivePrice(item);
  if (!isValidPrice(price)) {
    console.error(`[UWS] позиция "${item.code}": цена ${price} не кратна ${PRICE_STEP}`);
    throw new PaynetError(PAYNET_ERRORS.SERVICE_UNAVAILABLE, 'некорректная цена позиции');
  }
  return price;
}

// Услуга в запросе должна совпадать с той, под которой партнёр авторизовался.
function assertService(svc, params) {
  if (Number(params.serviceId) !== svc.serviceId) throw new PaynetError(PAYNET_ERRORS.SERVICE_NOT_FOUND);
}

// Разбор fields: сначала номер (301), затем позиция каталога (304).
async function resolveRequest(svc, params, { requireCode }) {
  const fields = params.fields;
  const phoneRaw = pick(fields, PHONE_ALIASES);
  const codeRaw = pick(fields, CODE_ALIASES);

  const phone = normalizeUzMobile(phoneRaw);
  if (!phone) throw new PaynetError(PAYNET_ERRORS.PHONE_NOT_EXIST);

  if (!codeRaw) {
    if (requireCode) throw new PaynetError(PAYNET_ERRORS.PRODUCT_NOT_FOUND);
    return { phone, item: null };
  }
  const item = await catalog.resolveItem(svc.id, codeRaw);
  if (!item) throw new PaynetError(PAYNET_ERRORS.PRODUCT_NOT_FOUND);
  return { phone, item, code: codeRaw };
}

// ---------- GetInformation ----------
async function getInformation(svc, params) {
  assertService(svc, params);
  const { item } = await resolveRequest(svc, params, { requireCode: false });

  // Позиция не указана — отдаём каталог услуги, чтобы терминал построил список.
  if (!item) {
    return { status: '0', timestamp: formatPaynet(), fields: { items: await catalog.listItems(svc) } };
  }

  const available = await catalog.stockOf(item.productId);
  if (available <= 0) throw new PaynetError(PAYNET_ERRORS.QUOTA_EXHAUSTED);

  const price = channelPriceOf(item);
  return {
    status: '0',
    timestamp: formatPaynet(),
    fields: {
      name: item.label,
      price,                        // сумы, цена канала
      amount: catalog.toTiyin(price), // тийины, столько должен списать терминал
      available,
    },
  };
}

// ---------- PerformTransaction ----------
async function performTransaction(partner, svc, params) {
  assertService(svc, params);

  if (!isIntLike(params.transactionId)) throw new PaynetError(PAYNET_ERRORS.REQUIRED_MISSING, 'transactionId');
  const externalTxnId = BigInt(String(params.transactionId).trim());

  const existing = await prisma.partnerTransaction.findUnique({
    where: { partner_externalTxnId: { partner, externalTxnId } },
  });
  if (existing) throw new PaynetError(PAYNET_ERRORS.TXN_EXISTS);

  const { phone, item, code } = await resolveRequest(svc, params, { requireCode: true });

  const channelPrice = channelPriceOf(item);
  const expected = catalog.toTiyin(channelPrice);
  if (!Number.isFinite(Number(params.amount)) || Math.round(Number(params.amount)) !== expected) {
    throw new PaynetError(PAYNET_ERRORS.WRONG_AMOUNT);
  }
  if (await catalog.stockOf(item.productId) <= 0) throw new PaynetError(PAYNET_ERRORS.QUOTA_EXHAUSTED);

  // Заявка-«claim» до выдачи: уникальный индекс (partner, externalTxnId) —
  // единственная надёжная защита от двойной выдачи при повторе запроса.
  let claim;
  try {
    claim = await prisma.partnerTransaction.create({
      data: {
        partner, externalTxnId, partnerServiceId: svc.id, code,
        phone, amount: BigInt(expected), state: 0, // 0 — заявка в работе
      },
    });
  } catch (e) {
    if (e.code === 'P2002') throw new PaynetError(PAYNET_ERRORS.TXN_EXISTS);
    throw e;
  }

  let issued;
  try {
    issued = await issueVoucher({ svc, item, phone, channelPrice });
  } catch (e) {
    // Выдача не состоялась: ваучер не тронут, снимаем заявку и сообщаем
    // ошибку — партнёр не спишет деньги.
    await prisma.partnerTransaction.delete({ where: { id: claim.id } }).catch(() => {});
    throw e;
  }

  // Отсюда и ниже ваучер УЖЕ у клиента. Удалять заявку нельзя ни при каких
  // обстоятельствах, иначе продажа исчезнет из журнала и из выписки, а
  // партнёр сочтёт платёж неуспешным — ваучер уйдёт бесплатно.
  try {
    await prisma.partnerTransaction.update({
      where: { id: claim.id },
      data: { state: 1, saleId: issued.saleId, voucherValue: issued.voucherValue },
    });
  } catch (e) {
    console.error('[UWS] ваучер выдан, но журнал канала не обновлён — требуется ручная сверка',
      { providerTrnId: claim.id, externalTxnId: String(externalTxnId), saleId: issued.saleId,
        voucher: issued.voucherValue, error: e?.message });
    // Намеренно не бросаем: деньги должны быть списаны, товар уже выдан.
  }

  return {
    providerTrnId: claim.id,
    timestamp: formatPaynet(claim.createdAt),
    fields: { name: item.label, price: channelPrice, amount: expected },
  };
}

// Выдача идёт через существующий конвейер POSA — тот же, что у Click/Payme/Alif.
async function issueVoucher({ svc, item, phone, channelPrice }) {
  const product = item.product;
  // Привязка строго к мерчанту канала. Искать «любую активную» нельзя:
  // у товара может быть ссылка живого мерчанта, и продажа из терминала
  // ушла бы ему на баланс.
  const link = await prisma.merchantProductLink.findFirst({
    where: {
      productId: product.id,
      merchantId: svc.merchantId,
      isActive: true,
      merchant: { status: 'active' },
    },
    include: { merchant: true, product: { include: { vendor: { include: { kassa: true } } } } },
  });
  if (!link) throw new PaynetError(PAYNET_ERRORS.SERVICE_UNAVAILABLE, 'товар не подключён к каналу');

  const kassaId = catalog.resolveKassaId(svc);
  const attempt = await prisma.qrPaymentAttempt.create({
    data: {
      linkId: link.id,
      phoneNumber: phone,
      amount: channelPrice, // фактически списанная сумма, а не цена товара
      paymentMethod: 'paynet',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      kassaId,
    },
  });

  const { processPaymentInternal } = await import('../public/qrPaymentController.js');
  const kassa = kassaId ? await prisma.kassa.findUnique({ where: { id: kassaId } }) : null;

  // Одна повторная попытка: проигранная гонка за ваучером ничего не записывает,
  // и следующий заход возьмёт другой свободный код.
  let result = await processPaymentInternal(attempt.id, link, kassa);
  if (!result.success && result.retryable) {
    result = await processPaymentInternal(attempt.id, link, kassa);
  }

  if (!result.success) {
    if (result.error === 'Товар закончился') throw new PaynetError(PAYNET_ERRORS.QUOTA_EXHAUSTED);
    if (result.retryable) throw new PaynetError(PAYNET_ERRORS.SERVICE_UNAVAILABLE, result.error);
    throw new PaynetError(PAYNET_ERRORS.INTERNAL, result.error);
  }

  return { saleId: result.sale.id, voucherValue: result.voucher.value };
}

// ---------- CheckTransaction ----------
async function checkTransaction(partner, svc, params) {
  assertService(svc, params);
  const t = await findTxn(partner, params.transactionId);
  if (!t) throw new PaynetError(PAYNET_ERRORS.TXN_NOT_FOUND);

  // state 0 — заявка осталась незавершённой (процесс прервался между
  // резервированием и выдачей). Ваучер не выдан, поэтому отвечаем «не
  // найдена»: иначе партнёр спишет деньги за товар, которого клиент не получил.
  if (t.state === 0) {
    console.warn('[UWS] CheckTransaction по незавершённой заявке', { providerTrnId: t.id });
    throw new PaynetError(PAYNET_ERRORS.TXN_NOT_FOUND);
  }

  return {
    providerTrnId: t.id,
    timestamp: formatPaynet(t.state === 2 ? (t.cancelledAt ?? t.createdAt) : t.createdAt),
    transactionState: t.state,
  };
}

// ---------- CancelTransaction ----------
async function cancelTransaction(partner, svc, params) {
  assertService(svc, params);
  const t = await findTxn(partner, params.transactionId);
  if (!t || t.state === 0) throw new PaynetError(PAYNET_ERRORS.TXN_NOT_FOUND);
  if (t.state === 2) throw new PaynetError(PAYNET_ERRORS.TXN_CANCELLED);

  const cancelledAt = new Date();
  await prisma.partnerTransaction.update({
    where: { id: t.id },
    data: { state: 2, cancelledAt },
  });
  // Откат выдачи (возврат ваучера, Sale -> CANCELLED, минусовка балансов)
  // здесь пока не реализован: политика отмены уже выданного кода не согласована
  // с Paynet — см. вопрос E3. Отмена фиксируется только в журнале канала.
  return { providerTrnId: t.id, timestamp: formatPaynet(cancelledAt), transactionState: 2 };
}

async function findTxn(partner, transactionId) {
  if (!isIntLike(transactionId)) return null;
  return prisma.partnerTransaction.findUnique({
    where: { partner_externalTxnId: { partner, externalTxnId: BigInt(String(transactionId).trim()) } },
  });
}

// ---------- GetStatement ----------
async function getStatement(partner, svc, params) {
  assertService(svc, params);
  const from = parsePaynet(params.dateFrom);
  const to = parsePaynet(params.dateTo);
  if (!from || !to) throw new PaynetError(PAYNET_ERRORS.BAD_DATETIME);

  const rows = await prisma.partnerTransaction.findMany({
    where: {
      partner,
      partnerServiceId: svc.id,
      state: 1, // в выписке только успешные
      createdAt: { gte: from, lte: to },
    },
    orderBy: { createdAt: 'asc' },
  });

  return {
    statements: rows.map((r) => ({
      amount: Number(r.amount),           // целое, в тийинах
      providerTrnId: r.id,
      transactionId: Number(r.externalTxnId),
      timestamp: formatPaynet(r.createdAt),
    })),
  };
}
