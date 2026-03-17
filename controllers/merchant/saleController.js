import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import prisma from '../../prisma/client.js';
import { sendSMS } from '../../utils/smsService.js';
import { normalizePhone } from '../../utils/phone.js';
import { parseReceiptSchema, resolveReceiptTemplate } from '../../utils/receiptRenderer.js';
import { buildVoucherTokenUrl, buildVoucherQrUrl } from '../../utils/qr.js';


export function buildReceiptQrUrl(serial, origin) {
  const trimmed = typeof serial === 'string' ? serial.trim() : '';
  if (!trimmed) {
    return 'https://wallet.namo.uz/activate/demo';
  }
  const baseOrigin = origin || null;
  try {
    return buildVoucherTokenUrl({ serial: trimmed, origin: baseOrigin });
  } catch (error) {
    try {
      return buildVoucherQrUrl({ voucherCode: trimmed, origin: baseOrigin });
    } catch {
      return `https://wallet.namo.uz/activate?voucher=${encodeURIComponent(trimmed)}`;
    }
  }
}

// Подтвердить покупку
export const confirmCheckout = async (req, res) => {
  const user = req.session.user;
  const merchant = await prisma.merchant.findUnique({
    where: { username: user.username },
    select: {
      id: true,
      legalInfo: true,
      balance: true,
    }
  });

  if (!merchant) {
    return res.status(403).send('Мерчант не найден');
  }

  const rawSaleType = (req.body.saleType || 'OFFLINE').toString().toUpperCase();
  const saleType = rawSaleType === 'ONLINE' ? 'ONLINE' : 'OFFLINE';
  const rawCustomerPhone = req.body.customerPhone || null;
  const normalizedPhone = rawCustomerPhone ? normalizePhone(rawCustomerPhone) : null;
  const cart = req.session.cart || [];

  if (cart.length === 0) {
    return res.status(400).send('Корзина пуста');
  }

  // Валидация для онлайн продаж
  if (saleType === 'ONLINE') {
    if (!normalizedPhone || !normalizedPhone.match(/^\+998[0-9]{9}$/)) {
      return res.status(400).send('Для онлайн продажи требуется корректный номер телефона в формате +998XXXXXXXXX');
    }
  }

  const now = new Date();
  const formattedDate = now.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const formattedTime = now.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const receiptFileName = `receipt-${user.username}-${timestamp}.pdf`;
  const receiptPath = path.join('receipts', receiptFileName);
  const absolutePath = path.join(process.cwd(), receiptPath);
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  // Поиск или создание клиента для онлайн продаж
  let client = null;
  if (saleType === 'ONLINE') {
    client = await prisma.client.findFirst({
      where: { phoneNumber: normalizedPhone }
    });

    if (!client) {
      const fallback = normalizedPhone.replace(/^\+/, '');
      if (fallback) {
        client = await prisma.client.findFirst({ where: { phoneNumber: fallback } });
        if (client) {
          await prisma.client.update({
            where: { id: client.id },
            data: { phoneNumber: normalizedPhone },
          });
        }
      }

      if (!client) {
        client = await prisma.client.create({
          data: {
            phoneNumber: normalizedPhone
          }
        });
      }
    }
  }

  const cartItem = cart[0];
  if (!cartItem) {
    return res.status(400).send('Корзина пуста');
  }

  const product = await prisma.product.findUnique({
    where: { id: cartItem.productId },
    include: { vendor: true },
  });

  if (!product) {
    return res.status(400).send(`Товар с id ${cartItem.productId} недоступен для продажи`);
  }

  const activeVoucher = await prisma.voucher.findFirst({
    where: { productId: product.id, status: 'active' },
    orderBy: { id: 'asc' },
  });

  if (!activeVoucher) {
    return res.status(409).send(`Недостаточно активных ваучеров для товара "${product.name}".`);
  }

  let processedVoucher = null;
  const schemaForVendor = resolveReceiptTemplate(product, product.vendor);


  try {
    const { updatedVoucher, saleId } = await prisma.$transaction(async (tx) => {
      const updated = await tx.voucher.update({
        where: { id: activeVoucher.id },
        data: { status: 'sold' },
        select: { id: true, value: true },
      });

      const sale = await tx.sale.create({
        data: {
          voucherValue: updated.value,
          price: product.price,
          productId: product.id,
          productName: product.name,
          merchantUsername: user.username,
          receiptPath,
          saleType,
          customerPhone: normalizedPhone,
        },
        select: { id: true },
      });

      if (saleType === 'ONLINE' && client) {
        await tx.onlineVoucher.create({
          data: {
            clientId: client.id,
            voucherId: updated.id,
            assignedAt: new Date(),
          },
        });

        await tx.voucherWalletLog.create({
          data: {
            clientId: client.id,
            voucherId: updated.id,
            isAddedToWallet: true,
          },
        });
      }

      const vendorDebt = product.price * (1 - product.vendorCommissionPercent / 100);
      const merchantPayable = product.price * (1 - product.merchantCommissionPercent / 100);

      await tx.voucherTransaction.create({
        data: {
          voucherValue: updated.value,
          merchantId: merchant.id,
          vendorId: product.vendorId,
          productId: product.id,
          productName: product.name,
          price: product.price,
          // Store how much merchant owes the platform for the sale
          merchantDebt: merchantPayable,
          kassaDebt: product.price * (product.vendorCommissionPercent / 100),
          kassaId: product.vendor?.kassaId || null,
          vendorDebt,
        },
      });

      await tx.vendor.update({
        where: { id: product.vendorId },
        data: { balance: { increment: vendorDebt } },
      });

      // Increase merchant balance by the payable part of the sale (price minus commission)
      await tx.merchant.update({
        where: { id: merchant.id },
        data: { balance: { increment: merchantPayable } },
      });

      // P0-1 fix: обновить баланс кассы (оффлайн-продажа)
      const kassaId = product.vendor?.kassaId || null;
      if (kassaId) {
        await tx.kassa.update({
          where: { id: kassaId },
          data: {
            totalReceived: { increment: product.price },
            balance: { increment: product.price * (product.vendorCommissionPercent / 100) },
          },
        });
      }

      return { updatedVoucher: updated, saleId: sale.id };
    });

    processedVoucher = {
      voucher: updatedVoucher,
      product,
      saleId,
    };

    if (saleType === 'OFFLINE') {
      const vendorName = product.vendor?.name || 'Вендор';
      const price = product.price;
      const voucherValue = processedVoucher.voucher.value;
      const segments = [
        {
          schema: schemaForVendor,
          context: {
            vendorName,
            merchantName: user.username,
            clientName: normalizedPhone || 'Оффлайн клиент',
            clientPhone: normalizedPhone || '',
            date: formattedDate,
            time: formattedTime,
            saleDate: formattedDate,
            saleTime: formattedTime,
            saleId: String(processedVoucher.saleId),
            items: [
              {
                name: product.name,
                qty: 1,
                price,
              },
            ],
            total: price,
            totalFormatted: formatCurrencyUz(price),
            voucherFull: voucherValue,
            voucherMasked: voucherValue,
            qrUrl: buildReceiptQrUrl(voucherValue, baseUrl),
            qrOrigin: baseUrl,
            variables: {
              customerPhone: normalizedPhone || '',
              merchantLegal: merchant?.legalInfo || '',
            },
          },
        },
      ];

      await generatePDFReceipt({
        absolutePath,
        merchant,
        segments,
        fallbackSchema: schemaForVendor,
      });
    }

    if (saleType === 'ONLINE' && client) {
      await sendVoucherSMS(client, [processedVoucher]);
    }

    // Очистка корзины
    req.session.cart = [];

    const customerPhoneDisplay = normalizedPhone || rawCustomerPhone || '—';

    // Ответ в зависимости от типа продажи
    if (saleType === 'OFFLINE') {
      res.send(`
        <html>
          <head>
            <title>Продажа завершена</title>
            <meta charset="UTF-8">
            <script src="https://cdn.tailwindcss.com"></script>
            <script>
              function printPdf(){
                const iframe = document.createElement('iframe');
                iframe.style.position = 'fixed';
                iframe.style.right = '0';
                iframe.style.bottom = '0';
                iframe.style.width = '0';
                iframe.style.height = '0';
                iframe.style.border = '0';
                iframe.src = '/${receiptPath.replace(/\\\\/g, '/')}';
                iframe.onload = () => { try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch(e) {} };
                document.body.appendChild(iframe);
              }
              window.addEventListener('load', () => setTimeout(printPdf, 300));
            </script>
          </head>
          <body class="bg-slate-50 min-h-screen flex items-center justify-center">
            <div class="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
              <div class="mb-6">
                <div class="bg-green-100 rounded-full p-3 w-16 h-16 mx-auto mb-4">
                  <svg class="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
                <h2 class="text-2xl font-bold text-slate-900 mb-2">Продажа завершена</h2>
                <p class="text-slate-600">Чек был создан и сохранён</p>
              </div>
              <div class="bg-slate-50 rounded-lg p-4 mb-6">
                <code class="text-sm text-slate-700">${receiptFileName}</code>
              </div>
              <div class="space-y-3">
                <a href="/merchant/sales" class="block w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                  Перейти к продажам
                </a>
                <a href="/${receiptPath.replace(/\\\\/g, '/')}" target="_blank" class="block w-full bg-slate-200 text-slate-700 py-2 px-4 rounded-lg hover:bg-slate-300 transition-colors">
                  Печать чека
                </a>
              </div>
            </div>
          </body>
        </html>
      `);
    } else {
      res.send(`
        <html>
          <head>
            <title>Онлайн продажа завершена</title>
            <meta charset="UTF-8">
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="bg-slate-50 min-h-screen flex items-center justify-center">
            <div class="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
              <div class="mb-6">
                <div class="bg-green-100 rounded-full p-3 w-16 h-16 mx-auto mb-4">
                  <svg class="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                  </svg>
                </div>
                <h2 class="text-2xl font-bold text-slate-900 mb-2">Онлайн продажа завершена</h2>
                <p class="text-slate-600">SMS с ваучером отправлено на номер</p>
              </div>
              <div class="bg-slate-50 rounded-lg п-4 mb-6">
                <code class="text-sm text-slate-700">${customerPhoneDisplay}</code>
              </div>
              <div class="space-y-3">
                <a href="/merchant/sales" class="block w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                  Перейти к продажам
                </a>
                <a href="/merchant/sell" class="block w-full bg-slate-200 text-slate-700 py-2 px-4 rounded-lg hover:bg-slate-300 transition-colors">
                  Новая продажа
                </a>
              </div>
            </div>
          </body>
        </html>
      `);
    }

  } catch (error) {
    console.error('Error during checkout:', error);
    res.status(500).send('Ошибка при оформлении покупки: ' + error.message);
  }
};

