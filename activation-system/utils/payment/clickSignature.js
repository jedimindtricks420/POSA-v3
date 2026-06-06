import crypto from 'crypto';

/**
 * Проверка MD5 подписи Click
 * @param {Object} params - Параметры запроса от Click
 * @param {Number} action - 0 для Prepare, 1 для Complete
 * @returns {Boolean}
 */
export function verifyClickSign(params, action, kassaCredentials = null) {
    const {
        click_trans_id,
        service_id,
        merchant_trans_id,
        merchant_prepare_id,
        amount,
        sign_time,
        sign_string
    } = params;

    const secretKey = kassaCredentials?.clickSecretKey || process.env.CLICK_SECRET_KEY;

    let signData;
    if (action === 0) {
        // Prepare
        signData = `${click_trans_id}${service_id}${secretKey}${merchant_trans_id}${amount}${action}${sign_time}`;
    } else {
        // Complete
        signData = `${click_trans_id}${service_id}${secretKey}${merchant_trans_id}${merchant_prepare_id}${amount}${action}${sign_time}`;
    }

    const expectedSign = crypto.createHash('md5').update(signData).digest('hex');

    return expectedSign === sign_string;
}

/**
 * Генерация URL для редиректа на Click
 * @param {String} orderId - ID заказа (QrPaymentAttempt.id)
 * @param {Number} amount - Сумма в сумах (не в тийинах!)
 * @param {String} returnUrl - URL для возврата после оплаты
 * @returns {String} - URL для редиректа
 */
export function generateClickUrl(orderId, amount, returnUrl, kassaCredentials = null) {
    const merchantId     = kassaCredentials?.clickMerchantId     || process.env.CLICK_MERCHANT_ID;
    const serviceId      = kassaCredentials?.clickServiceId      || process.env.CLICK_SERVICE_ID;
    const merchantUserId = kassaCredentials?.clickMerchantUserId || process.env.CLICK_MERCHANT_USER_ID;
    // BUG FIX: брать clickEnv из кассы (БД), а не только из process.env
    const env = kassaCredentials?.clickEnv || process.env.CLICK_ENV || 'production';

    // Click использует один и тот же URL для test и production
    // Различие только в service_id и merchant_id
    const baseUrl = 'https://my.click.uz/services/pay';

    const params = new URLSearchParams({
        service_id:        serviceId,
        merchant_id:       merchantId,
        amount:            amount, // В сумах
        transaction_param: orderId,
        return_url:        returnUrl,
    });

    // merchant_user_id — необязательный, добавляем только если задан
    if (merchantUserId) {
        params.set('merchant_user_id', merchantUserId);
    }

    return `${baseUrl}?${params.toString()}`;
}
