(function () {
  const form = document.getElementById('checkoutForm');
  if (!form) return;

  const PHONE_PREFIX = '+998';

  const saleTypeRadios = form.querySelectorAll('input[name="saleType"]');
  const phoneSection = document.getElementById('phoneSection');
  const phoneInput = document.getElementById('customerPhone');
  const paymentCheckbox = document.getElementById('paymentConfirmed');
  const confirmButton = document.getElementById('confirmSaleButton');

  function toggleConfirmButton() {
    if (confirmButton) confirmButton.disabled = !(paymentCheckbox && paymentCheckbox.checked);
  }

  function togglePhoneSection() {
    const selected = form.querySelector('input[name="saleType"]:checked');
    if (!selected) return;
    const isOnline = selected.value === 'ONLINE';
    if (isOnline) {
      phoneSection.classList.remove('hidden');
      phoneInput?.setAttribute('required', '');
    } else {
      phoneSection.classList.add('hidden');
      phoneInput?.removeAttribute('required');
      if (phoneInput) phoneInput.value = PHONE_PREFIX;
    }
  }

  // Продавец вводит только 9 цифр после +998 — префикс всегда на месте и его нельзя стереть.
  // Нормализует любой ввод (набор, вставка "+998901234567"/"998901234567"/"901234567") к виду +998XXXXXXXXX.
  function normalizePhoneInput() {
    if (!phoneInput) return;
    let digits = phoneInput.value.replace(/\D/g, '');
    if (digits.startsWith('998')) digits = digits.slice(3);
    digits = digits.slice(0, 9);
    phoneInput.value = PHONE_PREFIX + digits;
    const end = phoneInput.value.length;
    phoneInput.setSelectionRange(end, end);
  }

  if (phoneInput) {
    if (!phoneInput.value || !phoneInput.value.startsWith(PHONE_PREFIX)) {
      phoneInput.value = PHONE_PREFIX;
    }

    phoneInput.addEventListener('input', normalizePhoneInput);

    phoneInput.addEventListener('focus', () => {
      if (phoneInput.selectionStart < PHONE_PREFIX.length) {
        const end = phoneInput.value.length;
        phoneInput.setSelectionRange(end, end);
      }
    });

    phoneInput.addEventListener('click', () => {
      if (phoneInput.selectionStart < PHONE_PREFIX.length) {
        const end = phoneInput.value.length;
        phoneInput.setSelectionRange(end, end);
      }
    });

    phoneInput.addEventListener('keydown', (event) => {
      const withinPrefix = phoneInput.selectionStart <= PHONE_PREFIX.length && phoneInput.selectionEnd <= PHONE_PREFIX.length;
      if ((event.key === 'Backspace' || event.key === 'Delete') && withinPrefix) {
        event.preventDefault();
      }
    });
  }

  paymentCheckbox?.addEventListener('change', toggleConfirmButton);
  saleTypeRadios.forEach((radio) => radio.addEventListener('change', togglePhoneSection));
  toggleConfirmButton();
  togglePhoneSection();

  form.addEventListener('submit', (event) => {
    const selected = form.querySelector('input[name="saleType"]:checked');
    if (selected && selected.value === 'ONLINE') {
      const phone = (phoneInput?.value || '').trim();
      if (!/^\+998[0-9]{9}$/.test(phone)) {
        event.preventDefault();
        alert('Введите корректный номер телефона в формате +998XXXXXXXXX');
        phoneInput?.focus();
        return;
      }
    }
    if (!paymentCheckbox || !paymentCheckbox.checked) {
      event.preventDefault();
      return;
    }
    if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.textContent = 'Обработка...';
    }
  });
})();
