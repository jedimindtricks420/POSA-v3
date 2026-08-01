import QRCode from 'qrcode';
import bwipjs from 'bwip-js';
import prisma from '../../../prisma/client.js';
import { buildVoucherQrUrl, extractVoucherCode } from '../../../utils/qr.js';
import { resolveRedeemInstructions } from '../../../utils/receiptRenderer.js';
import {
  resolveStatusPayload,
  requestVoucherCode,
  getVoucherCodeStatus,
  WalletActivationError,
} from '../../../services/walletActivationService.js';

// Товар с этим типом вендора всегда показывается по-старому (QR/штрихкод) —
// код клиенту уже известен сразу, вызывать внешний API не нужно.
const LEGACY_ONLY_TYPE = 'VOUCHER';

function resolveDisplayMode(voucher) {
  const vendor = voucher.product?.vendor;
  if (!vendor || vendor.productType === LEGACY_ONLY_TYPE) return 'qr';
  return voucher.product.walletOnDemandEnabled ? 'ondemand' : 'qr';
}

const DEEP_VOUCHER_INCLUDE = {
  product: {
    include: {
      vendor: true,
      store: true,
      images: { where: { isPrimary: true }, take: 1 },
    },
  },
  rokkyOrder: true,
  drwebOrder: true,
  manastoreOrder: true,
  manualActivationRequest: true,
};

const STATUS_META = {
  active: { label: 'Активен', color: 'bg-emerald-400' },
  activated: { label: 'Активирован', color: 'bg-emerald-500' },
  pending: { label: 'Ожидает', color: 'bg-amber-400' },
  sold: { label: 'Ожидает активации', color: 'bg-amber-500' },
  deleted: { label: 'Недоступен', color: 'bg-rose-400' },
  used: { label: 'Использован', color: 'bg-slate-400' },
};

async function ensureClient(phone) {
  if (!phone) return null;

  let client = await prisma.client.findUnique({ where: { phoneNumber: phone } });
  if (client) return client;

  const fallback = phone.replace(/^\+/, '');
  if (fallback) {
    client = await prisma.client.findUnique({ where: { phoneNumber: fallback } });
    if (client) {
      await prisma.client.update({ where: { id: client.id }, data: { phoneNumber: phone } });
      return client;
    }
  }

  return prisma.client.create({ data: { phoneNumber: phone } });
}

function formatSummary(raw) {
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

async function buildDetail(raw, origin) {
  const summary = formatSummary(raw);
  const product = raw.voucher.product;
  const vendor = product?.vendor || null;
  const displayMode = resolveDisplayMode(raw.voucher);

  const base = {
    ...summary,
    displayMode,
    vendorName: vendor?.name || null,
    vendorProductType: vendor?.productType || null,
    store: product?.store
      ? { name: product.store.name, logoUrl: product.store.logoUrl, themeColor: product.store.themeColor }
      : null,
    productImage: product?.images?.[0]?.url || null,
    redeemInstructions: resolveRedeemInstructions(product, vendor),
    codeStatus: displayMode === 'ondemand' ? resolveStatusPayload(raw.voucher) : null,
    lastSyncAt: new Date().toISOString(),
  };

  if (displayMode === 'ondemand') {
    // Новый вид: код физически не отдаём в ответе, пока клиент его не
    // запросит через POST /voucher/:id/request-code — поэтому QR/штрихкод
    // тут не нужны и не генерируются.
    return base;
  }

  const qrUrl = buildVoucherQrUrl({
    voucherCode: raw.voucher.value,
    origin,
  });
  const passSerial = raw.voucher.value;
  const passUrl = buildPassDownloadUrl(passSerial, origin);

  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    margin: 1,
    width: 320,
  });

  let barcodeDataUrl = null;
  try {
    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text: raw.voucher.value,
      includetext: true,
      scale: 3,
      height: 12,
      textxalign: 'center',
    });
    barcodeDataUrl = `data:image/png;base64,${png.toString('base64')}`;
  } catch (error) {
    console.warn('Failed to create barcode for voucher', raw.voucher.id, error);
  }

  return {
    ...base,
    passSerial,
    qrUrl,
    qrPayload: qrUrl,
    barcodePayload: raw.voucher.value,
    qrDataUrl,
    barcodeDataUrl,
    terms:
      raw.voucher.product?.description ||
      'Используйте этот ваучер согласно условиям продавца. Подробности уточняйте у поддержки.',
    brandColor: '#0A84FF',
    passUrl,
  };
}

