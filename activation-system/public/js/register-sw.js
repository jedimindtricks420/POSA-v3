import { monitorServiceWorkerUpdates } from './sw-update.js';

monitorServiceWorkerUpdates();

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

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
    return registration;
  } catch (error) {
    console.error('Service worker registration failed', error);
    return null;
  }
}
