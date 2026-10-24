// Валидация узбекского мобильного номера.
// Нужна отдельно от normalizePhone(): тестер Paynet требует, чтобы на
// неверный номер сервис отвечал ошибкой «не найдено», а normalizePhone
// лишь приводит формат и пропускает любые 12 цифр, начинающиеся с 998.
const MOBILE_PREFIXES = [
  '20', '33', '50', '55', '77', '88',
  '90', '91', '93', '94', '95', '97', '98', '99',
];

export function normalizeUzMobile(raw) {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, '');
  let national = null;
  if (digits.length === 12 && digits.startsWith('998')) national = digits.slice(3);
  else if (digits.length === 9) national = digits;
  else return null;
  if (!MOBILE_PREFIXES.includes(national.slice(0, 2))) return null;
  return `+998${national}`;
}

export const isUzMobile = (raw) => normalizeUzMobile(raw) !== null;
