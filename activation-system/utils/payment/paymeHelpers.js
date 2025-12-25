/**
 * Генерация URL для редиректа на Payme
 * @param {String} orderId - ID заказа (QrPaymentAttempt.id)
 * @param {Number} amount - Сумма в тийинах
 * @param {String} callbackUrl - URL для возврата после оплаты
 * @returns {String} - URL для редиректа
 */
export function generatePaymeUrl(orderId, amount, callbackUrl) {
    const merchantId = process.env.PAYME_MERCHANT_ID;
    const env = process.env.PAYME_ENV || 'test';

    const baseUrl = env === 'test'
        ? 'https://test.paycom.uz'
        : 'https://checkout.paycom.uz';

    // Формат: m={merchant};ac.order_id={orderId};a={amount};c={callback}
    const params = `m=${merchantId};ac.order_id=${orderId};a=${amount};c=${encodeURIComponent(callbackUrl)}`;
    const encoded = Buffer.from(params).toString('base64');

    return `${baseUrl}/${encoded}`;
}

/**
 * Проверка Basic Auth для Payme
 * @param {Object} req - Express request
 * @returns {Boolean}
 */
export function checkPaymeAuth(req) {
    const auth = req.headers.authorization;
    if (!auth) return false;

    const [type, credentials] = auth.split(' ');
    if (type !== 'Basic') return false;

    const decoded = Buffer.from(credentials, 'base64').toString();
    const [login, key] = decoded.split(':');

    const env = process.env.PAYME_ENV || 'test';
    const expectedKey = env === 'test'
        ? process.env.PAYME_TEST_KEY
        : process.env.PAYME_KEY;

    return login === 'Paycom' && key === expectedKey;
}
