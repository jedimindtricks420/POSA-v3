// /home/admin1/posa/activation-system/utils/qr.js
import crypto from 'crypto';

// Единый секрет для токенов (поддерживаем оба названия env-переменной)
const QR_SECRET = process.env.QR_TOKEN_SECRET || process.env.QR_SIGN_SECRET || null;

/**
 * Определяет origin для построения ссылок.
 * 1) Берёт переданный origin, если он задан (http/https строка или hostname).
 * 2) Иначе берёт из ENV: PUBLIC_BASE_URL.
 * @param {string} [origin]
 * @returns {string} Абсолютный origin, например "https://wallet.namo.uz"
 */
export function resolveOrigin(origin) {
  const normalize = (val) => {
    const v = String(val || '').trim();
    if (!v) return null;
    if (/^https?:\/\//i.test(v)) return v;
    return `https://${v}`;
  };

  const fromArg = normalize(origin);
  if (fromArg) return fromArg;

  const env = normalize(process.env.PUBLIC_BASE_URL);
  if (env) return env;

  throw new Error('origin is required to build QR url (set PUBLIC_BASE_URL or pass origin explicitly)');
}

/**
 * Построение канонического URL для активации ваучера.
 * Пример: https://wallet.namo.uz/activate?voucher=VCH-000001
 * @param {Object} params
 * @param {string} params.voucherCode
 * @param {string} [params.origin] - Абсолютный origin
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
  return buildVoucherSmartUrl({ serial: trimmedCode, origin });
}

/**
 * Попытаться извлечь код ваучера из произвольной строки/URL/JSON/base64-полезной нагрузки.
 * Поддерживает:
 *  - URL с параметром ?voucher= или ?code=
 *  - URL с base64 JSON в ?payload=
 *  - JSON-строки {"voucher": "..."} / {"code": "..."} / {"voucherCode": "..."}
 *  - "сырой" код (без пробелов)
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function extractVoucherCode(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const payload = raw.trim();
  if (!payload) return null;

  // 1) URL
  const urlCode = extractFromUrl(payload);
  if (urlCode) return urlCode;

  // 2) JSON
  const jsonCode = extractFromJson(payload);
  if (jsonCode) return jsonCode;

  // 3) Fallback: убрать пробелы
  const fallback = payload.replace(/\s+/g, '');
  return fallback || null;
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
      if (decoded?.voucher || decoded?.code || decoded?.voucherCode) {
        const v = decoded.voucher || decoded.code || decoded.voucherCode;
        return (typeof v === 'string' && v.trim()) ? v.trim() : null;
      }
    }
  } catch {
    // not a URL
  }
  return null;
}

function extractFromJson(candidate) {
  try {
    const parsed = JSON.parse(candidate);
    if (typeof parsed === 'object' && parsed !== null) {
      const v = parsed.voucher || parsed.code || parsed.voucherCode;
      if (typeof v === 'string' && v.trim()) {
        return v.trim();
      }
    }
  } catch {
    // not JSON
  }
  return null;
}

function decodePayload(payload) {
  try {
    const sanitized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = sanitized + '='.repeat((4 - (sanitized.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/* -------------------- Токенизированный QR (опционально) -------------------- */
/**
 * base64url helpers (без =, +/, совместимо c URL)
 */
const b64u = {
  enc: (buf) =>
    buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''),
  dec: (str) =>
    Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
};

function hmacSign(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest();
}

/**
 * Сгенерировать токен для QR. В токене хранится:
 *  - s: serial (код ваучера)
 *  - exp: время истечения (unix seconds)
 * Подпись HMAC-SHA256 по payload с секретом QR_TOKEN_SECRET.
 * @param {Object} params
 * @param {string} params.serial
 * @param {number} [params.ttlSec=3600]
 * @param {string} [params.secret=process.env.QR_TOKEN_SECRET]
 * @returns {string} token
 */
export function generateVoucherToken({ serial, ttlSec = 3600, secret = QR_SECRET }) {
  if (!serial || typeof serial !== 'string') throw new Error('serial is required');
  if (!secret) throw new Error('QR_TOKEN_SECRET is required');

  const exp = Math.floor(Date.now() / 1000) + Number(ttlSec || 0);
  const payload = Buffer.from(JSON.stringify({ s: serial, exp }), 'utf8');
  const sig = hmacSign(payload, secret);
  return `${b64u.enc(payload)}.${b64u.enc(sig)}`;
}

/**
 * Распарсить и проверить QR-токен. Вернёт { s, exp } или null.
 * @param {string} token
 * @param {string} [secret=process.env.QR_TOKEN_SECRET]
 * @returns {{s:string, exp:number}|null}
 */
export function parseVoucherToken(token, secret = QR_SECRET) {
  if (!secret) throw new Error('QR_TOKEN_SECRET is required');
  if (!token || typeof token !== 'string') return null;

  const [p64, s64] = token.split('.');
  if (!p64 || !s64) return null;

  try {
    const payload = b64u.dec(p64);
    const sig = b64u.dec(s64);
    const expSig = hmacSign(payload, secret);
    if (!crypto.timingSafeEqual(sig, expSig)) return null;

    const obj = JSON.parse(payload.toString('utf8'));
    if (typeof obj.exp === 'number' && obj.exp < Math.floor(Date.now() / 1000)) return null;
    if (!obj.s || typeof obj.s !== 'string' || !obj.s.trim()) return null;
    return { s: obj.s.trim(), exp: obj.exp };
  } catch {
    return null;
  }
}

/**
 * Построить URL вида https://origin/qr/<token>
 * Удобно использовать на чеках, чтобы не светить реальный код.
 * @param {Object} params
 * @param {string} params.serial
 * @param {string} [params.origin]
 * @param {number} [params.ttlSec=3600]
 * @returns {string}
 */
export function buildVoucherTokenUrl({ serial, origin, ttlSec = 3600 }) {
  const tok = generateVoucherToken({ serial, ttlSec });
  const base = resolveOrigin(origin);
  return `${base.replace(/\/+$/, '')}/qr/${tok}`;
}

/* -------------------- Детект iOS (для UI/редиректов) -------------------- */
/**
 * Простой детект iOS по User-Agent (iPhone/iPod). iPad тоже можно учесть при желании.
 * @param {string} ua
 * @returns {boolean}
 */
export function isIOSUserAgent(ua = '') {
  const s = String(ua || '');
  return /iPhone|iPod/i.test(s); // добавить iPad, если нужно для вашего кейса
}

/**
 * Построить "умный" URL (с токеном при наличии секрета).
 * @param {Object} params
 * @param {string} params.serial
 * @param {string} [params.origin]
 * @param {number} [params.ttlSec=3600]
 * @returns {string}
 */
export function buildVoucherSmartUrl({ serial, origin, ttlSec = 3600 }) {
  const base = resolveOrigin(origin);
  if (QR_SECRET) {
    const tok = generateVoucherToken({ serial, ttlSec, secret: QR_SECRET });
    return `${base.replace(/\/+$/, '')}/qr/${tok}`;
  }
  const url = new URL('/activate', base);
  url.searchParams.set('voucher', serial);
  return url.toString();
}
