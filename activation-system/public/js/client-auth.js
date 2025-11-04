import { registerServiceWorker } from './register-sw.js';

function sanitizePhone(value) {
  if (!value) return '';
  let cleaned = value.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    const rest = cleaned.slice(1).replace(/\+/g, '');
    return `+${rest}`;
  }
  return cleaned.replace(/\+/g, '');
}

function initPhoneInputs() {
  document.querySelectorAll('input[name="phoneNumber"]').forEach((input) => {
    input.addEventListener('input', (event) => {
      const target = event.target;
      const previous = target.value;
      const caret = target.selectionStart || 0;
      const sanitized = sanitizePhone(previous);
      if (sanitized !== previous) {
        const diff = previous.length - sanitized.length;
        target.value = sanitized;
        const nextPos = Math.max(caret - diff, 0);
        target.setSelectionRange(nextPos, nextPos);
      }
    });
  });
}

async function initOtp() {
  const form = document.getElementById('walletOtpForm');
  if (!form) return;

  const resendBtn = document.getElementById('walletOtpResend');
  const phone = window.__WALLET_VERIFY__?.phone;

  if ('OTPCredential' in window) {
    try {
      const abort = new AbortController();
      navigator.credentials.get({
        otp: { transport: ['sms'] },
        signal: abort.signal,
      }).then((credential) => {
        if (credential && credential.code) {
          form.querySelector('input[name="otp"]').value = credential.code;
          form.submit();
        }
      }).catch(() => {});
    } catch (error) {
      console.warn('WebOTP unavailable', error);
    }
  }

  if (resendBtn && phone) {
    resendBtn.addEventListener('click', async () => {
      resendBtn.disabled = true;
      try {
        await fetch('/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ phoneNumber: phone, rememberMe: '1' }),
        });
      } finally {
        setTimeout(() => {
          resendBtn.disabled = false;
        }, 30000);
      }
    });
  }
}

async function bootstrap() {
  initPhoneInputs();
  await registerServiceWorker();
  await initOtp();
}

bootstrap();
