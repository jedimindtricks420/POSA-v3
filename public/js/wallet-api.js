const OFFLINE_QUEUE_EVENT = 'wallet-api:offline-queued';

async function fetchJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch (networkError) {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      const offlineError = new Error('Offline');
      offlineError.offline = true;
      offlineError.payload = { offline: true };
      throw offlineError;
    }
    throw networkError;
  }

  const payload = await response.json().catch(() => ({}));

  if (response.status === 202 && payload?.offline) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(OFFLINE_QUEUE_EVENT, {
          detail: {
            url,
            payload,
          },
        }),
      );
    }
    return payload;
  }

  if (!response.ok) {
    const error = new Error(payload.error || 'Request failed');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function getVouchers() {
  return fetchJson('/api/client/vouchers');
}

export function getVoucher(id) {
  return fetchJson(`/api/client/voucher/${id}`);
}

export function logVoucherEvent(id, event, meta = {}, options = {}) {
  const extra = options.keepalive ? { keepalive: true } : {};
  return fetchJson(`/api/v1/voucher/${encodeURIComponent(id)}/events`, {
    method: 'POST',
    body: JSON.stringify({ event, meta }),
    ...extra,
  });
}

export function subscribePush(subscription) {
  return fetchJson('/api/client/push-subscription', {
    method: 'POST',
    body: JSON.stringify({ subscription }),
  });
}

export async function registerPush(registration) {
  if (!('PushManager' in window)) return null;

  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    const stored = await subscribePush(existing.toJSON());
    return stored?.offline ? { subscription: existing, offline: true, message: stored.message } : existing;
  }

  const vapidPublicKey = window.__WALLET_PUSH_PUBLIC_KEY__ || null;
  if (!vapidPublicKey) {
    console.warn('VAPID public key is not configured');
    return null;
  }

  const padded = vapidPublicKey.replace(/-/g, '+').replace(/_/g, '/');
  const base64 = padded + '='.repeat((4 - (padded.length % 4)) % 4);
  const convertedKey = Uint8Array.from(window.atob(base64), (c) => c.charCodeAt(0));
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedKey,
  });

  const stored = await subscribePush(subscription.toJSON());
  if (stored?.offline) {
    return { subscription, offline: true, message: stored.message };
  }
  return subscription;
}

export function claimVoucher(payload) {
  return fetchJson('/api/client/voucher/claim', {
    method: 'POST',
    body: JSON.stringify({ payload }),
  });
}

export { OFFLINE_QUEUE_EVENT };
