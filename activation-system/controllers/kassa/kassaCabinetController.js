import prisma from '../../prisma/client.js';

// Дашборд кассы — KPI + последние транзакции + привязанные вендоры
export const showDashboard = async (req, res) => {
    try {
        const kassaId = req.session.user.kassaId;
        const kassa = await prisma.kassa.findUnique({
            where: { id: kassaId },
            include: { vendors: true },
        });

        if (!kassa) return res.status(404).send('Касса не найдена');

        // Последние 10 транзакций
        const recentTransactions = await prisma.voucherTransaction.findMany({
            where: { kassaId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { vendor: true, merchant: true },
        });

        // KPI — продажи за 7 дней
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const weekSales = await prisma.voucherTransaction.aggregate({
            where: { kassaId, createdAt: { gte: weekAgo } },
            _sum: { price: true, kassaDebt: true },
            _count: { id: true },
        });

        res.render('pages/kassa/dashboard', {
            layout: false,
            user: req.session.user,
            kassa,
            recentTransactions,
            weekSales: {
                count: weekSales._count?.id || 0,
                total: Number(weekSales._sum?.price || 0),
                commission: Number(weekSales._sum?.kassaDebt || 0),
            },
        });
    } catch (err) {
        console.error('[Kassa] Dashboard error:', err);
        res.status(500).send('Ошибка загрузки дашборда');
    }
};

// Транзакции — полный список с фильтрацией
export const showTransactions = async (req, res) => {
    try {
        const kassaId = req.session.user.kassaId;
        const { page = 1, vendor, status } = req.query;
        const limit = 50;
        const skip = (parseInt(page) - 1) * limit;

        const where = { kassaId };
        if (vendor) where.vendorId = parseInt(vendor);
        if (status) where.status = status;

        const [transactions, total, vendors] = await Promise.all([
            prisma.voucherTransaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: { vendor: true, merchant: true },
            }),
            prisma.voucherTransaction.count({ where }),
            prisma.vendor.findMany({ where: { kassaId }, select: { id: true, name: true } }),
        ]);

        res.render('pages/kassa/transactions', {
            layout: false,
            user: req.session.user,
            transactions,
            vendors,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit),
            filters: { vendor, status },
        });
    } catch (err) {
        console.error('[Kassa] Transactions error:', err);
        res.status(500).send('Ошибка загрузки транзакций');
    }
};

// Обязательства — долги вендоров, комиссии платформы, корректировки
export const showObligations = async (req, res) => {
    try {
        const kassaId = req.session.user.kassaId;

        // Агрегация по вендорам
        const vendorStats = await prisma.voucherTransaction.groupBy({
            by: ['vendorId'],
            where: { kassaId },
            _sum: { kassaDebt: true, vendorDebt: true, price: true },
            _count: { id: true },
        });

        // Получаем имена вендоров
        const vendorIds = vendorStats.map((v) => v.vendorId);
        const vendors = await prisma.vendor.findMany({
            where: { id: { in: vendorIds } },
            select: { id: true, name: true, balance: true },
        });
        const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v]));

        // Корректировки
        const adjustments = await prisma.kassaAdjustment.findMany({
            where: { kassaId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });

        res.render('pages/kassa/obligations', {
            layout: false,
            user: req.session.user,
            vendorStats: vendorStats.map((vs) => ({
                ...vs,
                vendorName: vendorMap[vs.vendorId]?.name || `Vendor #${vs.vendorId}`,
                vendorBalance: vendorMap[vs.vendorId]?.balance || 0,
            })),
            adjustments,
        });
    } catch (err) {
        console.error('[Kassa] Obligations error:', err);
        res.status(500).send('Ошибка загрузки обязательств');
    }
};

// Выплаты — история + форма для kassa_admin
export const showPayouts = async (req, res) => {
    try {
        const kassaId = req.session.user.kassaId;

        const payments = await prisma.kassaPayment.findMany({
            where: { kassaId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        const kassa = await prisma.kassa.findUnique({
            where: { id: kassaId },
            select: { balance: true, totalPaid: true },
        });

        res.render('pages/kassa/payouts', {
            layout: false,
            user: req.session.user,
            payments,
            kassaBalance: kassa?.balance || 0,
            totalPaid: kassa?.totalPaid || 0,
        });
    } catch (err) {
        console.error('[Kassa] Payouts error:', err);
        res.status(500).send('Ошибка загрузки выплат');
    }
};

// Создание выплаты (POST, только kassa_admin)
export const createPayout = async (req, res) => {
    try {
        const kassaId = req.session.user.kassaId;
        const { amount, recipientType, recipientId, comment } = req.body;
        const parsedAmount = parseFloat(amount);

        if (!parsedAmount || parsedAmount <= 0) {
            return res.status(400).send('Некорректная сумма');
        }

        const kassa = await prisma.kassa.findUnique({ where: { id: kassaId } });
        if (!kassa) return res.status(404).send('Касса не найдена');

        await prisma.$transaction(async (tx) => {
            await tx.kassaPayment.create({
                data: {
                    kassaId,
                    amount: parsedAmount,
                    recipientType: recipientType || 'platform',
                    recipientId: recipientId ? parseInt(recipientId) : null,
                    comment: comment || null,
                    balanceBefore: kassa.balance,
                    balanceAfter: kassa.balance - parsedAmount,
                },
            });

            await tx.kassa.update({
                where: { id: kassaId },
                data: {
                    balance: { decrement: parsedAmount },
                    totalPaid: { increment: parsedAmount },
                },
            });
        });

        res.redirect('/kassa/payouts');
    } catch (err) {
        console.error('[Kassa] Create payout error:', err);
        res.status(500).send('Ошибка создания выплаты');
    }
};

// Настройки кассы — реквизиты, callback URL, привязанные вендоры
export const showSettings = async (req, res) => {
    try {
        const kassaId = req.session.user.kassaId;
        const kassa = await prisma.kassa.findUnique({
            where: { id: kassaId },
            include: { vendors: true },
        });

        if (!kassa) return res.status(404).send('Касса не найдена');

        const baseUrl = process.env.PAYMENT_BASE_URL || 'https://wallet.namo.uz';
        const callbackUrls = {
            clickPrepare: `${baseUrl}/api/payments/click/${kassaId}/prepare`,
            clickComplete: `${baseUrl}/api/payments/click/${kassaId}/complete`,
            payme: `${baseUrl}/api/payments/payme/${kassaId}`,
        };

        res.render('pages/kassa/settings', {
            layout: false,
            user: req.session.user,
            kassa,
            callbackUrls,
        });
    } catch (err) {
        console.error('[Kassa] Settings error:', err);
        res.status(500).send('Ошибка загрузки настроек');
    }
};
