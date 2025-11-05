import { registerServiceWorker } from './register-sw.js';

const PHONE_PREFIX = '+998';
const PHONE_SUFFIX_LENGTH = 9;
const PHONE_MAX_LENGTH = PHONE_PREFIX.length + PHONE_SUFFIX_LENGTH;
const PHONE_VALIDATION_MESSAGE = 'Введите номер в формате +998XXXXXXXXX';

function sanitizePhone(value) {
  if (!value) return '';
  let cleaned = value.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    const rest = cleaned.slice(1).replace(/\+/g, '');
    return `+${rest}`;
  }
  return cleaned.replace(/\+/g, '');
}

function normalizePhoneValue(value) {
  const sanitized = sanitizePhone(value);
  const digits = sanitized.replace(/\D/g, '');
  const suffixDigits = digits.startsWith('998') ? digits.slice(3) : digits;
  const limitedSuffix = suffixDigits.slice(0, PHONE_SUFFIX_LENGTH);
  return `${PHONE_PREFIX}${limitedSuffix}`;
}

function setPhoneValidity(input) {
  if (!input) return;
  const isComplete = input.value.length === PHONE_MAX_LENGTH;
  input.setCustomValidity(isComplete ? '' : PHONE_VALIDATION_MESSAGE);
}

function initPhoneInputs() {
  document.querySelectorAll('input[name="phoneNumber"]').forEach((input) => {
    if (!input.value || !input.value.startsWith(PHONE_PREFIX)) {
      input.value = PHONE_PREFIX;
    }
    input.maxLength = PHONE_MAX_LENGTH;
    input.pattern = '\\+998\\d{9}';
    input.title = PHONE_VALIDATION_MESSAGE;
    setPhoneValidity(input);

    input.addEventListener('focus', () => {
      if (!input.value.startsWith(PHONE_PREFIX)) {
        input.value = PHONE_PREFIX;
      }
      const pos = Math.max(input.selectionStart || PHONE_PREFIX.length, PHONE_PREFIX.length);
      requestAnimationFrame(() => {
        input.setSelectionRange(pos, pos);
      });
    });

    input.addEventListener('beforeinput', (event) => {
      if ((event.inputType === 'deleteContentBackward' || event.inputType === 'deleteContentForward') &&
        (input.selectionStart || 0) <= PHONE_PREFIX.length &&
        (input.selectionEnd || 0) <= PHONE_PREFIX.length) {
        event.preventDefault();
      }
    });

    input.addEventListener('input', (event) => {
      const target = event.target;
      const previous = target.value;
      const caret = target.selectionStart || 0;
      const normalized = normalizePhoneValue(previous);

      if (normalized !== previous) {
        const diff = previous.length - normalized.length;
        target.value = normalized;
        let nextPos = Math.max(caret - diff, PHONE_PREFIX.length);
        nextPos = Math.min(nextPos, normalized.length);
        target.setSelectionRange(nextPos, nextPos);
      } else if ((target.selectionStart || 0) < PHONE_PREFIX.length) {
        target.setSelectionRange(PHONE_PREFIX.length, PHONE_PREFIX.length);
      }

      setPhoneValidity(target);
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
