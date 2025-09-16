import prisma from '../../prisma/client.js';

// Показать товары
export const showProductsForSale = async (req, res) => {
  const products = await prisma.product.findMany({
    where: { status: 'on' },
    orderBy: { id: 'asc' },
  });

  if (!req.session.cart) req.session.cart = [];

  res.render('pages/merchant-sell', {
    products,
    cart: req.session.cart,
    user: req.session.user,
  });
};

// Добавить товар в корзину
export const addToCart = async (req, res) => {
  const productId = Number(req.body.productId);
  if (!productId) return res.redirect('/merchant/sell');

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return res.status(404).send('Товар не найден');

  if (!req.session.cart) req.session.cart = [];

  const existing = req.session.cart.find(p => p.productId === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    req.session.cart.push({
      productId,
      name: product.name,
      price: product.price,
      quantity: 1
    });
  }

  res.redirect('/merchant/checkout');
};

// Отображение корзины
export const showCart = (req, res) => {
  const cart = req.session.cart || [];
  const enrichedCart = cart.map(item => ({
    ...item,
    total: item.price * item.quantity,
    id: item.productId
  }));

  const totalPrice = enrichedCart.reduce((sum, item) => sum + item.total, 0);

  res.render('pages/checkout', {
    items: enrichedCart,
    totalPrice,
    user: req.session.user
  });
};

// Обновить корзину
export const updateCart = (req, res) => {
  const updates = req.body;
  if (!req.session.cart) req.session.cart = [];

  req.session.cart = req.session.cart
    .map(item => {
      const newQty = parseInt(updates[item.productId]);
      return newQty > 0 ? { ...item, quantity: newQty } : null;
    })
    .filter(Boolean);

  res.redirect('/merchant/checkout');
};

// Удалить товар из корзины
export const removeFromCart = (req, res) => {
  const productId = Number(req.params.id);
  if (!req.session.cart) req.session.cart = [];

  req.session.cart = req.session.cart.filter(item => item.productId !== productId);
  res.redirect('/merchant/checkout');
};
