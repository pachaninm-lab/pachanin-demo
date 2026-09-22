'use client';

import { Sparkles } from 'lucide-react';

type Locale = 'ru' | 'en' | 'zh';
type Variant = 'header' | 'mobile' | 'section';

const COPY: Record<Locale, { short: string; ask: string }> = {
  ru: { short: 'Гекта', ask: 'Спросить Гекту' },
  en: { short: 'Gekta', ask: 'Ask Gekta' },
  zh: { short: 'Gekta', ask: '询问 Gekta' },
};

function canonicalLocale(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export function PublicGektaChatButton({
  locale,
  variant = 'header',
  className = '',
}: {
  locale: string;
  variant?: Variant;
  className?: string;
}) {
  const lang = canonicalLocale(locale);
  const copy = COPY[lang];
  const label = copy.ask;

  const openGekta = () => {
    window.dispatchEvent(new CustomEvent('pc:public-assistant-context', {
      detail: { context: 'platform', prompts: [] },
    }));
  };

  return (
    <button
      type='button'
      className={`pc-gekta-chat-button pc-gekta-chat-button--${variant} ${className}`.trim()}
      data-gekta-chat-entry='true'
      onClick={openGekta}
    >
      <Sparkles size={variant === 'section' ? 17 : 15} strokeWidth={2.2} aria-hidden='true' />
      <span>{label}</span>
    </button>
  );
}
