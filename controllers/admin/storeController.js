import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Показать список магазинов
export const showStores = async (req, res) => {
    const stores = await prisma.store.findMany({
        orderBy: { id: 'desc' },
        include: {
            products: true
        }
    });

    res.render('pages/admin-stores', {
        stores,
        user: req.session.user
    });
};

// Показать форму создания магазина
export const showAddStoreForm = async (req, res) => {
    const vendors = await prisma.vendor.findMany();
    const products = await prisma.product.findMany({
        include: { vendor: true }
    });

    res.render('pages/admin-add-store', {
        vendors,
        products,
        error: null,
        user: req.session.user
    });
};

// Создать магазин
export const handleAddStore = async (req, res) => {
    const { slug, name, isActive, productIds } = req.body;

    try {
        const productIdArray = productIds
            ? (Array.isArray(productIds) ? productIds.map(Number) : [Number(productIds)])
            : [];

        await prisma.store.create({
            data: {
                slug,
                name,
                isActive: isActive === 'on',
                products: {
                    connect: productIdArray.map(id => ({ id }))
                }
            }
        });

        res.redirect('/admin/stores');
    } catch (error) {
        console.error('Error creating store:', error);
        const vendors = await prisma.vendor.findMany();
        const products = await prisma.product.findMany({ include: { vendor: true } });

        res.render('pages/admin-add-store', {
            vendors,
            products,
            error: 'Ошибка при создании магазина',
            user: req.session.user
        });
    }
};

// Показать форму редактирования магазина
export const showEditStoreForm = async (req, res) => {
    const storeId = Number(req.params.id);

    const store = await prisma.store.findUnique({
        where: { id: storeId },
        include: { products: true }
    });

    if (!store) {
        return res.status(404).send('Магазин не найден');
    }

    const allProducts = await prisma.product.findMany({
        include: { vendor: true }
    });

    res.render('pages/admin-edit-store', {
        store,
        allProducts,
        user: req.session.user
    });
};

// Обработать редактирование магазина
export const handleEditStore = async (req, res) => {
    const storeId = Number(req.params.id);
    const { slug, name, isActive, productIds } = req.body;

    try {
        const productIdArray = Array.isArray(productIds)
            ? productIds.map(Number)
            : productIds ? [Number(productIds)] : [];

        const updateData = {
            slug,
            name,
            isActive: isActive === 'on',
            themeColor: req.body.themeColor,
            backgroundColor: req.body.backgroundColor,
            activationSmsTemplate: req.body.activationSmsTemplate || null,
            products: {
                set: productIdArray.map(id => ({ id }))
            }
        };

        // Handle logo upload
        if (req.file) {
            updateData.logoUrl = '/uploads/' + req.file.filename;
        } else if (req.body.removeLogo === 'true') {
            updateData.logoUrl = null;
        }

        await prisma.store.update({
            where: { id: storeId },
            data: updateData
        });

        res.redirect('/admin/stores');
    } catch (error) {
        console.error('Error updating store:', error);
        res.status(500).send('Ошибка при обновлении магазина');
    }
};
