import prisma from '../../prisma/client.js';

// Показать товары
export const showProductsForSale = async (req, res) => {
  const products = await prisma.product.findMany({
    where: { status: 'on' },
    orderBy: { id: 'asc' },
  });

  if (!Array.isArray(req.session.cart)) {
    req.session.cart = [];
  }

  res.render('pages/merchant-sell', {
    products,
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

  res.render('pages/checkout', {
    items: enrichedCart,
    totalPrice,
    totalQuantity,
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
