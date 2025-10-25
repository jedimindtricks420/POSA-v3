import { registerServiceWorker } from './register-sw.js';
import walletOfflineStore from './wallet-offline-store.js';
import { getVouchers, logVoucherEvent, claimVoucher } from './wallet-api.js';

let BrowserMultiFormatReader = null;
let NotFoundException = null;
let barcodeDetector = null;

async function ensureZxingScript() {
  if (window.ZXing?.BrowserMultiFormatReader) {
    return true;
  }
  const existing = document.querySelector('script[data-zxing-umd]');
  if (existing) {
    if (existing.dataset.ready === '1') {
      return Boolean(window.ZXing?.BrowserMultiFormatReader);
    }
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(Boolean(window.ZXing?.BrowserMultiFormatReader)), { once: true });
      existing.addEventListener('error', () => reject(new Error('ZXing UMD failed to load')), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/vendor/zxing/browser/umd/zxing-browser.min.js';
    script.async = true;
    script.dataset.zxingUmd = '1';
    script.addEventListener('load', () => {
      script.dataset.ready = '1';
      resolve(Boolean(window.ZXing?.BrowserMultiFormatReader));
    });
    script.addEventListener('error', () => reject(new Error('ZXing UMD failed to load')));
    document.head.appendChild(script);
  });
}

const video = document.getElementById('qrPreview');
const switchCameraBtn = document.getElementById('qrSwitchCamera');
const toggleTorchBtn = document.getElementById('qrToggleTorch');
const manualInput = document.getElementById('qrManualCode');
const manualSubmit = document.getElementById('qrManualSubmit');
const historyList = document.getElementById('qrHistory');
const historyClearBtn = document.getElementById('qrHistoryClear');
const modal = document.getElementById('voucherModal');
const modalClose = document.getElementById('voucherModalClose');
const modalCloseBottom = document.getElementById('voucherModalCloseBottom');
const modalProduct = document.getElementById('voucherModalProduct');
const modalValue = document.getElementById('voucherModalValue');
const modalStatus = document.getElementById('voucherModalStatus');
const modalQr = document.getElementById('voucherModalQr');
const modalBarcode = document.getElementById('voucherModalBarcode');
const modalTerms = document.getElementById('voucherModalTerms');
const modalSync = document.getElementById('voucherModalSyncInfo');
const offlineNotice = document.getElementById('qrOfflineNotice');

let codeReader = null;
let readerControls = null;
let torchEnabled = false;
let activeStream = null;
let usingFrontCamera = false;

let isHandlingPayload = false;
let lastHandledPayload = null;
let lastHandledAt = 0;
const DUPLICATE_WINDOW_MS = 2000;

async function ensureZxing() {
  if (BrowserMultiFormatReader && NotFoundException && codeReader) {
    return true;
  }
  const hasUmd = await ensureZxingScript().catch((error) => {
    console.warn(error);
    return false;
  });
  if (hasUmd && window.ZXing?.BrowserMultiFormatReader) {
    BrowserMultiFormatReader = window.ZXing.BrowserMultiFormatReader;
    NotFoundException = window.ZXing.NotFoundException || Error;
  } else {
    try {
      const module = await import('https://unpkg.com/@zxing/browser@0.1.5/esm/index.js');
      BrowserMultiFormatReader = module.BrowserMultiFormatReader;
      NotFoundException = module.NotFoundException || Error;
    } catch (error) {
      console.warn('ZXing load failed, will try BarcodeDetector fallback', error);
      return false;
    }
  }
  codeReader = new BrowserMultiFormatReader();
  return true;
}

async function ensureBarcodeDetector() {
  if (barcodeDetector) return true;
  if ('BarcodeDetector' in window) {
    try {
      barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
      return true;
    } catch (error) {
      console.warn('BarcodeDetector unavailable', error);
    }
  }
  return false;
}

function showOfflineMessage() {
  if (typeof alert === 'function') {
    alert('Требуется подключение к интернету для проверки ваучера.');
  }
}

function updateOfflineState() {
  if (!offlineNotice) return;
  if (navigator.onLine) {
    offlineNotice.classList.add('hidden');
  } else {
    offlineNotice.classList.remove('hidden');
  }
}

