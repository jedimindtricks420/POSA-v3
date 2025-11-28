import { PrismaClient } from '@prisma/client';
import { sendOtpSms } from '../utils/smsService.js';
import rokkyService from '../services/rokkyService.js';

const prisma = new PrismaClient();

// Helper to generate 6-digit OTP
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

export const getStorePage = async (req, res) => {
    const { storeSlug } = req.params;

    try {
        const store = await prisma.store.findUnique({
            where: { slug: storeSlug },
            include: { products: true }
        });

        if (!store || !store.isActive) {
            return res.status(404).render('store/login', {
                store: null,
                error: 'Магазин не найден',
                layout: 'store/layout'
            });
        }

        // Check if client is authenticated for this session
        if (req.session.clientId) {
            const client = await prisma.client.findUnique({ where: { id: req.session.clientId } });

            // Fetch history for this store
            const history = await prisma.voucherActivation.findMany({
                where: {
                    clientId: client.id,
                    voucher: {
                        product: {
                            storeId: store.id
                        }
                    }
                },
                include: {
                    voucher: {
                        include: {
                            product: true,
                            rokkyOrder: true,
                            manualActivationRequest: true
                        }
                    }
                },
                orderBy: { activatedAt: 'desc' }
            });

            return res.render('store/activate', {
                store,
                client,
                history,
                layout: 'store/layout'
            });
        }

        // Not authenticated -> Login page
        return res.render('store/login', {
            store,
            layout: 'store/layout'
        });

    } catch (error) {
        console.error('getStorePage error:', error);
        res.status(500).render('store/login', {
            store: null,
            error: 'Произошла ошибка',
            layout: 'store/layout'
        });
    }
};

