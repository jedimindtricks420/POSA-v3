import prisma from '../../prisma/client.js';
import { PaymeError, PAYME_ERRORS } from '../../utils/payment/paymeErrors.js';
import { checkPaymeAuth } from '../../utils/payment/paymeHelpers.js';

/**
 * Главный обработчик JSON-RPC запросов от Payme
 */
export async function handlePayme(req, res) {
    const { method, params, id } = req.body;

    console.log(`[Payme] ${method}:`, JSON.stringify(params));

    try {
        // Проверка авторизации
        if (!checkPaymeAuth(req)) {
            throw new PaymeError(PAYME_ERRORS.AUTH_ERROR);
        }

        // Вызов метода
        let result;
        switch (method) {
            case 'CheckPerformTransaction':
                result = await CheckPerformTransaction(params);
                break;
            case 'CreateTransaction':
                result = await CreateTransaction(params);
                break;
            case 'PerformTransaction':
                result = await PerformTransaction(params);
                break;
            case 'CancelTransaction':
                result = await CancelTransaction(params);
                break;
            case 'CheckTransaction':
                result = await CheckTransaction(params);
                break;
            default:
                throw new PaymeError(PAYME_ERRORS.METHOD_NOT_FOUND);
        }

        return res.json({ result, id });

    } catch (error) {
        console.error(`[Payme] Error:`, error);

        if (error instanceof PaymeError) {
            return res.json({
                error: {
                    code: error.code,
                    message: error.messageObj,
                    data: error.data
                },
                id
            });
        }

        return res.json({
            error: {
                code: PAYME_ERRORS.SYSTEM_ERROR.code,
                message: PAYME_ERRORS.SYSTEM_ERROR.message
            },
            id
        });
    }
}

/**
 * CheckPerformTransaction - проверка возможности оплаты
 */
async function CheckPerformTransaction(params) {
    const { amount, account } = params;

    // Валидация account
    if (!account || !account.order_id) {
        throw new PaymeError(PAYME_ERRORS.ORDER_NOT_FOUND, 'order_id');
    }

    const orderId = parseInt(account.order_id);

    if (isNaN(orderId)) {
        throw new PaymeError(PAYME_ERRORS.ORDER_NOT_FOUND, 'order_id');
    }

    // Найти попытку оплаты
    const attempt = await prisma.qrPaymentAttempt.findUnique({
        where: { id: orderId }
    });

    if (!attempt) {
        throw new PaymeError(PAYME_ERRORS.ORDER_NOT_FOUND);
    }

    // Проверить сумму (Payme присылает в тийинах, у нас в QrPaymentAttempt amount в сумах)
    const expectedAmountInTiyin = Math.round(attempt.amount * 100);
    if (amount !== expectedAmountInTiyin) {
        throw new PaymeError(PAYME_ERRORS.WRONG_AMOUNT);
    }

    // Проверить статус
    if (attempt.status === 'PAID') {
        throw new PaymeError(PAYME_ERRORS.ORDER_ALREADY_PAID);
    }

    if (attempt.status === 'FAILED' || attempt.status === 'EXPIRED') {
        throw new PaymeError(PAYME_ERRORS.ORDER_CANCELLED);
    }

    return { allow: true };
}

/**
 * CreateTransaction - создание транзакции
 */
async function CreateTransaction(params) {
    const { id, time, amount, account } = params;

    // Валидация account
    if (!account || !account.order_id) {
        throw new PaymeError(PAYME_ERRORS.ORDER_NOT_FOUND, 'order_id');
    }

    const orderId = parseInt(account.order_id);

    if (isNaN(orderId)) {
        throw new PaymeError(PAYME_ERRORS.ORDER_NOT_FOUND, 'order_id');
    }

    // Проверить существующую транзакцию с таким же Payme ID (идемпотентность)
    const existing = await prisma.qrPaymentAttempt.findFirst({
        where: { externalPaymentId: id }
    });

    if (existing) {
        console.log('[Payme] CreateTransaction: Found existing transaction');
        return {
            create_time: existing.createdAt.getTime(),
            transaction: existing.id.toString(),
            state: existing.status === 'PAID' ? 2 : 1
        };
    }

    // Найти попытку оплаты
    const attempt = await prisma.qrPaymentAttempt.findUnique({
        where: { id: orderId }
    });

    if (!attempt) {
        throw new PaymeError(PAYME_ERRORS.ORDER_NOT_FOUND);
    }

    // Проверить, есть ли уже транзакция с ДРУГИМ Payme ID
    if (attempt.externalPaymentId && attempt.externalPaymentId !== id) {
        console.log('[Payme] CreateTransaction: Order already has different transaction:', attempt.externalPaymentId);
        throw new PaymeError(PAYME_ERRORS.ORDER_HAS_TRANSACTION);
    }

    // Проверить сумму
    const expectedAmountInTiyin = Math.round(attempt.amount * 100);
    if (amount !== expectedAmountInTiyin) {
        throw new PaymeError(PAYME_ERRORS.WRONG_AMOUNT);
    }

    // Проверить статус
    if (attempt.status === 'PAID') {
        throw new PaymeError(PAYME_ERRORS.ORDER_ALREADY_PAID);
    }

    // Обновить статус и сохранить Payme transaction ID
    const updated = await prisma.qrPaymentAttempt.update({
        where: { id: attempt.id },
        data: {
            status: 'PROCESSING',
            externalPaymentId: id
        }
    });

    console.log('[Payme] CreateTransaction: Success for attempt', attempt.id);

    return {
        create_time: updated.createdAt.getTime(),
        transaction: updated.id.toString(),
        state: 1
    };
}

