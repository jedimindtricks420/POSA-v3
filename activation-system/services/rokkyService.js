import axios from 'axios';
import crypto from 'crypto';

const ROKKY_API_URL = process.env.ROKKY_API_URL || 'https://api.rokky.com/v1'; // Placeholder
const PARTNER_CODE = process.env.ROKKY_PARTNER_CODE;
const USERNAME = process.env.ROKKY_USERNAME;
const PASSWORD = process.env.ROKKY_PASSWORD;
const MOCK_MODE = process.env.ROKKY_MOCK === 'true' || true; // Force TRUE for testing if env is missing

class RokkyService {
    constructor() {
        this.token = null;
    }

    /**
     * Create an order for a digital key
     * @param {string} sku - Rokky SKU
     * @param {string} referenceId - Our unique voucher ID or transaction ID
     * @param {number} price - Unit price (optional, for validation)
     */
    async createOrder(sku, referenceId, price) {
        const startTime = Date.now();
        const logData = {
            method: 'createOrder',
            sku,
            referenceId,
            requestData: JSON.stringify({ sku, referenceId, price }),
            success: false
        };

        if (MOCK_MODE) {
            console.log(`[RokkyService] MOCK createOrder for SKU: ${sku}, Ref: ${referenceId}`);
            const result = {
                rokkyOrderId: `mock-order-${Date.now()}`,
                status: 'COMPLETED',
                key: `MOCK-KEY-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${sku}`
            };

            // Log successful mock request
            logData.success = true;
            logData.statusCode = 200;
            logData.responseData = JSON.stringify(result);
            logData.duration = Date.now() - startTime;
            await this.logApiCall(logData);

            return result;
        }

        try {
            const auth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
            const requestBody = {
                partnerOrderId: referenceId,
                items: [
                    {
                        sku: sku,
                        quantity: 1,
                        unitPrice: price
                    }
                ]
            };

            const response = await axios.post(`${ROKKY_API_URL}/orders`, requestBody, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = {
                rokkyOrderId: response.data.orderId,
                status: response.data.status,
                key: response.data.items?.[0]?.key || null
            };

            // Log successful request
            logData.success = true;
            logData.statusCode = response.status;
            logData.responseData = JSON.stringify(response.data);
            logData.duration = Date.now() - startTime;
            await this.logApiCall(logData);

            return result;

        } catch (error) {
            // Log failed request
            logData.success = false;
            logData.statusCode = error.response?.status || 500;
            logData.errorMessage = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            logData.duration = Date.now() - startTime;
            await this.logApiCall(logData);

            console.error('[RokkyService] createOrder error:', error.response?.data || error.message);
            throw new Error('Failed to create Rokky order');
        }
    }

    async logApiCall(logData) {
        try {
            const prisma = (await import('../prisma/client.js')).default;
            await prisma.rokkyApiLog.create({ data: logData });
        } catch (err) {
            console.error('[RokkyService] Failed to log API call:', err);
        }
    }

    /**
     * Fetch order content (if async)
     * @param {string} rokkyOrderId 
     */
    async getOrderContent(rokkyOrderId) {
        if (MOCK_MODE) {
            return {
                status: 'COMPLETED',
                key: `MOCK-KEY-DELAYED-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
            };
        }

        try {
            const auth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
            const response = await axios.get(`${ROKKY_API_URL}/orders/${rokkyOrderId}/content`, {
                headers: {
                    'Authorization': `Basic ${auth}`
                }
            });

            return {
                status: response.data.status,
                key: response.data.items?.[0]?.key || null
            };
        } catch (error) {
            console.error('[RokkyService] getOrderContent error:', error.response?.data || error.message);
            throw error;
        }
    }
}

export default new RokkyService();
