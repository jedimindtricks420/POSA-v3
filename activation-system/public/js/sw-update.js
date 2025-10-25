const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

function requestSkipWaiting(registration) {
  if (registration && registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

function listenForControllerChange() {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

function schedulePeriodicCheck() {
  setInterval(async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
      }
    } catch (error) {
      console.warn('Service worker update check failed', error);
    }
  }, UPDATE_CHECK_INTERVAL);
}

export function monitorServiceWorkerUpdates() {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  listenForControllerChange();
  schedulePeriodicCheck();
  navigator.serviceWorker.getRegistration().then((registration) => {
    if (!registration) return;
    if (registration.waiting) {
      requestSkipWaiting(registration);
    }
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          requestSkipWaiting(registration);
        }
      });
    });
  });
}
