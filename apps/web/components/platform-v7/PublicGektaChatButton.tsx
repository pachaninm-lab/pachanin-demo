'use client';

import { useEffect, useRef } from 'react';
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

export function PublicGektaChatButton({ locale, variant = 'header', className = '', prompt }: {
  locale: string; variant?: Variant; className?: string; prompt?: string;
}) {
  const lang = canonicalLocale(locale);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const frameRef = useRef(0);
  const question = typeof prompt === 'string' && prompt.length <= 240 && !/[\u0000-\u001f\u007f]/u.test(prompt) ? prompt.trim() : '';
  useEffect(() => () => { observerRef.current?.disconnect(); window.cancelAnimationFrame(frameRef.current); }, []);
  const openGekta = () => {
    observerRef.current?.disconnect();
    let wasOpen = Boolean(document.querySelector('#pc-public-assistant-panel'));
    const observer = new MutationObserver(() => {
      const open = Boolean(document.querySelector('#pc-public-assistant-panel'));
      if (wasOpen && !open) {
        observer.disconnect();
        frameRef.current = window.requestAnimationFrame(() => {
          // The legacy shortcut is intentionally hidden. Return to the visible
          // entry that opened this same chat, without jumping the document.
          const button = buttonRef.current;
          const target = button?.getClientRects().length ? button : document.querySelector<HTMLElement>('.pc-site-mobile-menu>summary');
          target?.focus({ preventScroll: true });
        });
      }
      wasOpen = open;
    });
    observerRef.current = observer;
    observer.observe(document.body, { childList: true, subtree: true });
    window.dispatchEvent(new CustomEvent('pc:public-assistant-context', {
      detail: { context: 'platform', prompts: question ? [question] : [] },
    }));
  };
  return <button
    ref={buttonRef}
    type='button'
    className={`pc-gekta-chat-button pc-gekta-chat-button--${variant} ${question ? 'pc-gekta-question' : ''} ${className}`.trim()}
    data-gekta-chat-entry='true'
    aria-haspopup='dialog'
    aria-controls='pc-public-assistant-panel'
    aria-label={question ? `${COPY[lang].ask}: ${question}` : undefined}
    onClick={openGekta}
  >
    <Sparkles size={variant === 'section' ? 17 : 15} strokeWidth={2.2} aria-hidden='true' />
    <span>{question || COPY[lang].ask}</span>
  </button>;
}