export const sendOtp = async (req, res) => {
    const { phone, storeSlug } = req.body;

    try {
        // Basic validation
        if (!phone) return res.status(400).json({ error: 'Phone is required' });

        const otp = generateOtp();

        // Save to AuthSmsLog
        const log = await prisma.authSmsLog.create({
            data: {
                phoneNumber: phone,
                code: otp,
                requestId: 'pending', // Will update after send
                status: 'waiting'
            }
        });

        // Send SMS
        const result = await sendOtpSms(phone, otp);

        // Update log
        await prisma.authSmsLog.update({
            where: { id: log.id },
            data: {
                requestId: result.smsId ? String(result.smsId) : 'error',
                status: result.success ? 'delivered' : 'failed',
                response: result.data || {}
            }
        });

        if (!result.success) {
            return res.status(500).json({ error: 'Failed to send SMS' });
        }

        res.json({ success: true, message: 'OTP sent' });

    } catch (error) {
        console.error('sendOtp error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const verifyOtp = async (req, res) => {
    const { phone, code, storeSlug } = req.body;

    try {
        // Find valid OTP
        const log = await prisma.authSmsLog.findFirst({
            where: {
                phoneNumber: phone,
                code: code,
                verified: false,
                createdAt: {
                    gte: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes TTL
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!log) {
            return res.status(400).json({ error: 'Invalid or expired code' });
        }

        // Mark as verified
        await prisma.authSmsLog.update({
            where: { id: log.id },
            data: { verified: true, verifiedAt: new Date() }
        });

        // Find or create client
        let client = await prisma.client.findUnique({ where: { phoneNumber: phone } });
        if (!client) {
            client = await prisma.client.create({ data: { phoneNumber: phone } });
        }

        // Set session
        req.session.clientId = client.id;
        req.session.save();

        res.json({ success: true, redirectUrl: `/${storeSlug}` });

    } catch (error) {
        console.error('verifyOtp error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const activateVoucher = async (req, res) => {
    const { voucherCode, storeSlug } = req.body;
    const clientId = req.session.clientId;

    if (!clientId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
        if (!store) return res.status(404).json({ error: 'Store not found' });

        // Rate limiting check (10 failures per day)
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const failedAttempts = await prisma.auditLog.count({
            where: {
                actorUserId: clientId,
                role: 'client',
                action: 'activation_failed',
                createdAt: { gte: startOfDay },
                details: {
                    path: ['storeSlug'],
                    equals: storeSlug
                }
            }
        });

        if (failedAttempts >= 10) {
            return res.status(429).json({ error: 'Произошла ошибка. Пожалуйста обратитесь в службу поддержки.' });
        }

        // Find voucher
        const voucher = await prisma.voucher.findUnique({
            where: { value: voucherCode },
            include: {
                product: {
                    include: {
                        vendor: true,
                        store: true
                    }
                }
            }
        });

        // Validation logic
        let error = null;
        if (!voucher) {
            error = 'Invalid code';
            console.log(`Activation failed: Voucher not found for code ${voucherCode}`);
        }
        else if (voucher.product.storeId !== store.id) {
            error = 'Invalid code for this store';
            console.log(`Activation failed: Store mismatch. Voucher StoreId: ${voucher.product.storeId}, Current StoreId: ${store.id}`);
        }
        // SECURITY: Only allow activation for SOLD or PENDING vouchers
        else if (voucher.status === 'active') {
            error = 'Code not sold yet';
            console.log(`Activation failed: Voucher not sold yet (status: ${voucher.status})`);
        }
        else if (voucher.status === 'activated') {
            error = 'Code already used';
            console.log(`Activation failed: Voucher already activated`);
        }
        else if (!['sold', 'pending'].includes(voucher.status)) {
            error = 'Code already used or invalid';
            console.log(`Activation failed: Invalid status ${voucher.status}`);
        }
        else if (voucher.status === 'pending') {
            // Check if it's a stuck pending (failed attempt)
            // For Rokky vendors, check RokkyOrder
            if (voucher.product.vendor.productType === 'ROKKY') {
                const existingOrder = await prisma.rokkyOrder.findUnique({ where: { voucherId: voucher.id } });
                if (existingOrder && existingOrder.status === 'COMPLETED') {
                    error = 'Code already activated';
                    console.log(`Activation failed: Voucher pending but already has COMPLETED Rokky order`);
                }
            }
            // For Manual vendors, check ManualActivationRequest
            else if (voucher.product.vendor.productType === 'MANUAL') {
                const existingRequest = await prisma.manualActivationRequest.findUnique({ where: { voucherId: voucher.id } });
                if (existingRequest && existingRequest.status === 'COMPLETED') {
                    error = 'Code already activated';
                    console.log(`Activation failed: Voucher pending but already has COMPLETED manual request`);
                }
                // If request exists and is PENDING, allow retry (user might have refreshed page)
            }
            // If no order or failed/pending order, we allow retry (logic continues)
        }
        else if (voucher.type !== 'Vendor') {
            error = 'Invalid voucher type';
            console.log(`Activation failed: Invalid type ${voucher.type}`);
        }

        if (error) {
            // Log failure
            await prisma.auditLog.create({
                data: {
                    actorUserId: clientId,
                    role: 'client',
                    action: 'activation_failed',
                    entityType: 'Voucher',
                    details: { reason: error, code: voucherCode, storeSlug },
                    ip: req.ip
                }
            });
            return res.status(400).json({ error: 'Произошла ошибка. Пожалуйста обратитесь в службу поддержки.' });
        }

        // Check if already bound to another client
        const existingBinding = await prisma.onlineVoucher.findUnique({ where: { voucherId: voucher.id } });
        if (existingBinding && existingBinding.clientId !== clientId) {
            return res.status(400).json({ error: 'Произошла ошибка. Пожалуйста обратитесь в службу поддержки.' });
        }

        // Bind to client
        if (!existingBinding) {
            await prisma.onlineVoucher.create({
                data: {
                    clientId,
                    voucherId: voucher.id
                }
            });
        }

        // Update status to pending
        await prisma.voucher.update({
            where: { id: voucher.id },
            data: { status: 'pending' }
        });

        // CHECK: Manual vendor activation
        if (voucher.product.vendor.productType === 'MANUAL') {
            try {
                // Импортируем telegramService динамически
                const telegramService = (await import('../services/telegramService.js')).default;

                // Проверяем, существует ли уже запрос
                let manualRequest = await prisma.manualActivationRequest.findUnique({
                    where: { voucherId: voucher.id }
                });

                // Создаем запрос только если его еще нет
                if (!manualRequest) {
                    manualRequest = await prisma.manualActivationRequest.create({
                        data: {
                            voucherId: voucher.id,
                            status: 'PENDING'
                        }
                    });

                    // Получаем клиента
                    const client = await prisma.client.findUnique({ where: { id: clientId } });

                    // Отправляем уведомление в Telegram только для нового запроса
                    const notification = telegramService.formatActivationNotification(
                        voucher,
                        client,
                        store,
                        voucher.product,
                        manualRequest.id
                    );

                    await telegramService.sendNotificationToStore(store.id, notification);

                    console.log(`[Manual Activation] Request created: ${manualRequest.id} for voucher ${voucher.value}`);
                } else {
                    console.log(`[Manual Activation] Request already exists: ${manualRequest.id} for voucher ${voucher.value}`);
                }

                return res.json({
                    success: true,
                    message: 'Ваша заявка принята. Ожидайте SMS с ключом активации в течение нескольких минут.',
                    pending: true
                });
            } catch (manualError) {
                console.error('[Manual Activation] Error:', manualError);
                // Если не удалось создать запрос, откатываем статус
                await prisma.voucher.update({
                    where: { id: voucher.id },
                    data: { status: 'sold' }
                });
                return res.status(500).json({ error: 'Произошла ошибка. Пожалуйста обратитесь в службу поддержки.' });
            }
        }

        // Call Rokky API (only for Rokky vendors)
        if (voucher.product.vendor.productType === 'ROKKY') {
            let rokkyOrder;
            try {
                const sku = voucher.product.rokkySku;
                if (!sku) throw new Error('Product missing Rokky SKU');

                const orderResult = await rokkyService.createOrder(sku, String(voucher.id), voucher.product.price);

                rokkyOrder = await prisma.rokkyOrder.upsert({
                    where: { voucherId: voucher.id },
                    update: {
                        rokkyOrderId: orderResult.rokkyOrderId,
                        sku: sku,
                        status: orderResult.status,
                        key: orderResult.key,
                        errorMessage: null
                    },
                    create: {
                        voucherId: voucher.id,
                        rokkyOrderId: orderResult.rokkyOrderId,
                        sku: sku,
                        status: orderResult.status,
                        key: orderResult.key
                    }
                });

            } catch (apiError) {
                console.error('Rokky API Error:', apiError);
                await prisma.rokkyOrder.upsert({
                    where: { voucherId: voucher.id },
                    update: {
                        rokkyOrderId: 'error',
                        status: 'FAILED',
                        errorMessage: apiError.message
                    },
                    create: {
                        voucherId: voucher.id,
                        rokkyOrderId: 'error',
                        sku: voucher.product.rokkySku || 'unknown',
                        status: 'FAILED',
                        errorMessage: apiError.message
                    }
                });
                return res.status(500).json({ error: 'Произошла ошибка. Пожалуйста обратитесь в службу поддержки.' });
            }

            // If we got the key immediately
            if (rokkyOrder.status === 'COMPLETED' && rokkyOrder.key) {
                // Create Activation
                await prisma.voucherActivation.create({
                    data: {
                        voucherId: voucher.id,
                        vendorId: voucher.product.vendorId,
                        clientId: clientId,
                        activatedBy: null // System
                    }
                });

                await prisma.voucher.update({
                    where: { id: voucher.id },
                    data: { status: 'activated' }
                });

                return res.json({ success: true, key: rokkyOrder.key });
            }

            // If pending (async)
            return res.json({ success: true, message: 'Activation in progress. Please check back later.' });
        } // End of Rokky vendor block
        else if (voucher.product.vendor.productType === 'VOUCHER') {
            // For VOUCHER type vendors - these are activated outside our system
            // (e.g., in vendor's own system like Spotify balance top-up)
            // We just mark as activated for record-keeping
            console.log(`[Activation] VOUCHER type vendor: ${voucher.product.vendor.name}`);

            // Simply mark as activated
            await prisma.voucher.update({
                where: { id: voucher.id },
                data: { status: 'activated' }
            });

            // Create activation record
            await prisma.voucherActivation.create({
                data: {
                    voucherId: voucher.id,
                    vendorId: voucher.product.vendorId,
                    clientId: clientId,
                    activatedBy: null // System
                }
            });

            return res.json({
                success: true,
                message: 'Voucher activated successfully',
                voucher: true
            });
        }
        else {
            // Unknown vendor type - should not happen with enum
            console.error(`[Activation] Unknown vendor type: ${voucher.product.vendor.productType}`);
            return res.status(500).json({ error: 'Произошла ошибка. Пожалуйста обратитесь в службу поддержки.' });
        }

    } catch (error) {
        console.error('activateVoucher error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const logout = (req, res) => {
    const { storeSlug } = req.params;
    req.session.clientId = null;
    res.redirect(`/${storeSlug}`);
};
