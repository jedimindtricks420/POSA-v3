export function isClientAuthenticated(req, res, next) {
  if (req.session?.client) {
    return next();
  }

  const wantsJson = req.headers.accept?.includes('application/json') || req.originalUrl.startsWith('/api/');
  if (wantsJson) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.redirect('/wallet');
}