function updateHistoryList(items) {
  historyList.innerHTML = '';
  if (!items.length) {
    historyList.innerHTML = '<li class="text-xs text-slate-400">Пока пусто</li>';
    return;
  }

  items.forEach((item) => {
    const li = document.createElement('li');
    li.innerHTML = `<div class="flex justify-between"><span>${item.code}</span><span class="text-xs text-slate-400">${new Date(item.scannedAt).toLocaleString('ru-RU')}</span></div>`;
    historyList.append(li);
  });
}

function openModal() {
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeModal() {
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function populateModal(detail) {
  modalProduct.textContent = detail.productName;
  modalValue.textContent = detail.displayValue;
  modalStatus.innerHTML = `<span class="inline-flex h-2 w-2 rounded-full mr-2 ${detail.statusColor}"></span>${detail.statusLabel}`;
  modalQr.innerHTML = `<img src="${detail.qrDataUrl}" alt="QR код" class="mx-auto h-56 w-56" />`;
  modalBarcode.innerHTML = detail.barcodeDataUrl
    ? `<img src="${detail.barcodeDataUrl}" alt="Штрихкод" class="max-h-20" />`
    : '<p class="text-xs text-slate-400">Не удалось сформировать штрихкод</p>';
  modalTerms.textContent = detail.terms;
  modalSync.textContent = `Синхронизировано: ${new Date(detail.lastSyncAt).toLocaleString('ru-RU')}`;
}

function getActiveTrack() {
  const stream = activeStream;
  if (!stream) return null;
  const [track] = stream.getVideoTracks();
  return track || null;
}

function trackSupportsTorch(track) {
  if (!track || typeof track.getCapabilities !== 'function') {
    return false;
  }
  try {
    const capabilities = track.getCapabilities();
    return Boolean(capabilities?.torch);
  } catch {
    return false;
  }
}

function updateTorchButton() {
  if (!toggleTorchBtn) return;
  const track = getActiveTrack();
  const supportsTorch = trackSupportsTorch(track);
  toggleTorchBtn.disabled = !supportsTorch;
  toggleTorchBtn.textContent = torchEnabled ? 'Выключить' : 'Фонарик';
}

function resetTorchState() {
  torchEnabled = false;
  updateTorchButton();
}

async function startVideo(facing = 'environment') {
  if (!navigator.mediaDevices?.getUserMedia) {
    alert('Камера недоступна в этом браузере.');
    return null;
  }
  try {
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
      activeStream = null;
    }
    const constraints = {
      video: {
        facingMode: facing,
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    activeStream = stream;
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    await video.play();
    return stream;
  } catch (error) {
    console.error('getUserMedia failed', error);
    alert('Не удалось получить доступ к камере. Проверьте разрешения.');
    return null;
  }
}

async function startZxingDecoder() {
  if (!(await ensureZxing())) {
    return false;
  }
  if (!video.srcObject) {
    console.warn('ZXing requested without active stream');
    return false;
  }

  if (readerControls) {
    readerControls.stop();
    readerControls = null;
  }

  try {
    readerControls = await codeReader.decodeFromVideoElement(
      video,
      (result, error) => {
        if (result) {
          const text = result.getText();
          if (text) {
            processPayload(text);
          }
        } else if (error && !(error instanceof NotFoundException)) {
          console.warn('ZXing decode error', error);
        }
      },
    );
    return true;
  } catch (error) {
    console.error('decodeFromVideoElement failed', error);
    return false;
  }
}

let barcodeLoopId = null;

async function startBarcodeDetector() {
  if (!(await ensureBarcodeDetector())) {
    return false;
  }
  if (!video.srcObject) {
    return false;
  }

  const detect = async () => {
    try {
      if (video.readyState < 2) {
        barcodeLoopId = requestAnimationFrame(detect);
        return;
      }
      const results = await barcodeDetector.detect(video);
      if (results.length) {
        processPayload(results[0].rawValue);
      }
    } catch (error) {
      // NotFoundException ожидаема, игнорируем
    }
    barcodeLoopId = requestAnimationFrame(detect);
  };
  barcodeLoopId = requestAnimationFrame(detect);
  return true;
}

function stopBarcodeDetector() {
  if (barcodeLoopId) {
    cancelAnimationFrame(barcodeLoopId);
    barcodeLoopId = null;
  }
}

async function startScanner() {
  if (!navigator.onLine) {
    updateOfflineState();
    return;
  }

  stopScanner();

  const stream = await startVideo(usingFrontCamera ? 'user' : 'environment');
  if (!stream) {
    return;
  }

  resetTorchState();

  const zxingReady = await startZxingDecoder();
  if (!zxingReady) {
    console.warn('Falling back to native BarcodeDetector');
    await startBarcodeDetector();
  } else {
    stopBarcodeDetector();
  }
}

function stopScanner() {
  stopBarcodeDetector();
  if (readerControls?.stop) {
    readerControls.stop();
    readerControls = null;
  }
  if (codeReader) {
    try {
      codeReader.reset();
    } catch (error) {
      console.warn('Failed to reset code reader', error);
    }
  }
  if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;
  }
  video.srcObject = null;
  resetTorchState();
}

async function switchCamera() {
  usingFrontCamera = !usingFrontCamera;
  await startScanner();
}

async function toggleTorch() {
  const track = getActiveTrack();
  if (!track) {
    alert('Фонарик недоступен для текущей камеры');
    return;
  }
  if (!trackSupportsTorch(track)) {
    alert('Фонарик не поддерживается на этом устройстве');
    return;
  }
  try {
    torchEnabled = !torchEnabled;
    await track.applyConstraints({
      advanced: [{ torch: torchEnabled }],
    });
  } catch (error) {
    console.warn('Failed to toggle torch', error);
    torchEnabled = false;
  }
  updateTorchButton();
}

async function refreshWalletCache() {
  try {
    const data = await getVouchers();
    await walletOfflineStore.saveVouchers({ vouchers: data.vouchers });
    await walletOfflineStore.saveSyncInfo({ syncedAt: data.syncedAt });
  } catch (error) {
    console.warn('Failed to refresh wallet cache', error);
  }
}

async function processPayload(rawPayload) {
  const payload = (rawPayload || '').trim();
  if (!payload) {
    return;
  }
  if (!navigator.onLine) {
    showOfflineMessage();
    updateOfflineState();
    return;
  }

  const now = Date.now();
  if (
    payload === lastHandledPayload &&
    now - lastHandledAt < DUPLICATE_WINDOW_MS
  ) {
    return;
  }

  if (isHandlingPayload) {
    return;
  }

  isHandlingPayload = true;
  try {
    const detail = await claimVoucher(payload);
    populateModal(detail);
    openModal();
    await walletOfflineStore.appendScanHistory({
      code: detail.value,
      scannedAt: new Date().toISOString(),
    });
    updateHistoryList(await walletOfflineStore.getScanHistory());
    logVoucherEvent(detail.id, 'voucher.qr_show').catch(() => {});
    await refreshWalletCache();
    try {
      localStorage.setItem('wallet-sync-trigger', String(Date.now()));
    } catch (storageError) {
      console.warn('Failed to broadcast wallet sync', storageError);
    }
    lastHandledPayload = payload;
    lastHandledAt = Date.now();
  } catch (error) {
    console.error('Failed to resolve voucher', error);
    const message = error?.payload?.error || 'Не удалось обработать ваучер.';
    alert(message);
    lastHandledPayload = null;
    lastHandledAt = 0;
  } finally {
    setTimeout(() => {
      isHandlingPayload = false;
    }, 500);
  }
}

async function initHistory() {
  const history = await walletOfflineStore.getScanHistory();
  updateHistoryList(history);
}

function bindModalInteractions() {
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
  }
  if (modalClose) {
    modalClose.addEventListener('click', closeModal);
  }
  if (modalCloseBottom) {
    modalCloseBottom.addEventListener('click', closeModal);
  }
}

async function bootstrap() {
  await initHistory();
  updateOfflineState();
  await startScanner();
  bindModalInteractions();

  if (switchCameraBtn) {
    switchCameraBtn.addEventListener('click', async () => {
      await switchCamera();
    });
  }

  if (toggleTorchBtn) {
    toggleTorchBtn.addEventListener('click', () => {
      toggleTorch();
    });
    updateTorchButton();
  }

  if (manualSubmit) {
    manualSubmit.addEventListener('click', async () => {
      const value = manualInput.value.trim();
      if (!value) return;
      await processPayload(value);
    });
  }

  if (historyClearBtn) {
    historyClearBtn.addEventListener('click', async () => {
      await walletOfflineStore.clearScanHistory();
      updateHistoryList([]);
    });
  }

  window.addEventListener('online', async () => {
    updateOfflineState();
    await startScanner();
  });

  window.addEventListener('offline', () => {
    updateOfflineState();
    stopScanner();
  });

  await registerServiceWorker();
}

bootstrap();
