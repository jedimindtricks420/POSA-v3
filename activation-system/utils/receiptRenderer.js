import QRCode from 'qrcode';
import { buildVoucherQrUrl } from './qr.js';

const PLACEHOLDERS = {
  '{{vendorName}}': (ctx) => ctx.vendorName,
  '{{merchant}}': (ctx) => ctx.merchantName,
  '{{merchantName}}': (ctx) => ctx.merchantName,
  '{{clientName}}': (ctx) => ctx.clientName,
  '{{date}}': (ctx) => ctx.saleDate,
  '{{time}}': (ctx) => ctx.saleTime,
  '{{saleId}}': (ctx) => ctx.saleId,
  '{{total}}': (ctx) => ctx.totalFormatted,
  '{{voucher}}': (ctx) => ctx.voucherFull,
  '{{voucherMasked}}': (ctx) => ctx.voucherMasked,
  '{{qrUrl}}': (ctx) => ctx.qrUrl,
};

function resolvePlaceholders(text = '', context) {
  return text.replace(/{{[^}]+}}/g, (match) => {
    const resolver = PLACEHOLDERS[match];
    if (resolver) {
      return resolver(context) ?? '';
    }
    const key = match.slice(2, -2).trim();
    return context.variables?.[key] ?? '';
  });
}

export function buildDefaultReceiptSchema(vendorName = 'Vendor') {
  return {
    version: 1,
    meta: {
      title: `${vendorName} Receipt`,
    },
    elements: [
      {
        id: 'heading',
        type: 'heading',
        text: '🧾 Чек продажи',
        align: 'center',
      },
      {
        id: 'divider-1',
        type: 'divider',
        style: 'dashed',
      },
      {
        id: 'merchant-info',
        type: 'text',
        text: 'Продавец: {{merchant}}\nВендор: {{vendorName}}\nДата: {{date}}',
        align: 'left',
      },
      {
        id: 'items-table',
        type: 'line-items',
        showPrice: true,
        showQty: true,
      },
      {
        id: 'total',
        type: 'total',
        label: 'Итого',
      },
      {
        id: 'voucher-block',
        type: 'text',
        text: 'Ваучер: {{voucherMasked}}',
        align: 'left',
      },
      {
        id: 'qr-section',
        type: 'qr',
        caption: 'Сканируйте для активации',
      },
      {
        id: 'footer',
        type: 'text',
        text: 'Спасибо за покупку! Возврат невозможен.',
        align: 'center',
      },
    ],
  };
}

export function parseReceiptSchema(raw, vendorName) {
  if (!raw) {
    return buildDefaultReceiptSchema(vendorName);
  }

  if (typeof raw === 'object') {
    return normaliseSchema(raw, vendorName);
  }

  try {
    const parsed = JSON.parse(raw);
    return normaliseSchema(parsed, vendorName);
  } catch (error) {
    // Legacy text template → convert into simple schema with single text block
    return {
      version: 1,
      meta: {
        title: `${vendorName} Receipt`,
      },
      elements: [
        {
          id: 'legacy-heading',
          type: 'heading',
          text: '🧾 Чек продажи',
          align: 'center',
        },
        {
          id: 'legacy-body',
          type: 'text',
          text: String(raw),
          align: 'left',
        },
        {
          id: 'legacy-qr',
          type: 'qr',
          caption: 'Сканируйте для активации',
        },
      ],
    };
  }
}

function normaliseSchema(schema = {}, vendorName) {
  const base = buildDefaultReceiptSchema(vendorName);
  const elements = Array.isArray(schema.elements) && schema.elements.length
    ? schema.elements.filter((item) => typeof item === 'object' && item.type)
    : base.elements;

  return {
    version: schema.version ?? 1,
    meta: {
      ...base.meta,
      ...(schema.meta || {}),
    },
    elements: elements.map((el, index) => ({
      id: el.id || `el-${index}-${Date.now()}`,
      type: el.type,
      text: typeof el.text === 'string' ? el.text : undefined,
      align: el.align || 'left',
      style: el.style,
      label: el.label,
      showPrice: el.showPrice !== false,
      showQty: el.showQty !== false,
      caption: el.caption,
    })),
  };
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'UZS',
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('UZS', 'сум');
}

function buildContext(sample) {
  const saleDate = sample.date ?? new Date();
  return {
    ...sample,
    saleDate: saleDate.toLocaleDateString('ru-RU'),
    saleTime: saleDate.toLocaleTimeString('ru-RU', { hour12: false }),
    saleId: sample.saleId ?? '00001',
    totalFormatted: formatCurrency(sample.total ?? 0),
    voucherFull: sample.voucherFull ?? 'TEST-CODE-123456',
    voucherMasked: sample.voucherMasked ?? 'TEST-******-3456',
  };
}

async function renderElement(element, context) {
  switch (element.type) {
    case 'heading':
      return `<h1 class="receipt-heading" data-id="${element.id}" style="text-align:${element.align || 'left'}">${resolvePlaceholders(element.text ?? '', context)}</h1>`;
    case 'text':
      return `<pre class="receipt-text" data-id="${element.id}" style="text-align:${element.align || 'left'}">${resolvePlaceholders(element.text ?? '', context)}</pre>`;
    case 'divider':
      return `<hr class="receipt-divider receipt-divider-${element.style || 'solid'}" data-id="${element.id}" />`;
    case 'line-items':
      return renderLineItems(element, context);
    case 'total':
      return `<div class="receipt-total" data-id="${element.id}"><span>${element.label || 'Итого'}</span><span>${context.totalFormatted}</span></div>`;
    case 'qr':
      return await renderQr(element, context);
    default:
      return '';
  }
}

