const RU_LOCALE = 'ru-RU';
const MSK_TZ = 'Europe/Moscow';

export function formatDateLocal(
  date: Date | string | number,
  opts?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'object' ? date : new Date(date);
  return new Intl.DateTimeFormat(RU_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  }).format(d);
}

export function formatDateMsk(
  date: Date | string | number,
  opts?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'object' ? date : new Date(date);
  const formatted = new Intl.DateTimeFormat(RU_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: MSK_TZ,
    ...opts,
  }).format(d);
  return `${formatted} МСК`;
}

export function formatDateShort(date: Date | string | number): string {
  const d = typeof date === 'object' ? date : new Date(date);
  return new Intl.DateTimeFormat(RU_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatTimeLocal(date: Date | string | number): string {
  const d = typeof date === 'object' ? date : new Date(date);
  return new Intl.DateTimeFormat(RU_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
