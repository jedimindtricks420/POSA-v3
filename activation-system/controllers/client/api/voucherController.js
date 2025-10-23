import QRCode from 'qrcode';
import bwipjs from 'bwip-js';
import prisma from '../../../prisma/client.js';
import { buildVoucherQrUrl, extractVoucherCode } from '../../../utils/qr.js';

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
  const qrUrl = buildVoucherQrUrl({
    voucherCode: raw.voucher.value,
    origin,
  });

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
    ...summary,
    qrUrl,
    qrPayload: qrUrl,
    barcodePayload: raw.voucher.value,
    qrDataUrl,
    barcodeDataUrl,
    terms:
      raw.voucher.product?.description ||
      'Используйте этот ваучер согласно условиям продавца. Подробности уточняйте у поддержки.',
    brandColor: '#0A84FF',
    lastSyncAt: new Date().toISOString(),
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
      .filter((item) => !['activated', 'used', 'deleted'].includes(item.voucher.status))
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
        voucher: {
          include: { product: true },
        },
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
