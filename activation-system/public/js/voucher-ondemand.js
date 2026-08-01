import { requestVoucherCode, getVoucherCodeStatus, logVoucherEvent } from './wallet-api.js';

const modal = document.getElementById('voucherOndemandModal');
if (modal) {
  const closeBtn = document.getElementById('odModalClose');
  const partnerRow = document.getElementById('odPartnerRow');
  const partnerLogo = document.getElementById('odPartnerLogo');
  const partnerName = document.getElementById('odPartnerName');
  const productImage = document.getElementById('odProductImage');
  const productName = document.getElementById('odProductName');
  const vendorName = document.getElementById('odVendorName');
  const statusDot = document.getElementById('odStatusDot');
  const statusLabel = document.getElementById('odStatusLabel');
  const stage = document.getElementById('odStage');

  let current = null;
  let pollTimer = null;

  const STATUS_META = {
    idle: { label: 'Ожидает получения', color: '#f59e0b' },
    pending: { label: 'Готовим код', color: '#fbbf24' },
    ready: { label: 'Код получен', color: '#10b981' },
    error: { label: 'Ошибка получения', color: '#fb7185' },
  };

  function setStatus(status) {
    const meta = STATUS_META[status] || STATUS_META.idle;
    statusLabel.textContent = meta.label;
    statusDot.style.background = meta.color;
  }

  function stopPolling() {
    clearTimeout(pollTimer);
    pollTimer = null;
  }

  function openModal() {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    stopPolling();
  }

  closeBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  function renderIdle() {
    setStatus('idle');
    // Текст этого шага теперь целиком берётся из настроек товара
    // (redeemInstructions) — если не задан, блок с текстом просто не показываем.
    const instructionsBlock = current.redeemInstructions
      ? `<div class="rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">${escapeHtml(current.redeemInstructions)}</div>`
      : '';
    stage.innerHTML = `
      ${instructionsBlock}
      <button id="odRequestBtn" type="button" class="btn-wallet-green mt-4 w-full rounded-2xl px-4 py-3 text-sm font-semibold">Получить код</button>
    `;
    document.getElementById('odRequestBtn').addEventListener('click', renderConfirm);
  }

  function renderConfirm() {
    stage.innerHTML = `
      <div class="rounded-2xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        После получения кода вернуть или обменять ваучер будет нельзя. Продолжить?
      </div>
      <div class="mt-4 grid grid-cols-[1fr_1.3fr] gap-3">
        <button id="odCancelBtn" type="button" class="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800">Отмена</button>
        <button id="odConfirmBtn" type="button" class="btn-wallet-green rounded-2xl px-4 py-3 text-sm font-semibold">Получить код</button>
      </div>
    `;
    document.getElementById('odCancelBtn').addEventListener('click', renderIdle);
    document.getElementById('odConfirmBtn').addEventListener('click', doRequestCode);
  }

  function renderLoading() {
    stage.innerHTML = `
      <div class="rounded-2xl bg-slate-50 p-6 text-center dark:bg-slate-800">
        <div class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-apple-blue dark:border-slate-700"></div>
        <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Пожалуйста подождите, ваш запрос обрабатывается.</p>
      </div>
    `;
  }

  function renderPending(payload) {
    setStatus('pending');
    const isManual = current.vendor === 'MANUAL';
    const headline = isManual ? 'Заявка передана оператору' : 'Готовим ваш код';
    const text = isManual
      ? `Заявка №${payload.requestId ?? ''}. Обычно занимает 5–15 минут — оператор получает код у поставщика вручную. Мы пришлём SMS.`
      : 'Пожалуйста подождите, ваш запрос обрабатывается.';

    stage.innerHTML = `
      <div class="rounded-2xl bg-slate-50 p-6 text-center dark:bg-slate-800">
        <div class="mx-auto mb-3 h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400"></div>
        <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">${headline}</p>
        <p class="mt-1 text-xs text-slate-500">${text}</p>
      </div>
    `;

    schedulePoll();
  }

  function renderError(message) {
    setStatus('error');
    stage.innerHTML = `
      <div class="rounded-2xl bg-rose-50 p-6 text-center dark:bg-slate-800">
        <p class="text-sm font-semibold text-rose-600">Не удалось получить код</p>
        <p class="mt-1 text-xs text-slate-500">${escapeHtml(message || 'Поставщик временно недоступен.')}</p>
      </div>
      <button id="odRetryBtn" type="button" class="btn-wallet-green mt-4 w-full rounded-2xl px-4 py-3 text-sm font-semibold">Повторить попытку</button>
    `;
    document.getElementById('odRetryBtn').addEventListener('click', doRequestCode);
  }

  function renderReady(key) {
    setStatus('ready');
    stopPolling();
    const hint = current.redeemInstructions
      ? `<p class="mt-3 text-xs leading-relaxed text-slate-500">${escapeHtml(current.redeemInstructions)}</p>`
      : '';
    stage.innerHTML = `
      <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-800">
        <code id="odCodeValue" class="break-all text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100">${escapeHtml(key || '')}</code>
      </div>
      <button id="odCopyBtn" type="button" class="mt-3 w-full rounded-2xl bg-apple-blue px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600">Скопировать код</button>
      ${hint}
    `;
    document.getElementById('odCopyBtn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(key || '');
        logVoucherEvent(current.id, 'voucher.share').catch(() => {});
      } catch (e) { /* ignore */ }
    });
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function doRequestCode() {
    renderLoading();
    try {
      const result = await requestVoucherCode(current.id);
      if (result.status === 'ready') {
        renderReady(result.key);
      } else if (result.status === 'pending') {
        renderPending(result);
      } else {
        renderError(result.message);
      }
    } catch (error) {
      renderError(error.payload?.error || error.message);
    }
  }

  function schedulePoll() {
    stopPolling();
    pollTimer = setTimeout(async () => {
      try {
        const result = await getVoucherCodeStatus(current.id);
        if (result.status === 'ready') {
          renderReady(result.key);
        } else if (result.status === 'pending') {
          renderPending(result);
        } else if (result.status === 'error') {
          renderError(result.message);
        } else {
          schedulePoll();
        }
      } catch (error) {
        schedulePoll();
      }
    }, 5000);
  }

  window.openOndemandModal = function openOndemandModal(detail) {
    current = {
      id: detail.id,
      vendorName: detail.vendorName,
      vendor: detail.vendorProductType || null,
      redeemInstructions: detail.redeemInstructions || null,
    };

    productName.textContent = detail.productName || '';
    vendorName.textContent = detail.vendorName || '';

    if (detail.store) {
      partnerRow.classList.remove('hidden');
      partnerRow.classList.add('inline-flex');
      const color = detail.store.themeColor || '#4F46E5';
      partnerLogo.style.background = color;
      partnerLogo.textContent = (detail.store.name || '?').slice(0, 2).toUpperCase();
      partnerName.textContent = `Партнёр: ${detail.store.name || ''}`;
      partnerName.style.color = color;
    } else {
      partnerRow.classList.add('hidden');
      partnerRow.classList.remove('inline-flex');
    }

    if (detail.productImage) {
      productImage.innerHTML = `<img src="${detail.productImage}" alt="" class="h-full w-full object-cover" />`;
    } else {
      productImage.innerHTML = `<span class="text-2xl">🎁</span>`;
    }

    const codeStatus = detail.codeStatus || { status: 'idle' };
    current.vendor = detail.vendorProductType || current.vendor;

    if (codeStatus.status === 'ready') {
      renderReady(codeStatus.key);
    } else if (codeStatus.status === 'pending') {
      renderPending(codeStatus);
    } else if (codeStatus.status === 'error') {
      renderError(codeStatus.message);
    } else {
      renderIdle();
    }

    openModal();
    logVoucherEvent(detail.id, 'voucher.view').catch(() => {});
  };
}
