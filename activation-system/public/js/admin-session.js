const REFRESH_ENDPOINT = '/auth/refresh';
const LOGOUT_URL = '/auth/logout';
const LOGIN_URL = '/auth/login';
const REFRESH_INTERVAL = 5 * 60 * 1000;
const IDLE_TIMEOUT = 6 * 60 * 60 * 1000; // 6 часов

const hasRememberMe = document.cookie.includes('remember_me=1');

async function refreshSession() {
  if (!hasRememberMe) return;
  try {
    const res = await fetch(REFRESH_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
    });
    if (!res.ok) {
      window.location.href = LOGIN_URL;
    } else if (window.location.pathname === '/auth/login') {
      window.location.href = '/admin/dashboard';
    }
  } catch (error) {
    console.warn('Admin refresh failed', error);
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

window.addEventListener('offline', () => console.log('admin offline - refresh paused'));
window.addEventListener('online', () => hasRememberMe && refreshSession());
