export function checkSubdomain(req, res, next) {
  const host = req.hostname; // Например, wallet.namo.uz

  if (host.startsWith('wallet.')) {
    req.appRole = 'client';
  } else if (host.startsWith('merchant.')) {
    req.appRole = 'merchant';
  } else if (host.startsWith('vendor.')) {
    req.appRole = 'vendor';
  } else if (host.startsWith('office.')) {
    req.appRole = 'admin';
  } else {
    req.appRole = 'public';
  }
  next();
}
