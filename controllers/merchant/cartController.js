import crypto from 'crypto';
import prisma from '../../prisma/client.js';

// Показать товары
export const showProductsForSale = async (req, res) => {
  const products = await prisma.product.findMany({
    where: { status: 'on' },
    orderBy: { id: 'asc' },
    include: {
      images: { where: { isPrimary: true }, take: 1 },
    },
  });

  // Считаем активные (доступные для продажи) ваучеры по каждому товару,
  // чтобы бейдж "В наличии" отражал реальный остаток, а не только статус товара.
  const productIds = products.map((p) => p.id);
  const voucherCounts = await prisma.voucher.groupBy({
    by: ['productId'],
    where: { status: 'active', productId: { in: productIds } },
    _count: { _all: true },
  });
  const voucherMap = {};
  voucherCounts.forEach((vc) => {
    voucherMap[vc.productId] = vc._count._all;
  });
  const enrichedProducts = products.map((p) => ({
    ...p,
    activeVoucherCount: voucherMap[p.id] || 0,
  }));

  if (!Array.isArray(req.session.cart)) {
    req.session.cart = [];
  }

  res.render('pages/merchant-sell', {
    products: enrichedProducts,
    cart: req.session.cart,
    user: req.session.user,
  });
};

// Добавить товар в корзину (в системе теперь может быть только один товар)
export const addToCart = async (req, res) => {
  const productId = Number(req.body.productId);
  if (!productId) return res.redirect('/merchant/sell');

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return res.status(404).send('Товар не найден');

  req.session.cart = [{
    productId,
    name: product.name,
    price: product.price,
    quantity: 1,
  }];

  res.redirect('/merchant/checkout');
};

// Отображение корзины
export const showCart = (req, res) => {
  const cart = Array.isArray(req.session.cart) && req.session.cart.length ? [req.session.cart[0]] : [];
  req.session.cart = cart;

  const enrichedCart = cart.map((item) => ({
    ...item,
    total: item.price * item.quantity,
    id: item.productId,
  }));

  const totalPrice = enrichedCart.reduce((sum, item) => sum + item.total, 0);
  const totalQuantity = enrichedCart.reduce((sum, item) => sum + (item.quantity || 0), 0);

  // Одноразовый токен на каждый рендер чека — защита от повторной отправки
  // формы (двойной клик / повтор запроса при медленной сети).
  req.session.checkoutToken = cart.length ? crypto.randomUUID() : null;

  res.render('pages/checkout', {
    items: enrichedCart,
    totalPrice,
    totalQuantity,
    checkoutToken: req.session.checkoutToken,
    user: req.session.user,
  });
};

// Обновить корзину (не используется в новой логике)
export const updateCart = (req, res) => {
  res.redirect('/merchant/checkout');
};

// Удалить товар из корзины
export const removeFromCart = (req, res) => {
  req.session.cart = [];
  res.redirect('/merchant/checkout');
};
