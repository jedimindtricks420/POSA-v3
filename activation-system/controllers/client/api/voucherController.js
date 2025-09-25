import QRCode from 'qrcode';
import bwipjs from 'bwip-js';
import prisma from '../../../prisma/client.js';

const STATUS_META = {
  active: { label: 'Активен', color: 'bg-emerald-400' },
  activated: { label: 'Активирован', color: 'bg-emerald-500' },
  pending: { label: 'Ожидает', color: 'bg-amber-400' },
  sold: { label: 'Продан', color: 'bg-amber-500' },
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

async function buildDetail(raw) {
  const summary = formatSummary(raw);
  const qrPayload = raw.voucher.value;

  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    margin: 1,
    width: 320,
  });

  let barcodeDataUrl = null;
  try {
    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text: qrPayload,
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
    qrPayload,
    barcodePayload: qrPayload,
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

    const vouchers = onlineVouchers.map(formatSummary);
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

    const detail = await buildDetail(onlineVoucher);
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
