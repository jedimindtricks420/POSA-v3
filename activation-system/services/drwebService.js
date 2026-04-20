import axios from 'axios';
import crypto from 'crypto';

const DRWEB_API_URL = process.env.DRWEB_API_URL || 'http://localhost:8001/drweb/api/v1';
const API_KEY = process.env.DRWEB_API_KEY || 'drweb_secret_key_2026';
const MOCK_MODE = process.env.DRWEB_MOCK === 'true' || false;

class DrWebService {
    constructor() {}

    /**
     * Create an order for a digital key
     * @param {string} sku - Dr.Web SKU
     * @param {string} referenceId - Our unique voucher ID or transaction ID
     * @param {number} price - Unit price (optional)
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
            console.log(`[DrWebService] MOCK createOrder for SKU: ${sku}, Ref: ${referenceId}`);
            const result = {
                drwebOrderId: `mock-order-${Date.now()}`,
                status: 'COMPLETED',
                key: `MOCK-DRWEB-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${sku}`
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
            const requestBody = {
                sku: sku,
                source: `voucher-${referenceId}`
            };

            const response = await axios.post(`${DRWEB_API_URL}/generate`, requestBody, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = {
                drwebOrderId: `drweb-order-${Date.now()}`, // Or whatever unique ID is needed
                status: 'COMPLETED',
                key: response.data.serial || null
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

            console.error('[DrWebService] createOrder error:', error.response?.data || error.message);
            throw new Error('Failed to create Dr.Web order');
        }
    }

    async logApiCall(logData) {
        try {
            const prisma = (await import('../prisma/client.js')).default;
            await prisma.drWebApiLog.create({ data: logData });
        } catch (err) {
            console.error('[DrWebService] Failed to log API call:', err);
        }
    }
}

export default new DrWebService();
