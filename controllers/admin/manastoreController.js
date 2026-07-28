import prisma from '../../prisma/client.js';
import manastoreService from '../../services/manastoreService.js';

const CURRENT_ENVIRONMENT = (process.env.MANASTORE_ENV || 'staging').toLowerCase() === 'production'
    ? 'production'
    : 'staging';

async function getWalletBalanceSafe() {
    try {
        return await manastoreService.getWalletBalance();
    } catch (err) {
        console.error('[ManaStoreController] Failed to fetch wallet balance:', err);
        return null;
    }
}

// price/face_value из каталога ManaStore — объекты { amount, currency, formatted, decimal, ... },
// а не голые числа; decimal — строка ("8.90"), Prisma Float требует number.
function toFloatFromPrice(priceObj) {
    if (priceObj == null) return null;
    if (typeof priceObj === 'number') return priceObj;
    if (typeof priceObj === 'string') return parseFloat(priceObj) || null;
    const raw = priceObj.decimal ?? priceObj.amount;
    if (raw == null) return null;
    const parsed = parseFloat(raw);
    return Number.isNaN(parsed) ? null : parsed;
}

// Показать главную страницу ManaStore админки
export const showManaStoreDashboard = async (req, res) => {
    const products = await prisma.product.findMany({
        where: {
            vendor: {
                productType: 'MANASTORE'
            }
        },
        include: {
            vendor: true,
            store: true
        },
        orderBy: { id: 'desc' }
    });

    const skus = await prisma.manaStoreSku.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' }
    });

    const activations = await prisma.voucherActivation.count({
        where: {
            voucher: {
                product: {
                    vendor: {
                        productType: 'MANASTORE'
                    }
                }
            }
        }
    });

    // Получаем последние 20 API логов
    const apiLogs = await prisma.manaStoreApiLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20
    });

    const walletBalance = await getWalletBalanceSafe();

    res.render('pages/admin-manastore-dashboard', {
        products,
        skus,
        stats: {
            products: products.length,
            skus: skus.length,
            activations
        },
        apiLogs,
        environment: CURRENT_ENVIRONMENT,
        walletBalance,
        user: req.session.user
    });
};

// Показать список SKU
export const showManaStoreSkus = async (req, res) => {
    const skus = await prisma.manaStoreSku.findMany({
        orderBy: { name: 'asc' }
    });

    res.render('pages/admin-manastore-skus', {
        skus,
        user: req.session.user
    });
};

// Показать форму добавления SKU
export const showAddSkuForm = (req, res) => {
    res.render('pages/admin-manastore-add-sku', {
        error: null,
        user: req.session.user
    });
};

// Создать SKU
export const handleAddSku = async (req, res) => {
    const { variantId, sku, name, description, category, costPrice, retailPrice, faceValue } = req.body;

    try {
        await prisma.manaStoreSku.create({
            data: {
                variantId: parseInt(variantId, 10),
                sku: sku || null,
                name,
                description: description || null,
                category: category || null,
                costPrice: costPrice ? parseFloat(costPrice) : null,
                retailPrice: retailPrice ? parseFloat(retailPrice) : null,
                faceValue: faceValue ? parseFloat(faceValue) : null,
                isActive: true
            }
        });

        res.redirect('/admin/manastore/skus');
    } catch (error) {
        console.error('Error creating ManaStore SKU:', error);
        res.render('pages/admin-manastore-add-sku', {
            error: 'Ошибка при создании SKU. Возможно, такой Variant ID уже существует.',
            user: req.session.user
        });
    }
};

// Показать форму редактирования SKU
export const showEditSkuForm = async (req, res) => {
    const skuId = Number(req.params.id);

    const sku = await prisma.manaStoreSku.findUnique({
        where: { id: skuId }
    });

    if (!sku) {
        return res.status(404).send('SKU не найден');
    }

    res.render('pages/admin-manastore-edit-sku', {
        sku,
        user: req.session.user
    });
};

// Обработать редактирование SKU
export const handleEditSku = async (req, res) => {
    const skuId = Number(req.params.id);
    const { variantId, sku, name, description, category, costPrice, retailPrice, faceValue, isActive } = req.body;

    try {
        const existing = await prisma.manaStoreSku.findUnique({ where: { id: skuId } });
        if (!existing) {
            return res.status(404).send('SKU не найден');
        }

        const parsedRetailPrice = retailPrice ? parseFloat(retailPrice) : null;

        // Обновляем SKU
        await prisma.manaStoreSku.update({
            where: { id: skuId },
            data: {
                variantId: parseInt(variantId, 10),
                sku: sku || null,
                name,
                description: description || null,
                category: category || null,
                costPrice: costPrice ? parseFloat(costPrice) : null,
                retailPrice: parsedRetailPrice,
                faceValue: faceValue ? parseFloat(faceValue) : null,
                isActive: isActive === 'on'
            }
        });

        // Если retailPrice изменился, обновляем цены всех товаров с этим вариантом
        if (parsedRetailPrice !== null) {
            await prisma.product.updateMany({
                where: { manastoreVariantId: existing.variantId },
                data: { price: parsedRetailPrice }
            });
        }

        res.redirect('/admin/manastore/skus');
    } catch (error) {
        console.error('Error updating ManaStore SKU:', error);
        res.status(500).send('Ошибка при обновлении SKU');
    }
};

// Показать товары ManaStore с привязкой варианта
export const showManaStoreProducts = async (req, res) => {
    const products = await prisma.product.findMany({
        where: {
            vendor: {
                productType: 'MANASTORE'
            }
        },
        include: {
            vendor: true,
            store: true
        },
        orderBy: { id: 'desc' }
    });

    const skus = await prisma.manaStoreSku.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' }
    });

    res.render('pages/admin-manastore-products', {
        products,
        skus,
        user: req.session.user
    });
};

