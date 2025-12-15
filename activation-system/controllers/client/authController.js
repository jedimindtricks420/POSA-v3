import prisma from '../../prisma/client.js';
import { sendOtpSms } from '../../utils/smsService.js';
import { normalizePhone } from '../../utils/phone.js';
import {
  issueRefreshToken,
  setRememberCookies,
  clearRememberCookies,
  revokeRefreshTokens,
  revokeRefreshTokenByToken,
  findRefreshToken,
  rotateRefreshToken,
  SESSION_MAX_AGE,
  REMEMBER_ME_MAX_AGE,
} from '../../utils/authTokens.js';

// Генерация случайного 6-значного OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Хелпер: установка OTP в сессию и отправка SMS
async function setOtpSessionAndSend(req, phone) {
  // DEMO ACCOUNTS for App Store Review
  const DEMO_ACCOUNTS = {
    '+998003332211': '777777',  // Primary demo account (persistent)
    '+998003332222': '888888',  // For testing account deletion
    '+998003332233': '999999',  // For testing payments/transactions
    '+998003332244': '111111',  // For testing error handling
    '+998003332255': '222222'   // Additional/reserve account
  };

  const isDemo = phone in DEMO_ACCOUNTS;
  const otp = isDemo ? DEMO_ACCOUNTS[phone] : generateOtp();
  req.session.otp = otp;
  req.session.phone = phone;

  console.log(`OTP для ${phone}: ${otp}`); // лог для тестирования

  // Skip SMS sending for demo accounts
  if (!isDemo) {
    try {
      await sendOtpSms(phone, otp);
    } catch (error) {
      console.error('Ошибка при отправке SMS:', error);
    }
  } else {
    console.log(`[DEMO] Skipping SMS for demo account: ${phone}, code: ${DEMO_ACCOUNTS[phone]}`);
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
  const rememberMe = true;
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

    req.session.pendingRememberMe = rememberMe;
    req.session.pendingClientId = client.id;
    await setOtpSessionAndSend(req, normalizedPhone);

    return req.session.save((err) => {
      if (err) {
        console.error('Ошибка при сохранении сессии после логина клиента:', err);
        return res.render('pages/client-login', { error: 'Не удалось сохранить сессию. Попробуйте позже.' });
      }
      res.redirect('/client-verify');
    });
  } catch (error) {
    console.error('Ошибка при логине клиента:', error);
    res.render('pages/client-login', { error: 'Произошла ошибка. Попробуйте позже.' });
  }
};

// === Страница ввода OTP ===
export const showOtpPage = (req, res) => {
  if (!req.session.phone) return res.redirect('/wallet');
  res.render('pages/client-verify', {
    phone: req.session.phone,
    error: null,
  });
};

// === Проверка OTP ===
export const verifyOtp = async (req, res) => {
  const { otp } = req.body;

  if (!otp || otp !== req.session.otp) {
    return res.render('pages/client-verify', { phone: req.session.phone, error: 'Неверный код' });
  }

  const clientId = req.session.pendingClientId;
  if (!clientId) {
    return res.redirect('/wallet');
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    await revokeRefreshTokens({ subjectType: 'client', subjectId: clientId, role: 'client' }).catch(() => { });
    clearRememberCookies(res);
    return res.redirect('/wallet');
  }

  const rememberMe = req.session.pendingRememberMe !== undefined
    ? Boolean(req.session.pendingRememberMe)
    : true;
  const phoneForRender = req.session.phone;

  req.session.client = { id: client.id, phone: client.phoneNumber };
  req.session.rememberMe = rememberMe;
  req.session.cookie.maxAge = rememberMe ? REMEMBER_ME_MAX_AGE : SESSION_MAX_AGE;

  delete req.session.otp;
  delete req.session.phone;
  delete req.session.pendingRememberMe;
  delete req.session.pendingClientId;

  if (rememberMe) {
    const { token } = await issueRefreshToken({
      subjectType: 'client',
      subjectId: client.id,
      role: 'client',
    });
    setRememberCookies(res, token);
  } else {
    await revokeRefreshTokens({ subjectType: 'client', subjectId: client.id, role: 'client' }).catch(() => { });
    clearRememberCookies(res);
  }

  return req.session.save((err) => {
    if (err) {
      console.error('Ошибка при сохранении клиентской сессии после OTP:', err);
      return res.render('pages/client-verify', {
        phone: phoneForRender,
        error: 'Не удалось сохранить сессию. Попробуйте снова.',
      });
    }
    res.redirect('/client/dashboard');
  });
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

    const created = await prisma.client.create({ data: { phoneNumber: normalizedPhone, name } });
    await setOtpSessionAndSend(req, normalizedPhone);
    req.session.pendingRememberMe = true;
    req.session.pendingClientId = created.id;

    return req.session.save((err) => {
      if (err) {
        console.error('Ошибка при сохранении сессии после регистрации клиента:', err);
        return res.render('pages/client-register', { error: 'Не удалось сохранить сессию. Попробуйте позже.' });
      }
      res.redirect('/client-verify');
    });
  } catch (error) {
    console.error('Ошибка при регистрации клиента:', error);
    res.render('pages/client-register', { error: 'Не удалось зарегистрировать пользователя. Попробуйте позже.' });
  }
};

