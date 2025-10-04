import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import prisma from '../../prisma/client.js';
import QRCode from 'qrcode';


// showMerchantDashboard
export const showMerchantDashboard = async (req, res) => {
  const username = req.session.user.username;

  const merchant = await prisma.merchant.findUnique({
    where: { username },
  });

  const sales = await prisma.sale.findMany({
    where: {
      merchantUsername: username,
    },
    orderBy: {
      date: 'desc',
    },
  });

  res.render('pages/merchant-sales', {
    sales,
    user: req.session.user || null
  });
};

//showMerchantSales
export const showMerchantSales = async (req, res) => {
  const user = req.session.user;

  const sales = await prisma.sale.findMany({
    where: { merchantUsername: user.username },
    orderBy: { date: 'desc' },
  });

  // Маскируем ваучеры для мерчанта
  const maskVoucher = (val = '') => {
    if (typeof val !== 'string') val = String(val || '');
    if (val.length <= 3) return val.replace(/.(?=.$)/g, '*');
    return `${val.slice(0, 2)}*******${val.slice(-1)}`;
  };

  const maskedSales = sales.map((sale) => ({
    ...sale,
    maskedVoucher: maskVoucher(sale.voucherValue),
  }));

  res.render('pages/merchant-sales', {
    sales: maskedSales,
    user
  });
};

/**
 * Показать страницу с товарами для продажи.
 * Если корзина ещё не создана — инициализируем пустую.
 */
export const showProductsForSale = async (req, res) => {
  const products = await prisma.product.findMany({
    where: { status: 'on' },
    orderBy: { id: 'asc' },
  });

  if (!req.session.cart) req.session.cart = [];

  res.render('pages/merchant-sell', {
    products,
    cart: req.session.cart,
    user: req.session.user,
  });
};

/**
 * Добавление товара в корзину.
 * Если товар уже есть — увеличиваем количество.
 */
export const addToCart = async (req, res) => {
  const productId = Number(req.body.productId); // ✅ это и отправляется с формы

  if (!productId) {
    return res.redirect('/merchant/sell');
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return res.status(404).send('Товар не найден');

  if (!req.session.cart) req.session.cart = [];

  const existing = req.session.cart.find(p => p.productId === productId);

  if (existing) {
    existing.quantity += 1;
  } else {
    req.session.cart.push({
      productId,
      name: product.name,
      price: product.price,
      quantity: 1
    });
  }

  res.redirect('/merchant/checkout'); //
};


/**
 * Отображение содержимого корзины.
 */
export const showCart = (req, res) => {
  const cart = req.session.cart || [];

  const enrichedCart = cart.map(item => ({
    ...item,
    total: item.price * item.quantity,
    id: item.productId // чтобы EJS понимал item.id
  }));

  const totalPrice = enrichedCart.reduce((sum, item) => sum + item.total, 0);

  res.render('pages/checkout', {
    items: enrichedCart,
    totalPrice,
    user: req.session.user
  });
};

/**
 * Обновление количества товаров в корзине (или удаление).
 */
export const updateCart = (req, res) => {
  const updates = req.body; // Объект вида: { productId: quantity }

  if (!req.session.cart) req.session.cart = [];

  req.session.cart = req.session.cart
    .map(item => {
      const newQty = parseInt(updates[item.productId]);
      return newQty > 0 ? { ...item, quantity: newQty } : null;
    })
    .filter(Boolean);

  res.redirect('/merchant/checkout');
};

/**
 * Удаление товара из корзины по ID.
 */
export const removeFromCart = (req, res) => {
  const productId = Number(req.params.id);
  if (!req.session.cart) req.session.cart = [];

  req.session.cart = req.session.cart.filter(item => item.productId !== productId);
  res.redirect('/merchant/checkout');
};

/**
 * Подтверждение покупки.
 * Ваучеры получают статус "sold", продажи записываются в таблицу Sale.
 * Корзина очищается.
 */
export const confirmCheckout = async (req, res) => {
  const user = req.session.user;
  const updatedQuantities = req.body.quantities || {};
  const cart = req.session.cart || [];

  if (cart.length === 0) {
    return res.status(400).send('Корзина пуста');
  }

  const sales = [];
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const filename = `receipt_${user.username}_${timestamp}.pdf`;
  const filepath = path.join('/home/admin1/posa/activation-system/receipts', filename); // Абсолютный путь

  const doc = new PDFDocument();
  const writeStream = fs.createWriteStream(filepath);
  doc.pipe(writeStream);

  doc.fontSize(18).text('🧾 Чек продажи', { align: 'center' });
  doc.moveDown();

  let total = 0;

  for (const item of cart) {
    const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '-');
const receiptFileName = `receipt-${user.username}-${timestamp}.pdf`;
const receiptPath = path.join('receipts', receiptFileName); // относительный путь
const absolutePath = path.join('/home/admin1/posa/activation-system', receiptPath);

const doc = new PDFDocument();
const writeStream = fs.createWriteStream(absolutePath);
doc.pipe(writeStream);

doc.fontSize(18).text('🧾 Чек продажи', { align: 'center' });
doc.moveDown();

let total = 0;
const sales = [];

for (const item of cart) {
  const quantity = Number(updatedQuantities[item.productId]) || item.quantity;
  const product = await prisma.product.findUnique({ where: { id: item.productId } });

  if (!product) continue;

  for (let i = 0; i < quantity; i++) {
    const voucher = await prisma.voucher.findFirst({
      where: { productId: product.id, status: 'active' }
    });

    if (!voucher) continue;

    // Обновляем статус ваучера
    await prisma.voucher.update({
      where: { id: voucher.id },
      data: { status: 'sold' }
    });

    // Создаём продажу с путём к PDF
    const sale = await prisma.sale.create({
      data: {
        voucherValue: voucher.value,
        price: product.price,
        productId: product.id,
        productName: product.name,
        merchantUsername: user.username,
        receiptPath: receiptPath // Относительный путь к PDF сохраняем в БД
      }
    });

    sales.push(sale);
    total += product.price;

    // Добавляем строку в PDF
    doc
      .fontSize(12)
      .text(`${product.name} — ${voucher.value} — ${product.price.toFixed(2)} сум`);
      // Генерируем QR-код
      const qrData = `https://yourdomain.com/activate?voucher=${voucher.value}`;
      const qrImageBuffer = await QRCode.toBuffer(qrData);

      // Вставляем QR-код
      doc.image(qrImageBuffer, {
        fit: [100, 100],
        align: 'right',
        valign: 'center'
});
}
}

  doc.moveDown().fontSize(14).text(`💵 Итого: $${total.toFixed(2)}`, { align: 'right' });
  doc.end();

  // Очистка корзины
  req.session.cart = [];

  writeStream.on('finish', () => {
    res.send(`
      <html>
        <body style="text-align:center;font-family:sans-serif;margin-top:50px">
          <h2>✅ Продажа завершена</h2>
          <p>Чек был создан и сохранён на сервере:</p>
          <code>${filename}</code>
          <br><br>
          <a href="/merchant/sales" class="btn btn-primary">Перейти к продажам</a>
          <script>
            window.print();
          </script>
        </body>
      </html>
    `);
  });
}};

