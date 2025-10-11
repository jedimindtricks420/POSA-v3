import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import prisma from '../../prisma/client.js';
import { sendSMS } from '../../utils/smsService.js';
import { normalizePhone } from '../../utils/phone.js';
import { parseReceiptSchema } from '../../utils/receiptRenderer.js';

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

  const updatedQuantities = req.body.quantities || {};
  const saleType = req.body.saleType || 'OFFLINE';
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

  let total = 0;
  const processedVouchers = [];

  const voucherValues = [];
  const saleIds = [];
  const lineItemsMap = new Map();
  let primaryVendor = null;
  let primarySchema = null;

  try {
    // Обработка каждого товара в корзине
    for (const item of cart) {
      const quantity = Number(updatedQuantities[item.productId]) || item.quantity;
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { vendor: true },
      });

      if (!product) continue;

      if (product.vendor && !primaryVendor) {
        primaryVendor = product.vendor;
      }
      if (product.vendor && !primarySchema) {
        primarySchema = parseReceiptSchema(product.vendor.receiptTemplate, product.vendor.name || 'Vendor');
      }

      const productKey = product.id;
      const existingLine = lineItemsMap.get(productKey) || {
        name: product.name,
        qty: 0,
        price: product.price,
      };
      existingLine.qty += quantity;
      lineItemsMap.set(productKey, existingLine);

      for (let i = 0; i < quantity; i++) {
        const voucher = await prisma.voucher.findFirst({
          where: { productId: product.id, status: 'active' }
        });

        if (!voucher) continue;

        // Обновление статуса ваучера
        await prisma.voucher.update({
          where: { id: voucher.id },
          data: { status: 'sold' }
        });

        // Создание записи о продаже
        const saleData = {
          voucherValue: voucher.value,
          price: product.price,
          productId: product.id,
          productName: product.name,
          merchantUsername: user.username,
          receiptPath,
          saleType: saleType,
          customerPhone: normalizedPhone
        };

        const sale = await prisma.sale.create({ data: saleData });
        saleIds.push(sale.id);
        voucherValues.push(voucher.value);

        // Для онлайн продаж создаем связь ваучера с клиентом
        if (saleType === 'ONLINE' && client) {
          await prisma.onlineVoucher.create({
            data: {
              clientId: client.id,
              voucherId: voucher.id,
              assignedAt: new Date()
            }
          });

          // Логирование для кошелька
          await prisma.voucherWalletLog.create({
            data: {
              clientId: client.id,
              voucherId: voucher.id,
              isAddedToWallet: true
            }
          });
        }

        // Создание транзакции ваучера
        await prisma.voucherTransaction.create({
          data: {
            voucherValue: voucher.value,
            merchantId: merchant.id,
            vendorId: product.vendorId,
            productId: product.id,
            productName: product.name,
            price: product.price,
            merchantDebt: product.price * (1 - product.merchantCommissionPercent / 100),
            adminDebt: product.price * (product.vendorCommissionPercent / 100),
            vendorDebt: product.price * (1 - product.vendorCommissionPercent / 100)
          }
        });

        // Обновление баланса вендора
        const vendorDebt = product.price * (1 - product.vendorCommissionPercent / 100);
        const vendor = await prisma.vendor.findUnique({
          where: { id: product.vendorId },
          select: { balance: true }
        });

        const vendorBalance = vendor.balance ?? 0;
        const newVendorBalance = vendorBalance + vendorDebt;

        await prisma.vendor.update({
          where: { id: product.vendorId },
          data: { balance: newVendorBalance }
        });

        // Обновление баланса мерчанта
        const merchantCurrent = await prisma.merchant.findUnique({
          where: { id: merchant.id },
          select: { balance: true }
        });

        const currentBalance = merchantCurrent.balance ?? 0;
        const merchantDebt = product.price * (1 - product.merchantCommissionPercent / 100);
        const newBalance = currentBalance + merchantDebt;

        await prisma.merchant.update({
          where: { id: merchant.id },
          data: { balance: newBalance }
        });

        total += product.price;
        processedVouchers.push({
          voucher: voucher,
          product: product,
          saleId: sale.id,
        });
      }
    }

    // Генерация PDF чека для оффлайн продаж
    if (saleType === 'OFFLINE') {
      const vendorName = primaryVendor?.name || 'Вендор';
      const schema = primarySchema || parseReceiptSchema(primaryVendor?.receiptTemplate, vendorName);
      const lineItems = Array.from(lineItemsMap.values());
      const voucherFull = voucherValues.join('\n');
      const voucherMasked = voucherFull;
      const firstVoucher = voucherValues[0] || '';
      await generatePDFReceipt({
        absolutePath,
        merchant,
        schema,
        context: {
          vendorName,
          merchantName: user.username,
          clientName: normalizedPhone || 'Оффлайн клиент',
          clientPhone: normalizedPhone || '',
          date: formattedDate,
          time: formattedTime,
          saleDate: formattedDate,
          saleTime: formattedTime,
          saleId: saleIds[0] ? String(saleIds[0]) : '',
          items: lineItems,
          total,
          totalFormatted: formatCurrencyUz(total),
          voucherFull,
          voucherMasked,
          qrUrl: firstVoucher ? `${baseUrl}/activate?voucher=${encodeURIComponent(firstVoucher)}` : '',
          variables: {
            customerPhone: normalizedPhone || '',
            merchantLegal: merchant?.legalInfo || '',
          },
        },
      });
    }

    // Отправка SMS для онлайн продаж
    if (saleType === 'ONLINE' && client && processedVouchers.length > 0) {
      await sendVoucherSMS(client, processedVouchers);
    }

    // Очистка корзины
    req.session.cart = [];

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
                iframe.src = '/${receiptPath.replace(/\\\\/g,'/')}';
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
                <a href="/${receiptPath.replace(/\\\\/g,'/')}" target="_blank" class="block w-full bg-slate-200 text-slate-700 py-2 px-4 rounded-lg hover:bg-slate-300 transition-colors">
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
              <div class="bg-slate-50 rounded-lg p-4 mb-6">
                <code class="text-sm text-slate-700">${customerPhone}</code>
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

