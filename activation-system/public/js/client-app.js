import { registerServiceWorker } from './register-sw.js';
import walletOfflineStore from './wallet-offline-store.js';
import { getVouchers, getVoucher, logVoucherEvent, registerPush } from './wallet-api.js';

const state = {
  vouchers: [],
  detailsCache: new Map(),
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

  selectors.metricActive.textContent = active;
  selectors.metricPending.textContent = pending;
  selectors.metricUsed.textContent = used;
}

function createCard(voucher) {
  const template = document.createElement('template');
  template.innerHTML = `
    <article class="wallet-card w-full" data-voucher-id="${voucher.id}">
      <div class="wallet-card__body">
        <div class="flex items-start justify-between">
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-widest text-white/70">${voucher.productName}</p>
            <h2 class="text-2xl font-semibold text-white">${voucher.displayValue}</h2>
          </div>
          <span class="badge bg-white/20 text-white">
            <span class="inline-flex h-2 w-2 rounded-full ${voucher.statusColor}"></span>
            ${voucher.statusLabel}
          </span>
        </div>
        <div class="mt-10 flex items-center justify-between text-sm">
          <div>
            <p class="text-white/60">Получен</p>
            <p class="font-medium">${voucher.assignedAt}</p>
          </div>
          <button class="wallet-card__show inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur" data-voucher-id="${voucher.id}">
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
  if (selectors.skeleton) {
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
      }
    }
  } finally {
    if (selectors.skeleton) selectors.skeleton.classList.add('hidden');
  }
}

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
  selectors.modalValue.textContent = detail.displayValue;
  selectors.modalStatus.innerHTML = `<span class="inline-flex h-2 w-2 rounded-full mr-2 ${detail.statusColor}"></span>${detail.statusLabel}`;
  selectors.modalQr.innerHTML = `<img src="${detail.qrDataUrl}" alt="QR код" class="mx-auto h-56 w-56" />`;
  selectors.modalBarcode.innerHTML = detail.barcodeDataUrl
    ? `<img src="${detail.barcodeDataUrl}" alt="Штрихкод" class="max-h-20" />`
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
    registerPush(registration).catch((error) => console.warn('Push registration failed', error));
  }
}

bootstrap();
