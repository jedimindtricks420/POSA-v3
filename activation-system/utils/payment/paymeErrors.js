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
 * Сообщения должны быть мультиязычными (uz, ru, en) согласно документации
 */
export const PAYME_ERRORS = {
    // Transport errors
    TRANSPORT_ERROR: {
        code: -32300,
        message: {
            uz: "Transport xatosi",
            ru: "Ошибка транспорта",
            en: "Transport error"
        }
    },

    // System errors
    SYSTEM_ERROR: {
        code: -32400,
        message: {
            uz: "Tizim xatosi",
            ru: "Системная ошибка",
            en: "System error"
        }
    },
    METHOD_NOT_FOUND: {
        code: -32601,
        message: {
            uz: "Metod topilmadi",
            ru: "Метод не найден",
            en: "Method not found"
        }
    },
    AUTH_ERROR: {
        code: -32504,
        message: {
            uz: "Ushbu usulni bajarishga ruxsat yo'q",
            ru: "Недостаточно прав для выполнения метода",
            en: "Insufficient privilege to perform this method"
        }
    },

    // Business logic errors
    WRONG_AMOUNT: {
        code: -31001,
        message: {
            uz: "Noto'g'ri summa",
            ru: "Недопустимая сумма",
            en: "Invalid amount"
        }
    },
    TRANSACTION_NOT_FOUND: {
        code: -31003,
        message: {
            uz: "Tranzaksiya topilmadi",
            ru: "Транзакция не найдена",
            en: "Transaction not found"
        }
    },
    CANNOT_PERFORM: {
        code: -31008,
        message: {
            uz: "Operatsiyani bajarib bo'lmadi",
            ru: "Невозможно выполнить операцию",
            en: "Unable to perform operation"
        }
    },
    CANNOT_CANCEL: {
        code: -31007,
        message: {
            uz: "Tranzaksiyani bekor qilib bo'lmaydi",
            ru: "Невозможно отменить транзакцию",
            en: "Unable to cancel transaction"
        }
    },

    // Account errors (order)
    ORDER_NOT_FOUND: {
        code: -31050,
        message: {
            uz: "Biz sizning hisobingizni topolmadik",
            ru: "Мы не нашли вашу учетную запись",
            en: "We couldn't find your account"
        }
    },
    ORDER_CANCELLED: {
        code: -31051,
        message: {
            uz: "Buyurtma bekor qilindi",
            ru: "Заказ отменен",
            en: "Order cancelled"
        }
    },
    ORDER_ALREADY_PAID: {
        code: -31052,
        message: {
            uz: "Buyurtma allaqachon to'langan",
            ru: "Заказ уже оплачен",
            en: "Order already paid"
        }
    },
    ORDER_HAS_TRANSACTION: {
        code: -31053,
        message: {
            uz: "Buyurtmada boshqa tranzaksiya mavjud",
            ru: "По заказу уже есть другая транзакция",
            en: "Order already has another transaction"
        }
    }
};

/**
 * Класс ошибки Payme
 */
export class PaymeError extends Error {
    constructor(error, data = null) {
        const msg = typeof error.message === 'object' ? error.message.en : error.message;
        super(msg);
        this.code = error.code;
        this.messageObj = error.message;
        this.data = data;
        this.name = 'PaymeError';
    }
}
