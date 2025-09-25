export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.info('Service worker controller changed, new version active');
    });
    return registration;
  } catch (error) {
    console.error('Service worker registration failed', error);
    return null;
  }
}
