import prisma from '../../prisma/client.js';
import { sendOtpSms } from '../../utils/smsService.js';
import { normalizePhone } from '../../utils/phone.js';

// Генерация случайного 6-значного OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Хелпер: установка OTP в сессию и отправка SMS
async function setOtpSessionAndSend(req, phone) {
  const otp = generateOtp();
  req.session.otp = otp;
  req.session.phone = phone;

  console.log(`OTP для ${phone}: ${otp}`); // лог для тестирования
  try {
    await sendOtpSms(phone, otp);
  } catch (error) {
    console.error('Ошибка при отправке SMS:', error);
  }
}

// === Страница логина ===
export const showLogin = (req, res) => {
  console.log('=== SHOW LOGIN CALLED ===');
  console.log('Session in showLogin:', req.session);
  console.log('req.session?.client:', req.session?.client);
  
  // Проверяем есть ли активная сессия клиента
  if (req.session && req.session.client) {
    console.log('Client still in session, redirecting to dashboard');
    return res.redirect('/client/dashboard');
  }
  
  console.log('No client in session, showing login page');
  res.render('pages/client-login', { error: null });
};

// === Обработка логина (отправка SMS) ===
export const handleLogin = async (req, res) => {
  console.log('=== HANDLE LOGIN CALLED ===');
  console.log('Request body:', req.body);
  
  const { phoneNumber, phone } = req.body;
  const clientPhoneInput = phoneNumber || phone;
  const normalizedPhone = normalizePhone(clientPhoneInput);

  if (!normalizedPhone || normalizedPhone.trim() === '+') {
    return res.render('pages/client-login', { error: 'Введите номер телефона' });
  }

  try {
    let client = await prisma.client.findUnique({ where: { phoneNumber: normalizedPhone } });

    if (!client) {
      const fallback = normalizedPhone.replace(/^\+/, '');
      if (fallback) {
        client = await prisma.client.findUnique({ where: { phoneNumber: fallback } });
        if (client) {
          await prisma.client.update({
            where: { id: client.id },
            data: { phoneNumber: normalizedPhone },
          });
        }
      }
    }
    if (!client) {
      client = await prisma.client.create({
        data: { phoneNumber: normalizedPhone },
      });
    }

    await setOtpSessionAndSend(req, normalizedPhone);
    res.redirect('/client-verify');
  } catch (error) {
    console.error('Ошибка при логине клиента:', error);
    res.render('pages/client-login', { error: 'Произошла ошибка. Попробуйте позже.' });
  }
};

// === Страница ввода OTP ===
export const showOtpPage = (req, res) => {
  if (!req.session.phone) return res.redirect('/wallet');
  res.render('pages/client-verify', { phone: req.session.phone, error: null });
};

// === Проверка OTP ===
export const verifyOtp = (req, res) => {
  const { otp } = req.body;

  if (!otp || otp !== req.session.otp) {
    return res.render('pages/client-verify', { phone: req.session.phone, error: 'Неверный код' });
  }

  // Авторизация
  req.session.client = { phone: req.session.phone };
  delete req.session.otp;
  delete req.session.phone;

  res.redirect('/client/dashboard');
};

// === Страница регистрации ===
export const showRegister = (req, res) => {
  if (req.session?.client) {
    return res.redirect('/client/dashboard');
  }
  res.render('pages/client-register', { error: null });
};

// === Обработка регистрации ===
export const handleRegister = async (req, res) => {
  console.log('=== HANDLE REGISTER CALLED ===');
  console.log('Request body:', req.body);
  
  const { phoneNumber, phone, name } = req.body;
  const clientPhoneInput = phoneNumber || phone;
  const normalizedPhone = normalizePhone(clientPhoneInput);

  if (!normalizedPhone || !name || normalizedPhone.trim() === '+' || name.trim() === '') {
    return res.render('pages/client-register', { error: 'Заполните все поля' });
  }

  try {
    let existing = await prisma.client.findUnique({ where: { phoneNumber: normalizedPhone } });
    if (!existing) {
      const fallback = normalizedPhone.replace(/^\+/, '');
      if (fallback) {
        existing = await prisma.client.findUnique({ where: { phoneNumber: fallback } });
      }
    }
    if (existing) {
      return res.render('pages/client-register', { error: 'Пользователь уже существует' });
    }

    await prisma.client.create({ data: { phoneNumber: normalizedPhone, name } });
    await setOtpSessionAndSend(req, normalizedPhone);

    res.redirect('/client-verify');
  } catch (error) {
    console.error('Ошибка при регистрации клиента:', error);
    res.render('pages/client-register', { error: 'Не удалось зарегистрировать пользователя. Попробуйте позже.' });
  }
};

// === Выход из аккаунта ===
export const logout = (req, res) => {
  console.log('=== CLIENT LOGOUT CALLED ===');
  console.log('Session before logout:', req.session);
  
  // Полностью уничтожаем сессию, как это делается в общем authController
  req.session.destroy((err) => {
    if (err) {
      console.error('Ошибка при уничтожении сессии:', err);
      // Даже при ошибке перенаправляем на страницу входа
      return res.redirect('/wallet');
    }
    console.log('Session destroyed successfully, redirecting to /wallet');
    res.redirect('/wallet');
  });
};
