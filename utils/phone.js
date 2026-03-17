export function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('998')) {
    return `+${digits}`;
  }

  if (digits.length === 9) {
    return `+998${digits}`;
  }

  if (digits.length === 13 && digits.startsWith('998')) {
    // safeguard if someone already prefixed with +
    return `+${digits.slice(0, 12)}`;
  }

  if (digits.length === 12) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

export function phoneForSms(normalizedPhone) {
  if (!normalizedPhone) return '';
  return normalizedPhone.replace(/^[+]/, '');
}
