import axios from 'axios';
import crypto from 'crypto';

const MOCK_MODE = process.env.MANASTORE_MOCK === 'true';
const TIMEOUT_MS = parseInt(process.env.MANASTORE_TIMEOUT_MS || '30000', 10);

const ENV_CONFIG = {
    staging: {
        baseUrl: process.env.MANASTORE_API_URL_STAGING || 'https://api-staging.manastore.com/api/v1',
        apiKey: process.env.MANASTORE_API_KEY_STAGING,
        walletId: process.env.MANASTORE_WALLET_ID_STAGING,
    },
    production: {
        baseUrl: process.env.MANASTORE_API_URL_PRODUCTION || 'https://api.manastore.com/api/v1',
        apiKey: process.env.MANASTORE_API_KEY_PRODUCTION,
        walletId: process.env.MANASTORE_WALLET_ID_PRODUCTION,
    },
};

// Ключ order.fulfillment_status/payment_status ManaStore не даёт единого "failed" —
// отказ проявляется как ошибка HTTP при createOrder, а не как статус для опроса.
function normalizeStatus(fulfillmentStatus, paymentStatus) {
    if (fulfillmentStatus === 'refunded') return 'REFUNDED';
    if (fulfillmentStatus === 'completed' && paymentStatus === 'completed') return 'COMPLETED';
    return 'PENDING';
}

