// Единый формат цен: только кратные десяти тысячам сумов.
// Причина простая — терминалы Paynet не дают сдачи, а купюры в обороте
// кратны 10 000. Если это правило держать на входе, то вся арифметика
// округления, надбавок и сверки разницы становится ненужной.
export const PRICE_STEP = 10_000;

export const isValidPrice = (v) =>
  Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) % PRICE_STEP === 0;

// Ближайшая допустимая цена — для подсказки в интерфейсе.
export const nearestValidPrice = (v) =>
  Math.max(PRICE_STEP, Math.round(Number(v) / PRICE_STEP) * PRICE_STEP);

export function priceError(v, label = 'Цена') {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return `${label} должна быть положительным числом.`;
  if (n % PRICE_STEP !== 0) {
    return `${label} должна быть кратна ${PRICE_STEP.toLocaleString('ru-RU')} сум.`
      + ` Ближайшие допустимые: ${nearestValidPrice(n - PRICE_STEP / 2).toLocaleString('ru-RU')}`
      + ` или ${nearestValidPrice(n + PRICE_STEP / 2).toLocaleString('ru-RU')}.`;
  }
  return null;
}
