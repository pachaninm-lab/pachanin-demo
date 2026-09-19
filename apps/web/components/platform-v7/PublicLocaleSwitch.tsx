'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
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

export function PublicLocaleSwitch() {
  const localeValue = useLocale();
  const t = useTranslations('publicEntry.language');
  const locale: AppLocale = isAppLocale(localeValue) ? localeValue : 'ru';
  const next = nextLocale(locale);
  const currentLabel = SHORT_LABELS[locale];
  const nextLabel = SHORT_LABELS[next];

  function switchLocale() {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', next);
    url.searchParams.delete('l10n');
    window.location.replace(url.toString());
  }

  return (
    <button
      type='button'
      className='pc-site-locale-switch'
      aria-label={t('switchLabel', { current: currentLabel, next: nextLabel })}
      title={t('switchTitle', { current: currentLabel })}
      onClick={switchLocale}
      data-current-locale={locale}
      data-next-locale={next}
    >
      <Languages size={16} strokeWidth={2.35} aria-hidden='true' />
      <span>{currentLabel}</span>
    </button>
  );
}