export async function list(req, res) {
  const phone = req.session?.client?.phone;
  if (!phone) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const client = await ensureClient(phone);
    const onlineVouchers = await prisma.onlineVoucher.findMany({
      where: { clientId: client.id },
      include: {
        voucher: {
          include: { product: true },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    const vouchers = onlineVouchers
      .filter((item) => {
        const status = item.voucher.status;
        if (['used', 'deleted'].includes(status)) return false;
        // Для QR-ваучеров (VOUCHER-тип) код виден ещё до активации, поэтому
        // activated там можно скрывать как раньше. Для walletOnDemandEnabled
        // товаров активация — это момент, когда код ТОЛЬКО появился, скрывать
        // карточку в этот момент нельзя, иначе клиент физически не увидит код.
        if (status === 'activated' && !item.voucher.product?.walletOnDemandEnabled) return false;
        return true;
      })
      .map(formatSummary);
    res.json({ vouchers, syncedAt: new Date().toISOString() });
  } catch (error) {
    console.error('list vouchers error', error);
    res.status(500).json({ error: 'Failed to load vouchers' });
  }
}

export async function show(req, res) {
  const phone = req.session?.client?.phone;
  if (!phone) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const voucherId = Number(req.params.id);
  if (!Number.isInteger(voucherId)) {
    return res.status(400).json({ error: 'Invalid voucher id' });
  }

  try {
    const client = await ensureClient(phone);
    const onlineVoucher = await prisma.onlineVoucher.findFirst({
      where: {
        voucherId,
        clientId: client.id,
      },
      include: {
        voucher: { include: DEEP_VOUCHER_INCLUDE },
      },
    });

    if (!onlineVoucher) {
      return res.status(404).json({ error: 'Voucher not found' });
    }

    const origin = resolveRequestOrigin(req);
    const detail = await buildDetail(onlineVoucher, origin);
    res.json(detail);
  } catch (error) {
    console.error('show voucher error', error);
    res.status(500).json({ error: 'Failed to load voucher' });
  }
}

// Клиент нажал "Получить код" — вызывает провайдера/создаёт заявку оператору.
export async function requestCode(req, res) {
  const phone = req.session?.client?.phone;
  if (!phone) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const voucherId = Number(req.params.id);
  if (!Number.isInteger(voucherId)) {
    return res.status(400).json({ error: 'Invalid voucher id' });
  }

  try {
    const client = await ensureClient(phone);
    const result = await requestVoucherCode({ voucherId, clientId: client.id });
    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof WalletActivationError) {
      return res.status(error.status).json({ success: false, error: error.message, code: error.code });
    }
    console.error('request voucher code error', error);
    res.status(500).json({ success: false, error: 'Не удалось получить код. Попробуйте ещё раз.' });
  }
}

// Лёгкий поллинг статуса, пока модалка открыта на "Готовим код"/"Заявка передана оператору".
export async function codeStatus(req, res) {
  const phone = req.session?.client?.phone;
  if (!phone) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const voucherId = Number(req.params.id);
  if (!Number.isInteger(voucherId)) {
    return res.status(400).json({ error: 'Invalid voucher id' });
  }

  try {
    const client = await ensureClient(phone);
    const result = await getVoucherCodeStatus({ voucherId, clientId: client.id });
    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof WalletActivationError) {
      return res.status(error.status).json({ success: false, error: error.message, code: error.code });
    }
    console.error('voucher code status error', error);
    res.status(500).json({ success: false, error: 'Не удалось получить статус' });
  }
}

export async function logEvent(req, res) {
  const phone = req.session?.client?.phone;
  if (!phone) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const voucherId = Number(req.params.id);
  const { event, meta } = req.body || {};
  const allowed = new Set(['voucher.view', 'voucher.qr_show', 'voucher.add_to_wallet', 'voucher.share']);
  if (!allowed.has(event)) {
    return res.status(400).json({ error: 'Unsupported event' });
  }

  try {
    const client = await ensureClient(phone);
    const onlineVoucher = await prisma.onlineVoucher.findFirst({
      where: { voucherId, clientId: client.id },
      select: { voucherId: true },
    });

    if (!onlineVoucher) {
      return res.status(404).json({ error: 'Voucher not found' });
    }

    await prisma.voucherWalletLog.create({
      data: {
        voucherId,
        clientId: client.id,
        isAddedToWallet: event === 'voucher.add_to_wallet',
        pkpassId: event,
        deviceInfo: meta?.device || null,
      },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('log voucher event error', error);
    res.status(500).json({ error: 'Failed to log event' });
  }
}

export async function subscribePush(req, res) {
  const phone = req.session?.client?.phone;
  if (!phone) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const subscription = req.body?.subscription;
  if (!subscription?.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription payload' });
  }

  try {
    const client = await ensureClient(phone);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ClientPushSubscription" (
        id SERIAL PRIMARY KEY,
        "clientId" INTEGER NOT NULL REFERENCES "Client"(id) ON DELETE CASCADE,
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT,
        auth TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await prisma.$executeRaw`
      INSERT INTO "ClientPushSubscription" ("clientId", endpoint, p256dh, auth)
      VALUES (${client.id}, ${subscription.endpoint}, ${subscription.keys?.p256dh || null}, ${subscription.keys?.auth || null})
      ON CONFLICT (endpoint)
      DO UPDATE SET "clientId" = EXCLUDED."clientId", p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, "createdAt" = NOW()
    `;

    res.json({ ok: true });
  } catch (error) {
    console.error('push subscription error', error);
    res.status(500).json({ error: 'Failed to store subscription' });
  }
}

class ClaimError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ClaimError';
    this.status = status;
  }
}

export async function claim(req, res) {
  const phone = req.session?.client?.phone;
  if (!phone) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const origin = resolveRequestOrigin(req);
  const payload = req.body?.payload || '';
  const voucherCode = extractVoucherCode(payload);

  if (!voucherCode) {
    return res.status(400).json({ error: 'Не удалось распознать QR код' });
  }

  try {
    const client = await ensureClient(phone);
    const voucher = await prisma.voucher.findUnique({
      where: { value: voucherCode },
      include: {
        product: true,
        onlineVouchers: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!voucher) {
      return res.status(404).json({ error: 'Ваучер не найден' });
    }

    if (!['sold', 'pending'].includes(voucher.status)) {
      return res.status(409).json({ error: `Ваучер находится в статусе «${voucher.status}» и не может быть добавлен` });
    }

    await prisma.$transaction(async (tx) => {
      const current = await tx.onlineVoucher.findUnique({
        where: { voucherId: voucher.id },
      });

      if (current && current.clientId !== client.id) {
        throw new ClaimError('Ваучер уже привязан к другому клиенту', 409);
      }

      const isNewAssignment = !current;

      if (current) {
        await tx.onlineVoucher.update({
          where: { voucherId: voucher.id },
          data: {
            clientId: client.id,
            assignedAt: new Date(),
          },
        });
      } else {
        await tx.onlineVoucher.create({
          data: {
            voucherId: voucher.id,
            clientId: client.id,
            assignedAt: new Date(),
          },
        });
      }

      if (isNewAssignment) {
        await tx.voucherWalletLog.create({
          data: {
            voucherId: voucher.id,
            clientId: client.id,
            isAddedToWallet: true,
            pkpassId: 'voucher.claim_qr',
          },
        });
      }
    });

    const onlineVoucher = await prisma.onlineVoucher.findFirst({
      where: {
        voucherId: voucher.id,
        clientId: client.id,
      },
      include: {
        voucher: {
          include: { product: true },
        },
      },
    });

    if (!onlineVoucher) {
      throw new ClaimError('Не удалось обновить ваучер', 500);
    }

    const detail = await buildDetail(onlineVoucher, origin);
    res.json(detail);
  } catch (error) {
    if (error instanceof ClaimError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('claim voucher error', error);
    res.status(500).json({ error: 'Не удалось добавить ваучер в кошелёк' });
  }
}

function resolveRequestOrigin(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.get('host');
  return `${protocol}://${host}`;
}

function normalizeBaseUrl(candidate) {
  if (!candidate || typeof candidate !== 'string') {
    return null;
  }
  const trimmed = candidate.trim();
  if (!trimmed) {
    return null;
  }
  const prefixed = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return prefixed.replace(/\/+$/, '');
}

function resolveAppBaseUrl(origin) {
  const envBase = process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL;
  const normalizedEnv = normalizeBaseUrl(envBase);
  if (normalizedEnv) {
    return normalizedEnv;
  }
  const normalizedOrigin = normalizeBaseUrl(origin);
  if (normalizedOrigin) {
    return normalizedOrigin;
  }
  return 'https://wallet.namo.uz';
}

function buildPassDownloadUrl(serial, origin) {
  const normalizedSerial = typeof serial === 'string' ? serial.trim() : '';
  if (!normalizedSerial) {
    return null;
  }
  const base = process.env.PASS_BASE_URL || resolveAppBaseUrl(origin);
  const normalizedBase = normalizeBaseUrl(base);
  if (!normalizedBase) {
    return null;
  }
  const encodedSerial = encodeURIComponent(normalizedSerial);
  return `${normalizedBase}/wallet/${encodedSerial}.pkpass`;
}
