# Backend реализация

## Структура файлов

```
/home/admin1/posa/activation-system/
├── controllers/
│   ├── admin/
│   │   └── qrLinkController.js      # НОВЫЙ
│   └── public/
│       └── qrPaymentController.js   # НОВЫЙ
├── routes/
│   ├── admin.js                     # добавить маршруты
│   └── public.js                    # НОВЫЙ
├── services/
│   └── qrPaymentService.js          # НОВЫЙ
└── views/pages/
    ├── admin-qr-links.ejs           # НОВЫЙ
    ├── pay-product.ejs              # НОВЫЙ
    ├── pay-checkout.ejs             # НОВЫЙ
    ├── pay-result.ejs               # НОВЫЙ
    └── pay-error.ejs                # НОВЫЙ
```

---

## Шаг 1: Создать контроллер админ-панели

**Файл:** `controllers/admin/qrLinkController.js`

```javascript
import prisma from '../../prisma/client.js';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';

// Страница генерации QR-кодов
export const showQrLinksPage = async (req, res) => {
  try {
    const merchants = await prisma.merchant.findMany({
      where: { status: 'active' },
      orderBy: { username: 'asc' }
    });

    const products = await prisma.product.findMany({
      where: { status: 'on' },
      include: { vendor: true },
      orderBy: { name: 'asc' }
    });

    res.render('pages/admin-qr-links', {
      merchants,
      products,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading QR links page:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
};

// AJAX: Генерация ссылки
export const generateLink = async (req, res) => {
  try {
    const { merchantId, productId } = req.body;

    // Проверить существующую ссылку
    let link = await prisma.merchantProductLink.findUnique({
      where: {
        merchantId_productId: {
          merchantId: parseInt(merchantId),
          productId: parseInt(productId)
        }
      },
      include: {
        merchant: true,
        product: { include: { vendor: true } }
      }
    });

    // Создать новую если нет
    if (!link) {
      link = await prisma.merchantProductLink.create({
        data: {
          merchantId: parseInt(merchantId),
          productId: parseInt(productId),
          token: uuidv4()
        },
        include: {
          merchant: true,
          product: { include: { vendor: true } }
        }
      });
    }

    const baseUrl = process.env.BASE_URL || 'https://wallet.namo.uz';
    const payUrl = `${baseUrl}/pay/${link.token}`;

    // Генерация QR
    const qrDataUrl = await QRCode.toDataURL(payUrl, {
      width: 300,
      margin: 2
    });

    res.json({
      success: true,
      link: {
        id: link.id,
        token: link.token,
        url: payUrl,
        qrCode: qrDataUrl,
        merchant: link.merchant.username,
        product: link.product.name,
        price: link.product.price
      }
    });
  } catch (error) {
    console.error('Error generating link:', error);
    res.status(500).json({ success: false, error: 'Ошибка генерации' });
  }
};

// Скачать QR как PNG
export const downloadQr = async (req, res) => {
  try {
    const link = await prisma.merchantProductLink.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!link) {
      return res.status(404).send('Ссылка не найдена');
    }

    const baseUrl = process.env.BASE_URL || 'https://wallet.namo.uz';
    const payUrl = `${baseUrl}/pay/${link.token}`;

    const qrBuffer = await QRCode.toBuffer(payUrl, {
      width: 500,
      margin: 2
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename=qr-${link.token}.png`);
    res.send(qrBuffer);
  } catch (error) {
    console.error('Error downloading QR:', error);
    res.status(500).send('Ошибка скачивания');
  }
};
```

---

## Шаг 2: Создать контроллер публичных страниц

**Файл:** `controllers/public/qrPaymentController.js`

```javascript
import prisma from '../../prisma/client.js';
import { generatePDFReceipt } from '../merchant/saleController.js';

// Страница товара
export const showProductPage = async (req, res) => {
  try {
    const { token } = req.params;

    const link = await prisma.merchantProductLink.findUnique({
      where: { token },
      include: {
        merchant: true,
        product: { include: { vendor: true } }
      }
    });

    if (!link || !link.isActive) {
      return res.render('pages/pay-error', {
        error: 'link_invalid',
        message: 'Ссылка недействительна'
      });
    }

    if (link.merchant.status !== 'active') {
      return res.render('pages/pay-error', {
        error: 'merchant_inactive',
        message: 'Продавец недоступен'
      });
    }

    if (link.product.status !== 'on') {
      return res.render('pages/pay-error', {
        error: 'product_inactive',
        message: 'Товар снят с продажи'
      });
    }

    // Проверить наличие ваучеров
    const voucherCount = await prisma.voucher.count({
      where: { productId: link.productId, status: 'active' }
    });

    res.render('pages/pay-product', {
      link,
      merchant: link.merchant,
      product: link.product,
      hasVouchers: voucherCount > 0
    });
  } catch (error) {
    console.error('Error loading product page:', error);
    res.render('pages/pay-error', {
      error: 'server_error',
      message: 'Ошибка сервера'
    });
  }
};

