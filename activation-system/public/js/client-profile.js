import { registerServiceWorker } from './register-sw.js';
import walletOfflineStore from './wallet-offline-store.js';
import { registerPush } from './wallet-api.js';

const pushToggle = document.getElementById('profilePushToggle');
const themeToggle = document.getElementById('profileThemeToggle');
const clearCacheBtn = document.getElementById('profileClearCache');
const topThemeToggle = document.getElementById('walletThemeToggle');
const themeSun = document.getElementById('walletThemeToggleSun');
const themeMoon = document.getElementById('walletThemeToggleMoon');

function updateThemeIcon(isDark) {
  if (themeSun && themeMoon) {
    themeSun.classList.toggle('hidden', isDark);
    themeMoon.classList.toggle('hidden', !isDark);
  }
}

function setThemeToggle(state) {
  document.body.classList.toggle('dark-mode', state);
  localStorage.setItem('wallet-theme', state ? 'dark' : 'light');
  if (themeToggle) {
    themeToggle.checked = state;
  }
  updateThemeIcon(state);
}

async function initTheme() {
  if (!themeToggle && !topThemeToggle) return;
  const saved = localStorage.getItem('wallet-theme');
  const isDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  setThemeToggle(isDark);

  if (themeToggle) {
    themeToggle.addEventListener('change', () => setThemeToggle(themeToggle.checked));
  }

  if (topThemeToggle) {
    topThemeToggle.addEventListener('click', () => {
      const next = !document.body.classList.contains('dark-mode');
      setThemeToggle(next);
    });
  }
}

async function initPush(registration) {
  if (!pushToggle) return;
  const stored = localStorage.getItem('wallet-push-enabled') === 'true';
  pushToggle.checked = stored;

  pushToggle.addEventListener('change', async () => {
    if (pushToggle.checked) {
      try {
        await registerPush(registration);
        localStorage.setItem('wallet-push-enabled', 'true');
      } catch (error) {
        console.error('Push subscription error', error);
        pushToggle.checked = false;
      }
    } else {
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
      }
      localStorage.setItem('wallet-push-enabled', 'false');
    }
  });
}

async function initClearCache() {
  if (!clearCacheBtn) return;
  clearCacheBtn.addEventListener('click', async () => {
    await walletOfflineStore.saveVouchers({ vouchers: [] });
    await walletOfflineStore.clear('syncInfo');
    await walletOfflineStore.clearScanHistory();
    alert('Локальный кеш PWA очищен');
  });
}

async function bootstrap() {
  await initTheme();
  await initClearCache();
  const registration = await registerServiceWorker();
  if (registration) {
    await initPush(registration);
  }
}

bootstrap();
