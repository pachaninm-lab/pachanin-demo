export const SUPPORTED_LOCALES = ['ru', 'en', 'zh'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'ru';

// Локаль SSR-рендера. Синхронизируется с localStorage-ключом pc-v7-language,
// который используют клиентский DOM-переводчик и самолокализованные виджеты.
export const LOCALE_COOKIE = 'pc-v7-locale';

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'ru' || value === 'en' || value === 'zh';
}