// Страница списка мерчантов с долгами
export const showMerchantsWithDebt = async (req, res) => {
  const merchantsRaw = await prisma.merchant.findMany({
    orderBy: { id: 'asc' },
    select: {
      id: true,
      legalInfo: true,
      balance: true
    }
  });

  // Добавим actualDebt = либо баланс, если он отрицательный, либо 0
  const merchants = merchantsRaw.map(m => ({
    ...m,
    actualDebt: m.balance > 0 ? m.balance : 0
  }));

  res.render('pages/admin-merchants', {
    merchants,
    user: req.session.user
  });
};



// Показать форму погашения долга
export const showPaymentForm = async (req, res) => {
  const merchantId = Number(req.params.id);
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });

  const { _sum } = await prisma.voucherTransaction.aggregate({
    where: {
      merchantId,
      status: 'PENDING'
    },
    _sum: { merchantDebt: true }
  });

  const actualDebt = Number(_sum.merchantDebt ?? 0);

  res.render('pages/admin-pay-merchant', {
    merchant,
    actualDebt,
    error: null,
    user: req.session.user
  });
};

// Обработать форму погашения долга
export const handleMerchantPayment = async (req, res) => {
  const merchantId = Number(req.params.id);
  const { amount, comment } = req.body;

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) return res.status(404).send('Merchant not found');

  const paymentAmount = parseFloat(amount);
  const { _sum } = await prisma.voucherTransaction.aggregate({
    where: {
      merchantId,
      status: 'PENDING'
    },
    _sum: { merchantDebt: true }
  });

  const actualDebt = Number(_sum.merchantDebt ?? 0);

  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).render('pages/admin-pay-merchant', {
      merchant,
      actualDebt,
      user: req.session.user,
      error: 'Сумма платежа должна быть больше нуля'
    });
  }

  const balanceBefore = Number(merchant.balance ?? 0);
  const balanceAfter = balanceBefore - paymentAmount;

  await prisma.merchantPayment.create({
    data: {
      merchantId,
      amount: paymentAmount,
      comment: comment || '',
      balanceBefore,
      balanceAfter,
    }
  });

  await prisma.merchant.update({
    where: { id: merchantId },
    data: { balance: balanceAfter }
  });

  res.redirect('/admin/merchants');
};



// Показать все транзакции по мерчанту
export const showMerchantTransactions = async (req, res) => {
  const merchantId = Number(req.params.id);

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId }
  });

  const transactions = await prisma.voucherTransaction.findMany({
    where: { merchantId },
    orderBy: { createdAt: 'desc' }
  });

  res.render('pages/admin-merchant-transactions', {
    merchant,
    transactions,
    user: req.session.user
  });
};


// Показать платежи мерчанта
export const showMerchantPaymentHistory = async (req, res) => {
  const merchantId = Number(req.params.id);

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: {
      payments: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!merchant) {
    return res.status(404).send('Мерчант не найден');
  }

  res.render('pages/admin-merchant-payments', {
    merchant,
    payments: merchant.payments
  });
};

// Оплата мерчантов
export const showVendorPaymentForm = async (req, res) => {
  const vendorId = Number(req.params.id);
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });

  if (!vendor) {
    return res.status(404).send('Вендор не найден');
  }

  const actualDebt = vendor.balance || 0;

  res.render('pages/admin-pay-vendor', {
    vendor,
    actualDebt,
    user: req.session.user
  });
};
