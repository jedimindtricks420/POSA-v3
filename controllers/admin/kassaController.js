import prisma from '../../prisma/client.js';

// Список касс
export const showKassaList = async (req, res) => {
    const kassas = await prisma.kassa.findMany({
        include: {
            vendors: { select: { id: true, name: true } },
            _count: { select: { transactions: true, users: true } },
        },
        orderBy: { id: 'asc' },
    });

    res.render('pages/admin-kassa-list', { kassas, user: req.session.user });
};

// Форма создания кассы
export const showCreateKassaForm = async (req, res) => {
    const vendors = await prisma.vendor.findMany({
        where: { kassaId: null },
        select: { id: true, name: true },
    });
    res.render('pages/admin-kassa-add', { vendors, error: null, user: req.session.user });
};

// Создание кассы
export const handleCreateKassa = async (req, res) => {
    try {
        const {
            name, legalName, inn,
            clickMerchantId, clickServiceId, clickSecretKey, clickMerchantUserId, clickEnv,
            paymeMerchantId, paymeKey, paymeTestKey, paymeEnv,
            contactPerson, contactPhone, contactEmail,
            vendorIds,
        } = req.body;

        if (!name) {
            const vendors = await prisma.vendor.findMany({ where: { kassaId: null } });
            return res.render('pages/admin-kassa-add', {
                vendors, error: 'Укажите название кассы', user: req.session.user,
            });
        }

        const kassa = await prisma.kassa.create({
            data: {
                name,
                legalName: legalName || null,
                inn: inn || null,
                clickMerchantId: clickMerchantId || null,
                clickServiceId: clickServiceId || null,
                clickSecretKey: clickSecretKey || null,
                clickMerchantUserId: clickMerchantUserId || null,
                clickEnv: clickEnv || 'production',
                paymeMerchantId: paymeMerchantId || null,
                paymeKey: paymeKey || null,
                paymeTestKey: paymeTestKey || null,
                paymeEnv: paymeEnv || 'test',
                contactPerson: contactPerson || null,
                contactPhone: contactPhone || null,
                contactEmail: contactEmail || null,
            },
        });

        // Привязка вендоров
        if (vendorIds) {
            const ids = Array.isArray(vendorIds) ? vendorIds : [vendorIds];
            await prisma.vendor.updateMany({
                where: { id: { in: ids.map((id) => parseInt(id)) } },
                data: { kassaId: kassa.id },
            });
        }

        res.redirect('/admin/kassas');
    } catch (err) {
        console.error('[Kassa] Create error:', err);
        const vendors = await prisma.vendor.findMany({ where: { kassaId: null } });
        res.render('pages/admin-kassa-add', {
            vendors, error: 'Ошибка при создании кассы', user: req.session.user,
        });
    }
};

// Форма редактирования кассы
export const showEditKassaForm = async (req, res) => {
    const kassa = await prisma.kassa.findUnique({
        where: { id: parseInt(req.params.id) },
        include: { vendors: { select: { id: true, name: true } } },
    });
    if (!kassa) return res.status(404).send('Касса не найдена');

    const availableVendors = await prisma.vendor.findMany({
        where: { OR: [{ kassaId: null }, { kassaId: kassa.id }] },
        select: { id: true, name: true, kassaId: true },
    });
    res.render('pages/admin-kassa-edit', {
        kassa, availableVendors, error: null, user: req.session.user,
    });
};

// Обновление кассы
export const handleUpdateKassa = async (req, res) => {
    try {
        const kassaId = parseInt(req.params.id);
        const {
            name, legalName, inn, isActive,
            clickMerchantId, clickServiceId, clickSecretKey, clickMerchantUserId, clickEnv,
            paymeMerchantId, paymeKey, paymeTestKey, paymeEnv,
            contactPerson, contactPhone, contactEmail,
            vendorIds,
        } = req.body;

        await prisma.kassa.update({
            where: { id: kassaId },
            data: {
                name, legalName: legalName || null, inn: inn || null,
                isActive: isActive === 'on',
                clickMerchantId: clickMerchantId || null,
                clickServiceId: clickServiceId || null,
                clickSecretKey: clickSecretKey || null,
                clickMerchantUserId: clickMerchantUserId || null,
                clickEnv: clickEnv || 'production',
                paymeMerchantId: paymeMerchantId || null,
                paymeKey: paymeKey || null,
                paymeTestKey: paymeTestKey || null,
                paymeEnv: paymeEnv || 'test',
                contactPerson: contactPerson || null,
                contactPhone: contactPhone || null,
                contactEmail: contactEmail || null,
            },
        });

        // Обновление привязки вендоров: убираем старые, ставим новые
        await prisma.vendor.updateMany({
            where: { kassaId },
            data: { kassaId: null },
        });

        if (vendorIds) {
            const ids = Array.isArray(vendorIds) ? vendorIds : [vendorIds];
            await prisma.vendor.updateMany({
                where: { id: { in: ids.map((id) => parseInt(id)) } },
                data: { kassaId },
            });
        }

        res.redirect('/admin/kassas');
    } catch (err) {
        console.error('[Kassa] Update error:', err);
        res.redirect(`/admin/kassas/${req.params.id}/edit`);
    }
};
