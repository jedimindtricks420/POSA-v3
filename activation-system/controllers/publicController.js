import prisma from '../prisma/client.js';
import { sendActivationKeyEmail } from '../utils/mailer.js';
import { fetchActivationKeyFromTelegram } from '../utils/telegramHelper.js';
import { activateVoucherForVendor, ActivationError } from '../services/voucherActivationService.js';

// Страница: Ввод email и телефона
export const showEmailForm = (req, res) => {
  res.render('pages/enter-email', { error: null });
};

// Обработка формы email и телефона
export const handleEmailForm = (req, res) => {
  const { email, phone } = req.body;

  if (!email || !phone) {
    return res.render('pages/enter-email', { error: 'Введите email и номер телефона' });
  }

  // Сохраняем данные клиента в сессию
  req.session.customer = { email, phone };
  return res.redirect('/client/enter-voucher');
};

// Страница: ввод ваучера
export const showVoucherForm = (req, res) => {
  const { email, phone } = req.session.customer || {};

  if (!email || !phone) {
    return res.redirect('/email');
  }

  res.render('pages/enter-voucher', {
    email,
    phone,
    name: req.session.customer.name || '',
    error: null
  });
};

// Обработка ваучера
export const handleVoucherSubmit = async (req, res) => {
  const { voucher } = req.body;
  const { name, email, phone } = req.session.customer || {};

  if (!voucher || !email || !phone) {
    return res.render('pages/enter-voucher', {
      email, phone, name,
      error: 'Все поля обязательны'
    });
  }

  const voucherRecord = await prisma.voucher.findUnique({
    where: { value: voucher }
  });

  if (!voucherRecord || voucherRecord.status !== 'active') {
    return res.render('pages/activation-key', {
      error: 'Неверный или использованный ваучер',
      key: null
    });
  }

  // Генерация ключа
  let activationKey = '';
  if (voucherRecord.type === 'Telegram') {
    activationKey = await fetchActivationKeyFromTelegram(voucherRecord.value);
  } else {
    activationKey = `KEY-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  }

  // Обновляем статус ваучера
  await prisma.voucher.update({
    where: { id: voucherRecord.id },
    data: { status: 'activated' }
  });

  // Создаём продажу
  await prisma.sale.create({
    data: {
      voucherValue: voucherRecord.value,
      price: voucherRecord.price || 0,
      productId: voucherRecord.productId,
      productName: voucherRecord.productName,
      merchantUsername: voucherRecord.merchantUsername || 'unknown',
    }
  });

  // Отправляем email
  await sendActivationKeyEmail(email, activationKey);

  // Показываем результат
  res.render('pages/activation-key', {
    key: activationKey,
    error: null
  });
};

// (опционально) регистрация клиента
export const showClientRegister = (req, res) => {
  res.render('pages/register-client', { error: null });
};

export const handleClientRegister = (req, res) => {
  const { name, email, phone } = req.body;

  if (!name || !email || !phone) {
    return res.render('pages/register-client', {
      error: 'Все поля обязательны'
    });
  }

  req.session.customer = { name, email, phone };
  return res.redirect('/client/enter-voucher');
};


// Активация ваучера
// Страница активации ваучера (универсальная)
export const handleVoucherActivation = async (req, res) => {
  const code = (req.query.voucher || '').toString().trim();

  if (!code) {
    return res.send('❌ Введите код ваучера в ссылке');
  }

  const user = req.session.user;

  if (user?.vendorId && (user.role === 'vendor_user' || user.role === 'vendor')) {
    try {
      const result = await activateVoucherForVendor({
        voucherCode: code,
        vendorId: user.vendorId,
        userId: user.id,
      });

      return res.render('pages/vendor/activate-qr-result', {
        user,
        result: {
          success: true,
          code: result.voucher.value,
          productName: result.productName,
          activationKey: result.activationKey,
          wasLinkedToClient: result.wasLinkedToClient,
        },
      });
    } catch (error) {
      if (error instanceof ActivationError) {
        return res.render('pages/vendor/activate-qr-result', {
          user,
          result: {
            success: false,
            message: error.message,
          },
        });
      }
      console.error('Vendor QR activation error:', error);
      return res.render('pages/vendor/activate-qr-result', {
        user,
        result: {
          success: false,
          message: 'Не удалось активировать ваучер. Попробуйте ещё раз.',
        },
      });
    }
  }

  const voucher = await prisma.voucher.findUnique({
    where: { value: code }
  });

  if (!voucher) {
    return res.send('❌ Ваучер не найден');
  }

  // Показать форму активации для публичных пользователей
  return res.render('pages/activate-form', { voucherCode: code });
};
