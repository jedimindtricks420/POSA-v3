export function ensureAuthenticated(req, res, next) {
  if (req.session?.user) {
    return next();
  }
  return res.redirect('/auth/login');
}

export function ensureAdmin(req, res, next) {
  if (req.session?.user?.role === 'admin') {
    return next();
  }
  return res.status(403).send('Доступ запрещён: только для админов');
}

export function ensureMerchant(req, res, next) {
  if (req.session?.user?.role === 'merchant') {
    return next();
  }
  return res.status(403).send('Доступ запрещён: только для продавцов');
}
