import prisma from '../../prisma/client.js';

// Показать список всех товаров
// Показать список всех товаров с подсчётом активных ваучеров
export const showAllProducts = async (req, res) => {
  const products = await prisma.product.findMany({
    orderBy: { id: 'desc' }
  });

  // Получаем ID всех продуктов
  const productIds = products.map(p => p.id);

  // Считаем активные ваучеры по каждому productId
  const voucherCounts = await prisma.voucher.groupBy({
    by: ['productId'],
    where: { status: 'active', productId: { in: productIds } },
    _count: { _all: true }
  });

  // Преобразуем в map: productId → count
  const voucherMap = {};
  voucherCounts.forEach(vc => {
    voucherMap[vc.productId] = vc._count._all;
  });

  // Добавляем поле activeVoucherCount
  const enrichedProducts = products.map(p => ({
    ...p,
    activeVoucherCount: voucherMap[p.id] || 0
  }));

  res.render('pages/admin-products', {
    products: enrichedProducts,
    user: req.session.user
  });
};


// Показать форму создания товара
export const showAddProductForm = async (req, res) => {
  const vendors = await prisma.vendor.findMany({ orderBy: { name: 'asc' } });
  res.render('pages/admin-add-product', { vendors, user: req.session.user, error: null });
};

// Обработать создание товара
export const handleAddProduct = async (req, res) => {
  const { name, price, status, vendorId, merchantCommissionPercent, vendorCommissionPercent } = req.body;

  try {
    await prisma.product.create({
      data: {
        name,
        price: parseFloat(price),
        status,
        vendorId: parseInt(vendorId),
        merchantCommissionPercent: parseFloat(merchantCommissionPercent),
        vendorCommissionPercent: parseFloat(vendorCommissionPercent),
      }
    });

    res.redirect('/admin/products');
  } catch (error) {
    res.render('pages/admin-add-product', {
      error: 'Ошибка при создании товара',
      vendors: await prisma.vendor.findMany({ orderBy: { name: 'asc' } }),
      user: req.session.user
    });
  }
};


// Показать форму редактирования товара
export const showEditProductForm = async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: Number(req.params.id) } });
  if (!product) return res.send('Товар не найден');
  res.render('pages/edit-product', { product, user: req.session.user });
};

// Обработать редактирование товара
export const handleEditProduct = async (req, res) => {
  const id = Number(req.params.id);
  const { name, price, status, merchantCommissionPercent, vendorCommissionPercent, rokkySku } = req.body;

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    return res.redirect('/admin/products');
  }

  const parsedPrice = price !== undefined && price !== '' ? parseFloat(price) : existing.price;
  const parsedMerchantCommission = merchantCommissionPercent !== undefined && merchantCommissionPercent !== ''
    ? parseFloat(merchantCommissionPercent)
    : existing.merchantCommissionPercent;
  const parsedVendorCommission = vendorCommissionPercent !== undefined && vendorCommissionPercent !== ''
    ? parseFloat(vendorCommissionPercent)
    : existing.vendorCommissionPercent;

  await prisma.product.update({
    where: { id },
    data: {
      name,
      price: parsedPrice,
      status,
      merchantCommissionPercent: parsedMerchantCommission,
      vendorCommissionPercent: parsedVendorCommission,
      rokkySku: rokkySku || null,
    }
  });

  res.redirect('/admin/products');
};

// Удалить товар
export const handleDeleteProduct = async (req, res) => {
  await prisma.product.delete({ where: { id: Number(req.params.id) } });
  res.redirect('/admin/products');
};

