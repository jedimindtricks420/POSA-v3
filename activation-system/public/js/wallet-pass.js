const DEFAULT_APP_BASE_URL = 'https://wallet.namo.uz';

function normalizeBaseUrl(candidate) {
  if (!candidate || typeof candidate !== 'string') {
    return null;
  }
  const trimmed = candidate.trim();
  if (!trimmed) {
    return null;
  }
  const prefixed = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return prefixed.replace(/\/+$/, '');
}

export function resolveAppBaseUrl() {
  if (typeof window === 'undefined') {
    return DEFAULT_APP_BASE_URL;
  }
  const envBase = window.__APP_BASE_URL__ || '';
  const locationBase = typeof window.location !== 'undefined' ? window.location.origin : '';
  return normalizeBaseUrl(envBase) || normalizeBaseUrl(locationBase) || DEFAULT_APP_BASE_URL;
}

export function resolvePassUrl(detail) {
  if (detail?.passUrl && /^https?:\/\//i.test(detail.passUrl)) {
    return detail.passUrl;
  }
  const serial = typeof detail?.passSerial === 'string' && detail.passSerial.trim()
    ? detail.passSerial.trim()
    : (typeof detail?.value === 'string' ? detail.value.trim() : '');
  if (!serial) {
    return null;
  }
  const base = resolveAppBaseUrl();
  const encoded = encodeURIComponent(serial);
  return `${base}/wallet/${encoded}.pkpass`;
}

export { normalizeBaseUrl };
