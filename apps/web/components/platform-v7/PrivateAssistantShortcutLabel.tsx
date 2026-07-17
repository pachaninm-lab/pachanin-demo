'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/track';
import styles from './PrivateAssistantShortcutLabel.module.css';

type Locale = 'ru' | 'en' | 'zh';

const LABELS: Record<Locale, { title: string; note: string; aria: string }> = {
  ru: { title: 'Помощник сделки', note: 'Контекст текущего ЛК', aria: 'Открыть помощника сделки на весь экран' },
  en: { title: 'Deal assistant', note: 'Current workspace context', aria: 'Open the Deal assistant full screen' },
  zh: { title: '交易助手', note: '当前工作区上下文', aria: '全屏打开交易助手' },
};

function localeFromDocument(): Locale {
  if (typeof document === 'undefined') return 'ru';
  const query = new URLSearchParams(window.location.search).get('lang');
  if (query === 'en' || query === 'zh') return query;
  const html = document.documentElement.lang.toLowerCase();
  if (html.startsWith('en')) return 'en';
  if (html.startsWith('zh')) return 'zh';
  return 'ru';
}

export function PrivateAssistantShortcutLabel() {
  const pathname = usePathname() || '/platform-v7';
  const [locale, setLocale] = React.useState<Locale>('ru');

  React.useEffect(() => setLocale(localeFromDocument()), []);
  const copy = LABELS[locale];
  const dealMatch = pathname.match(/^\/platform-v7\/deals\/([^/]+)/u);
  const href = dealMatch
    ? `/platform-v7/assistant?deal=${encodeURIComponent(dealMatch[1])}`
    : '/platform-v7/assistant';

  return (
    <>
      <Link
        href={href}
        className={styles.shortcut}
        aria-label={copy.aria}
        onClick={() => trackEvent('private_assistant_shortcut_opened', { source: 'persistent_label', pathname, hasDealContext: Boolean(dealMatch) })}
      >
        <span className={styles.icon} aria-hidden='true'><Sparkles size={18} /></span>
        <span className={styles.copy}>
          <strong>{copy.title}</strong>
          <small>{copy.note}</small>
        </span>
      </Link>
      <style>{`.p7-ai-trigger{bottom:max(92px,calc(env(safe-area-inset-bottom,0px) + 88px))!important}`}</style>
    </>
  );
}
