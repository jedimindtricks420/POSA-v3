import axios from 'axios';
import dotenv from 'dotenv';
import { phoneForSms } from './phone.js';

dotenv.config();

// Данные авторизации Eskiz
const ESKIZ_EMAIL = process.env.ESKIZ_EMAIL; // твой email
const ESKIZ_PASSWORD = process.env.ESKIZ_PASSWORD; // твой секретный ключ
const ESKIZ_API_URL = process.env.ESKIZ_API_URL || 'https://notify.eskiz.uz/api';
const SENDER_NAME = process.env.ESKIZ_SENDER_NAME || '4546'; // заменить на утвержденный "from", если нужно

let token = null;

/**
 * Получить токен Eskiz (кэшируем, чтобы не запрашивать каждый раз)
 */
async function getEskizToken() {
  try {
    if (!ESKIZ_EMAIL || !ESKIZ_PASSWORD) {
      throw new Error('Не заданы переменные окружения ESKIZ_EMAIL или ESKIZ_PASSWORD');
    }

    if (token) return token; // если токен уже получен, просто возвращаем

    const formData = new URLSearchParams();
    formData.append('email', ESKIZ_EMAIL);
    formData.append('password', ESKIZ_PASSWORD);

    const response = await axios.post(`${ESKIZ_API_URL}/auth/login`, formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    token = response.data.data.token;
    console.log('Eskiz токен получен:', token);
    return token;
  } catch (error) {
    console.error('Ошибка получения токена Eskiz:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Отправка SMS через Eskiz (основная функция с поддержкой новой схемы)
 * @param {string} phone - номер телефона (например: +998901234567 или 998901234567)
 * @param {string} message - текст сообщения
 */
export async function sendSMS(phone, message) {
  try {
    // Очищаем номер от символа +
    const cleanPhone = phone.replace(/^\+/, '');
    
    const authToken = await getEskizToken();

    const formData = new URLSearchParams();
    formData.append('mobile_phone', cleanPhone);
    formData.append('message', message);
    formData.append('from', SENDER_NAME);

    const response = await axios.post(`${ESKIZ_API_URL}/message/sms/send`, formData, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    console.log('SMS отправлено:', response.data);
    return {
      success: true,
      smsId: response.data.id,
      data: response.data
    };
  } catch (error) {
    console.error('Ошибка отправки SMS:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

/**
 * Отправка SMS через Eskiz (старая функция для совместимости)
 * @param {string} phone - номер телефона (например: 998901234567)
 * @param {string} message - текст сообщения
 */
export async function sendSms(phone, message) {
  try {
    const authToken = await getEskizToken();

    const formData = new URLSearchParams();
    formData.append('mobile_phone', phoneForSms(phone));
    formData.append('message', message);
    formData.append('from', SENDER_NAME);

    const response = await axios.post(`${ESKIZ_API_URL}/message/sms/send`, formData, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    console.log('SMS отправлено:', response.data);
    return response.data;
  } catch (error) {
    console.error('Ошибка отправки SMS:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Отправить OTP-код (вход/регистрация)
 * @param {string} phone
 * @param {string} code
 */
export async function sendOtpSms(phone, code) {
  // Используем утвержденный шаблон
  const message = `wallet.namo.uz Vash kod podtverjdeniya dlya sayta Tasdiqlash uchun kod: ${code}`;
  return await sendSms(phone, message);
}