function formatCurrencyUz(amount = 0) {
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

async function drawReceiptElement(doc, element, context, layout) {
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

async function generatePDFReceipt({ absolutePath, merchant, schema, context }) {
  const doc = new PDFDocument({
    size: [226.8, 820],
    margin: 20,
  });

  const fontPath = path.join(process.cwd(), 'assets', 'fonts', 'Roboto.ttf');
  if (fs.existsSync(fontPath)) {
    doc.registerFont('Roboto', fontPath);
    doc.font('Roboto');
  }

  const writeStream = fs.createWriteStream(absolutePath);
  doc.pipe(writeStream);

  const layout = {
    x: doc.page.margins.left,
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
  };

  if (merchant?.legalInfo) {
    doc.fontSize(9).fillColor('#475569').text(merchant.legalInfo, {
      width: layout.width,
      align: 'left',
    });
    doc.moveDown(0.4);
  }

  const resolvedSchema = schema || parseReceiptSchema(null, context.vendorName || 'Receipt');
  const preparedContext = {
    ...context,
    total: context.total ?? 0,
    totalFormatted: context.totalFormatted ?? formatCurrencyUz(context.total ?? 0),
  };

  if (Array.isArray(resolvedSchema?.elements)) {
    for (const element of resolvedSchema.elements) {
      // eslint-disable-next-line no-await-in-loop
      await drawReceiptElement(doc, element, preparedContext, layout);
    }
  }

  doc.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}

// Функция отправки SMS
async function sendVoucherSMS(client, vouchers) {
  try {
    for (const item of vouchers) {
      // Используем строго заданный шаблон ESKIZ
      const message = `Dobavlen noviy vaucher | Yangi vaucher qo'shildi wallet.namo.uz`;
      
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