const RECEIPT_PLACEHOLDERS = {
  '{{vendorName}}': (ctx) => ctx.vendorName,
  '{{merchant}}': (ctx) => ctx.merchantName,
  '{{merchantName}}': (ctx) => ctx.merchantName,
  '{{clientName}}': (ctx) => ctx.clientName,
  '{{clientPhone}}': (ctx) => ctx.clientPhone ?? ctx.clientName,
  '{{customerPhone}}': (ctx) => ctx.clientPhone ?? ctx.clientName,
  '{{date}}': (ctx) => ctx.date,
  '{{time}}': (ctx) => ctx.time,
  '{{saleDate}}': (ctx) => ctx.saleDate ?? ctx.date,
  '{{saleTime}}': (ctx) => ctx.saleTime ?? ctx.time,
  '{{saleId}}': (ctx) => ctx.saleId,
  '{{total}}': (ctx) => ctx.totalFormatted ?? formatCurrencyUz(ctx.total || 0),
  '{{totalFormatted}}': (ctx) => ctx.totalFormatted ?? formatCurrencyUz(ctx.total || 0),
  '{{totalRaw}}': (ctx) => ctx.total ?? 0,
  '{{voucher}}': (ctx) => ctx.voucherFull,
  '{{voucherMasked}}': (ctx) => ctx.voucherMasked,
  '{{qrUrl}}': (ctx) => ctx.qrUrl,
};

