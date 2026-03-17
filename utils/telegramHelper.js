export async function fetchActivationKeyFromTelegram(voucherCode) {
  console.log(`📨 Получение ключа через Telegram: ${voucherCode}`);

  // Заглушка
  return `TELEGRAM-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
}
