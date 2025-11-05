import { registerServiceWorker } from './register-sw.js';
import walletOfflineStore from './wallet-offline-store.js';
import { getVouchers, getVoucher, logVoucherEvent, registerPush, OFFLINE_QUEUE_EVENT } from './wallet-api.js';

const state = {
  vouchers: [],
  detailsCache: new Map(),
  hasRendered: false,
};

const selectors = {
  skeleton: document.getElementById('walletSkeleton'),
  list: document.getElementById('walletList'),
  empty: document.getElementById('walletEmpty'),
  refreshBtn: document.getElementById('walletRefresh'),
  metricActive: document.getElementById('walletMetricActive'),
  metricPending: document.getElementById('walletMetricPending'),
  metricUsed: document.getElementById('walletMetricUsed'),
  themeToggle: document.getElementById('walletThemeToggle'),
  themeToggleSun: document.getElementById('walletThemeToggleSun'),
  themeToggleMoon: document.getElementById('walletThemeToggleMoon'),
  modal: document.getElementById('voucherModal'),
  modalClose: document.getElementById('voucherModalClose'),
  modalCloseBottom: document.getElementById('voucherModalCloseBottom'),
  modalProduct: document.getElementById('voucherModalProduct'),
  modalValue: document.getElementById('voucherModalValue'),
  modalStatus: document.getElementById('voucherModalStatus'),
  modalQr: document.getElementById('voucherModalQr'),
  modalBarcode: document.getElementById('voucherModalBarcode'),
  modalTerms: document.getElementById('voucherModalTerms'),
  modalAddApple: document.getElementById('voucherModalAddApple'),
  modalAddGoogle: document.getElementById('voucherModalAddGoogle'),
  modalCopy: document.getElementById('voucherModalCopy'),
  modalShare: document.getElementById('voucherModalShare'),
  modalSync: document.getElementById('voucherModalSyncInfo'),
};

const OFFLINE_QUEUE_FALLBACK_MESSAGE = 'Действие будет завершено после восстановления подключения.';
let offlineToastTimer = null;

function showOfflineQueueToast(message) {
  if (typeof document === 'undefined') {
    return;
  }
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

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const { type, payload } = event.data || {};
    if (type !== 'WALLET_QUEUE_EVENT') {
      return;
    }
    if (payload?.status === 'dropped') {
      showOfflineQueueToast('Не удалось отправить запрос. Проверьте подключение и повторите действие.');
    } else if (payload?.status === 'sent') {
      showOfflineQueueToast('Действие выполнено после восстановления подключения.');
    }
  });
}
function setTheme(mode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effective = mode || (prefersDark ? 'dark' : 'light');
  document.body.classList.toggle('dark-mode', effective === 'dark');
  if (selectors.themeToggleSun) {
    selectors.themeToggleSun.classList.toggle('hidden', effective === 'dark');
  }
  if (selectors.themeToggleMoon) {
    selectors.themeToggleMoon.classList.toggle('hidden', effective !== 'dark');
  }
  localStorage.setItem('wallet-theme', effective);
}

