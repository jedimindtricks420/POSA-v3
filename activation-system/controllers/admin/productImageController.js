import fs from 'fs';
import path from 'path';
import prisma from '../../prisma/client.js';

// Список товаров с их главным изображением (или плейсхолдером)
export const showProductImagesList = async (req, res) => {
  const products = await prisma.product.findMany({
    orderBy: { id: 'desc' },
    include: {
      images: {
        where: { isPrimary: true },
        take: 1,
      },
      _count: { select: { images: true } },
    },
  });

  res.render('pages/admin-product-images', {
    products,
    user: req.session.user,
  });
};

// Галерея изображений одного товара
export const showManageProductImages = async (req, res) => {
  const productId = Number(req.params.productId);
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!product) {
    return res.status(404).send('Товар не найден');
  }

  res.render('pages/admin-product-images-manage', {
    product,
    user: req.session.user,
    error: null,
  });
};

// Загрузить новое изображение для товара
export const uploadProductImage = async (req, res) => {
  const productId = Number(req.params.productId);

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return res.status(404).send('Товар не найден');
  }

  if (!req.file) {
    return res.redirect(`/admin/product-images/${productId}`);
  }

  const existingCount = await prisma.productImage.count({ where: { productId } });
  const maxSortOrder = await prisma.productImage.aggregate({
    where: { productId },
    _max: { sortOrder: true },
  });

  await prisma.productImage.create({
    data: {
      productId,
      url: '/uploads/products/' + req.file.filename,
      isPrimary: existingCount === 0, // первое загруженное фото сразу становится главным
      sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
    },
  });

  res.redirect(`/admin/product-images/${productId}`);
};

// Сделать изображение главным (показывается на merchant/sell и странице оплаты)
export const setPrimaryImage = async (req, res) => {
  const imageId = Number(req.params.imageId);

  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) {
    return res.status(404).send('Изображение не найдено');
  }

  await prisma.$transaction([
    prisma.productImage.updateMany({
      where: { productId: image.productId },
      data: { isPrimary: false },
    }),
    prisma.productImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
    }),
  ]);

  res.redirect(`/admin/product-images/${image.productId}`);
};

// Удалить изображение (файл + запись), при удалении главного — назначить новое главное
export const deleteProductImage = async (req, res) => {
  const imageId = Number(req.params.imageId);

  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) {
    return res.status(404).send('Изображение не найдено');
  }

  const { productId, isPrimary } = image;

  await prisma.productImage.delete({ where: { id: imageId } });

  const absolutePath = path.join(process.cwd(), 'public', image.url.replace(/^\//, ''));
  fs.unlink(absolutePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error('Error deleting product image file:', err);
    }
  });

  if (isPrimary) {
    const nextImage = await prisma.productImage.findFirst({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
    });
    if (nextImage) {
      await prisma.productImage.update({
        where: { id: nextImage.id },
        data: { isPrimary: true },
      });
    }
  }

  res.redirect(`/admin/product-images/${productId}`);
};
