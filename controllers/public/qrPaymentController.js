import prisma from '../../prisma/client.js';
import path from 'path';
import fs from 'fs';
import { resolveReceiptTemplate } from '../../utils/receiptRenderer.js';
import {
    generatePDFReceipt,
    sendVoucherSMS,
    buildReceiptQrUrl,
    formatCurrencyUz
} from '../merchant/saleController.js';
import { generateClickUrl } from '../../utils/payment/clickSignature.js';
import { generatePaymeUrl } from '../../utils/payment/paymeHelpers.js';
import { createInvoice, getCheckoutUrl, isAmountInAlifRange } from '../../utils/payment/alifClient.js';

// Страница товара
export const showProductPage = async (req, res) => {
    try {
        const { token } = req.params;

        const link = await prisma.merchantProductLink.findUnique({
            where: { token },
            include: {
                merchant: true,
                product: {
                    include: {
                        vendor: true,
                        images: { where: { isPrimary: true }, take: 1 }
                    }
                }
            }
        });

        if (!link || !link.isActive) {
            return res.render('pages/pay-error', {
                error: 'link_invalid',
                message: 'Ссылка недействительна'
            });
        }

        if (link.merchant.status !== 'active') {
            return res.render('pages/pay-error', {
                error: 'merchant_inactive',
                message: 'Продавец недоступен'
            });
        }

        if (link.product.status !== 'on') {
            return res.render('pages/pay-error', {
                error: 'product_inactive',
                message: 'Товар снят с продажи'
            });
        }

        // Проверить наличие ваучеров
        const voucherCount = await prisma.voucher.count({
            where: { productId: link.productId, status: 'active' }
        });

        // Зачёркнутая "старая" цена для витрины: подобрана так, чтобы текущая
        // цена реально была скидкой 10% от неё (price = oldPrice * 0.9)
        const oldPrice = Math.round(link.product.price / 0.9);
        const discountPercent = Math.round((oldPrice - link.product.price) / oldPrice * 100);

        res.render('pages/pay-product', {
            link,
            merchant: link.merchant,
            product: link.product,
            hasVouchers: voucherCount > 0,
            oldPrice,
            discountPercent
        });
    } catch (error) {
        console.error('Error loading product page:', error);
        res.render('pages/pay-error', {
            error: 'server_error',
            message: 'Ошибка сервера'
        });
    }
};

// Страница checkout
export const showCheckoutPage = async (req, res) => {
    try {
        const { token } = req.params;

        const link = await prisma.merchantProductLink.findUnique({
            where: { token },
            include: {
                merchant: true,
                product: { include: { vendor: true } }
            }
        });

        if (!link || !link.isActive) {
            return res.redirect(`/pay/${token}`);
        }

        res.render('pages/pay-checkout', {
            link,
            merchant: link.merchant,
            product: link.product,
            token
        });
    } catch (error) {
        console.error('Error loading checkout:', error);
        res.redirect(`/pay/${req.params.token}`);
    }
};

