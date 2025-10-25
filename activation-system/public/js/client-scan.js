import { registerServiceWorker } from './register-sw.js';
import walletOfflineStore from './wallet-offline-store.js';
import { getVouchers, logVoucherEvent, claimVoucher } from './wallet-api.js';

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

const fallbackCanvas = document.createElement('canvas');
const fallbackCtx = fallbackCanvas.getContext('2d', { willReadFrequently: true });

let activeStream = null;
let usingFrontCamera = false;
let fallbackLoopId = null;
let isHandlingPayload = false;
let lastHandledPayload = null;
let lastHandledAt = 0;
let scannerStarting = false;
let zxingReader = null;
let zxingReady = false;
let jsqrReady = false;
let torchEnabled = false;

const SCAN_DEBOUNCE_MS = 2000;
const FALLBACK_WIDTH = 640;

function loadScriptOnce(selector, src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) {
      const readyAttr = existing.dataset.ready || existing.getAttribute('data-ready');
      if (readyAttr === '1') {
        resolve(true);
      } else {
        existing.addEventListener('load', () => resolve(true), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.ready = '0';
    const attrMatch = selector.match(/data-([a-z0-9-]+)/i);
    if (attrMatch) {
      const camel = attrMatch[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      script.dataset[camel] = '1';
    }
    script.addEventListener('load', () => {
      script.dataset.ready = '1';
      resolve(true);
    });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
    document.head.appendChild(script);
  });
}

async function ensureZxing() {
  try {
    await Promise.all([
      loadScriptOnce('script[data-zxing-core]', '/vendor/zxing-library/index.min.js'),
      loadScriptOnce('script[data-zxing-browser]', '/vendor/zxing/browser/umd/zxing-browser.min.js'),
    ]);
  } catch (error) {
    console.warn('ZXing scripts unavailable', error);
    zxingReady = false;
    return false;
  }

  const ZXing = window.ZXing;
  const ZXingBrowser = window.ZXingBrowser;
  if (!ZXing || !ZXingBrowser) {
    zxingReady = false;
    return false;
  }

  if (!zxingReader) {
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.QR_CODE]);
    zxingReader = new ZXing.MultiFormatReader();
    zxingReader.setHints(hints);
  }

  zxingReady = true;
  return true;
}

async function ensureJsqr() {
  try {
    await loadScriptOnce('script[data-jsqr]', '/vendor/jsqr/jsQR.js');
    jsqrReady = typeof window.jsQR === 'function';
    return jsqrReady;
  } catch (error) {
    console.warn('jsQR unavailable', error);
    jsqrReady = false;
    return false;
  }
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
  if (navigator.onLine) {
    setTimeout(() => startScanner(), 300);
  }
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
  const stream = activeStream || video?.srcObject || null;
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
    video.setAttribute('autoplay', 'true');
    video.setAttribute('muted', 'true');
    video.setAttribute('playsinline', 'true');
    await video.play();
    return stream;
  } catch (error) {
    console.error('getUserMedia failed', error);
    alert('Не удалось получить доступ к камере. Проверьте разрешения.');
    return null;
  }
}

function decodeWithZxing() {
  if (!zxingReady || !window.ZXing || !window.ZXingBrowser) {
    return null;
  }
  const ZXing = window.ZXing;
  const ZXingBrowser = window.ZXingBrowser;
  try {
    const luminance = new ZXingBrowser.HTMLCanvasElementLuminanceSource(fallbackCanvas);
    const binaryBitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminance));
    const result = zxingReader.decode(binaryBitmap);
    const text = result.getText();
    zxingReader.reset();
    return text;
  } catch (error) {
    if (
      error instanceof window.ZXing.NotFoundException ||
      error instanceof window.ZXing.ChecksumException ||
      error instanceof window.ZXing.FormatException
    ) {
      return null;
    }
    console.warn('ZXing decode error', error);
    return null;
  }
}

function decodeWithJsqr(width, height) {
  if (!jsqrReady || typeof window.jsQR !== 'function') {
    return null;
  }
  const imageData = fallbackCtx.getImageData(0, 0, width, height);
  const qr = window.jsQR(imageData.data, width, height, {
    inversionAttempts: 'attemptBoth',
  });
  return qr?.data || null;
}

function stopFrameLoop() {
  if (fallbackLoopId) {
    cancelAnimationFrame(fallbackLoopId);
    fallbackLoopId = null;
  }
}

function stopScanner() {
  stopFrameLoop();
  if (zxingReader) {
    try {
      zxingReader.reset();
    } catch (error) {
      console.warn('ZXing reset error', error);
    }
  }
  if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;
  }
  video.srcObject = null;
  resetTorchState();
}

function startFrameLoop(useZxing, useJsqr) {
  stopFrameLoop();
  if (!useZxing && !useJsqr) {
    alert('Сканер недоступен. Введите код вручную.');
    return;
  }

  const loop = () => {
    if (!activeStream || video.readyState < 2) {
      fallbackLoopId = requestAnimationFrame(loop);
      return;
    }

    const { videoWidth, videoHeight } = video;
    if (!videoWidth || !videoHeight) {
      fallbackLoopId = requestAnimationFrame(loop);
      return;
    }

    const scale = Math.min(1, FALLBACK_WIDTH / videoWidth);
    const width = Math.max(160, Math.round(videoWidth * scale));
    const height = Math.max(160, Math.round(videoHeight * scale));

    if (fallbackCanvas.width !== width || fallbackCanvas.height !== height) {
      fallbackCanvas.width = width;
      fallbackCanvas.height = height;
    }
    fallbackCtx.drawImage(video, 0, 0, width, height);

    let decoded = null;

    if (useZxing) {
      decoded = decodeWithZxing();
    }

    if (!decoded && useJsqr) {
      decoded = decodeWithJsqr(width, height);
    }

    if (decoded) {
      processPayload(decoded);
      return;
    }

    fallbackLoopId = requestAnimationFrame(loop);
  };

  fallbackLoopId = requestAnimationFrame(loop);
}

async function startScanner() {
  if (scannerStarting) return;
  scannerStarting = true;
  try {
    if (!navigator.onLine) {
      updateOfflineState();
      showOfflineMessage();
      return;
    }

    stopScanner();

    const stream = await startVideo(usingFrontCamera ? 'user' : 'environment');
    if (!stream) {
      return;
    }

    resetTorchState();

    const [zxingAvailable, jsqrAvailable] = await Promise.all([
      ensureZxing(),
      ensureJsqr(),
    ]);

    startFrameLoop(zxingAvailable, jsqrAvailable);
  } finally {
    scannerStarting = false;
  }
}

function stopAllAndStartAgain(facing) {
  usingFrontCamera = facing === 'user';
  startScanner();
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
  if (payload === lastHandledPayload && now - lastHandledAt < SCAN_DEBOUNCE_MS) {
    return;
  }

  if (isHandlingPayload) {
    return;
  }

  isHandlingPayload = true;
  stopScanner();

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
      if (navigator.onLine && modal.classList.contains('hidden')) {
        startScanner();
      }
    }, 500);
  }
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
    switchCameraBtn.addEventListener('click', () => {
      stopAllAndStartAgain(usingFrontCamera ? 'environment' : 'user');
    });
  }

  if (toggleTorchBtn) {
    toggleTorchBtn.addEventListener('click', toggleTorch);
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

  window.addEventListener('online', () => {
    updateOfflineState();
    startScanner();
  });

  window.addEventListener('offline', () => {
    updateOfflineState();
    stopScanner();
  });

  await registerServiceWorker();
}

bootstrap();