// === Выход из аккаунта ===
export const logout = (req, res) => {
  console.log('=== CLIENT LOGOUT CALLED ===');
  console.log('Session before logout:', req.session);

  const token = req.cookies?.refresh_token;
  if (token) {
    revokeRefreshTokenByToken(token).catch(() => { });
  }
  clearRememberCookies(res);

  const clientId = req.session?.client?.id;
  if (clientId) {
    revokeRefreshTokens({ subjectType: 'client', subjectId: clientId, role: 'client' }).catch(() => { });
  }

  req.session.destroy((err) => {
    if (err) {
      console.error('Ошибка при уничтожении сессии:', err);
      return res.redirect('/wallet');
    }
    console.log('Session destroyed successfully, redirecting to /wallet');
    res.redirect('/wallet');
  });
};

// === Удаление аккаунта (анонимизация) ===
export const deleteAccount = async (req, res) => {
  console.log('=== DELETE ACCOUNT CALLED ===');

  const clientId = req.session?.client?.id;
  if (!clientId) {
    return res.status(401).json({ ok: false, message: 'Not authenticated' });
  }

  try {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return res.status(404).json({ ok: false, message: 'Client not found' });
    }

    // Генерируем уникальный идентификатор для анонимизации
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const anonymizedPhone = `deleted_${timestamp}_${randomId}`;

    console.log(`Anonymizing client ${clientId}: ${client.phoneNumber} -> ${anonymizedPhone}`);

    // Анонимизируем данные клиента
    await prisma.client.update({
      where: { id: clientId },
      data: {
        phoneNumber: anonymizedPhone,
        name: null,
      },
    });

    // Удаляем все refresh токены для этого клиента
    await revokeRefreshTokens({ subjectType: 'client', subjectId: clientId, role: 'client' });

    // Очищаем cookies
    clearRememberCookies(res);

    // Логируем действие в AuditLog
    await prisma.auditLog.create({
      data: {
        actorUserId: null,
        role: 'client',
        action: 'CLIENT_ACCOUNT_DELETED',
        entityType: 'Client',
        details: {
          clientId,
          originalPhone: client.phoneNumber,
          anonymizedPhone,
          timestamp: new Date().toISOString(),
        },
        ip: req.ip || req.connection.remoteAddress,
      },
    });

    console.log(`Client account ${clientId} successfully anonymized and logged out`);

    // Разрушаем сессию
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session after account deletion:', err);
        return res.status(500).json({ ok: false, message: 'Session destruction failed' });
      }
      res.json({ ok: true, message: 'Account deleted successfully' });
    });
  } catch (error) {
    console.error('Error deleting client account:', error);
    res.status(500).json({ ok: false, message: 'Failed to delete account' });
  }
};

export const refreshSession = async (req, res) => {
  try {
    const token = req.cookies?.refresh_token;
    const record = await findRefreshToken(token);

    if (!record || record.expiresAt < new Date() || !record.clientId) {
      if (record?.id) {
        await revokeRefreshTokenByToken(token);
      }
      clearRememberCookies(res);
      return res.status(401).json({ ok: false, message: 'Token expired' });
    }

    const client = await prisma.client.findUnique({ where: { id: record.clientId } });
    if (!client) {
      await revokeRefreshTokenByToken(token);
      clearRememberCookies(res);
      return res.status(401).json({ ok: false, message: 'Client not found' });
    }

    req.session.regenerate(async (err) => {
      if (err) {
        return res.status(500).json({ ok: false });
      }

      req.session.client = { id: client.id, phone: client.phoneNumber };
      req.session.rememberMe = true;
      req.session.cookie.maxAge = REMEMBER_ME_MAX_AGE;

      const rotated = await rotateRefreshToken(record);
      if (rotated) {
        setRememberCookies(res, rotated.token);
      }

      res.json({ ok: true });
    });
  } catch (error) {
    console.error('Client refresh session error:', error);
    res.status(500).json({ ok: false });
  }
};
