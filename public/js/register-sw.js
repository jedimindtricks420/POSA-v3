import { monitorServiceWorkerUpdates } from './sw-update.js';

const HEARTBEAT_INTERVAL_MS = 30 * 1000;

let updatesMonitoringStarted = false;
let networkListenerAttached = false;
let queueHeartbeatId = null;

function ensureUpdateMonitoring() {
  if (updatesMonitoringStarted) {
    return;
  }
  updatesMonitoringStarted = true;
  monitorServiceWorkerUpdates();
}

function postMessageToActive(message) {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message);
    return;
  }
  navigator.serviceWorker.ready
    .then((registration) => {
      registration.active?.postMessage(message);
    })
    .catch(() => {});
}

function ensureNetworkListeners() {
  if (networkListenerAttached) {
    return;
  }
  networkListenerAttached = true;

  window.addEventListener('online', () => {
    postMessageToActive({ type: 'NETWORK_ONLINE' });
  });

  if (!('SyncManager' in window)) {
    queueHeartbeatId = window.setInterval(() => {
      if (navigator.onLine) {
        postMessageToActive({ type: 'FLUSH_QUEUE' });
      }
    }, HEARTBEAT_INTERVAL_MS);
  }
}

export async function registerServiceWorker() {
  if (typeof window === 'undefined') {
    return null;
  }
  if (!('serviceWorker' in navigator)) {
    return null;
  }
  if (window.__APP_ROLE__ !== 'Client') {
    return null;
  }

  ensureUpdateMonitoring();

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');

    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });

    ensureNetworkListeners();
    if (navigator.onLine) {
      postMessageToActive({ type: 'NETWORK_ONLINE' });
    }
    navigator.serviceWorker.ready.then(() => ensureNetworkListeners()).catch(() => {});

    return registration;
  } catch (error) {
    console.error('Service worker registration failed', error);
    if (queueHeartbeatId) {
      clearInterval(queueHeartbeatId);
      queueHeartbeatId = null;
    }
    return null;
  }
}