// Страница checkout
export const showCheckoutPage = async (req, res) => {
  try {
    const { token } = req.params;

    const link = await prisma.merchantProductLink.findUnique({
      where: { token },
      include: {
        merchant: true,
        product: { include: { vendor: true } }
      }
    });

    if (!link || !link.isActive) {
      return res.redirect(`/pay/${token}`);
    }

    res.render('pages/pay-checkout', {
      link,
      merchant: link.merchant,
      product: link.product,
      token
    });
  } catch (error) {
    console.error('Error loading checkout:', error);
    res.redirect(`/pay/${req.params.token}`);
  }
};

// Обработка оплаты (Фаза 1 - эмуляция)
export const processCheckout = async (req, res) => {
  try {
    const { token } = req.params;
    const { phoneNumber, paymentMethod } = req.body;

    // Валидация телефона
    const phoneRegex = /^\+998[0-9]{9}$/;
    if (!phoneNumber || !phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Некорректный номер телефона'
      });
    }

    const link = await prisma.merchantProductLink.findUnique({
      where: { token },
      include: {
        merchant: true,
        product: { include: { vendor: true } }
      }
    });

    if (!link) {
      return res.status(404).json({ success: false, error: 'Ссылка не найдена' });
    }

    // Создать попытку оплаты
    const attempt = await prisma.qrPaymentAttempt.create({
      data: {
        linkId: link.id,
        phoneNumber,
        amount: link.product.price,
        paymentMethod: paymentMethod || null,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 2 * 60 * 1000) // +2 минуты
      }
    });

    // ФАЗА 1: Эмуляция оплаты - сразу обрабатываем
    const result = await processPayment(attempt.id, link);

    if (result.success) {
      res.json({
        success: true,
        redirectUrl: `/pay/${token}/result/${attempt.id}`
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error processing checkout:', error);
    res.status(500).json({ success: false, error: 'Ошибка обработки' });
  }
};

// Обработка платежа (внутренняя функция)
async function processPayment(attemptId, link) {
  try {
    const attempt = await prisma.qrPaymentAttempt.findUnique({
      where: { id: attemptId }
    });

    const merchant = link.merchant;
    const product = link.product;

    // Транзакция - как в saleController
    const result = await prisma.$transaction(async (tx) => {
      // 1. Найти активный ваучер
      const voucher = await tx.voucher.findFirst({
        where: { productId: product.id, status: 'active' }
      });

      if (!voucher) {
        throw new Error('NO_VOUCHERS');
      }

      // 2. Voucher → sold
      await tx.voucher.update({
        where: { id: voucher.id },
        data: { status: 'sold' }
      });

      // 3. Создать Sale
      const sale = await tx.sale.create({
        data: {
          voucherValue: voucher.value,
          price: product.price,
          productId: product.id,
          productName: product.name,
          merchantUsername: merchant.username,
          saleType: 'ONLINE',
          customerPhone: attempt.phoneNumber
        }
      });

      // 4. Найти/создать Client
      let client = await tx.client.findUnique({
        where: { phoneNumber: attempt.phoneNumber }
      });
      if (!client) {
        client = await tx.client.create({
          data: { phoneNumber: attempt.phoneNumber }
        });
      }

      // 5. OnlineVoucher
      await tx.onlineVoucher.create({
        data: { clientId: client.id, voucherId: voucher.id }
      });

      // 6. VoucherWalletLog
      await tx.voucherWalletLog.create({
        data: {
          clientId: client.id,
          voucherId: voucher.id,
          isAddedToWallet: true
        }
      });

      // 7. Комиссии
      const vendorDebt = product.price * (1 - product.vendorCommissionPercent / 100);
      const merchantPayable = product.price * (1 - product.merchantCommissionPercent / 100);

      // 8. VoucherTransaction
      await tx.voucherTransaction.create({
        data: {
          voucherValue: voucher.value,
          merchantId: merchant.id,
          vendorId: product.vendorId,
          productId: product.id,
          productName: product.name,
          price: product.price,
          merchantDebt: merchantPayable,
          adminDebt: product.price * (product.vendorCommissionPercent / 100),
          vendorDebt
        }
      });

      // 9. Обновить балансы
      await tx.vendor.update({
        where: { id: product.vendorId },
        data: { balance: { increment: vendorDebt } }
      });

      await tx.merchant.update({
        where: { id: merchant.id },
        data: { balance: { increment: merchantPayable } }
      });

      // 10. Обновить QrPaymentAttempt
      await tx.qrPaymentAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          saleId: sale.id,
          voucherValue: voucher.value
        }
      });

      return { sale, voucher, client };
    });

    return { success: true, ...result };
  } catch (error) {
    console.error('Payment processing error:', error);

    if (error.message === 'NO_VOUCHERS') {
      await prisma.qrPaymentAttempt.update({
        where: { id: attemptId },
        data: { status: 'FAILED' }
      });
      return { success: false, error: 'Товар закончился' };
    }

    return { success: false, error: 'Ошибка обработки платежа' };
  }
}

