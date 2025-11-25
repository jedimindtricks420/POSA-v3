import prisma from '../../prisma/client.js';

// Показать главную страницу Rokky админки
export const showRokkyDashboard = async (req, res) => {
    const products = await prisma.product.findMany({
        where: {
            vendor: {
                name: 'Rokky'
            }
        },
        include: {
            vendor: true,
            store: true
        },
        orderBy: { id: 'desc' }
    });

    const skus = await prisma.rokkySku.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' }
    });

    const activations = await prisma.voucherActivation.count({
        where: {
            voucher: {
                product: {
                    vendor: {
                        name: 'Rokky'
                    }
                }
            }
        }
    });

    // Получаем последние 20 API логов
    const apiLogs = await prisma.rokkyApiLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20
    });

    res.render('pages/admin-rokky-dashboard', {
        products,
        skus,
        stats: {
            products: products.length,
            skus: skus.length,
            activations
        },
        apiLogs,
        user: req.session.user
    });
};

// Показать список SKU
export const showRokkySkus = async (req, res) => {
    const skus = await prisma.rokkySku.findMany({
        orderBy: { name: 'asc' }
    });

    res.render('pages/admin-rokky-skus', {
        skus,
        user: req.session.user
    });
};

// Показать форму добавления SKU
export const showAddSkuForm = (req, res) => {
    res.render('pages/admin-rokky-add-sku', {
        error: null,
        user: req.session.user
    });
};

// Создать SKU
export const handleAddSku = async (req, res) => {
    const { sku, name, description, category, costPrice, retailPrice } = req.body;

    try {
        await prisma.rokkySku.create({
            data: {
                sku,
                name,
                description: description || null,
                category: category || null,
                costPrice: costPrice ? parseFloat(costPrice) : null,
                retailPrice: retailPrice ? parseFloat(retailPrice) : null,
                isActive: true
            }
        });

        res.redirect('/admin/rokky/skus');
    } catch (error) {
        console.error('Error creating SKU:', error);
        res.render('pages/admin-rokky-add-sku', {
            error: 'Ошибка при создании SKU. Возможно, такой SKU уже существует.',
            user: req.session.user
        });
    }
};

// Показать форму редактирования SKU
export const showEditSkuForm = async (req, res) => {
    const skuId = Number(req.params.id);

    const sku = await prisma.rokkySku.findUnique({
        where: { id: skuId }
    });

    if (!sku) {
        return res.status(404).send('SKU не найден');
    }

    res.render('pages/admin-rokky-edit-sku', {
        sku,
        user: req.session.user
    });
};

// Обработать редактирование SKU
export const handleEditSku = async (req, res) => {
    const skuId = Number(req.params.id);
    const { sku, name, description, category, costPrice, retailPrice, isActive } = req.body;

    try {
        const parsedRetailPrice = retailPrice ? parseFloat(retailPrice) : null;

        // Обновляем SKU
        await prisma.rokkySku.update({
            where: { id: skuId },
            data: {
                sku,
                name,
                description: description || null,
                category: category || null,
                costPrice: costPrice ? parseFloat(costPrice) : null,
                retailPrice: parsedRetailPrice,
                isActive: isActive === 'on'
            }
        });

        // Если retailPrice изменился, обновляем цены всех товаров с этим SKU
        if (parsedRetailPrice !== null) {
            await prisma.product.updateMany({
                where: { rokkySku: sku },
                data: { price: parsedRetailPrice }
            });
        }

        res.redirect('/admin/rokky/skus');
    } catch (error) {
        console.error('Error updating SKU:', error);
        res.status(500).send('Ошибка при обновлении SKU');
    }
};

// Показать товары Rokky с привязкой SKU
export const showRokkyProducts = async (req, res) => {
    const products = await prisma.product.findMany({
        where: {
            vendor: {
                name: 'Rokky'
            }
        },
        include: {
            vendor: true,
            store: true
        },
        orderBy: { id: 'desc' }
    });

    const skus = await prisma.rokkySku.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' }
    });

    res.render('pages/admin-rokky-products', {
        products,
        skus,
        user: req.session.user
    });
};

// Привязать SKU к товару
export const handleBindSku = async (req, res) => {
    const productId = Number(req.params.id);
    const { rokkySku } = req.body;

    try {
        await prisma.product.update({
            where: { id: productId },
            data: {
                rokkySku: rokkySku || null
            }
        });

        res.redirect('/admin/rokky/products');
    } catch (error) {
        console.error('Error binding SKU:', error);
        res.status(500).send('Ошибка при привязке SKU');
    }
};

// Показать историю активаций Rokky
export const showRokkyActivations = async (req, res) => {
    const { startDate, endDate, productId, phone, storeSlug } = req.query;

    const where = {
        voucher: {
            product: {
                vendor: {
                    name: 'Rokky'
                }
            }
        }
    };

    if (startDate) {
        where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    }
    if (endDate) {
        where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
    }
    if (productId) {
        where.voucher.productId = Number(productId);
    }
    if (phone) {
        where.client = { phone: { contains: phone } };
    }

    const activations = await prisma.voucherActivation.findMany({
        where,
        include: {
            voucher: {
                include: {
                    product: {
                        include: {
                            store: true
                        }
                    },
                    rokkyOrder: true
                }
            },
            client: true
        },
        orderBy: { createdAt: 'desc' },
        take: 100
    });

    const products = await prisma.product.findMany({
        where: {
            vendor: {
                name: 'Rokky'
            }
        },
        orderBy: { name: 'asc' }
    });

    res.render('pages/admin-rokky-activations', {
        activations,
        products,
        filters: { startDate, endDate, productId, phone, storeSlug },
        user: req.session.user
    });
};

// Показать финансовую сводку
export const showRokkyFinance = async (req, res) => {
    const { startDate, endDate } = req.query;

    const where = {
        product: {
            vendor: {
                name: 'Rokky'
            }
        }
    };

    if (startDate) {
        where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    }
    if (endDate) {
        where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
    }

    const sales = await prisma.sale.findMany({
        where,
        include: {
            product: {
                include: {
                    vendor: true
                }
            }
        }
    });

    const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.price), 0);
    const totalCost = sales.reduce((sum, sale) => {
        // Здесь можно использовать costPrice из RokkySku
        return sum + Number(sale.product.price * 0.7); // Примерная себестоимость
    }, 0);
    const totalMargin = totalRevenue - totalCost;

    res.render('pages/admin-rokky-finance', {
        sales,
        stats: {
            totalRevenue,
            totalCost,
            totalMargin,
            salesCount: sales.length
        },
        filters: { startDate, endDate },
        user: req.session.user
    });
};
