// Formatters centralizados es-CL. Reusar siempre estos helpers en vez de
// instanciar Intl.* ad-hoc — facilita auditar formato consistente y prepara
// migración futura a next-intl.

const LOCALE = 'es-CL';

export const numberFormat = new Intl.NumberFormat(LOCALE);
export const hhFormat = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
export const percentFormat = new Intl.NumberFormat(LOCALE, {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
export const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
export const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
export const monthFormat = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

export function relativeFromNow(date: Date | string | number): string {
  const target = new Date(date).getTime();
  const diffMs = target - Date.now();
  const abs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  if (abs < hour) return relative.format(Math.round(diffMs / minute), 'minute');
  if (abs < day) return relative.format(Math.round(diffMs / hour), 'hour');
  if (abs < week) return relative.format(Math.round(diffMs / day), 'day');
  if (abs < month) return relative.format(Math.round(diffMs / week), 'week');
  return relative.format(Math.round(diffMs / month), 'month');
}

export function hh(value: number | string | null | undefined): string {
  if (value == null) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return 'Sin HH';
  return hhFormat.format(n);
}

export function int(value: number | null | undefined): string {
  if (value == null) return '—';
  return numberFormat.format(value);
}