function hydrateTheme() {
  const saved = localStorage.getItem('wallet-theme');
  setTheme(saved);
  if (selectors.themeToggle) {
    selectors.themeToggle.addEventListener('click', () => {
      const current = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
  }
}

function renderMetrics(vouchers) {
  const active = vouchers.filter((v) => v.status === 'active').length;
  const pending = vouchers.filter((v) => v.status === 'pending' || v.status === 'sold').length;
  const used = vouchers.filter((v) => v.status === 'activated' || v.status === 'used' || v.status === 'deleted').length;

  if (selectors.metricActive) selectors.metricActive.textContent = active;
  if (selectors.metricPending) selectors.metricPending.textContent = pending;
  if (selectors.metricUsed) selectors.metricUsed.textContent = used;
}

function cardThemeClass(voucher) {
  // Simple deterministic theming based on id
  const themes = ['wallet-card--blue', 'wallet-card--pink', 'wallet-card--dark'];
  const idx = Math.abs(Number(voucher.id || 0)) % themes.length;
  return themes[idx];
}

function createCard(voucher) {
  const template = document.createElement('template');
  const theme = cardThemeClass(voucher);
  template.innerHTML = `
    <article class="wallet-card w-full ${theme}" data-voucher-id="${voucher.id}">
      <div class="wallet-card__body">
        <div class="flex items-start">
          <h2 class="text-2xl font-semibold text-white">${voucher.productName}</h2>
        </div>
        <div class="mt-10 flex items-center justify-between text-sm">
          <div>
            <p class="text-white/60">Получен</p>
            <p class="font-medium">${voucher.assignedAt}</p>
          </div>
          <button class="wallet-card__show inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold" data-voucher-id="${voucher.id}">
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8.25-3c-1.5-3.5-4.75-6-8.25-6s-6.75 2.5-8.25 6c1.5 3.5 4.75 6 8.25 6s6.75-2.5 8.25-6Z" />
            </svg>
            Показать
          </button>
        </div>
      </div>
    </article>
  `.trim();
  return template.content.firstElementChild;
}

function renderVouchers(vouchers) {
  if (selectors.skeleton) {
    selectors.skeleton.classList.add('hidden');
  }
  state.vouchers = vouchers;
  state.hasRendered = true;

  if (!vouchers.length) {
    if (selectors.empty) selectors.empty.classList.remove('hidden');
    if (selectors.list) selectors.list.classList.add('hidden');
    return;
  }

  if (selectors.empty) selectors.empty.classList.add('hidden');

  if (selectors.list) {
    selectors.list.innerHTML = '';
    vouchers.forEach((voucher) => {
      selectors.list.append(createCard(voucher));
    });
    selectors.list.classList.remove('hidden');
  }

  renderMetrics(vouchers);
}

async function loadFromCache() {
  const cached = await walletOfflineStore.loadVouchers();
  if (cached?.vouchers) {
    renderVouchers(cached.vouchers);
    renderMetrics(cached.vouchers);
  }
}

async function fetchAndRender() {
  if (fetchAndRender.pending) {
    return;
  }
  fetchAndRender.pending = true;
  const shouldShowSkeleton = selectors.skeleton && !state.hasRendered;
  if (shouldShowSkeleton) {
    selectors.skeleton.classList.remove('hidden');
  }
  try {
    const data = await getVouchers();
    renderVouchers(data.vouchers);
    await walletOfflineStore.saveVouchers({ vouchers: data.vouchers });
    await walletOfflineStore.saveSyncInfo({ syncedAt: data.syncedAt });
  } catch (error) {
    console.error('Failed to fetch vouchers', error);
    if (!state.vouchers.length) {
      const cached = await walletOfflineStore.loadVouchers();
      if (cached?.vouchers) {
        renderVouchers(cached.vouchers);
      } else {
        if (selectors.empty) selectors.empty.classList.remove('hidden');
        state.hasRendered = true;
      }
    }
  } finally {
    if (selectors.skeleton) selectors.skeleton.classList.add('hidden');
    fetchAndRender.pending = false;
  }
}
fetchAndRender.pending = false;

function openModal() {
  selectors.modal.classList.remove('hidden');
  selectors.modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  selectors.modal.classList.add('hidden');
  selectors.modal.classList.remove('flex');
  document.body.style.overflow = '';
}

function bindModalControls() {
  if (!selectors.modal || !selectors.modalClose) {
    return;
  }
  selectors.modal.addEventListener('click', (event) => {
    if (event.target === selectors.modal) {
      closeModal();
    }
  });
  selectors.modalClose.addEventListener('click', closeModal);
  if (selectors.modalCloseBottom) {
    selectors.modalCloseBottom.addEventListener('click', closeModal);
  }
}

function populateModal(detail) {
  selectors.modalProduct.textContent = detail.productName;
  // Show full voucher code (no dots)
  selectors.modalValue.textContent = detail.value || detail.displayValue;
  selectors.modalStatus.innerHTML = `<span class="inline-flex h-2 w-2 rounded-full mr-2 ${detail.statusColor}"></span>${detail.statusLabel}`;
  // Force dark text for status label
  selectors.modalStatus.classList.add('text-slate-900');
  selectors.modalStatus.classList.add('dark:text-slate-900');
  selectors.modalQr.innerHTML = `<img src="${detail.qrDataUrl}" alt="QR код" class="mx-auto w-full max-w-[224px] h-auto" />`;
  selectors.modalBarcode.innerHTML = detail.barcodeDataUrl
    ? `<img src="${detail.barcodeDataUrl}" alt="Штрихкод" class="max-h-20 w-full max-w-full object-contain" />`
    : '<p class="text-xs text-slate-400">Не удалось сформировать штрихкод</p>';
  selectors.modalTerms.textContent = detail.terms;
  selectors.modalSync.textContent = `Синхронизировано: ${new Date(detail.lastSyncAt).toLocaleString('ru-RU')}`;
  selectors.modalAddApple.onclick = () => {
    logVoucherEvent(detail.id, 'voucher.add_to_wallet', { device: 'ios' }).catch(() => {});
    window.location.href = `/wallet/pass/${detail.id}`;
  };
  selectors.modalAddGoogle.onclick = () => {
    logVoucherEvent(detail.id, 'voucher.add_to_wallet', { device: 'android' }).catch(() => {});
    window.location.href = `/wallet/google/${detail.id}`;
  };
  selectors.modalCopy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(detail.value);
      logVoucherEvent(detail.id, 'voucher.share').catch(() => {});
    } catch (error) {
      console.error('Clipboard copy failed', error);
    }
  };
  selectors.modalShare.onclick = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Мой ваучер',
          text: `Ваучер ${detail.productName}`,
          url: window.location.href,
        });
        logVoucherEvent(detail.id, 'voucher.share').catch(() => {});
      } else {
        await navigator.clipboard.writeText(detail.value);
      }
    } catch (error) {
      console.warn('Share unsupported', error);
    }
  };
}