class ManaStoreService {
    constructor() {
        const rawEnv = (process.env.MANASTORE_ENV || 'staging').toLowerCase();
        this.environment = rawEnv === 'production' ? 'production' : 'staging';

        const config = ENV_CONFIG[this.environment];
        this.baseUrl = config.baseUrl;
        this.apiKey = config.apiKey;
        this.walletId = config.walletId;

        if (!MOCK_MODE) {
            if (!this.apiKey || !this.walletId) {
                throw new Error(
                    `ManaStore: missing credentials for environment "${this.environment}". ` +
                    `Set MANASTORE_API_KEY_${this.environment.toUpperCase()} and MANASTORE_WALLET_ID_${this.environment.toUpperCase()}.`
                );
            }
            if (this.environment === 'production' && process.env.NODE_ENV !== 'production') {
                console.warn(
                    '[ManaStoreService] WARNING: MANASTORE_ENV=production, but NODE_ENV is not "production" — ' +
                    'боевые ключи ManaStore активны в не-production окружении приложения.'
                );
            }
        }

        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: TIMEOUT_MS,
            headers: {
                Accept: 'application/json',
                ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
            },
        });
    }

    /**
     * Выполняет запрос к ManaStore с логированием и одним автоматическим
     * повтором при timeout/5xx (не повторяет 4xx — это бизнес-ошибки).
     */
    async request(method, url, { data, params, logMeta = {} } = {}) {
        const startTime = Date.now();
        const logData = {
            method: logMeta.method || `${method.toUpperCase()} ${url}`,
            environment: this.environment,
            variantId: logMeta.variantId != null ? String(logMeta.variantId) : null,
            referenceId: logMeta.referenceId || null,
            requestData: data ? JSON.stringify(data) : (params ? JSON.stringify(params) : null),
            success: false,
        };

        let attempt = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            attempt += 1;
            try {
                const response = await this.client.request({ method, url, data, params });

                logData.success = true;
                logData.statusCode = response.status;
                logData.responseData = JSON.stringify(response.data);
                logData.duration = Date.now() - startTime;
                await this.logApiCall(logData);

                return response.data;
            } catch (error) {
                const status = error.response?.status;
                const isTimeout = error.code === 'ECONNABORTED' || !error.response;
                const isRetryable = isTimeout || (status >= 500);

                if (isRetryable && attempt < 2) {
                    continue;
                }

                logData.success = false;
                logData.statusCode = status || 0;
                logData.errorMessage = error.response?.data
                    ? JSON.stringify(error.response.data)
                    : error.message;
                logData.duration = Date.now() - startTime;
                await this.logApiCall(logData);

                throw error;
            }
        }
    }

    /**
     * Создаёт заказ в ManaStore. ManaStore НЕ принимает price/referenceId/sku —
     * только wallet_id + product_variant_id + quantity (см. ТЗ раздел 26.3).
     * Ключ в ответе никогда не приходит — за ним нужен отдельный getOrderContent().
     */
    async createOrder(variantId, quantity = 1) {
        if (MOCK_MODE) {
            const mockOrderId = `mock-mana-${Date.now()}`;
            await this.logApiCall({
                method: 'createOrder',
                environment: this.environment,
                variantId: String(variantId),
                requestData: JSON.stringify({ variantId, quantity }),
                success: true,
                statusCode: 201,
                responseData: JSON.stringify({ mock: true, orderId: mockOrderId }),
                duration: 0,
            });

            return {
                manaOrderId: mockOrderId,
                manaOrderNumber: `MOCK-${Date.now()}`,
                fulfillmentStatus: 'completed',
                paymentStatus: 'completed',
                status: 'COMPLETED',
                rawContent: { mock: true },
            };
        }

        const response = await this.request('post', '/orders', {
            data: {
                wallet_id: this.walletId,
                items: [{ product_variant_id: variantId, quantity }],
            },
            logMeta: { method: 'createOrder', variantId },
        });

        // Реальный ответ оборачивает заказ в { message, data: {...} }, а не отдаёт поля на верхнем уровне
        // (расходится с кратким описанием в доках) — подтверждено живым тестовым вызовом 2026-07-17.
        const order = response.data || response;
        const fulfillmentStatus = order.fulfillment_status || null;
        const paymentStatus = order.payment_status || null;

        return {
            manaOrderId: order.ulid,
            manaOrderNumber: order.order_number || null,
            fulfillmentStatus,
            paymentStatus,
            status: normalizeStatus(fulfillmentStatus, paymentStatus),
            rawContent: order,
        };
    }

    /** GET /orders/{order} — актуальные fulfillment_status/payment_status. */
    async getOrderStatus(manaOrderId) {
        if (MOCK_MODE) {
            return {
                fulfillmentStatus: 'completed',
                paymentStatus: 'completed',
                status: 'COMPLETED',
                rawContent: { mock: true },
            };
        }

        const response = await this.request('get', `/orders/${manaOrderId}`, {
            logMeta: { method: 'getOrderStatus', referenceId: manaOrderId },
        });

        // Тот же { data: {...} } конверт, что и у createOrder — подтверждено живым вызовом.
        const order = response.data || response;
        const fulfillmentStatus = order.fulfillment_status || null;
        const paymentStatus = order.payment_status || null;

        return {
            fulfillmentStatus,
            paymentStatus,
            status: normalizeStatus(fulfillmentStatus, paymentStatus),
            rawContent: order,
        };
    }

    /**
     * GET /orders/{order}/get-codes — единственный способ получить реальные коды.
     * Возвращает { ready, codes } в нормализованном виде.
     */
    async getOrderContent(manaOrderId) {
        if (MOCK_MODE) {
            return {
                ready: true,
                codes: [{
                    code: `MOCK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
                    serialNumber: 'MOCK-SERIAL',
                    pinCode: null,
                    expirationDate: null,
                }],
            };
        }

        const data = await this.request('get', `/orders/${manaOrderId}/get-codes`, {
            logMeta: { method: 'getOrderContent', referenceId: manaOrderId },
        });

        const items = data.data || [];
        const ready = items.length > 0 && items.every((item) => item.status === 'completed');
        const codes = items.flatMap((item) => (item.codes || []).map((c) => ({
            code: c.code,
            serialNumber: c.serial_number || null,
            pinCode: c.pin_code || null,
            expirationDate: c.expiration_date || null,
        })));

        return { ready, codes };
    }

    /** GET /products — каталог, используется syncSkuCatalog() в админке. */
    async listProducts(params = {}) {
        if (MOCK_MODE) return { data: [], links: {}, meta: {} };
        return this.request('get', '/products', { params, logMeta: { method: 'listProducts' } });
    }

    /** GET /products/search */
    async searchProducts(query, params = {}) {
        if (MOCK_MODE) return { data: [], links: {}, meta: {} };
        return this.request('get', '/products/search', {
            params: { search: query, ...params },
            logMeta: { method: 'searchProducts' },
        });
    }

    /** GET /products/{id} — единичный ресурс, тоже завёрнут в { data: {...} } (подтверждено живым вызовом). */
    async getProduct(id) {
        if (MOCK_MODE) return null;
        const response = await this.request('get', `/products/${id}`, {
            logMeta: { method: 'getProduct', referenceId: String(id) },
        });
        return response.data || response;
    }

    /** GET /wallets — баланс кошелька активного контура, для дашборда/алертов. */
    async getWalletBalance() {
        if (MOCK_MODE) {
            return {
                id: 'mock-wallet',
                name: 'Mock Wallet',
                balance: { amount: 1000000, currency: 'UZS', formatted: '1,000,000 UZS' },
            };
        }

        const data = await this.request('get', '/wallets', { logMeta: { method: 'getWalletBalance' } });
        const wallets = data.data || [];
        return wallets.find((w) => w.id === this.walletId) || wallets[0] || null;
    }

    async logApiCall(logData) {
        try {
            const prisma = (await import('../prisma/client.js')).default;
            await prisma.manaStoreApiLog.create({ data: logData });
        } catch (err) {
            console.error('[ManaStoreService] Failed to log API call:', err);
        }
    }
}

export default new ManaStoreService();