// Привязать вариант ManaStore к товару
export const handleBindSku = async (req, res) => {
    const productId = Number(req.params.id);
    const { variantId } = req.body;

    try {
        await prisma.product.update({
            where: { id: productId },
            data: {
                manastoreVariantId: variantId ? parseInt(variantId, 10) : null
            }
        });

        res.redirect('/admin/manastore/products');
    } catch (error) {
        console.error('Error binding ManaStore variant:', error);
        res.status(500).send('Ошибка при привязке варианта');
    }
};

// Показать историю активаций ManaStore
export const showManaStoreActivations = async (req, res) => {
    const { startDate, endDate, productId, phone, storeSlug, status } = req.query;

    const where = {
        voucher: {
            product: {
                vendor: {
                    productType: 'MANASTORE'
                }
            }
        }
    };

    if (startDate) {
        where.activatedAt = { ...where.activatedAt, gte: new Date(startDate) };
    }
    if (endDate) {
        where.activatedAt = { ...where.activatedAt, lte: new Date(endDate) };
    }
    if (productId) {
        where.voucher.productId = Number(productId);
    }
    if (phone) {
        where.client = { phoneNumber: { contains: phone } };
    }
    if (storeSlug) {
        where.voucher.product.store = { slug: storeSlug };
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
                    manastoreOrder: true
                }
            },
            client: true
        },
        orderBy: { activatedAt: 'desc' },
        take: 100
    });

    const filteredActivations = status
        ? activations.filter((a) => a.voucher.manastoreOrder?.status === status)
        : activations;

    const products = await prisma.product.findMany({
        where: {
            vendor: {
                productType: 'MANASTORE'
            }
        },
        orderBy: { name: 'asc' }
    });

    const stores = await prisma.store.findMany({
        orderBy: { name: 'asc' }
    });

    res.render('pages/admin-manastore-activations', {
        activations: filteredActivations,
        products,
        stores,
        filters: { startDate, endDate, productId, phone, storeSlug, status },
        user: req.session.user
    });
};

// Показать финансовую сводку
export const showManaStoreFinance = async (req, res) => {
    const { startDate, endDate } = req.query;

    const where = {
        product: {
            vendor: {
                productType: 'MANASTORE'
            }
        }
    };

    if (startDate) {
        where.date = { ...where.date, gte: new Date(startDate) };
    }
    if (endDate) {
        where.date = { ...where.date, lte: new Date(endDate) };
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

    // Себестоимость берём из ManaStoreSku.costPrice по variantId товара —
    // не из приблизительного коэффициента (ManaStore себестоимость через API не отдаёт).
    const variantIds = [...new Set(sales.map((s) => s.product.manastoreVariantId).filter(Boolean))];
    const skus = variantIds.length
        ? await prisma.manaStoreSku.findMany({ where: { variantId: { in: variantIds } } })
        : [];
    const costByVariantId = new Map(skus.map((s) => [s.variantId, s.costPrice]));

    const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.price), 0);
    const totalCost = sales.reduce((sum, sale) => {
        const cost = costByVariantId.get(sale.product.manastoreVariantId);
        return sum + Number(cost ?? 0);
    }, 0);
    const totalMargin = totalRevenue - totalCost;

    const walletBalance = await getWalletBalanceSafe();

    res.render('pages/admin-manastore-finance', {
        sales,
        stats: {
            totalRevenue,
            totalCost,
            totalMargin,
            salesCount: sales.length
        },
        walletBalance,
        environment: CURRENT_ENVIRONMENT,
        filters: { startDate, endDate },
        user: req.session.user
    });
};

// Синхронизировать локальный каталог SKU с каталогом ManaStore
export const handleSyncSkuCatalog = async (req, res) => {
    try {
        let page = 1;
        let hasMore = true;
        let syncedCount = 0;

        while (hasMore) {
            const response = await manastoreService.listProducts({ page, per_page: 50 });
            const items = response.data || [];

            for (const product of items) {
                const variant = product.variant;
                if (!variant?.id) continue;

                await prisma.manaStoreSku.upsert({
                    where: { variantId: variant.id },
                    update: {
                        productId: product.id,
                        name: variant.name || product.name,
                        description: product.description || null,
                        category: product.category_name || null,
                        retailPrice: toFloatFromPrice(variant.price),
                        faceValue: toFloatFromPrice(variant.face_value),
                        currency: variant.price?.currency || null,
                        meta: JSON.stringify(product)
                    },
                    create: {
                        variantId: variant.id,
                        productId: product.id,
                        name: variant.name || product.name,
                        description: product.description || null,
                        category: product.category_name || null,
                        retailPrice: toFloatFromPrice(variant.price),
                        faceValue: toFloatFromPrice(variant.face_value),
                        currency: variant.price?.currency || null,
                        meta: JSON.stringify(product),
                        isActive: true
                    }
                });
                syncedCount += 1;
            }

            const meta = response.meta || {};
            hasMore = meta.current_page && meta.last_page ? meta.current_page < meta.last_page : false;
            page += 1;
        }

        console.log(`[ManaStore] Catalog sync complete: ${syncedCount} SKUs synced`);
        res.redirect('/admin/manastore/skus');
    } catch (error) {
        console.error('[ManaStore] Catalog sync failed:', error);
        res.status(500).send('Ошибка синхронизации каталога ManaStore');
    }
};