// Обработка оплаты (Фаза 2 - реальные платёжные системы)
export const processCheckout = async (req, res) => {
    try {
        const { token } = req.params;
        const { phoneNumber, paymentMethod } = req.body;

        // Валидация телефона
        const phoneRegex = /^\+998[0-9]{9}$/;
        if (!phoneNumber || !phoneRegex.test(phoneNumber)) {
            return res.status(400).json({
                success: false,
                error: 'Некорректный номер телефона'
            });
        }

        // Валидация метода оплаты
        if (!paymentMethod || !['click', 'payme', 'alif'].includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                error: 'Выберите способ оплаты'
            });
        }

        const link = await prisma.merchantProductLink.findUnique({
            where: { token },
            include: {
                merchant: true,
                product: { include: { vendor: { include: { kassa: true } } } }
            }
        });

        if (!link) {
            return res.status(404).json({ success: false, error: 'Ссылка не найдена' });
        }

        // Определяем кассу через вендора
        const kassa = link.product.vendor.kassa;
        const kassaCredentials = kassa || null;

        // Создать попытку оплаты
        const attempt = await prisma.qrPaymentAttempt.create({
            data: {
                linkId: link.id,
                phoneNumber,
                amount: link.product.price,
                paymentMethod: paymentMethod,
                status: 'PENDING',
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
                kassaId: kassa?.id || null
            }
        });

        const baseUrl = process.env.PAYMENT_BASE_URL || 'https://wallet.namo.uz';
        const returnUrl = `${baseUrl}/pay/${token}/result/${attempt.id}`;

        let redirectUrl;

        if (paymentMethod === 'click') {
            // Click - сумма в сумах
            redirectUrl = generateClickUrl(attempt.id.toString(), link.product.price, returnUrl, kassaCredentials);
        } else if (paymentMethod === 'payme') {
            // Payme - сумма в тийинах
            const amountInTiyin = Math.round(link.product.price * 100);
            redirectUrl = generatePaymeUrl(attempt.id.toString(), amountInTiyin, returnUrl, kassaCredentials);
        } else if (paymentMethod === 'alif') {
            const env = kassaCredentials?.alifEnv || 'sandbox';
            const alifToken = env === 'production'
                ? kassaCredentials?.alifTokenProduction
                : kassaCredentials?.alifTokenSandbox;

            if (!alifToken) {
                await prisma.qrPaymentAttempt.update({
                    where: { id: attempt.id },
                    data: { status: 'FAILED' }
                });
                return res.status(400).json({ success: false, error: 'Alifpay не настроен для этой кассы' });
            }

            const priceInTiyin = Math.round(link.product.price * 100);
            if (!isAmountInAlifRange(priceInTiyin)) {
                await prisma.qrPaymentAttempt.update({
                    where: { id: attempt.id },
                    data: { status: 'FAILED' }
                });
                return res.status(400).json({ success: false, error: 'Сумма вне допустимого диапазона Alifpay' });
            }

            // Alifpay требует https:// для cancel_url/redirect_url/webhook_url
            const httpsBaseUrl = baseUrl.replace(/^http:/, 'https:');
            const httpsReturnUrl = returnUrl.replace(/^http:/, 'https:');
            const webhookUrl = `${httpsBaseUrl}/api/payments/alif/${kassaCredentials?.id}/webhook`;

            const invoiceResult = await createInvoice({
                token: alifToken,
                env,
                items: [{ name: link.product.name, amount: 1, price: priceInTiyin }],
                cancelUrl: `${httpsBaseUrl}/pay/${token}/checkout`,
                redirectUrl: httpsReturnUrl,
                webhookUrl,
                meta: { order_id: attempt.id.toString() },
            });

            if (!invoiceResult.success) {
                // Откатываем попытку, чтобы не плодить "мёртвые" PENDING-записи
                await prisma.qrPaymentAttempt.update({
                    where: { id: attempt.id },
                    data: { status: 'FAILED' },
                });
                return res.status(502).json({ success: false, error: invoiceResult.error });
            }

            // Сохраняем invoice id сразу — в отличие от Click/Payme, здесь мы это можем
            // сделать синхронно, т.к. счёт уже реально создан на стороне Alifpay.
            await prisma.qrPaymentAttempt.update({
                where: { id: attempt.id },
                data: { externalPaymentId: invoiceResult.id },
            });

            redirectUrl = getCheckoutUrl(invoiceResult.id, env);
        }

        console.log(`[Payment] Redirecting to ${paymentMethod}:`, redirectUrl);

        res.json({
            success: true,
            redirectUrl: redirectUrl
        });

    } catch (error) {
        console.error('Error processing checkout:', error);
        res.status(500).json({ success: false, error: 'Ошибка обработки' });
    }
};

