const DB_NAME = 'namo-wallet';
const STORE_NAME = 'kv';
const DB_VERSION = 1;
const memoryStore = new Map();
let useMemoryFallback = false;
let fallbackWarned = false;

function warnFallback(reason) {
  if (fallbackWarned) return;
  fallbackWarned = true;
  const message = 'wallet offline store: IndexedDB недоступен, используем in-memory хранилище (данные сотрутся при перезагрузке)';
  if (reason) {
    console.warn(message, reason);
  } else {
    console.warn(message);
  }
}

function enableMemoryFallback(reason) {
  if (!useMemoryFallback) {
    useMemoryFallback = true;
    warnFallback(reason);
  }
}

if (typeof indexedDB === 'undefined') {
  enableMemoryFallback(new Error('indexedDB is not defined in this environment'));
}

function cloneValue(value) {
  if (value === null || typeof value === 'undefined') {
    return value;
  }
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // ignore structuredClone unavailability
    }
  }
  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }
  return value;
}

function writeMemory(key, value) {
  memoryStore.set(key, cloneValue(value));
  return true;
}

function readMemory(key) {
  return memoryStore.has(key) ? cloneValue(memoryStore.get(key)) : null;
}

function deleteMemory(key) {
  memoryStore.delete(key);
  return true;
}

function openDb() {
  if (useMemoryFallback) {
    return Promise.reject(new Error('IndexedDB disabled'));
  }
  if (typeof indexedDB === 'undefined') {
    enableMemoryFallback(new Error('indexedDB is not available'));
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => {
      enableMemoryFallback(request.error);
      reject(request.error || new Error('IndexedDB request failed'));
    };
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
  if (useMemoryFallback) {
    throw new Error('IndexedDB disabled');
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    let request;
    try {
      request = handler(store);
    } catch (handlerError) {
      reject(handlerError);
      return;
    }
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      reject(request.error || new Error('IndexedDB operation failed'));
    };
  });
}

export async function save(key, value) {
  if (useMemoryFallback) {
    writeMemory(key, value);
    return true;
  }
  try {
    await withStore('readwrite', (store) => store.put(value, key));
    return true;
  } catch (error) {
    enableMemoryFallback(error);
    writeMemory(key, value);
    return false;
  }
}

export function load(key) {
  if (useMemoryFallback) {
    return Promise.resolve(readMemory(key));
  }
  return new Promise(async (resolve) => {
    try {
      const result = await withStore('readonly', (store) => store.get(key));
      resolve(result || null);
    } catch (error) {
      enableMemoryFallback(error);
      resolve(readMemory(key));
    }
  });
}

export async function clear(key) {
  if (useMemoryFallback) {
    deleteMemory(key);
    return true;
  }
  try {
    await withStore('readwrite', (store) => store.delete(key));
    return true;
  } catch (error) {
    enableMemoryFallback(error);
    deleteMemory(key);
    return false;
  }
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
