(function () {
  const modal = document.getElementById('voucherModal');
  const btnAddApple = document.getElementById('voucherModalAddApple');
  const btnCloseTop = document.getElementById('voucherModalClose');
  const btnCloseBottom = document.getElementById('voucherModalCloseBottom');

  function showModal() { if (!modal) return; modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function hideModal() { if (!modal) return; modal.classList.add('hidden'); document.body.style.overflow = ''; }
  btnCloseTop?.addEventListener('click', hideModal);
  btnCloseBottom?.addEventListener('click', hideModal);

  // Показать кнопку на iOS (в т.ч. внутри Capacitor)
  const ua = navigator.userAgent || '';
  const isiOS = /iPhone|iPad|iPod/i.test(ua) || (window.Capacitor?.getPlatform?.() === 'ios');
  if (isiOS) { btnAddApple?.classList.remove('hidden'); } else { btnAddApple?.classList.add('hidden'); }

  async function openInBrowser(passUrl) {
    try {
      // Официальный плагин доступен только внутри Capacitor-приложения
      if (window?.Capacitor?.Plugins?.Browser?.open) {
        await window.Capacitor.Plugins.Browser.open({ url: passUrl, presentationStyle: 'fullscreen' });
        return;
      }
    } catch (e) { /* ignore and fallback */ }
    // Фолбэк — обычная навигация (Safari / PWA)
    window.location.href = passUrl;
  }

  btnAddApple?.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    const serial = modal?.dataset?.serial || '';
    if (!serial) { console.warn('voucher-modal: serial is empty, set modal.dataset.serial before showing the modal'); return; }
    const base = (window.__PUBLIC_BASE_URL || window.location.origin).replace(/\/+$/, '');
    const passUrl = `${base}/wallet/${encodeURIComponent(serial)}.pkpass`;
    await openInBrowser(passUrl);
  });

  // Глобальная функция — вызывать при открытии модалки, чтобы передать serial
  window.openVoucherModal = function openVoucherModal(voucher) {
    if (!modal) return;
    modal.dataset.serial = voucher?.serial || voucher?.value || '';
    const elProduct = document.getElementById('voucherModalProduct');
    const elValue   = document.getElementById('voucherModalValue');
    const elStatus  = document.getElementById('voucherModalStatus');
    if (elProduct) elProduct.textContent = voucher?.productName || '';
    if (elValue)   elValue.textContent   = voucher?.amountLabel || voucher?.amount || '';
    if (elStatus)  elStatus.textContent  = voucher?.status || '';
    showModal();
  };
})();
