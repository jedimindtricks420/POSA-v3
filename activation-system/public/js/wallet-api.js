async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.error || 'Request failed');
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return response.json();
}

export function getVouchers() {
  return fetchJson('/api/client/vouchers');
}

export function getVoucher(id) {
  return fetchJson(`/api/client/voucher/${id}`);
}

export function logVoucherEvent(id, event, meta = {}) {
  return fetchJson(`/api/client/voucher/${id}/log`, {
    method: 'POST',
    body: JSON.stringify({ event, meta }),
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
    await subscribePush(existing.toJSON());
    return existing;
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

  await subscribePush(subscription.toJSON());
  return subscription;
}
