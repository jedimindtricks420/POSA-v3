import prisma from '../../prisma/client.js';
import {
  parseReceiptSchema,
  renderReceiptPreview,
  buildSampleReceiptData,
  resolveReceiptTemplate,
} from '../../utils/receiptRenderer.js';


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
  const { name, price, status, vendorId, merchantCommissionPercent, vendorCommissionPercent, rokkySku, drwebSku, manastoreVariantId } = req.body;

  try {
    await prisma.product.create({
      data: {
        name,
        price: parseFloat(price),
        status,
        vendorId: parseInt(vendorId),
        merchantCommissionPercent: parseFloat(merchantCommissionPercent),
        vendorCommissionPercent: parseFloat(vendorCommissionPercent),
        rokkySku: rokkySku || null,
        drwebSku: drwebSku || null,
        manastoreVariantId: manastoreVariantId ? parseInt(manastoreVariantId, 10) : null,
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
  const product = await prisma.product.findUnique({
    where: { id: Number(req.params.id) },
    include: { vendor: true },
  });

  if (!product) {
    return res.status(404).send('Товар не найден');
  }

  // Парсим шаблон товара или используем шаблон вендора как базу
  const schema = product.receiptTemplate
    ? parseReceiptSchema(product.receiptTemplate, product.vendor.name)
    : parseReceiptSchema(product.vendor?.receiptTemplate, product.vendor.name);

  res.render('pages/edit-product', {
    product,
    vendor: product.vendor,
    user: req.session.user,
    templateSchema: JSON.stringify(schema),
    hasCustomTemplate: !!product.receiptTemplate,
  });
};

// Обработать редактирование товара
export const handleEditProduct = async (req, res) => {
  const id = Number(req.params.id);
  const { name, price, status, merchantCommissionPercent, vendorCommissionPercent, rokkySku, drwebSku, manastoreVariantId, useCustomTemplate, templateSchema } = req.body;

  const existing = await prisma.product.findUnique({
    where: { id },
    include: { vendor: true },
  });

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

  // Обработка шаблона чека
  let schemaToSave = null;
  if (useCustomTemplate === 'true' && templateSchema) {
    try {
      schemaToSave = parseReceiptSchema(templateSchema, existing.vendor.name);
    } catch (error) {
      console.error('Invalid template schema:', error);
    }
  }

  await prisma.product.update({
    where: { id },
    data: {
      name,
      price: parsedPrice,
      status,
      merchantCommissionPercent: parsedMerchantCommission,
      vendorCommissionPercent: parsedVendorCommission,
      rokkySku: rokkySku || null,
      drwebSku: drwebSku || null,
      manastoreVariantId: manastoreVariantId ? parseInt(manastoreVariantId, 10) : null,
      receiptTemplate: schemaToSave ? JSON.stringify(schemaToSave) : null,
    }
  });

  res.redirect('/admin/products');
};

// Удалить товар
// Удалить товар
export const handleDeleteProduct = async (req, res) => {
  const productId = Number(req.params.id);
  try {
    await prisma.product.delete({ where: { id: productId } });
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Error deleting product:', error);

    let errorMessage = 'Ошибка при удалении товара';

    // P2003: Foreign key constraint failed
    if (error.code === 'P2003') {
      errorMessage = 'Требуется удаление ваучеров и истории продаж перед удалением товара.';
    }

    // Рендерим страницу списка товаров с ошибкой
    try {
      const products = await prisma.product.findMany({ orderBy: { id: 'desc' } });
      const productIds = products.map(p => p.id);
      const voucherCounts = await prisma.voucher.groupBy({
        by: ['productId'],
        where: { status: 'active', productId: { in: productIds } },
        _count: { _all: true }
      });
      const voucherMap = {};
      voucherCounts.forEach(vc => { voucherMap[vc.productId] = vc._count._all; });
      const enrichedProducts = products.map(p => ({ ...p, activeVoucherCount: voucherMap[p.id] || 0 }));

      res.render('pages/admin-products', {
        products: enrichedProducts,
        user: req.session.user,
        error: errorMessage
      });
    } catch (renderError) {
      console.error('Error rendering products page after delete fail:', renderError);
      res.status(500).send(errorMessage);
    }
  }
};

// Предпросмотр шаблона чека товара
export const previewProductReceiptTemplate = async (req, res) => {
  const productId = Number(req.params.id);
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { vendor: true },
  });

  if (!product) {
    return res.status(404).send('Товар не найден');
  }

  const incomingSchema = req.body?.schema;
  const schema = parseReceiptSchema(incomingSchema || product.receiptTemplate, product.vendor.name);

  const samplePayload = buildSampleReceiptData({
    vendorName: product.vendor.name,
    product: { name: product.name, price: product.price },
  });

  try {
    const html = await renderReceiptPreview(schema, samplePayload);
    res.send(html);
  } catch (error) {
    console.error('Receipt preview error:', error);
    res.status(500).send('<h1>Ошибка рендера чека</h1><p>Проверьте структуру шаблона.</p>');
  }
};
