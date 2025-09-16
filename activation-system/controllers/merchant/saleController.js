import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import prisma from '../../prisma/client.js';
import { sendSMS } from '../../utils/smsService.js';

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
  const customerPhone = req.body.customerPhone || null;
  const cart = req.session.cart || [];

  if (cart.length === 0) {
    return res.status(400).send('Корзина пуста');
  }

  // Валидация для онлайн продаж
  if (saleType === 'ONLINE') {
    if (!customerPhone || !customerPhone.match(/^\+998[0-9]{9}$/)) {
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

  // Поиск или создание клиента для онлайн продаж
  let client = null;
  if (saleType === 'ONLINE') {
    client = await prisma.client.findFirst({
      where: { phoneNumber: customerPhone }
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          phoneNumber: customerPhone
        }
      });
    }
  }

  let total = 0;
  const processedVouchers = [];

  // Получение шаблона чека
  let template = `{{product}} — {{voucher}} — {{price}} сум`;
  const firstProductId = cart[0]?.productId;
  if (firstProductId) {
    const firstProduct = await prisma.product.findUnique({ where: { id: firstProductId } });
    if (firstProduct?.vendorId) {
      const vendor = await prisma.vendor.findUnique({ where: { id: firstProduct.vendorId } });
      if (vendor?.receiptTemplate) {
        template = vendor.receiptTemplate;
      }
    }
  }

  try {
    // Обработка каждого товара в корзине
    for (const item of cart) {
      const quantity = Number(updatedQuantities[item.productId]) || item.quantity;
      const product = await prisma.product.findUnique({ where: { id: item.productId } });

      if (!product) continue;

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
          customerPhone: customerPhone
        };

        const sale = await prisma.sale.create({ data: saleData });

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
          templateText: template
            .replace(/{{product}}/g, product.name)
            .replace(/{{voucher}}/g, voucher.value)
            .replace(/{{price}}/g, product.price.toFixed(2))
            .replace(/{{merchant}}/g, user.username)
            .replace(/{{date}}/g, `${formattedDate} ${formattedTime}`)
        });
      }
    }

    // Генерация PDF чека для оффлайн продаж
    if (saleType === 'OFFLINE') {
      await generatePDFReceipt(absolutePath, merchant, processedVouchers, total, formattedDate, formattedTime);
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
                <button onclick="window.print()" class="block w-full bg-slate-200 text-slate-700 py-2 px-4 rounded-lg hover:bg-slate-300 transition-colors">
                  Печать чека
                </button>
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

// Функция генерации PDF чека
async function generatePDFReceipt(absolutePath, merchant, vouchers, total, formattedDate, formattedTime) {
  const doc = new PDFDocument({
    size: [226.8, 1000],
    margin: 10
  });
  
  const fontPath = path.join(process.cwd(), 'assets', 'fonts', 'Roboto.ttf');
  doc.registerFont('Roboto', fontPath);
  doc.font('Roboto');
  
  const writeStream = fs.createWriteStream(absolutePath);
  doc.pipe(writeStream);

  doc.fontSize(18).text('Чек ваучера', { align: 'center' });
  doc.moveDown();

  if (merchant.legalInfo) {
    doc.fontSize(10).text(merchant.legalInfo, { align: 'left' });
    doc.moveDown();
  }

  for (const item of vouchers) {
    doc.fontSize(12).text(item.templateText);
    doc.moveDown(1);

    const qrData = `https://yourdomain.com/activate?voucher=${item.voucher.value}`;
    const qrImageBuffer = await QRCode.toBuffer(qrData);
    doc.image(qrImageBuffer, (doc.page.width - 100) / 2, doc.y, {
      fit: [100, 100],
    });
    doc.moveDown(2);
  }
  
  doc.moveDown(10);
  doc.moveDown().fontSize(14).text(`Итого: ${total.toFixed(2)} сум`, { align: 'left' });
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
  
    const sales = await prisma.sale.findMany({
      where: { merchantUsername: user.username },
      orderBy: { date: 'desc' },
    });
  
    const maskedSales = sales.map(sale => ({
      ...sale,
      maskedVoucher: sale.voucherValue.slice(0, 3) + '******'
    }));
  
    res.render('pages/merchant-sales', {
      sales: maskedSales,
      user
    });
  };