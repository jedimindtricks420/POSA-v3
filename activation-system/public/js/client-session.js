const REFRESH_ENDPOINT = '/client/refresh';
const LOGOUT_URL = '/client/logout';
const LOGIN_URL = '/wallet';
const REFRESH_INTERVAL = 5 * 60 * 1000;
const IDLE_TIMEOUT = 15 * 60 * 1000;
const REFRESH_RETRY_INTERVAL = 60 * 1000;

const hasRememberMe = document.cookie.includes('remember_me=1');
let pendingRefreshRetry = false;
let refreshRetryTimer = null;
let refreshReconnectHandler = null;

function clearRefreshRetry() {
  if (refreshReconnectHandler) {
    window.removeEventListener('online', refreshReconnectHandler);
    refreshReconnectHandler = null;
  }
  if (refreshRetryTimer) {
    clearTimeout(refreshRetryTimer);
    refreshRetryTimer = null;
  }
  pendingRefreshRetry = false;
}

function scheduleRefreshRetry() {
  if (pendingRefreshRetry) return;
  pendingRefreshRetry = true;
  refreshReconnectHandler = () => {
    clearRefreshRetry();
    refreshSession();
  };
  window.addEventListener('online', refreshReconnectHandler, { once: true });
  refreshRetryTimer = setTimeout(() => {
    if (navigator.onLine) {
      refreshReconnectHandler();
    } else {
      clearRefreshRetry();
      scheduleRefreshRetry();
    }
  }, REFRESH_RETRY_INTERVAL);
}

async function refreshSession() {
  if (!hasRememberMe) return;
  if (!navigator.onLine) {
    scheduleRefreshRetry();
    return;
  }
  try {
    const res = await fetch(REFRESH_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
    });
    if (!res.ok) {
      if (!navigator.onLine || res.status === 503) {
        scheduleRefreshRetry();
        return;
      }
      window.location.href = LOGIN_URL;
    } else {
      clearRefreshRetry();
      const path = window.location.pathname;
      if (path === '/wallet' || path === '/client-register' || path === '/client-verify') {
        window.location.href = '/client/dashboard';
      }
    }
  } catch (error) {
    if (!navigator.onLine || error?.offline) {
      scheduleRefreshRetry();
    } else {
      console.warn('Client refresh failed', error);
    }
  }
}

let idleTimer = null;

function resetIdleTimer() {
  const hasSession = document.cookie.includes('connect.sid');
  if (!hasSession) {
    clearTimeout(idleTimer);
    return;
  }
  if (hasRememberMe) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    window.location.href = LOGOUT_URL;
  }, IDLE_TIMEOUT);
}

['click', 'mousemove', 'keydown', 'touchstart'].forEach((evt) => {
  document.addEventListener(evt, resetIdleTimer, { passive: true });
});
resetIdleTimer();

if (hasRememberMe) {
  setInterval(refreshSession, REFRESH_INTERVAL);
  refreshSession();
}

window.addEventListener('offline', () => console.log('client offline - refresh paused'));
window.addEventListener('online', () => hasRememberMe && refreshSession());
