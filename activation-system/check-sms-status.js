import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const ESKIZ_API_URL = 'https://notify.eskiz.uz/api';
const ESKIZ_EMAIL = process.env.ESKIZ_EMAIL;
const ESKIZ_PASSWORD = process.env.ESKIZ_PASSWORD;

async function getEskizToken() {
  const response = await axios.post(`${ESKIZ_API_URL}/auth/login`, {
    email: ESKIZ_EMAIL,
    password: ESKIZ_PASSWORD,
  });
  return response.data.data.token;
}

async function checkSMSStatus(smsId) {
  try {
    const authToken = await getEskizToken();
    
    const response = await axios.get(`${ESKIZ_API_URL}/message/sms/status/${smsId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    console.log('Статус SMS:', response.data);
    return response.data;
  } catch (error) {
    console.error('Ошибка проверки статуса SMS:', error.response?.data || error.message);
    return null;
  }
}

// Используем ID из предыдущего теста
const smsId = '24503a0b-40a8-44c1-88c6-8120cfb7c7f3';
console.log(`Проверяем статус SMS с ID: ${smsId}`);
checkSMSStatus(smsId);