// Обработка платежа (внутренняя функция) - ЭКСПОРТИРУЕТСЯ для Click/Payme контроллеров
export async function processPaymentInternal(attemptId, link, kassa = null) {

    try {
        const attempt = await prisma.qrPaymentAttempt.findUnique({
            where: { id: attemptId }
        });

        const merchant = link.merchant;
        const product = link.product;
        const vendor = product.vendor;

        // Подготовка данных для чека
        const now = new Date();
        const formattedDate = now.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        const formattedTime = now.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        const timestamp = now.toISOString().replace(/[:.]/g, '-');
        const receiptFileName = `receipt-qr-${attemptId}-${timestamp}.pdf`;
        const receiptPath = path.join('receipts', receiptFileName);
        const absolutePath = path.join(process.cwd(), receiptPath);

        // Проверяем существование директории receipts
        const receiptDir = path.join(process.cwd(), 'receipts');
        if (!fs.existsSync(receiptDir)) {
            fs.mkdirSync(receiptDir, { recursive: true });
        }

        // Транзакция - как в saleController
        // Цена этой продажи — фактически списанная сумма. В потоках Click/Payme/Alif
        // она равна product.price, у партнёрских каналов может быть своя цена
        // позиции. Считаем от неё, иначе чек и выплаты расходятся с деньгами.
        const salePrice = Number(attempt?.amount ?? product.price);

        const result = await prisma.$transaction(async (tx) => {
            // 1. Найти активный ваучер
            const voucher = await tx.voucher.findFirst({
                where: { productId: product.id, status: 'active' },
                orderBy: { id: 'asc' }
            });

            if (!voucher) {
                throw new Error('NO_VOUCHERS');
            }

            // 2. Voucher → sold. Атомарный claim: перевод происходит только если
            // ваучер всё ещё 'active'. Между findFirst выше и этим моментом его мог
            // забрать параллельный запрос — тогда count будет 0 и всю транзакцию
            // надо откатить, иначе один ваучер продаётся дважды.
            // Тот же приём уже используется в controllers/merchant/saleController.js.
            const claim = await tx.voucher.updateMany({
                where: { id: voucher.id, status: 'active' },
                data: { status: 'sold' }
            });

            if (claim.count !== 1) {
                throw new Error('VOUCHER_ALREADY_TAKEN');
            }

            // 3. Создать Sale С ПУТЕМ К ЧЕКУ
            const sale = await tx.sale.create({
                data: {
                    voucherValue: voucher.value,
                    price: salePrice,
                    productId: product.id,
                    productName: product.name,
                    merchantUsername: merchant.username,
                    saleType: 'ONLINE',
                    customerPhone: attempt.phoneNumber,
                    receiptPath: receiptPath // Сохраняем путь к чеку в Sale
                }
            });

            // 4. Найти/создать Client
            let client = await tx.client.findUnique({
                where: { phoneNumber: attempt.phoneNumber }
            });
            if (!client) {
                client = await tx.client.create({
                    data: { phoneNumber: attempt.phoneNumber }
                });
            }

            // 5. OnlineVoucher
            await tx.onlineVoucher.create({
                data: { clientId: client.id, voucherId: voucher.id }
            });

            // 6. VoucherWalletLog
            await tx.voucherWalletLog.create({
                data: {
                    clientId: client.id,
                    voucherId: voucher.id,
                    isAddedToWallet: true
                }
            });

            // 7. Комиссии
            // Вендору выплачивается остаток цены за вычетом ОБЕИХ комиссий (платформы и мерчанта),
            // чтобы доля мерчанта не выплачивалась дважды (мерчант получает её отдельно через merchantPayable).
            const vendorDebt = salePrice
                * (1 - product.vendorCommissionPercent / 100 - product.merchantCommissionPercent / 100);
            const merchantPayable = salePrice * (1 - product.merchantCommissionPercent / 100);
            const kassaDebt = salePrice * (product.vendorCommissionPercent / 100);
            // Касса берётся из того, что передал вызывающий, либо из самой попытки.
            // Неявного отката на кассу вендора здесь НЕТ: в партнёрских каналах
            // клиент платит наличными в терминале, а партнёр рассчитывается
            // банковским переводом позже — ни одна наша касса в этом не участвует,
            // и записывать туда «получено» нельзя. Для Click/Payme/Alif поведение
            // не меняется: они передают кассу явно, а QR-поток кладёт её id в попытку.
            const kassaId = kassa?.id ?? attempt?.kassaId ?? null;

            // 8. VoucherTransaction
            await tx.voucherTransaction.create({
                data: {
                    voucherValue: voucher.value,
                    merchantId: merchant.id,
                    vendorId: product.vendorId,
                    productId: product.id,
                    productName: product.name,
                    price: salePrice,
                    merchantDebt: merchantPayable,
                    kassaDebt,
                    kassaId,
                    vendorDebt
                }
            });

            // 9. Обновить балансы
            await tx.vendor.update({
                where: { id: product.vendorId },
                data: { balance: { increment: vendorDebt } }
            });

            await tx.merchant.update({
                where: { id: merchant.id },
                data: { balance: { increment: merchantPayable } }
            });

            // 9a. Обновить баланс кассы (если есть)
            if (kassaId) {
                const paymentMethod = attempt?.paymentMethod;
                await tx.kassa.update({
                    where: { id: kassaId },
                    data: {
                        totalReceived: { increment: salePrice },
                        ...(paymentMethod === 'click' ? { totalReceivedClick: { increment: salePrice } } : {}),
                        ...(paymentMethod === 'payme' ? { totalReceivedPayme: { increment: salePrice } } : {}),
                        ...(paymentMethod === 'alif' ? { totalReceivedAlif: { increment: salePrice } } : {}),
                        ...(paymentMethod === 'paynet' ? { totalReceivedPaynet: { increment: salePrice } } : {}),
                        balance: { increment: kassaDebt },
                    }
                });
            }

            // 10. Обновить QrPaymentAttempt (включая receiptPath)
            await tx.qrPaymentAttempt.update({
                where: { id: attemptId },
                data: {
                    status: 'PAID',
                    paidAt: now,
                    saleId: sale.id,
                    voucherValue: voucher.value,
                    receiptPath: receiptFileName
                }
            });

            return { sale, voucher, client };
        });

        // ПОСЛЕ УСПЕШНОЙ ТРАНЗАКЦИИ:

        // 1. ГЕНЕРАЦИЯ ЧЕКА (как при offline продаже мерчантом)
        const baseUrl = process.env.BASE_URL || process.env.PUBLIC_BASE_URL || 'https://wallet.namo.uz';
        const schemaForVendor = resolveReceiptTemplate(product, vendor);

        const segments = [{
            schema: schemaForVendor,
            context: {
                vendorName: vendor.name,
                merchantName: merchant.username,
                clientName: attempt.phoneNumber,
                clientPhone: attempt.phoneNumber,
                date: formattedDate,
                time: formattedTime,
                saleDate: formattedDate,
                saleTime: formattedTime,
                saleId: String(result.sale.id),
                items: [{
                    name: product.name,
                    qty: 1,
                    price: salePrice,
                }],
                total: salePrice,
                totalFormatted: formatCurrencyUz(salePrice),
                voucherFull: result.voucher.value,
                voucherMasked: result.voucher.value,
                qrUrl: buildReceiptQrUrl(result.voucher.value, baseUrl),
                qrOrigin: baseUrl,
                variables: {
                    customerPhone: attempt.phoneNumber,
                    merchantLegal: merchant?.legalInfo || '',
                },
            },
        }];

        // Получаем legalInfo мерчанта
        const merchantWithLegal = await prisma.merchant.findUnique({
            where: { id: merchant.id },
            select: { legalInfo: true }
        });

        // Транзакция выше уже зафиксирована: ваучер продан, Sale создан, балансы
        // начислены. Если генерация чека упадёт, нельзя сообщать об ошибке платежа —
        // иначе платёжная система сочтёт продажу неудачной, а ваучер уже израсходован.
        try {
            await generatePDFReceipt({
                absolutePath,
                merchant: merchantWithLegal,
                segments,
                fallbackSchema: schemaForVendor,
            });
        } catch (receiptError) {
            console.error('Receipt generation failed (non-critical):', receiptError);
        }

        // 2. ОТПРАВКА SMS (как при online продаже мерчантом)
        try {
            await sendVoucherSMS(result.client, [{
                voucher: result.voucher,
                product: product,
                saleId: result.sale.id
            }]);
        } catch (smsError) {
            console.error('SMS sending failed (non-critical):', smsError);
            // SMS ошибка не должна прерывать успешную транзакцию
        }

        return { success: true, ...result };
    } catch (error) {
        console.error('Payment processing error:', error);

        if (error.message === 'VOUCHER_ALREADY_TAKEN') {
            // Ваучер забрал параллельный запрос. Ничего не записано, можно повторить.
            return { success: false, error: 'Повторите попытку', retryable: true };
        }

        if (error.message === 'NO_VOUCHERS') {
            await prisma.qrPaymentAttempt.update({
                where: { id: attemptId },
                data: { status: 'FAILED' }
            });
            return { success: false, error: 'Товар закончился' };
        }

        return { success: false, error: 'Ошибка обработки платежа' };
    }
}

