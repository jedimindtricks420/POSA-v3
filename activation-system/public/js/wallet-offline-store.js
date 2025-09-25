const DB_NAME = 'namo-wallet';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function withStore(mode, handler) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = handler(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function save(key, value) {
  return withStore('readwrite', (store) => store.put(value, key));
}

export function load(key) {
  return new Promise(async (resolve) => {
    try {
      const result = await withStore('readonly', (store) => store.get(key));
      resolve(result || null);
    } catch (error) {
      console.warn('wallet offline load error', error);
      resolve(null);
    }
  });
}

export function clear(key) {
  return withStore('readwrite', (store) => store.delete(key));
}

export const walletOfflineStore = {
  save,
  load,
  clear,
  async saveVouchers(payload) {
    return save('vouchers', payload);
  },
  async loadVouchers() {
    return load('vouchers');
  },
  async saveSyncInfo(info) {
    return save('syncInfo', info);
  },
  async loadSyncInfo() {
    return load('syncInfo');
  },
  async appendScanHistory(entry) {
    const history = (await load('scanHistory')) || [];
    history.unshift(entry);
    const trimmed = history.slice(0, 5);
    await save('scanHistory', trimmed);
    return trimmed;
  },
  async getScanHistory() {
    return (await load('scanHistory')) || [];
  },
  async clearScanHistory() {
    return clear('scanHistory');
  },
};

export default walletOfflineStore;
