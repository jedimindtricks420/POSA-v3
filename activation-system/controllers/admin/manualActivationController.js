import prisma from '../../prisma/client.js';
import { sendSMS } from '../../utils/smsService.js';

// Показать список запросов на активацию
export const listRequests = async (req, res) => {
    try {
        const { status, storeId } = req.query;
        const user = req.session.user;

        // Фильтры
        const where = {};
        if (status) {
            where.status = status;
        }

        // Если пользователь - vendor_user, показываем только его вендора
        if (user.role === 'vendor_user' && user.vendorId) {
            where.voucher = {
                product: {
                    vendorId: user.vendorId
                }
            };
        }

        // Фильтр по магазину
        if (storeId) {
            where.voucher = {
                ...where.voucher,
                product: {
                    ...where.voucher?.product,
                    storeId: parseInt(storeId)
                }
            };
        }

        const requests = await prisma.manualActivationRequest.findMany({
            where,
            include: {
                voucher: {
                    include: {
                        product: {
                            include: {
                                vendor: true,
                                store: true
                            }
                        },
                        onlineVouchers: {
                            include: {
                                client: true
                            },
                            take: 1,
                            orderBy: { assignedAt: 'desc' }
                        }
                    }
                },
                operator: {
                    select: {
                        username: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        // Получаем список магазинов для фильтра
        const stores = await prisma.store.findMany({
            orderBy: { name: 'asc' }
        });

        res.render('pages/admin-manual-activations', {
            requests,
            stores,
            filters: { status, storeId },
            user: req.session.user
        });
    } catch (error) {
        console.error('Error listing manual activation requests:', error);
        res.status(500).send('Ошибка при загрузке запросов');
    }
};

// Показать детали запроса
export const showRequestDetails = async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);

        const request = await prisma.manualActivationRequest.findUnique({
            where: { id: requestId },
            include: {
                voucher: {
                    include: {
                        product: {
                            include: {
                                vendor: true,
                                store: true
                            }
                        },
                        onlineVouchers: {
                            include: {
                                client: true
                            }
                        }
                    }
                },
                operator: true
            }
        });

        if (!request) {
            return res.status(404).send('Запрос не найден');
        }

        res.render('pages/admin-manual-activation-details', {
            request,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error loading request details:', error);
        res.status(500).send('Ошибка при загрузке деталей');
    }
};

// Завершить запрос (ввести ключ)
export const completeRequest = async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        const { key } = req.body;
        const userId = req.session.user.id;

        if (!key || !key.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Ключ активации не может быть пустым'
            });
        }

        // Получаем запрос
        const request = await prisma.manualActivationRequest.findUnique({
            where: { id: requestId },
            include: {
                voucher: {
                    include: {
                        product: {
                            include: {
                                vendor: true,
                                store: true
                            }
                        },
                        onlineVouchers: {
                            include: {
                                client: true
                            },
                            take: 1,
                            orderBy: { assignedAt: 'desc' }
                        }
                    }
                }
            }
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Запрос не найден'
            });
        }

        if (request.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                error: 'Запрос уже обработан'
            });
        }

        const voucher = request.voucher;
        const client = voucher.onlineVouchers[0]?.client;

        // Выполняем все операции в транзакции
        await prisma.$transaction(async (tx) => {
            // 1. Обновляем запрос
            await tx.manualActivationRequest.update({
                where: { id: requestId },
                data: {
                    status: 'COMPLETED',
                    key: key.trim(),
                    operatorId: userId
                }
            });

            // 2. Обновляем статус ваучера
            await tx.voucher.update({
                where: { id: voucher.id },
                data: { status: 'activated' }
            });

            // 3. Создаем запись активации
            await tx.voucherActivation.create({
                data: {
                    voucherId: voucher.id,
                    vendorId: voucher.product.vendorId,
                    activatedBy: userId,
                    clientId: client?.id || null
                }
            });

            // 4. Обновляем транзакцию (если есть)
            const transaction = await tx.voucherTransaction.findFirst({
                where: { voucherValue: voucher.value },
                orderBy: { createdAt: 'desc' }
            });

            if (transaction && transaction.status !== 'COMPLETED') {
                await tx.voucherTransaction.update({
                    where: { id: transaction.id },
                    data: { status: 'COMPLETED' }
                });
            }

            // 5. Удаляем привязку к клиенту
            if (client) {
                await tx.onlineVoucher.deleteMany({
                    where: { voucherId: voucher.id }
                });

                // Создаем запись в wallet log
                await tx.voucherWalletLog.create({
                    data: {
                        voucherId: voucher.id,
                        clientId: client.id,
                        isAddedToWallet: false,
                        pkpassId: 'manual.activation.completed'
                    }
                });
            }
        });

        // 6. Отправляем SMS клиенту
        if (client) {
            const store = voucher.product.store;
            const smsTemplate = store?.activationSmsTemplate ||
                'Vash vaucher aktivirovan | Sizning vaucheringiz faollashtirildi https://namo.uz/link';

            const smsResult = await sendSMS(client.phoneNumber, smsTemplate);

            if (smsResult.success) {
                // Логируем отправку SMS
                await prisma.voucherSmsLog.create({
                    data: {
                        voucherId: voucher.id,
                        phoneNumber: client.phoneNumber,
                        message: smsTemplate,
                        requestId: smsResult.smsId ? String(smsResult.smsId) : 'manual-activation',
                        status: 'delivered',
                        response: smsResult.data || {}
                    }
                });
            }
        }

        res.json({
            success: true,
            message: 'Активация успешно завершена',
            key: key.trim()
        });

    } catch (error) {
        console.error('Error completing request:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при завершении активации'
        });
    }
};

// Отклонить запрос
export const rejectRequest = async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        const { reason } = req.body;
        const userId = req.session.user.id;

        const request = await prisma.manualActivationRequest.findUnique({
            where: { id: requestId },
            include: {
                voucher: true
            }
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Запрос не найден'
            });
        }

        if (request.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                error: 'Запрос уже обработан'
            });
        }

        await prisma.$transaction(async (tx) => {
            // Обновляем запрос
            await tx.manualActivationRequest.update({
                where: { id: requestId },
                data: {
                    status: 'REJECTED',
                    operatorId: userId,
                    key: reason || 'Отклонено оператором'
                }
            });

            // Возвращаем ваучер в статус sold
            await tx.voucher.update({
                where: { id: request.voucherId },
                data: { status: 'sold' }
            });

            // Удаляем привязку к клиенту
            await tx.onlineVoucher.deleteMany({
                where: { voucherId: request.voucherId }
            });
        });

        res.json({
            success: true,
            message: 'Запрос отклонен'
        });

    } catch (error) {
        console.error('Error rejecting request:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при отклонении запроса'
        });
    }
};