function bindAutoRefresh() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      fetchAndRender();
    }
  });
  window.addEventListener('focus', () => fetchAndRender());
  window.addEventListener('storage', (event) => {
    if (event.key === 'wallet-sync-trigger') {
      fetchAndRender();
    }
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      fetchAndRender();
    }
  }, 15000);
}

async function handleCardClick(event) {
  const trigger = event.target.closest('.wallet-card__show');
  if (!trigger) return;
  const voucherId = Number(trigger.dataset.voucherId);
  if (!voucherId) return;

  try {
    let detail = state.detailsCache.get(voucherId);
    if (!detail) {
      try {
        detail = await getVoucher(voucherId);
        state.detailsCache.set(voucherId, detail);
        await walletOfflineStore.save(`voucher-${voucherId}`, detail);
      } catch (networkError) {
        detail = await walletOfflineStore.load(`voucher-${voucherId}`);
        if (!detail) throw networkError;
        state.detailsCache.set(voucherId, detail);
      }
    }
    populateModal(detail);
    openModal();
    logVoucherEvent(voucherId, 'voucher.view').catch(() => {});
  } catch (error) {
    console.error('Failed to load voucher detail', error);
    alert('Не удалось загрузить данные ваучера. Попробуйте снова.');
  }
}

async function bootstrap() {
  hydrateTheme();
  bindModalControls();
  bindAutoRefresh();

  const bootstrapData = window.__WALLET_BOOTSTRAP__ || { vouchers: [] };
  if (bootstrapData.vouchers?.length) {
    renderVouchers(bootstrapData.vouchers);
    walletOfflineStore.saveVouchers({ vouchers: bootstrapData.vouchers }).catch(() => {});
  } else {
    await loadFromCache();
  }

  fetchAndRender();

  if (selectors.list) {
    selectors.list.addEventListener('click', handleCardClick);
  }

  if (selectors.refreshBtn) {
    selectors.refreshBtn.addEventListener('click', () => fetchAndRender());
  }

  const registration = await registerServiceWorker();
  if (registration) {
    try {
      await registerPush(registration);
    } catch (error) {
      console.warn('Push registration failed', error);
    }
  }
}

bootstrap();