// Страница результата
export const showResultPage = async (req, res) => {
    try {
        const { token, attemptId } = req.params;

        const attempt = await prisma.qrPaymentAttempt.findUnique({
            where: { id: parseInt(attemptId) },
            include: {
                link: {
                    include: {
                        merchant: true,
                        product: { include: { vendor: true } }
                    }
                },
                sale: true
            }
        });

        if (!attempt) {
            return res.render('pages/pay-error', {
                error: 'not_found',
                message: 'Запись не найдена'
            });
        }

        if (attempt.status !== 'PAID') {
            const errorMessages = {
                PENDING: 'Ожидание оплаты',
                PROCESSING: 'Обработка платежа',
                EXPIRED: 'Время оплаты истекло',
                FAILED: 'Оплата не прошла'
            };

            return res.render('pages/pay-error', {
                error: attempt.status.toLowerCase(),
                message: errorMessages[attempt.status] || 'Ошибка',
                token
            });
        }

        res.render('pages/pay-result', {
            attempt,
            merchant: attempt.link.merchant,
            product: attempt.link.product,
            sale: attempt.sale,
            voucherCode: attempt.voucherValue,
            token
        });
    } catch (error) {
        console.error('Error loading result:', error);
        res.render('pages/pay-error', {
            error: 'server_error',
            message: 'Ошибка сервера'
        });
    }
}

// Скачать PDF чек (файл уже создается при оплате в processPayment)
export const downloadReceipt = async (req, res) => {
    try {
        const { token, attemptId } = req.params;

        const attempt = await prisma.qrPaymentAttempt.findUnique({
            where: { id: parseInt(attemptId) },
            include: {
                sale: true
            }
        });

        if (!attempt || attempt.status !== 'PAID') {
            return res.status(404).send('Чек недоступен');
        }

        // Используем путь из Sale или QrPaymentAttempt
        const receiptPath = attempt.sale?.receiptPath || attempt.receiptPath;

        if (!receiptPath) {
            return res.status(404).send('Чек не найден');
        }

        const absolutePath = path.join(process.cwd(), receiptPath);

        if (!fs.existsSync(absolutePath)) {
            return res.status(404).send('Файл чека не найден');
        }

        // Отправляем файл
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=receipt-${attempt.id}.pdf`);

        const fileStream = fs.createReadStream(absolutePath);
        fileStream.pipe(res);

    } catch (error) {
        console.error('Error downloading receipt:', error);
        res.status(500).send('Ошибка загрузки чека');
    }
};