function resolveReceiptPlaceholders(text = '', context = {}) {
  return text.replace(/{{[^}]+}}/g, (match) => {
    const resolver = RECEIPT_PLACEHOLDERS[match];
    if (resolver) {
      const value = resolver(context);
      return value == null ? '' : String(value);
    }
    const key = match.slice(2, -2).trim();
    return context.variables?.[key] ?? '';
  });
}

export function formatCurrencyUz(amount = 0) {
  if (Number.isNaN(amount)) amount = 0;
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'UZS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount)).replace('UZS', 'сум').trim();
}

function maskVoucherCode(value = '') {
  const raw = String(value ?? '').replace(/\s+/g, '');
  if (!raw) return '';
  const cleaned = raw.replace(/[^A-Za-z0-9]/g, '');
  if (cleaned.length <= 3) {
    return cleaned.replace(/.(?=.$)/g, '*');
  }
  const maskedCore = `${cleaned.slice(0, 2)}${'*'.repeat(Math.max(0, cleaned.length - 3))}${cleaned.slice(-1)}`;
  return maskedCore;
}

export async function drawReceiptElement(doc, element, context, layout) {
  const align = element.align || 'left';
  switch (element.type) {
    case 'heading': {
      const text = resolveReceiptPlaceholders(element.text || '', context);
      if (text) {
        doc.fontSize(16).fillColor('#0f172a').text(text, {
          width: layout.width,
          align,
        });
        doc.moveDown(0.8);
      }
      break;
    }
    case 'text': {
      const text = resolveReceiptPlaceholders(element.text || '', context);
      if (text) {
        doc.fontSize(10).fillColor('#1e293b').text(text, {
          width: layout.width,
          align,
        });
        doc.moveDown(0.45);
      }
      break;
    }
    case 'divider': {
      const y = doc.y + 4;
      doc.moveTo(layout.x, y).lineTo(layout.x + layout.width, y);
      if (element.style === 'dashed') {
        doc.dash(2, { space: 2 });
      } else {
        doc.undash();
      }
      doc.strokeColor('#cbd5f5').stroke();
      doc.undash();
      doc.moveDown(0.6);
      break;
    }
    case 'line-items': {
      const items = Array.isArray(context.items) ? context.items : [];
      if (!items.length) {
        doc.fontSize(11).fillColor('#1e293b').text('Нет товаров для отображения', {
          width: layout.width,
        });
        doc.moveDown(0.4);
        break;
      }
      doc.moveDown(0.2);
      const metaWidth = layout.width * 0.38;
      const nameWidth = layout.width - metaWidth;
      for (const item of items) {
        const quantity = item.qty ?? 1;
        const metaParts = [];
        if (element.showQty !== false) metaParts.push(`${quantity}×`);
        if (element.showPrice !== false) metaParts.push(formatCurrencyUz((item.price || 0) * quantity));
        const metaText = metaParts.join('  ');

        doc.fontSize(11).fillColor('#0f172a');
        if (metaText) {
          doc.text(item.name, {
            width: nameWidth,
            continued: true,
          });
          doc.text(metaText, {
            width: metaWidth,
            align: 'right',
          });
        } else {
          doc.text(item.name, { width: layout.width });
        }
        doc.moveDown(0.15);
      }
      doc.moveDown(0.5);
      break;
    }
    case 'total': {
      doc.fontSize(12).fillColor('#0f172a');
      const rowY = doc.y;
      doc.text(element.label || 'Итого', layout.x, rowY, {
        width: layout.width - 90,
        continued: true,
      });
      doc.text(context.totalFormatted ?? formatCurrencyUz(context.total || 0), layout.x + layout.width - 90, rowY, {
        width: 90,
        align: 'right',
      });
      doc.moveDown(0.7);
      break;
    }
    case 'qr': {
      if (context.qrUrl) {
        const qrBuffer = await QRCode.toBuffer(context.qrUrl, { width: 160, margin: 0 });
        const size = 120;
        const startY = doc.y;
        const x = layout.x + (layout.width - size) / 2;
        doc.image(qrBuffer, x, startY, { fit: [size, size] });
        doc.y = startY + size + 8;
      }
      if (element.caption) {
        const caption = resolveReceiptPlaceholders(element.caption, context);
        if (caption) {
          doc.fontSize(9).fillColor('#475569').text(caption, {
            width: layout.width,
            align: 'center',
          });
          doc.moveDown(0.4);
        }
      }
      break;
    }
    default:
      break;
  }
}

