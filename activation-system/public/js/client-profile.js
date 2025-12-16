import { registerServiceWorker } from './register-sw.js';
import walletOfflineStore from './wallet-offline-store.js';
import { registerPush, OFFLINE_QUEUE_EVENT } from './wallet-api.js';

const pushToggle = document.getElementById('profilePushToggle');
const themeToggle = document.getElementById('profileThemeToggle');
const clearCacheBtn = document.getElementById('profileClearCache');
const topThemeToggle = document.getElementById('walletThemeToggle');
const themeSun = document.getElementById('walletThemeToggleSun');
const themeMoon = document.getElementById('walletThemeToggleMoon');
const OFFLINE_QUEUE_FALLBACK_MESSAGE = 'Действие выполнится после восстановления подключения.';
let offlineToastTimer = null;

function showOfflineQueueToast(message) {
  if (typeof document === 'undefined') return;
  const text = message || OFFLINE_QUEUE_FALLBACK_MESSAGE;
  let toast = document.getElementById('walletOfflineQueueToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'walletOfflineQueueToast';
    toast.style.position = 'fixed';
    toast.style.left = '50%';
    toast.style.bottom = '24px';
    toast.style.transform = 'translateX(-50%)';
    toast.style.maxWidth = '90%';
    toast.style.padding = '12px 18px';
    toast.style.borderRadius = '9999px';
    toast.style.background = 'rgba(15, 118, 110, 0.9)';
    toast.style.color = '#fff';
    toast.style.fontSize = '14px';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = '0 10px 30px rgba(15, 118, 110, 0.25)';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.2s ease';
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.style.opacity = '1';
  clearTimeout(offlineToastTimer);
  offlineToastTimer = setTimeout(() => {
    toast.style.opacity = '0';
  }, 3500);
}

window.addEventListener(OFFLINE_QUEUE_EVENT, (event) => {
  const detailMessage = event.detail?.payload?.message;
  showOfflineQueueToast(detailMessage);
});

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
  const isDark = saved === 'dark';
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

async function initDeleteAccount() {
  console.log('[Delete Account] Initializing...');

  const deleteBtn = document.getElementById('deleteAccountBtn');
  const deleteModal = document.getElementById('deleteModal');
  const cancelBtn = document.getElementById('cancelDelete');
  const confirmBtn = document.getElementById('confirmDelete');

  console.log('[Delete Account] Elements check:', {
    deleteBtn: !!deleteBtn,
    deleteModal: !!deleteModal,
    cancelBtn: !!cancelBtn,
    confirmBtn: !!confirmBtn
  });

  if (!deleteBtn || !deleteModal || !cancelBtn || !confirmBtn) {
    console.error('[Delete Account] Missing elements, aborting initialization');
    return;
  }

  console.log('[Delete Account] All elements found, adding event listeners');

  // Открыть модальное окно
  deleteBtn.addEventListener('click', () => {
    console.log('[Delete Account] Delete button clicked, opening modal');
    deleteModal.classList.remove('hidden');
    deleteModal.classList.add('flex');
    console.log('[Delete Account] Modal classes:', deleteModal.className);
  });

  // Закрыть модальное окно
  cancelBtn.addEventListener('click', () => {
    console.log('[Delete Account] Cancel button clicked, closing modal');
    deleteModal.classList.add('hidden');
    deleteModal.classList.remove('flex');
  });

  // Подтвердить удаление
  confirmBtn.addEventListener('click', async () => {
    console.log('[Delete Account] Confirm button clicked, starting deletion');
    try {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Удаление...';

      const response = await fetch('/client/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      console.log('[Delete Account] Server response:', result);

      if (result.ok) {
        alert('Ваш аккаунт успешно удален');
        window.location.href = '/wallet';
      } else {
        alert('Ошибка при удалении аккаунта: ' + (result.message || 'Попробуйте позже'));
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Удалить';
      }
    } catch (error) {
      console.error('[Delete Account] Error:', error);
      alert('Ошибка при удалении аккаунта. Попробуйте позже.');
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Удалить';
    }
  });

  console.log('[Delete Account] Initialization complete');
}

async function bootstrap() {
  await initTheme();
  await initClearCache();
  await initDeleteAccount();
  const registration = await registerServiceWorker();
  if (registration) {
    await initPush(registration);
  }
}

bootstrap();
