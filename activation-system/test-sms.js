import { sendSMS } from './utils/smsService.js';

async function testSMS() {
  console.log('Тестируем отправку SMS...');
  
  const phone = '998998137861';
  const message = 'Dobavlen noviy vaucher | Yangi vaucher qo\'shildi wallet.namo.uz';
  
  console.log(`Отправляем SMS на номер: ${phone}`);
  console.log(`Текст сообщения: ${message}`);
  
  try {
    const result = await sendSMS(phone, message);
    console.log('Результат отправки SMS:', result);
    
    if (result.success) {
      console.log('✅ SMS успешно отправлено!');
      console.log('SMS ID:', result.smsId);
    } else {
      console.log('❌ Ошибка отправки SMS:', result.error);
    }
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
  }
}

testSMS();
