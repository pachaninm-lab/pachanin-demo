import { Languages } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { isAppLocale, SUPPORTED_LOCALES, type AppLocale } from '@/i18n/locale';

const SHORT_LABELS: Record<AppLocale, string> = { ru: 'RU', en: 'EN', zh: 'ZH' };

function nextLocale(current: AppLocale): AppLocale {
  const index = SUPPORTED_LOCALES.indexOf(current);
  return SUPPORTED_LOCALES[(index + 1) % SUPPORTED_LOCALES.length] ?? 'ru';
}

export async function ResetPasswordLocaleLink({ token }: { token: string }) {
  const localeValue = await getLocale();
  const locale: AppLocale = isAppLocale(localeValue) ? localeValue : 'ru';
  const next = nextLocale(locale);
  const t = await getTranslations('publicEntry.language');
  const currentLabel = SHORT_LABELS[locale];
  const nextLabel = SHORT_LABELS[next];
  const query = new URLSearchParams({ lang: next });
  if (token) query.set('token', token);

  return (
    <a
      className='pc-site-locale-switch'
      href={`/platform-v7/reset-password?${query.toString()}`}
      aria-label={t('switchLabel', { current: currentLabel, next: nextLabel })}
      title={t('switchTitle', { current: currentLabel })}
      data-current-locale={locale}
      data-next-locale={next}
    >
      <Languages size={16} strokeWidth={2.35} aria-hidden='true' />
      <span>{currentLabel}</span>
    </a>
  );
}
