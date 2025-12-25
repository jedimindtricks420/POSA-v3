/**
 * Коды ошибок Click
 */
export const CLICK_ERRORS = {
    SUCCESS: 0,
    SIGN_CHECK_FAILED: -1,
    WRONG_AMOUNT: -2,
    ACTION_NOT_FOUND: -3,
    ALREADY_PAID: -4,
    ORDER_NOT_FOUND: -5,
    TRANSACTION_NOT_FOUND: -6,
    CANCEL_ERROR: -7,
    ACTION_DISABLED: -8,
    CANCELLED: -9,
    SYSTEM_ERROR: -10
};

/**
 * Коды ошибок Payme
 */
export const PAYME_ERRORS = {
    // Transport errors
    TRANSPORT_ERROR: { code: -32300, message: 'Transport error' },

    // System errors
    SYSTEM_ERROR: { code: -32400, message: 'System error' },
    METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
    AUTH_ERROR: { code: -32504, message: 'Insufficient privilege to perform this method' },

    // Business logic errors
    WRONG_AMOUNT: { code: -31001, message: 'Incorrect amount' },
    TRANSACTION_NOT_FOUND: { code: -31003, message: 'Transaction not found' },
    CANNOT_PERFORM: { code: -31008, message: 'Unable to perform operation' },
    CANNOT_CANCEL: { code: -31007, message: 'Unable to cancel transaction' },

    // Account errors (order)
    ORDER_NOT_FOUND: { code: -31050, message: 'Order not found' },
    ORDER_CANCELLED: { code: -31051, message: 'Order cancelled' },
    ORDER_ALREADY_PAID: { code: -31052, message: 'Order already paid' }
};

/**
 * Класс ошибки Payme
 */
export class PaymeError extends Error {
    constructor(error, data = null) {
        super(error.message);
        this.code = error.code;
        this.data = data;
        this.name = 'PaymeError';
    }
}
