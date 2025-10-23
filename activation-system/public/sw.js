const SHELL_CACHE = 'wallet-shell-v4';
const RUNTIME_CACHE = 'wallet-runtime-v4';
const QUEUE_DB = 'wallet-sw';
const QUEUE_STORE = 'pending';

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
  '/manifest.json',
  '/images/icon-192.png',
  '/images/icon-512.png',
  OFFLINE_URL
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
    const request = indexedDB.open(QUEUE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function queueRequest(request) {
  const db = await openQueueDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    request.clone().text().then((body) => {
      const record = {
        url: request.url,
        method: request.method,
        headers: Array.from(request.headers.entries()),
        body,
        timestamp: Date.now(),
      };
      store.add(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

async function flushQueue() {
  const db = await openQueueDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const requests = [];
    store.openCursor().onsuccess = async (event) => {
      const cursor = event.target.result;
      if (cursor) {
        requests.push({ key: cursor.key, value: cursor.value });
        cursor.continue();
      } else {
        for (const item of requests) {
          try {
            await fetch(item.value.url, {
              method: item.value.method,
              headers: item.value.headers,
              body: item.value.method === 'GET' ? undefined : item.value.body,
              credentials: 'same-origin',
            });
            store.delete(item.key);
          } catch (error) {
            console.warn('Failed to replay request', error);
          }
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

  if (request.method === 'POST' && request.url.includes('/api/client/')) {
    event.respondWith(
      fetch(request.clone()).catch(() =>
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
