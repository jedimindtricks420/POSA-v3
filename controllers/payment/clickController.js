import prisma from '../../prisma/client.js';
import { verifyClickSign } from '../../utils/payment/clickSignature.js';
import { CLICK_ERRORS } from '../../utils/payment/paymeErrors.js';

/**
 * Обработка Prepare callback от Click (action=0)
 */
export async function handlePrepare(req, res) {
    const params = req.body;

    console.log('[Click] Prepare:', JSON.stringify(params));

    try {
        // 0. Определяем кассу из URL
        const kassaId = parseInt(req.params.kassaId);
        if (!kassaId) {
            return res.json({ click_trans_id: params.click_trans_id, merchant_trans_id: params.merchant_trans_id, error: CLICK_ERRORS.SYSTEM_ERROR, error_note: 'Kassa not specified' });
        }
        const kassa = await prisma.kassa.findUnique({ where: { id: kassaId } });
        if (!kassa) {
            return res.json({ click_trans_id: params.click_trans_id, merchant_trans_id: params.merchant_trans_id, error: CLICK_ERRORS.SYSTEM_ERROR, error_note: 'Kassa not found' });
        }

        // 1. Проверить подпись с credentials кассы
        if (!verifyClickSign(params, 0, kassa)) {
            console.error('[Click] Prepare: Invalid signature');
            return res.json({
                click_trans_id: params.click_trans_id,
                merchant_trans_id: params.merchant_trans_id,
                error: CLICK_ERRORS.SIGN_CHECK_FAILED,
                error_note: 'SIGN CHECK FAILED!'
            });
        }

        // 2. Найти попытку оплаты по ID
        const attemptId = parseInt(params.merchant_trans_id);
        const attempt = await prisma.qrPaymentAttempt.findUnique({
            where: { id: attemptId },
            include: {
                link: {
                    include: {
                        product: true,
                        merchant: true
                    }
                }
            }
        });

        if (!attempt) {
            console.error('[Click] Prepare: Attempt not found:', attemptId);
            return res.json({
                click_trans_id: params.click_trans_id,
                merchant_trans_id: params.merchant_trans_id,
                error: CLICK_ERRORS.ORDER_NOT_FOUND,
                error_note: 'Order not found'
            });
        }

        // 3. Проверить сумму (Click присылает в сумах)
        const expectedAmount = parseFloat(attempt.amount);
        const receivedAmount = parseFloat(params.amount);

        if (Math.abs(expectedAmount - receivedAmount) > 0.01) {
            console.error('[Click] Prepare: Wrong amount. Expected:', expectedAmount, 'Received:', receivedAmount);
            return res.json({
                click_trans_id: params.click_trans_id,
                merchant_trans_id: params.merchant_trans_id,
                error: CLICK_ERRORS.WRONG_AMOUNT,
                error_note: 'Wrong amount'
            });
        }

        // 4. Проверить статус
        if (attempt.status === 'PAID') {
            console.warn('[Click] Prepare: Already paid');
            return res.json({
                click_trans_id: params.click_trans_id,
                merchant_trans_id: params.merchant_trans_id,
                merchant_prepare_id: attempt.id,
                error: CLICK_ERRORS.ALREADY_PAID,
                error_note: 'Already paid'
            });
        }

        // 5. Обновить статус и сохранить click_trans_id
        await prisma.qrPaymentAttempt.update({
            where: { id: attempt.id },
            data: {
                status: 'PROCESSING',
                externalPaymentId: params.click_trans_id.toString()
            }
        });

        console.log('[Click] Prepare: Success for attempt', attempt.id);

        // 6. Успешный ответ
        return res.json({
            click_trans_id: params.click_trans_id,
            merchant_trans_id: params.merchant_trans_id,
            merchant_prepare_id: attempt.id,
            error: CLICK_ERRORS.SUCCESS,
            error_note: 'Success'
        });

    } catch (error) {
        console.error('[Click] Prepare error:', error);
        return res.json({
            click_trans_id: params.click_trans_id,
            merchant_trans_id: params.merchant_trans_id,
            error: CLICK_ERRORS.SYSTEM_ERROR,
            error_note: 'System error'
        });
    }
}

/**
 * Обработка Complete callback от Click (action=1)
 */
