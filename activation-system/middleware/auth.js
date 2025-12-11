// Middleware для проверки авторизации
export const ensureAuthenticated = (req, res, next) => {
  if (req.session.user) return next();
  res.redirect('/auth/login');
};

// Middleware для Админа (супер-админ)
export const ensureAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') return next();
  res.status(403).send('Access denied. Admins only.');
};

// Middleware для Финансов (Админ + Финансист)
export const allowFinance = (req, res, next) => {
  const role = req.session.user?.role;
  if (role === 'admin' || role === 'financial_mgr') return next();
  res.status(403).send('Access denied. Finance role required.');
};

// Middleware для Контента (Админ + Контент-менеджер)
export const allowContent = (req, res, next) => {
  const role = req.session.user?.role;
  if (role === 'admin' || role === 'content_mgr') return next();
  res.status(403).send('Access denied. Content role required.');
};

// Middleware для Поддержки (Админ + Саппорт)
export const allowSupport = (req, res, next) => {
  const role = req.session.user?.role;
  if (role === 'admin' || role === 'support_agent') return next();
  res.status(403).send('Access denied. Support role required.');
};

export const ensureMerchant = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'merchant') return next();
  res.status(403).send('Access denied. Merchants only.');
};

export const ensureVendor = (req, res, next) => {
  if (req.session.user && (req.session.user.role === 'vendor' || req.session.user.role === 'vendor_user')) return next();
  res.status(403).send('Access denied. Vendors only.');
};
