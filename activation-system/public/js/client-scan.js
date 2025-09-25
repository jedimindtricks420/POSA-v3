import { registerServiceWorker } from './register-sw.js';
import walletOfflineStore from './wallet-offline-store.js';
import { getVoucher, getVouchers, logVoucherEvent } from './wallet-api.js';

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

let currentStream = null;
let usingFrontCamera = false;
let torchEnabled = false;
let detector = null;
let scanLoopId = null;

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

async function handleCode(code) {
  try {
    const trimmed = code.trim();
    const data = await getVouchers();
    const match = data.vouchers.find((item) => item.value === trimmed);
    if (!match) {
      throw new Error('Voucher not found');
    }
    const detail = await getVoucher(match.id);
    populateModal(detail);
    openModal();
    await walletOfflineStore.appendScanHistory({ code: trimmed, scannedAt: new Date().toISOString() });
    updateHistoryList(await walletOfflineStore.getScanHistory());
    logVoucherEvent(match.id, 'voucher.qr_show').catch(() => {});
  } catch (error) {
    console.error('Failed to resolve voucher', error);
    alert('Не удалось найти ваучер для указанного кода.');
  }
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    console.warn('Camera API unavailable');
    return;
  }

  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
  }

  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: usingFrontCamera ? 'user' : 'environment',
      },
      audio: false,
    });
    video.srcObject = currentStream;
    await video.play();
  } catch (error) {
    console.error('Camera start error', error);
  }
}

async function toggleTorch() {
  if (!currentStream) return;
  const track = currentStream.getVideoTracks()[0];
  const capabilities = track.getCapabilities();
  if (!capabilities.torch) {
    alert('Фонарик не поддерживается на этом устройстве');
    return;
  }
  torchEnabled = !torchEnabled;
  await track.applyConstraints({
    advanced: [{ torch: torchEnabled }],
  });
  toggleTorchBtn.textContent = torchEnabled ? 'Выключить' : 'Фонарик';
}

async function initDetector() {
  if ('BarcodeDetector' in window) {
    detector = new BarcodeDetector({ formats: ['qr_code'] });
    return true;
  }
  console.warn('BarcodeDetector API unsupported');
  return false;
}

async function scanLoop() {
  if (!detector || !video || video.readyState < 2) {
    scanLoopId = requestAnimationFrame(scanLoop);
    return;
  }

  try {
    const bitmap = await createImageBitmap(video);
    const barcodes = await detector.detect(bitmap);
    bitmap.close();
    if (barcodes.length) {
      cancelAnimationFrame(scanLoopId);
      await handleCode(barcodes[0].rawValue);
      scanLoopId = requestAnimationFrame(scanLoop);
    } else {
      scanLoopId = requestAnimationFrame(scanLoop);
    }
  } catch (error) {
    scanLoopId = requestAnimationFrame(scanLoop);
  }
}

async function initHistory() {
  const history = await walletOfflineStore.getScanHistory();
  updateHistoryList(history);
}

async function bootstrap() {
  await initHistory();
  await startCamera();
  if (await initDetector()) {
    scanLoopId = requestAnimationFrame(scanLoop);
  }

  if (switchCameraBtn) {
    switchCameraBtn.addEventListener('click', async () => {
      usingFrontCamera = !usingFrontCamera;
      await startCamera();
    });
  }

  if (toggleTorchBtn) {
    toggleTorchBtn.addEventListener('click', toggleTorch);
  }

  if (manualSubmit) {
    manualSubmit.addEventListener('click', async () => {
      if (!manualInput.value.trim()) return;
      await handleCode(manualInput.value.trim());
    });
  }

  if (historyClearBtn) {
    historyClearBtn.addEventListener('click', async () => {
      await walletOfflineStore.clearScanHistory();
      updateHistoryList([]);
    });
  }

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

  await registerServiceWorker();
}

bootstrap();
