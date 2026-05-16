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
        // 0. Определяем кассу из URL
        const kassaId = parseInt(req.params.kassaId);
        if (!kassaId) {
            throw new PaymeError(PAYME_ERRORS.SYSTEM_ERROR);
        }
        const kassa = await prisma.kassa.findUnique({ where: { id: kassaId } });
        if (!kassa) {
            throw new PaymeError(PAYME_ERRORS.SYSTEM_ERROR);
        }

        // Проверка авторизации с credentials кассы
        if (!checkPaymeAuth(req, kassa)) {
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
                result = await PerformTransaction(params, kassa);
                break;
            case 'CancelTransaction':
                result = await CancelTransaction(params);
                break;
            case 'CheckTransaction':
                result = await CheckTransaction(params);
                break;
            case 'GetStatement':
                result = await GetStatement(params);
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
    const orderIdRaw = account.Namo || account.order_id;
    if (!account || !orderIdRaw) {
        throw new PaymeError(PAYME_ERRORS.ORDER_NOT_FOUND, 'Namo');
    }

    const orderId = parseInt(orderIdRaw);

    if (isNaN(orderId)) {
        throw new PaymeError(PAYME_ERRORS.ORDER_NOT_FOUND, 'Namo');
    }

    // Найти попытку оплаты
    const attempt = await prisma.qrPaymentAttempt.findUnique({
        where: { id: orderId }
    });

    if (!attempt) {
        throw new PaymeError(PAYME_ERRORS.ORDER_NOT_FOUND, 'Namo');
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
    const orderIdRaw = account.Namo || account.order_id;
    if (!account || !orderIdRaw) {
        throw new PaymeError(PAYME_ERRORS.ORDER_NOT_FOUND, 'Namo');
    }

    const orderId = parseInt(orderIdRaw);

    if (isNaN(orderId)) {
        throw new PaymeError(PAYME_ERRORS.ORDER_NOT_FOUND, 'Namo');
    }

    // Проверка таймаута (12 часов)
    if (Date.now() - time > 43200000) {
        throw new PaymeError(PAYME_ERRORS.CANNOT_PERFORM, 'timeout');
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
        throw new PaymeError(PAYME_ERRORS.ORDER_NOT_FOUND, 'Namo');
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

    // Если транзакция была отменена или просрочена
    if (attempt.status === 'FAILED' || attempt.status === 'EXPIRED') {
        // Если была отменена - возвращаем ошибку
        throw new PaymeError(PAYME_ERRORS.ORDER_CANCELLED);
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
async function PerformTransaction(params, kassa = null) {
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

    // Если транзакция отменена
    if (attempt.status === 'FAILED' || attempt.status === 'EXPIRED') {
        throw new PaymeError(PAYME_ERRORS.CANNOT_PERFORM, 'Transaction cancelled');
    }

    // Проверка таймаута для выполнения (тоже 12 часов с момента создания транзакции Payme)
    // Но у нас нет времени создания транзакции Payme в базе (кроме createdAt, но это наше время)
    // Payme не присылает время в PerformTransaction

    // Выполнить оплату
    const { processPaymentInternal } = await import('../public/qrPaymentController.js');
    const result = await processPaymentInternal(attempt.id, attempt.link, kassa);

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

    // Если транзакция уже оплачена — возврат денег невозможен через API в данном случае (или возможен с state -2)
    // Payme разрешает отмену выполненной транзакции (reversal)

    const now = new Date();

    // Если уже отменена, возвращаем текущее состояние (идемпотентность)
    if (attempt.status === 'FAILED') {
        return {
            transaction: attempt.id.toString(),
            cancel_time: attempt.cancelTime ? attempt.cancelTime.getTime() : now.getTime(),
            state: attempt.paidAt ? -2 : -1
        };
    }

    // Обновить статус
    const updated = await prisma.qrPaymentAttempt.update({
        where: { id: attempt.id },
        data: {
            status: 'FAILED',
            cancelTime: now,
            cancelReason: reason
        }
    });

    console.log('[Payme] CancelTransaction: Cancelled attempt', attempt.id, 'reason:', reason);

    return {
        transaction: updated.id.toString(),
        cancel_time: now.getTime(),
        state: attempt.paidAt ? -2 : -1
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
        state = attempt.paidAt ? -2 : -1;
    } else {
        // PENDING и без externalPaymentId сюда не попадут, т.к. ищем по ID
        state = 0;
    }

    return {
        create_time: attempt.createdAt.getTime(),
        perform_time: attempt.paidAt ? attempt.paidAt.getTime() : 0,
        cancel_time: attempt.cancelTime ? attempt.cancelTime.getTime() : 0,
        transaction: attempt.id.toString(),
        state,
        reason: attempt.cancelReason || null
    };
}

/**
 * GetStatement - получение списка транзакций за период
 */
async function GetStatement(params) {
    const { from, to } = params;

    // Найти все транзакции за указанный период
    // Ищем только те, у которых есть externalPaymentId (успешно созданные через CreateTransaction)
    const attempts = await prisma.qrPaymentAttempt.findMany({
        where: {
            externalPaymentId: { not: null },
            createdAt: {
                gte: new Date(from),
                lte: new Date(to)
            }
        },
        orderBy: {
            createdAt: 'asc'
        }
    });

    // Формируем список транзакций
    const transactions = attempts.map(attempt => {
        let state;
        if (attempt.status === 'PAID') {
            state = 2;
        } else if (attempt.status === 'PROCESSING') {
            state = 1;
        } else if (attempt.status === 'FAILED' || attempt.status === 'EXPIRED') {
            state = attempt.paidAt ? -2 : -1;
        } else {
            state = 0;
        }

        return {
            id: attempt.externalPaymentId,
            time: attempt.createdAt.getTime(),
            amount: Math.round(attempt.amount * 100), // Конвертируем в тийины
            account: {
                Namo: attempt.id.toString(),
                order_id: attempt.id.toString()
            },
            create_time: attempt.createdAt.getTime(),
            perform_time: attempt.paidAt ? attempt.paidAt.getTime() : 0,
            cancel_time: attempt.cancelTime ? attempt.cancelTime.getTime() : 0,
            transaction: attempt.id.toString(),
            state,
            reason: attempt.cancelReason || null
        };
    });

    return { transactions };
}