export async function generatePDFReceipt({ absolutePath, merchant, segments = [], schema, context, fallbackSchema = null }) {
  const doc = new PDFDocument({
    size: [226.8, 1200],
    margin: 20,
  });

  const fontPath = path.join(process.cwd(), 'assets', 'fonts', 'Roboto.ttf');
  const registerFont = () => {
    if (fs.existsSync(fontPath)) {
      doc.registerFont('Roboto', fontPath);
      doc.font('Roboto');
    }
  };

  registerFont();

  const writeStream = fs.createWriteStream(absolutePath);
  doc.pipe(writeStream);

  const segmentList = segments.length ? segments : [{ schema: schema || fallbackSchema, context }];

  const drawLegalInfo = () => {
    if (merchant?.legalInfo) {
      doc.fontSize(9).fillColor('#475569').text(merchant.legalInfo, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: 'left',
      });
      doc.moveDown(0.4);
    }
  };

  let isFirstSegment = true;

  for (const segment of segmentList) {
    if (!segment || !segment.context) continue;

    if (isFirstSegment) {
      drawLegalInfo();
    } else {
      const estimatedHeight = 220; // примерная высота блока с QR
      if (doc.y + estimatedHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        registerFont();
        drawLegalInfo();
      } else {
        doc.moveDown(1);
        doc.strokeColor('#e2e8f0')
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .stroke();
        doc.moveDown(0.7);
      }
    }

    const effectiveSchema = segment.schema || fallbackSchema || schema || parseReceiptSchema(null, segment.context.vendorName || 'Receipt');
    const preparedContext = {
      ...segment.context,
      total: segment.context.total ?? 0,
      totalFormatted: segment.context.totalFormatted ?? formatCurrencyUz(segment.context.total ?? 0),
    };

    const layout = {
      x: doc.page.margins.left,
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    };

    if (Array.isArray(effectiveSchema?.elements)) {
      for (const element of effectiveSchema.elements) {
        // eslint-disable-next-line no-await-in-loop
        await drawReceiptElement(doc, element, preparedContext, layout);
      }
    }

    isFirstSegment = false;
  }

  doc.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}