function renderLineItems(element, context) {
  const items = Array.isArray(context.items) ? context.items : [];
  if (!items.length) {
    return `<div class="receipt-line-items" data-id="${element.id}">Нет товаров для отображения</div>`;
  }

  const rows = items.map((item) => {
    const qty = element.showQty ? `<span class="item-qty">${item.qty || 1}×</span>` : '';
    const price = element.showPrice ? `<span class="item-price">${formatCurrency(item.price || 0)}</span>` : '';
    return `<div class="item-row"><div class="item-name">${item.name}</div><div class="item-meta">${qty}${price}</div></div>`;
  }).join('');

  return `<div class="receipt-line-items" data-id="${element.id}">${rows}</div>`;
}

async function renderQr(element, context) {
  try {
    const qrTarget = resolveQrTarget(context);
    const dataUrl = await QRCode.toDataURL(qrTarget, {
      width: 164,
      margin: 0,
    });
    const caption = resolvePlaceholders(element.caption || '', context);
    return `
      <div class="receipt-qr" data-id="${element.id}">
        <img src="${dataUrl}" alt="QR" />
        ${caption ? `<p>${caption}</p>` : ''}
      </div>
    `;
  } catch (error) {
    return `<div class="receipt-qr" data-id="${element.id}">
      <div class="qr-fallback">QR недоступен</div>
    </div>`;
  }
}

function resolveQrTarget(context = {}) {
  if (context.qrUrl && typeof context.qrUrl === 'string') {
    return context.qrUrl;
  }
  const voucherCode = context.voucherFull || context.voucherMasked || '';
  if (!voucherCode) {
    return 'https://wallet.namo.uz/activate/demo';
  }
  try {
    return buildVoucherQrUrl({
      voucherCode,
      origin: context.qrOrigin || context.origin || null,
    });
  } catch (error) {
    return `https://wallet.namo.uz/activate?voucher=${encodeURIComponent(voucherCode)}`;
  }
}

export async function renderReceiptPreview(schema, sample) {
  const context = buildContext(sample);
  const parts = await Promise.all((schema.elements || []).map((element) => renderElement(element, context)));
  const bodyContent = parts.join('\n');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${schema.meta?.title || 'Preview receipt'}</title>
  <style>
    :root {
      color-scheme: light;
      font-family: 'Roboto', 'Segoe UI', sans-serif;
    }
    body {
      margin: 0;
      background: #f5f5f5;
      padding: 12px;
    }
    .receipt-wrapper {
      width: 320px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 12px 35px rgba(15, 23, 42, 0.18);
      overflow: hidden;
    }
    .receipt-paper {
      padding: 24px 20px 32px;
      background: repeating-linear-gradient(180deg, #ffffff 0, #ffffff 24px, rgba(148, 163, 184, 0.08) 24px, rgba(148, 163, 184, 0.08) 25px);
    }
    .receipt-heading {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 12px;
      letter-spacing: 0.03em;
    }
    .receipt-text {
      font-size: 14px;
      line-height: 1.5;
      color: #1e293b;
      margin: 0 0 16px;
      background: transparent;
      border: none;
      white-space: pre-wrap;
    }
    .receipt-divider-solid {
      border: none;
      border-top: 1px solid rgba(148, 163, 184, 0.6);
      margin: 16px 0;
    }
    .receipt-divider-dashed {
      border: none;
      border-top: 1px dashed rgba(148, 163, 184, 0.6);
      margin: 16px 0;
    }
    .receipt-line-items {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 20px 0 24px;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 14px;
      color: #0f172a;
    }
    .item-name {
      flex: 1;
      font-weight: 500;
    }
    .item-meta {
      display: flex;
      gap: 8px;
      color: #475569;
      font-variant-numeric: tabular-nums;
    }
    .item-price {
      font-weight: 600;
      color: #0f172a;
    }
    .receipt-total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 16px;
      font-weight: 700;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(148, 163, 184, 0.2);
      color: #0f172a;
    }
    .receipt-qr {
      margin-top: 24px;
      text-align: center;
    }
    .receipt-qr img {
      width: 164px;
      height: 164px;
    }
    .receipt-qr p {
      margin-top: 12px;
      font-size: 12px;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .qr-fallback {
      width: 164px;
      height: 164px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px dashed rgba(148, 163, 184, 0.8);
      color: #475569;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="receipt-wrapper">
    <div class="receipt-paper">
      ${bodyContent}
    </div>
  </div>
</body>
</html>`;
}

export function buildSampleReceiptData(options = {}) {
  const product = options.product || {
    name: 'Цифровой продукт',
    price: 100000,
  };

  const merchantName = options.merchantName || 'Demo Merchant';
  const voucherCode = options.voucherCode || 'ABCD-1234-EFGH';

  return {
    vendorName: options.vendorName || 'Vendor',
    merchantName,
    clientName: 'Иван Иванов',
    items: [
      {
        name: product.name,
        qty: 1,
        price: product.price,
      },
    ],
    total: product.price,
    voucherFull: voucherCode,
    voucherMasked: `${voucherCode.slice(0, 4)}-****-${voucherCode.slice(-4)}`,
    qrUrl: options.qrUrl || 'https://wallet.namo.uz/activate?token=demo-preview',
    date: new Date(),
  };
}
