// Отказ в доступе. Не вошедшего пользователя отправляем на форму входа —
// иначе он видит голый текст «Access denied» вместо логина и не понимает,
// что просто не авторизован. 403 остаётся для случая «вошёл, но не та роль».
const deny = (req, res, message) => {
  if (!req.session?.user) return res.redirect('/auth/login');
  return res.status(403).send(message);
};

// Middleware для проверки авторизации
export const ensureAuthenticated = (req, res, next) => {
  if (req.session.user) return next();
  res.redirect('/auth/login');
};

// Middleware для Админа (супер-админ)
export const ensureAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') return next();
  return deny(req, res, 'Access denied. Admins only.');
};

// Middleware для главного дашборда /admin/dashboard.
// Ровно те роли, для которых логин (controllers/authController.js) редиректит сюда:
// admin, financial_mgr, content_mgr, support_agent. Мерчанты/вендоры/касса — не сюда.
export const allowOfficeDashboard = (req, res, next) => {
  const role = req.session.user?.role;
  if (['admin', 'financial_mgr', 'content_mgr', 'support_agent'].includes(role)) return next();
  return deny(req, res, 'Access denied.');
};

// Middleware для Финансов (Админ + Финансист)
export const allowFinance = (req, res, next) => {
  const role = req.session.user?.role;
  if (role === 'admin' || role === 'financial_mgr' || role === 'kassa_admin') return next();
  return deny(req, res, 'Access denied. Finance role required.');
};

// Middleware для Контента (Админ + Контент-менеджер)
export const allowContent = (req, res, next) => {
  const role = req.session.user?.role;
  if (role === 'admin' || role === 'content_mgr') return next();
  return deny(req, res, 'Access denied. Content role required.');
};

// Middleware для Поддержки (Админ + Саппорт)
export const allowSupport = (req, res, next) => {
  const role = req.session.user?.role;
  if (role === 'admin' || role === 'support_agent') return next();
  return deny(req, res, 'Access denied. Support role required.');
};

// Middleware для Вендоров (Админ + Финансист + Контент-менеджер)
// Финансисту нужен доступ для выплат, контент-менеджеру для привязки товаров
export const allowFinanceOrContent = (req, res, next) => {
  const role = req.session.user?.role;
  if (role === 'admin' || role === 'financial_mgr' || role === 'content_mgr') return next();
  return deny(req, res, 'Access denied. Finance or Content role required.');
};

export const ensureMerchant = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'merchant') return next();
  return deny(req, res, 'Access denied. Merchants only.');
};

export const ensureVendor = (req, res, next) => {
  if (req.session.user && (req.session.user.role === 'vendor' || req.session.user.role === 'vendor_user')) return next();
  return deny(req, res, 'Access denied. Vendors only.');
};

// Middleware для Кассы (kassa_admin + kassa_viewer)
export const ensureKassa = (req, res, next) => {
  const role = req.session.user?.role;
  if ((role === 'kassa_admin' || role === 'kassa_viewer') && req.session.user?.kassaId) return next();
  return deny(req, res, 'Access denied. Kassa role required.');
};

// Middleware для Кассы (только admin)
export const ensureKassaAdmin = (req, res, next) => {
  if (req.session.user?.role === 'kassa_admin' && req.session.user?.kassaId) return next();
  return deny(req, res, 'Access denied. Kassa admin role required.');
};