// Функция отправки SMS
export async function sendVoucherSMS(client, vouchers) {
  try {
    for (const item of vouchers) {
      const messageLines = ["Dobavlen noviy vaucher | Yangi vaucher qo'shildi https://wallet.namo.uz"];
      const message = messageLines.join('\n');

      const smsResult = await sendSMS(client.phoneNumber, message);

      // Логирование SMS
      await prisma.voucherSmsLog.create({
        data: {
          voucherId: item.voucher.id,
          phoneNumber: client.phoneNumber,
          message: message,
          requestId: smsResult.smsId || smsResult.requestId || 'unknown',
          status: smsResult.success ? 'delivered' : 'rejected',
          statusDate: new Date(),
          response: smsResult.response || smsResult
        }
      });
    }
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
}


export const showMerchantSales = async (req, res) => {
  const user = req.session.user;

  const merchant = await prisma.merchant.findUnique({
    where: { username: user.username },
    select: { id: true },
  });

  const sales = await prisma.sale.findMany({
    where: { merchantUsername: user.username },
    orderBy: { date: 'desc' },
  });

  const maskedSales = sales.map((sale) => ({
    ...sale,
    maskedVoucher: maskVoucherCode(sale.voucherValue),
  }));

  let merchantDebt = 0;
  if (merchant) {
    const { _sum } = await prisma.voucherTransaction.aggregate({
      where: {
        merchantId: merchant.id,
        status: 'PENDING',
      },
      _sum: { merchantDebt: true },
    });
    merchantDebt = Number(_sum.merchantDebt ?? 0);
  }

  res.render('pages/merchant-sales', {
    sales: maskedSales,
    user,
    merchantDebt,
  });
};