export async function handleComplete(req, res) {
    const params = req.body;

    console.log('[Click] Complete:', JSON.stringify(params));

    try {
        // 0. Определяем кассу из URL
        const kassaId = parseInt(req.params.kassaId);
        if (!kassaId) {
            return res.json({ click_trans_id: params.click_trans_id, merchant_trans_id: params.merchant_trans_id, error: CLICK_ERRORS.SYSTEM_ERROR, error_note: 'Kassa not specified' });
        }
        const kassa = await prisma.kassa.findUnique({ where: { id: kassaId } });
        if (!kassa) {
            return res.json({ click_trans_id: params.click_trans_id, merchant_trans_id: params.merchant_trans_id, error: CLICK_ERRORS.SYSTEM_ERROR, error_note: 'Kassa not found' });
        }

        // 1. Проверить подпись с credentials кассы
        if (!verifyClickSign(params, 1, kassa)) {
            console.error('[Click] Complete: Invalid signature');
            return res.json({
                click_trans_id: params.click_trans_id,
                merchant_trans_id: params.merchant_trans_id,
                error: CLICK_ERRORS.SIGN_CHECK_FAILED,
                error_note: 'SIGN CHECK FAILED!'
            });
        }

        // 2. Найти попытку оплаты
        const attemptId = parseInt(params.merchant_trans_id);
        const attempt = await prisma.qrPaymentAttempt.findUnique({
            where: { id: attemptId },
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
            console.error('[Click] Complete: Attempt not found:', attemptId);
            return res.json({
                click_trans_id: params.click_trans_id,
                merchant_trans_id: params.merchant_trans_id,
                error: CLICK_ERRORS.TRANSACTION_NOT_FOUND,
                error_note: 'Transaction not found'
            });
        }

        // 3. Проверить prepare_id
        if (parseInt(params.merchant_prepare_id) !== attempt.id) {
            console.error('[Click] Complete: Invalid prepare_id');
            return res.json({
                click_trans_id: params.click_trans_id,
                merchant_trans_id: params.merchant_trans_id,
                error: CLICK_ERRORS.TRANSACTION_NOT_FOUND,
                error_note: 'Invalid prepare_id'
            });
        }

        // 4. Если Click прислал ошибку (error < 0) — отменяем
        if (parseInt(params.error) < 0) {
            console.warn('[Click] Complete: Payment cancelled by Click, error:', params.error);
            await prisma.qrPaymentAttempt.update({
                where: { id: attempt.id },
                data: { status: 'FAILED' }
            });

            return res.json({
                click_trans_id: params.click_trans_id,
                merchant_trans_id: params.merchant_trans_id,
                merchant_confirm_id: attempt.id,
                error: CLICK_ERRORS.CANCELLED,
                error_note: 'Transaction cancelled'
            });
        }

        // 5. Если уже оплачено — вернуть успех (идемпотентность)
        if (attempt.status === 'PAID') {
            console.warn('[Click] Complete: Already paid (idempotent response)');
            return res.json({
                click_trans_id: params.click_trans_id,
                merchant_trans_id: params.merchant_trans_id,
                merchant_confirm_id: attempt.id,
                error: CLICK_ERRORS.SUCCESS,
                error_note: 'Success'
            });
        }

        // 6. Выполнить оплату - используем СУЩЕСТВУЮЩУЮ функцию из qrPaymentController
        const { processPaymentInternal } = await import('../public/qrPaymentController.js');
        const result = await processPaymentInternal(attempt.id, attempt.link, kassa);

        if (!result.success) {
            console.error('[Click] Complete: Payment processing failed:', result.error);
            return res.json({
                click_trans_id: params.click_trans_id,
                merchant_trans_id: params.merchant_trans_id,
                error: CLICK_ERRORS.SYSTEM_ERROR,
                error_note: result.error || 'Payment processing failed'
            });
        }

        console.log('[Click] Complete: Payment successful for attempt', attempt.id);

        return res.json({
            click_trans_id: params.click_trans_id,
            merchant_trans_id: params.merchant_trans_id,
            merchant_confirm_id: attempt.id,
            error: CLICK_ERRORS.SUCCESS,
            error_note: 'Success'
        });

    } catch (error) {
        console.error('[Click] Complete error:', error);
        return res.json({
            click_trans_id: params.click_trans_id,
            merchant_trans_id: params.merchant_trans_id,
            error: CLICK_ERRORS.SYSTEM_ERROR,
            error_note: 'System error'
        });
    }
}
