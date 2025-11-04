const CACHE_VERSION = 'v20250128';
const SHELL_CACHE = `wallet-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `wallet-runtime-${CACHE_VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, RUNTIME_CACHE];
const QUEUE_DB = 'wallet-sw';
const QUEUE_DB_VERSION = 2;
const QUEUE_STORE = 'pending';
const MAX_QUEUE_RETRY = 5;
const BACKOFF_BASE_MS = 30 * 1000;

const OFFLINE_URL = '/offline.html';
const OFFLINE_API_MESSAGE = 'Требуется подключение к интернету.';

const PRECACHE_URLS = [
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
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(PRECACHE_URLS);
    } catch (error) {
      console.warn('Precache failed', error);
    } finally {
      await self.skipWaiting();
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => !CURRENT_CACHES.includes(name))
        .map((name) => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const type = event.data?.type;
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (type === 'NETWORK_ONLINE' || type === 'FLUSH_QUEUE') {
    event.waitUntil(flushQueue());
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
  let body = null;
  let bodyType = null;
  if (!['GET', 'HEAD'].includes(request.method)) {
    try {
      body = await request.clone().arrayBuffer();
      bodyType = 'arrayBuffer';
    } catch (error) {
      try {
        body = await request.clone().text();
        bodyType = 'text';
      } catch (fallbackError) {
        console.warn('Failed to clone request body for queue', fallbackError);
        body = null;
        bodyType = null;
      }
    }
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const record = {
      url: request.url,
      method: request.method,
      headers: Array.from(request.headers.entries()),
      body,
      bodyType,
      timestamp: Date.now(),
      retryCount: 0,
      nextRetryAt: Date.now(),
    };
    store.add(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

let flushQueueInProgress = false;
let syncTimeoutId = null;

async function readQueuedRequests(db) {
  const tx = db.transaction(QUEUE_STORE, 'readonly');
  const store = tx.objectStore(QUEUE_STORE);
  return new Promise((resolve, reject) => {
    const entries = [];
    const req = store.openCursor();
    req.onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor) {
        resolve(entries);
        return;
      }
      entries.push({ key: cursor.primaryKey, value: cursor.value });
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

function deleteQueuedRequest(db, key) {
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  const store = tx.objectStore(QUEUE_STORE);
  store.delete(key);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function updateQueuedRequest(db, key, record) {
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  const store = tx.objectStore(QUEUE_STORE);
  store.put(record, key);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function broadcastQueueEvent(payload) {
  const clientList = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clientList) {
    try {
      client.postMessage({ type: 'WALLET_QUEUE_EVENT', payload });
    } catch (error) {
      console.warn('Failed to postMessage to client', error);
    }
  }
}

async function sendQueuedRequest(record) {
  const headers = new Headers(record.headers || []);
  const init = {
    method: record.method,
    headers,
    credentials: 'same-origin',
  };
  if (!['GET', 'HEAD'].includes(record.method) && record.body) {
    if (record.bodyType === 'text') {
      init.body = record.body;
    } else {
      init.body = record.body;
    }
  }
  const response = await fetch(record.url, init);
  if (!response.ok && response.status >= 500) {
    throw new Error(`Server responded with ${response.status}`);
  }
  return response;
}

async function flushQueue() {
  if (flushQueueInProgress) {
    return;
  }
  if (syncTimeoutId) {
    clearTimeout(syncTimeoutId);
    syncTimeoutId = null;
  }
  flushQueueInProgress = true;
  try {
    const db = await openQueueDb();
    const entries = await readQueuedRequests(db);
    let hasPendingRetry = false;

    for (const entry of entries) {
      const record = entry.value;
      if (!record) {
        continue;
      }
      const retryCount = record.retryCount || 0;
      const nextRetryAt = record.nextRetryAt || 0;
      if (nextRetryAt > Date.now()) {
        hasPendingRetry = true;
        continue;
      }
      try {
        await sendQueuedRequest(record);
        await deleteQueuedRequest(db, entry.key);
        await broadcastQueueEvent({ status: 'sent', url: record.url });
      } catch (error) {
        const newRetryCount = retryCount + 1;
        if (newRetryCount >= MAX_QUEUE_RETRY) {
          await deleteQueuedRequest(db, entry.key);
          console.warn('Dropping queued request after max retries', record.url, error);
          await broadcastQueueEvent({ status: 'dropped', url: record.url, error: error?.message });
        } else {
          const backoff = Math.pow(2, newRetryCount - 1) * BACKOFF_BASE_MS;
          record.retryCount = newRetryCount;
          record.nextRetryAt = Date.now() + backoff;
          await updateQueuedRequest(db, entry.key, record);
          hasPendingRetry = true;
        }
      }
    }
    if (hasPendingRetry) {
      await scheduleSync();
    } else if (entries.length) {
      await broadcastQueueEvent({ status: 'idle' });
    }
  } finally {
    flushQueueInProgress = false;
  }
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

function offlineJsonResponse(message = OFFLINE_API_MESSAGE) {
  return new Response(
    JSON.stringify({ ok: false, offline: true, message }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }
  );
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

async function networkFirstJson(request) {
  try {
    const response = await fetch(request);
    try {
      await cacheResponse(request, response.clone());
    } catch (error) {
      console.warn('networkFirstJson cache error', error);
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return offlineJsonResponse();
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
    event.respondWith(networkFirstJson(request));
    return;
  }

  if (request.method === 'GET' && PRECACHE_URLS.some((url) => request.url.endsWith(url))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.destination === 'document') {
    event.respondWith(networkFirst(request, OFFLINE_URL));
    return;
  }
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
  if (self.registration.sync) {
    try {
      await self.registration.sync.register('wallet-sync');
      return;
    } catch (error) {
      console.warn('Failed to register background sync', error);
    }
  }
  if (!syncTimeoutId) {
    syncTimeoutId = setTimeout(() => {
      syncTimeoutId = null;
      flushQueue().catch((error) => {
        console.warn('Fallback queue flush failed', error);
      });
    }, BACKOFF_BASE_MS);
  }
}
