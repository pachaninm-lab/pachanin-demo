'use client';

import { useMemo, useTransition } from 'react';
import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { isAppLocale, SUPPORTED_LOCALES, type AppLocale } from '@/i18n/locale';
import styles from './PublicLocaleSwitcher.module.css';

const SHORT_LABELS: Record<AppLocale, string> = {
  ru: 'RU',
  en: 'EN',
  zh: 'ZH',
};

function normalizeLocale(value: string): AppLocale {
  return isAppLocale(value) ? value : 'ru';
}

function nextLocale(locale: AppLocale): AppLocale {
  const index = SUPPORTED_LOCALES.indexOf(locale);
  return SUPPORTED_LOCALES[(index + 1) % SUPPORTED_LOCALES.length] ?? 'ru';
}

export function PublicLocaleSwitcher() {
  const t = useTranslations('publicEntry.locale');
  const locale = normalizeLocale(useLocale());
  const next = nextLocale(locale);
  const pathname = usePathname() || '/platform-v7';
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const href = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('lang', next);
    params.delete('l10n');
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [next, pathname, searchParams]);

  const ariaLabel = `${t('current')}: ${SHORT_LABELS[locale]}. ${t('switchTo')}: ${SHORT_LABELS[next]}`;

  return (
    <button
      type='button'
      className={styles.button}
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={isPending}
      onClick={() => {
        if (isPending) return;
        startTransition(() => {
          router.replace(href, { scroll: false });
          router.refresh();
        });
      }}
    >
      <Languages size={16} strokeWidth={2.35} aria-hidden='true' />
      <span>{SHORT_LABELS[locale]}</span>
    </button>
  );
}
