// Время для UWS. Отдаём строго «yyyy-MM-dd HH:mm:ss» в GMT+5 —
// формат зафиксирован и в §2.2, и в проверках официального тестера Paynet.
const TZ_OFFSET_MIN = 5 * 60; // GMT+5, Узбекистан
const pad = (n) => String(n).padStart(2, '0');

export function formatPaynet(date = new Date()) {
  const d = new Date(date.getTime() + TZ_OFFSET_MIN * 60_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    + ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

// Разбор входящих дат делаем терпимым: спецификация обещает
// «yyyy-MM-dd HH:mm:ss», но в её же примере CheckTransaction стоит
// «Tue Dec 30 10:29:03 UZT 2025». Принимаем оба и ISO.
export function parsePaynet(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (m) {
    const [, y, mo, d, h, mi, sec] = m.map(Number);
    return new Date(Date.UTC(y, mo - 1, d, h, mi, sec) - TZ_OFFSET_MIN * 60_000);
  }
  const dotted = s.match(/^(\d{2})\.(\d{2})\.(\d{4})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (dotted) {
    const [, d, mo, y, h, mi, sec] = dotted.map(Number);
    return new Date(Date.UTC(y, mo - 1, d, h, mi, sec) - TZ_OFFSET_MIN * 60_000);
  }
  // «Tue Dec 30 10:29:03 UZT 2025» — UZT Date не знает, подменяем на смещение.
  const parsed = new Date(s.replace(/\bUZT\b/, 'GMT+0500'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