/**
 * PerformTransaction - проведение платежа
 */
async function PerformTransaction(params) {
    const { id } = params;

    // Найти транзакцию по Payme ID
    const attempt = await prisma.qrPaymentAttempt.findFirst({
        where: { externalPaymentId: id },
        include: {
            link: {
                include: {
                    product: { include: { vendor: true } },
                    merchant: true
                }
            }
        }
    });

    if (!attempt) {
        throw new PaymeError(PAYME_ERRORS.TRANSACTION_NOT_FOUND);
    }

    // Если уже оплачено - вернуть успех (идемпотентность)
    if (attempt.status === 'PAID' && attempt.paidAt) {
        console.log('[Payme] PerformTransaction: Already paid (idempotent)');
        return {
            transaction: attempt.id.toString(),
            perform_time: attempt.paidAt.getTime(),
            state: 2
        };
    }

    // Выполнить оплату - используем СУЩЕСТВУЮЩУЮ функцию
    const { processPaymentInternal } = await import('../public/qrPaymentController.js');
    const result = await processPaymentInternal(attempt.id, attempt.link);

    if (!result.success) {
        console.error('[Payme] PerformTransaction: Payment failed:', result.error);
        throw new PaymeError(PAYME_ERRORS.CANNOT_PERFORM, result.error);
    }

    // Получить обновленную запись
    const updated = await prisma.qrPaymentAttempt.findUnique({
        where: { id: attempt.id }
    });

    console.log('[Payme] PerformTransaction: Success for attempt', attempt.id);

    return {
        transaction: updated.id.toString(),
        perform_time: updated.paidAt.getTime(),
        state: 2
    };
}

/**
 * CancelTransaction - отмена транзакции
 */
async function CancelTransaction(params) {
    const { id, reason } = params;

    const attempt = await prisma.qrPaymentAttempt.findFirst({
        where: { externalPaymentId: id }
    });

    if (!attempt) {
        throw new PaymeError(PAYME_ERRORS.TRANSACTION_NOT_FOUND);
    }

    const now = new Date();

    // Обновить статус
    await prisma.qrPaymentAttempt.update({
        where: { id: attempt.id },
        data: {
            status: 'FAILED'
            // Можно добавить поле cancelReason если нужно
        }
    });

    console.log('[Payme] CancelTransaction: Cancelled attempt', attempt.id, 'reason:', reason);

    return {
        transaction: attempt.id.toString(),
        cancel_time: now.getTime(),
        state: attempt.status === 'PAID' ? -2 : -1
    };
}

/**
 * CheckTransaction - проверка статуса транзакции
 */
async function CheckTransaction(params) {
    const { id } = params;

    const attempt = await prisma.qrPaymentAttempt.findFirst({
        where: { externalPaymentId: id }
    });

    if (!attempt) {
        throw new PaymeError(PAYME_ERRORS.TRANSACTION_NOT_FOUND);
    }

    let state;
    if (attempt.status === 'PAID') {
        state = 2;
    } else if (attempt.status === 'PROCESSING') {
        state = 1;
    } else if (attempt.status === 'FAILED' || attempt.status === 'EXPIRED') {
        state = -1;
    } else {
        state = 0;
    }

    return {
        create_time: attempt.createdAt.getTime(),
        perform_time: attempt.paidAt ? attempt.paidAt.getTime() : 0,
        cancel_time: 0,
        transaction: attempt.id.toString(),
        state,
        reason: null
    };
}
