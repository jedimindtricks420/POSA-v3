export function isClientAuthenticated(req, res, next) {
  console.log('=== isClientAuthenticated MIDDLEWARE ===');
  console.log('Session:', req.session);
  console.log('req.session?.client:', req.session?.client);
  
  if (req.session && req.session.client) {
    console.log('Client authenticated, proceeding...');
    return next();
  }
  console.log('Client not authenticated, redirecting to /wallet');
  return res.redirect('/wallet');
}
