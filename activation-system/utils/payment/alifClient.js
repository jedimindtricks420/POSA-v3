import axios from 'axios';

const PRODUCTION_BASE_URL = 'https://api.alifpay.uz/v2';
// ВАЖНО: sandbox-адрес API не подтверждён напрямую документацией Alifpay
// (спрятан за JS-переключателем на docs.alifpay.uz). Значение ниже — по
// аналогии с checkout-dev.alifpay.uz (подтверждено документацией напрямую).
// Перед боевым использованием sandbox — сверить в личном кабинете alifpay.uz.
const SANDBOX_BASE_URL = 'https://api-dev.alifpay.uz/v2';

export const ALIF_MIN_AMOUNT_TIYIN = 50000; // 500 сум
export const ALIF_MAX_AMOUNT_TIYIN = 20000000000; // 200 000 000 сум

function getBaseUrl(env) {
    return env === 'production' ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;
}

/**
 * Проверка суммы на допустимый Alifpay диапазон (в тийинах).
 * @param {Number} amountInTiyin
 * @returns {Boolean}
 */
export function isAmountInAlifRange(amountInTiyin) {
    return amountInTiyin >= ALIF_MIN_AMOUNT_TIYIN && amountInTiyin <= ALIF_MAX_AMOUNT_TIYIN;
}

/**
 * Создать счёт (invoice) в Alifpay.
 * @param {Object} params
 * @param {String} params.token - Token кассы (production или sandbox, в зависимости от env)
 * @param {String} params.env - 'production' | 'sandbox'
 * @param {Array} params.items - [{ name, amount, price }] price — в тийинах
 * @param {String} params.cancelUrl
 * @param {String} params.redirectUrl
 * @param {String} params.webhookUrl
 * @param {Object} params.meta - { order_id: string }
 * @returns {Promise<{success: Boolean, id?: String, error?: String, errorCode?: String}>}
 */
export async function createInvoice({ token, env, items, cancelUrl, redirectUrl, webhookUrl, meta }) {
    const url = `${getBaseUrl(env)}/invoice`;

    try {
        const { data } = await axios.post(url, {
            items,
            cancel_url: cancelUrl,
            redirect_url: redirectUrl,
            webhook_url: webhookUrl,
            meta,
        }, {
            headers: { 'Content-Type': 'application/json', Token: token },
            timeout: 15000,
        });

        // ВАЖНО: Alifpay всегда возвращает HTTP 200, даже при бизнес-ошибке.
        // Признак ошибки — наличие поля `error` в теле.
        if (data.error) {
            console.error('[Alif] createInvoice business error:', data.error);
            return { success: false, error: data.error.message || 'Alifpay error', errorCode: data.error.code };
        }

        return { success: true, id: data.id, raw: data };
    } catch (err) {
        console.error('[Alif] createInvoice network error:', err.message);
        return { success: false, error: 'Платёжный сервис Alifpay временно недоступен' };
    }
}

/**
 * Ссылка на checkout-страницу Alifpay для созданного счёта.
 * @param {String} invoiceId
 * @param {String} env - 'production' | 'sandbox'
 * @returns {String}
 */
export function getCheckoutUrl(invoiceId, env) {
    const base = env === 'production'
        ? 'https://checkout.alifpay.uz/'
        : 'https://checkout-dev.alifpay.uz/';
    return `${base}?invoice=${encodeURIComponent(invoiceId)}`;
}
