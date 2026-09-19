import { headers } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';
import { Languages } from 'lucide-react';
import { isAppLocale, SUPPORTED_LOCALES, type AppLocale } from '@/i18n/locale';

const SHORT_LABELS: Record<AppLocale, string> = {
  ru: 'RU',
  en: 'EN',
  zh: 'ZH',
};

function nextLocale(current: AppLocale): AppLocale {
  const index = SUPPORTED_LOCALES.indexOf(current);
  return SUPPORTED_LOCALES[(index + 1) % SUPPORTED_LOCALES.length] ?? 'ru';
}

function normalizePath(value: string | null) {
  return (value || '').split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

/**
 * Zero-hydration locale control for the public entry surfaces.
 * The next locale is encoded in the URL and resolved by middleware/server i18n.
 */
export async function PublicLocaleLink() {
  const localeValue = await getLocale();
  const t = await getTranslations('publicEntry.language');
  const locale: AppLocale = isAppLocale(localeValue) ? localeValue : 'ru';
  const next = nextLocale(locale);
  const currentLabel = SHORT_LABELS[locale];
  const nextLabel = SHORT_LABELS[next];
  const pathname = normalizePath((await headers()).get('x-pc-pathname'));

  return (
    <a
      className='pc-site-locale-switch'
      href={`${pathname}?lang=${next}`}
      aria-label={t('switchLabel', { current: currentLabel, next: nextLabel })}
      title={t('switchTitle', { current: currentLabel })}
      data-current-locale={locale}
      data-next-locale={next}
    >
      <Languages aria-hidden='true' size={19} strokeWidth={1.9} />
      <span>{currentLabel}</span>
    </a>
  );
}
