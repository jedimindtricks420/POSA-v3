import { registerServiceWorker } from './register-sw.js';
import walletOfflineStore from './wallet-offline-store.js';
import { getVouchers, logVoucherEvent, claimVoucher } from './wallet-api.js';

let BrowserMultiFormatReader = null;
let NotFoundException = null;

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
let scannerControls = null;
let availableDevices = [];
let currentDeviceIndex = 0;
let torchEnabled = false;

let isHandlingPayload = false;
let lastHandledPayload = null;
let lastHandledAt = 0;
const DUPLICATE_WINDOW_MS = 2000;
let useConstraintsFallback = false;

async function ensureZxing() {
  if (BrowserMultiFormatReader && NotFoundException) {
    return true;
  }
  if (window.ZXing?.BrowserMultiFormatReader) {
    BrowserMultiFormatReader = window.ZXing.BrowserMultiFormatReader;
    NotFoundException = window.ZXing.NotFoundException || Error;
    if (!codeReader) {
      codeReader = new BrowserMultiFormatReader();
    }
    return true;
  }
  try {
    const module = await import('https://unpkg.com/@zxing/browser@0.1.5/esm/index.js');
    BrowserMultiFormatReader = module.BrowserMultiFormatReader;
    NotFoundException = module.NotFoundException || Error;
    if (!codeReader) {
      codeReader = new BrowserMultiFormatReader();
    }
    return true;
  } catch (error) {
    console.error('Failed to load ZXing module', error);
    alert('Не удалось загрузить модуль сканирования. Обновите страницу или обратитесь в поддержку.');
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
  const stream = scannerControls?.stream || video?.srcObject || null;
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

async function ensureDevices() {
  if (!(await ensureZxing())) {
    return false;
  }
  if (!navigator.mediaDevices?.enumerateDevices) {
    console.warn('Camera enumeration is unavailable in this browser');
    return false;
  }
  if (availableDevices.length) {
    return true;
  }
  try {
    let devices = await BrowserMultiFormatReader.listVideoInputDevices();
    if (!devices.length) {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach((track) => track.stop());
        devices = await BrowserMultiFormatReader.listVideoInputDevices();
      } catch (permissionError) {
        console.warn('Camera permission required for scanning', permissionError);
      }
    }
    if (!devices.length) {
      console.warn('No video input devices detected');
      useConstraintsFallback = true;
      return true;
    }
    useConstraintsFallback = false;
    availableDevices = devices;
    const preferredIndex = devices.findIndex((device) =>
      /back|rear|environment/i.test(device.label || ''),
    );
    currentDeviceIndex = preferredIndex >= 0 ? preferredIndex : 0;
    return true;
  } catch (error) {
    console.error('Failed to enumerate video input devices', error);
    return false;
  }
}

async function startScanner() {
  if (!(await ensureZxing())) {
    return;
  }
  if (!navigator.onLine) {
    updateOfflineState();
    return;
  }
  const ready = await ensureDevices();
  if (!ready) return;

  stopScanner();

  try {
    const handler = (result, error) => {
      if (result) {
        const text = result.getText();
        if (text) {
          processPayload(text);
        }
      } else if (error && !(error instanceof NotFoundException)) {
        console.warn('ZXing decode error', error);
      }
    };

    if (useConstraintsFallback) {
      const constraints = {
        video: {
          facingMode: usingFrontCamera ? 'user' : 'environment',
        },
        audio: false,
      };

      scannerControls = await codeReader.decodeFromConstraints(
        constraints,
        video,
        handler,
        true,
      );
    } else {
      const device = availableDevices[currentDeviceIndex];
      if (!device) {
        console.warn('Preferred video device missing, switching to fallback mode');
        useConstraintsFallback = true;
        await startScanner();
        return;
      }

      scannerControls = await codeReader.decodeFromVideoDevice(
        device.deviceId,
        video,
        handler,
      );
    }
    resetTorchState();
    video?.play?.().catch(() => {});
  } catch (error) {
    console.error('Failed to start ZXing scanner', error);
  }
}

function stopScanner() {
  if (scannerControls) {
    scannerControls.stop();
    scannerControls = null;
  }
  if (codeReader) {
    try {
      codeReader.reset();
    } catch (error) {
      console.warn('Failed to reset code reader', error);
    }
  }
  const stream = video?.srcObject;
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  }
  resetTorchState();
}

async function switchCamera() {
  if (useConstraintsFallback) {
    usingFrontCamera = !usingFrontCamera;
    await startScanner();
    return;
  }
  if (!availableDevices.length) return;
  currentDeviceIndex = (currentDeviceIndex + 1) % availableDevices.length;
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
