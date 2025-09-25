import { registerServiceWorker } from './register-sw.js';

function formatPhone(value) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  let formatted = '+';
  for (let i = 0; i < digits.length; i += 1) {
    formatted += digits[i];
    if (i === 2 || i === 4 || i === 6 || i === 8) {
      formatted += ' ';
    }
  }
  return formatted.trim();
}

function initPhoneInputs() {
  document.querySelectorAll('input[name="phoneNumber"]').forEach((input) => {
    input.addEventListener('input', () => {
      const caret = input.selectionStart;
      input.value = formatPhone(input.value);
      input.setSelectionRange(caret, caret);
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
          body: new URLSearchParams({ phoneNumber: phone }),
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
