const CACHE_VERSION = 'v20250126';
const SHELL_CACHE = `wallet-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `wallet-runtime-${CACHE_VERSION}`;
const QUEUE_DB = 'wallet-sw';
const QUEUE_DB_VERSION = 2;
const QUEUE_STORE = 'pending';
const MAX_QUEUE_RETRY = 5;
const BACKOFF_BASE_MS = 30 * 1000;

const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
  '/wallet',
  '/client-register',
  '/css/client.css',
  '/js/client-app.js',
  '/js/client-profile.js',
  '/js/client-scan.js',
  '/js/client-auth.js',
  '/js/wallet-api.js',
  '/js/wallet-offline-store.js',
  '/js/register-sw.js',
  '/js/sw-update.js',
  '/vendor/zxing-library/index.min.js',
  '/vendor/zxing/browser/umd/zxing-browser.min.js',
  '/vendor/jsqr/jsQR.js',
  '/manifest.json',
  '/images/icon-192.png',
  '/images/icon-512.png',
  OFFLINE_URL,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== SHELL_CACHE && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function openQueueDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(QUEUE_DB, QUEUE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { autoIncrement: true });
      } else if (request.oldVersion < 2) {
        // v2: ensure existing records get retry metadata on the fly
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function queueRequest(request) {
  const db = await openQueueDb();
  const body = request.method === 'GET' ? null : await request.clone().text();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const record = {
      url: request.url,
      method: request.method,
      headers: Array.from(request.headers.entries()),
      body,
      timestamp: Date.now(),
      retryCount: 0,
      nextRetryAt: Date.now(),
    };
    store.add(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function flushQueue() {
  const db = await openQueueDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const requests = [];
    let hasPendingRetry = false;
    store.openCursor().onsuccess = async (event) => {
      const cursor = event.target.result;
      if (cursor) {
        requests.push({ key: cursor.key, value: cursor.value });
        cursor.continue();
      } else {
        for (const item of requests) {
          const record = item.value || {};
          const retryCount = record.retryCount || 0;
          const nextRetryAt = record.nextRetryAt || 0;
          if (nextRetryAt > Date.now()) {
            hasPendingRetry = true;
            continue;
          }
          try {
            await fetch(record.url, {
              method: record.method,
              headers: record.headers,
              body: record.method === 'GET' ? undefined : record.body,
              credentials: 'same-origin',
            });
            store.delete(item.key);
          } catch (error) {
            const newRetryCount = retryCount + 1;
            if (newRetryCount >= MAX_QUEUE_RETRY) {
              store.delete(item.key);
              console.warn('Dropping queued request after max retries', record.url);
            } else {
              const backoff = Math.pow(2, newRetryCount - 1) * BACKOFF_BASE_MS;
              record.retryCount = newRetryCount;
              record.nextRetryAt = Date.now() + backoff;
              store.put(record, item.key);
              hasPendingRetry = true;
            }
          }
        }
        if (hasPendingRetry) {
          await scheduleSync();
        }
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'wallet-sync') {
    event.waitUntil(flushQueue());
  }
});

async function cacheResponse(request, response) {
  if (request.method !== 'GET') {
    return;
  }
  if (!response || !response.ok) {
    return;
  }
  if (response.type !== 'basic') {
    return;
  }
  const cache = await caches.open(RUNTIME_CACHE);
  await cache.put(request, response);
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    const clone = response.clone();
    try {
      await cacheResponse(request, clone);
    } catch (error) {
      console.warn('networkFirst cache error', error);
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) {
        return fallback;
      }
    }
    return new Response('Offline', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) {
      return cached;
    }
    return fetch(request).catch(async () => {
      if (request.destination === 'document') {
        const fallback = await caches.match(OFFLINE_URL);
        if (fallback) {
          return fallback;
        }
      }
      return new Response('Offline', {
        status: 503,
        statusText: 'Offline',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    });
  });
}

function staleWhileRevalidate(request) {
  return caches.match(request).then((cached) => {
    const fetchPromise = fetch(request)
      .then(async (response) => {
        const clone = response.clone();
        try {
          await cacheResponse(request, clone);
        } catch (error) {
          console.warn('staleWhileRevalidate cache error', error);
        }
        return response;
      })
      .catch(() => cached);
    return cached || fetchPromise;
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method === 'POST' && request.url.includes('/api/client/')) {
    event.respondWith(handleClientApiPost(request));
    return;
  }

  if (request.method === 'GET' && request.url.includes('/api/client/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ ok: false, offline: true, message: 'Требуется подключение к интернету.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        })
      )
    );
    return;
  }

  if (request.method === 'GET' && PRECACHE_URLS.some((url) => request.url.endsWith(url))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.destination === 'document') {
    event.respondWith(networkFirst(request, OFFLINE_URL));
  }
});

self.addEventListener('online', () => {
  flushQueue();
});

async function handleClientApiPost(request) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await queueRequest(request);
    await scheduleSync();
    return offlineQueuedResponse();
  }
  try {
    return await fetch(request.clone());
  } catch (error) {
    await queueRequest(request);
    await scheduleSync();
    return offlineQueuedResponse();
  }
}

function offlineQueuedResponse() {
  return new Response(
    JSON.stringify({
      ok: false,
      offline: true,
      message: 'Запрос сохранён и будет выполнен при восстановлении подключения.',
    }),
    {
      status: 202,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }
  );
}

async function scheduleSync() {
  if (!self.registration.sync) {
    return;
  }
  try {
    await self.registration.sync.register('wallet-sync');
  } catch (error) {
    console.warn('Failed to register background sync', error);
  }
}
