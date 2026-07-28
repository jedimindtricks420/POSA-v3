import prisma from '../../prisma/client.js';
import { verifyAlifSignature } from '../../utils/payment/alifSignature.js';

// Финальные отрицательные статусы Alifpay (см. docs.alifpay.uz/payments/#structure).
// PENDING/PENDING_REVERSAL/OTP_REQUIRED — промежуточные, попытку не трогаем.
const ALIF_NON_FINAL_STATUSES = ['PENDING', 'PENDING_REVERSAL', 'OTP_REQUIRED'];

/**
 * Обработка вебхука Alifpay.
 * Endpoint: POST /api/payments/alif/:kassaId/webhook
 */
export async function handleWebhook(req, res) {
    const rawBody = req.rawBody;
    const signature = req.headers['signature'];

    try {
        const kassaId = parseInt(req.params.kassaId);
        if (!kassaId) {
            console.error('[Alif] Webhook: kassaId not specified');
            return res.status(200).json({ status: 'kassa_not_found' });
        }

        const kassa = await prisma.kassa.findUnique({ where: { id: kassaId } });
        if (!kassa) {
            console.error('[Alif] Webhook: kassa not found', kassaId);
            return res.status(200).json({ status: 'kassa_not_found' });
        }

        const secretKey = kassa.alifEnv === 'production'
            ? kassa.alifSecretKeyProduction
            : kassa.alifSecretKeySandbox;

        if (!verifyAlifSignature(rawBody, signature, secretKey)) {
            console.error('[Alif] Webhook: invalid signature');
            return res.status(403).json({ status: 'invalid_signature' });
        }

        const body = req.body;

        // ВАЖНО: верхнеуровневый `id` — это ID СЧЁТА (invoice), не платежа.
        // Статус/сумма/ID платежа лежат в body.payment.*
        const invoiceId = body.id;
        const payment = body.payment || {};
        const paymentStatus = payment.status;
        const paymentId = payment.id;
        const orderIdFromMeta = body.meta?.order_id ? parseInt(body.meta.order_id) : null;

        console.log(`[Alif] Webhook: invoice=${invoiceId} payment=${paymentId} status=${paymentStatus}`);

        // Найти QrPaymentAttempt: сначала по meta.order_id (это attempt.id),
        // резервно — по externalPaymentId (invoice id, сохранённый при создании счёта).
        let attempt = null;
        if (orderIdFromMeta) {
            attempt = await prisma.qrPaymentAttempt.findUnique({
                where: { id: orderIdFromMeta },
                include: { link: { include: { product: { include: { vendor: true } }, merchant: true } } },
            });
        }
        if (!attempt) {
            attempt = await prisma.qrPaymentAttempt.findFirst({
                where: { externalPaymentId: invoiceId },
                include: { link: { include: { product: { include: { vendor: true } }, merchant: true } } },
            });
        }

        if (!attempt) {
            console.error('[Alif] Webhook: attempt not found for invoice', invoiceId);
            return res.status(200).json({ status: 'attempt_not_found' });
        }

        // Идемпотентность
        if (attempt.status === 'PAID') {
            return res.status(200).json({ status: 'already_paid' });
        }

        if (paymentStatus !== 'SUCCEEDED') {
            if (paymentStatus && !ALIF_NON_FINAL_STATUSES.includes(paymentStatus)) {
                await prisma.qrPaymentAttempt.update({
                    where: { id: attempt.id },
                    data: { status: 'FAILED' },
                });
            }
            return res.status(200).json({ status: 'not_succeeded', paymentStatus });
        }

        // Успех — переиспользуем ОБЩУЮ функцию, которой пользуются Click/Payme
        const { processPaymentInternal } = await import('../public/qrPaymentController.js');
        const result = await processPaymentInternal(attempt.id, attempt.link, kassa);

        if (!result.success) {
            console.error('[Alif] Webhook: processPaymentInternal failed:', result.error);
            return res.status(200).json({ status: 'processing_failed', error: result.error });
        }

        console.log('[Alif] Webhook: payment successful for attempt', attempt.id);
        return res.status(200).json({ status: 'ok' });

    } catch (error) {
        console.error('[Alif] Webhook error:', error);
        // Возвращаем 200, чтобы Alifpay не повторял бесконечно при нашей внутренней ошибке
        // (сам факт ошибки уже залогирован для расследования).
        return res.status(200).json({ status: 'internal_error' });
    }
}
