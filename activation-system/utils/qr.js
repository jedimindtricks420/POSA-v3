/**
 * Build canonical QR URL for voucher operations.
 * @param {Object} params
 * @param {string} params.voucherCode - Voucher code string.
 * @param {string} params.origin - Absolute origin, e.g. https://wallet.example.com
 * @returns {string}
 */
export function buildVoucherQrUrl({ voucherCode, origin }) {
  if (!voucherCode || typeof voucherCode !== 'string') {
    throw new Error('voucherCode is required to build QR url');
  }
  const trimmedCode = voucherCode.trim();
  if (!trimmedCode) {
    throw new Error('voucherCode must be a non-empty string');
  }

  const resolvedOrigin = resolveOrigin(origin);
  const url = new URL('/activate', resolvedOrigin);
  url.searchParams.set('voucher', trimmedCode);
  return url.toString();
}

/**
 * Try to extract voucher code from raw payload.
 * Supports canonical activation URLs, raw codes, JSON payloads and base64 JSON in ?payload=.
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function extractVoucherCode(raw) {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  const payload = raw.trim();
  if (!payload) {
    return null;
  }

  // 1. Try URL parsing
  const urlCode = extractFromUrl(payload);
  if (urlCode) {
    return urlCode;
  }

  // 2. Try JSON string
  const jsonCode = extractFromJson(payload);
  if (jsonCode) {
    return jsonCode;
  }

  // 3. Fallback to raw alphanumeric chunks
  const fallback = payload.replace(/\s+/g, '');
  return fallback || null;
}

function resolveOrigin(origin) {
  if (origin && typeof origin === 'string') {
    const trimmed = origin.trim();
    if (trimmed) {
      if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
      }
      return `https://${trimmed}`;
    }
  }
  const envOrigin = process.env.PUBLIC_BASE_URL;
  if (envOrigin) {
    return resolveOrigin(envOrigin);
  }
  throw new Error('origin is required to build QR url');
}

function extractFromUrl(candidate) {
  try {
    const url = new URL(candidate);
    const voucher = url.searchParams.get('voucher') || url.searchParams.get('code');
    if (voucher && voucher.trim()) {
      return voucher.trim();
    }
    const payload = url.searchParams.get('payload');
    if (payload) {
      const decoded = decodePayload(payload);
      if (decoded?.voucher || decoded?.code) {
        return (decoded.voucher || decoded.code).trim() || null;
      }
    }
  } catch (error) {
    // Not a URL, continue
  }
  return null;
}

function extractFromJson(candidate) {
  try {
    const parsed = JSON.parse(candidate);
    if (typeof parsed === 'object' && parsed !== null) {
      const voucher = parsed.voucher || parsed.code || parsed.voucherCode;
      if (typeof voucher === 'string' && voucher.trim()) {
        return voucher.trim();
      }
    }
  } catch (error) {
    // Not JSON
  }
  return null;
}

function decodePayload(payload) {
  try {
    const sanitized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = sanitized + '='.repeat((4 - (sanitized.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (error) {
    return null;
  }
}