// Страница результата
export const showResultPage = async (req, res) => {
  try {
    const { token, attemptId } = req.params;

    const attempt = await prisma.qrPaymentAttempt.findUnique({
      where: { id: parseInt(attemptId) },
      include: {
        link: {
          include: {
            merchant: true,
            product: { include: { vendor: true } }
          }
        },
        sale: true
      }
    });

    if (!attempt) {
      return res.render('pages/pay-error', {
        error: 'not_found',
        message: 'Запись не найдена'
      });
    }

    if (attempt.status !== 'PAID') {
      const errorMessages = {
        PENDING: 'Ожидание оплаты',
        PROCESSING: 'Обработка платежа',
        EXPIRED: 'Время оплаты истекло',
        FAILED: 'Оплата не прошла'
      };

      return res.render('pages/pay-error', {
        error: attempt.status.toLowerCase(),
        message: errorMessages[attempt.status] || 'Ошибка',
        token
      });
    }

    res.render('pages/pay-result', {
      attempt,
      merchant: attempt.link.merchant,
      product: attempt.link.product,
      sale: attempt.sale,
      voucherCode: attempt.voucherValue,
      token
    });
  } catch (error) {
    console.error('Error loading result:', error);
    res.render('pages/pay-error', {
      error: 'server_error',
      message: 'Ошибка сервера'
    });
  }
};

// Скачать PDF чек
export const downloadReceipt = async (req, res) => {
  try {
    const { attemptId } = req.params;

    const attempt = await prisma.qrPaymentAttempt.findUnique({
      where: { id: parseInt(attemptId) },
      include: {
        link: {
          include: {
            merchant: true,
            product: { include: { vendor: true } }
          }
        }
      }
    });

    if (!attempt || attempt.status !== 'PAID') {
      return res.status(404).send('Чек недоступен');
    }

    // Генерация PDF (использовать существующую логику)
    // TODO: Интегрировать generatePDFReceipt

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${attempt.id}.pdf`);
    // res.send(pdfBuffer);

    // Временно возвращаем заглушку
    res.send('PDF generation in progress');
  } catch (error) {
    console.error('Error generating receipt:', error);
    res.status(500).send('Ошибка генерации чека');
  }
};
```

---

## Шаг 3: Добавить маршруты

**Файл:** `routes/admin.js` - добавить:

```javascript
import * as qrLinkController from '../controllers/admin/qrLinkController.js';

// QR Links
router.get('/qr-links', qrLinkController.showQrLinksPage);
router.post('/qr-links/generate', qrLinkController.generateLink);
router.get('/qr-links/:id/download', qrLinkController.downloadQr);
```

**Файл:** `routes/public.js` - создать новый:

```javascript
import express from 'express';
import * as qrPaymentController from '../controllers/public/qrPaymentController.js';

const router = express.Router();

router.get('/pay/:token', qrPaymentController.showProductPage);
router.get('/pay/:token/checkout', qrPaymentController.showCheckoutPage);
router.post('/pay/:token/checkout', qrPaymentController.processCheckout);
router.get('/pay/:token/result/:attemptId', qrPaymentController.showResultPage);
router.get('/pay/:token/receipt/:attemptId', qrPaymentController.downloadReceipt);

export default router;
```

**Файл:** `app.js` - подключить:

```javascript
import publicRoutes from './routes/public.js';

// Перед другими роутами
app.use('/', publicRoutes);
```

---

## Шаг 4: Чеклист

- [ ] Контроллер админ-панели создан
- [ ] Контроллер публичных страниц создан
- [ ] Маршруты добавлены
- [ ] Роуты подключены в app.js
- [ ] UUID и QRCode установлены (`npm install uuid qrcode`)
