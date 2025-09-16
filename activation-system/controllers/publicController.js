import prisma from '../prisma/client.js';
import { sendActivationKeyEmail } from '../utils/mailer.js';
import { fetchActivationKeyFromTelegram } from '../utils/telegramHelper.js';

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
  const code = req.query.voucher;

  if (!code) {
    return res.send('❌ Введите код ваучера в ссылке');
  }

  const voucher = await prisma.voucher.findUnique({
    where: { value: code }
  });

  if (!voucher) {
    return res.send('❌ Ваучер не найден');
  }

  if (req.session.user?.role === 'vendor') {
    // Автоматическая активация
    await prisma.voucher.update({
      where: { value: code },
      data: { status: 'activated' }
    });

    return res.send('✅ Ваучер активирован');
  } else {
    // Показать форму активации
    return res.render('pages/activate-form', { voucherCode: code });
  }
};
