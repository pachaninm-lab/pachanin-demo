'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  readPublicGektaOpenStatus,
  requestPublicGektaOpen,
  subscribePublicGektaOpenStatus,
  type PublicGektaOpenStatus,
} from '@/lib/platform-v7/public-gekta-open';

type Locale = 'ru' | 'en' | 'zh';
type Variant = 'header' | 'mobile' | 'section';
const COPY: Record<Locale, { short: string; ask: string; opening: string; failed: string }> = {
  ru: { short: 'Гекта', ask: 'Спросить Гекту', opening: 'Открываем Гекту…', failed: 'Гекта не загрузилась. Обновить страницу' },
  en: { short: 'Gekta', ask: 'Ask Gekta', opening: 'Opening Gekta…', failed: 'Gekta did not load. Reload the page' },
  zh: { short: 'Gekta', ask: '询问 Gekta', opening: '正在打开 Gekta…', failed: 'Gekta 未能加载。刷新页面' },
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
  const [requested, setRequested] = useState(false);
  const [status, setStatus] = useState<PublicGektaOpenStatus>('idle');
  const question = typeof prompt === 'string' && prompt.length <= 240 && !/[\u0000-\u001f\u007f]/u.test(prompt) ? prompt.trim() : '';
  useEffect(() => {
    setStatus(readPublicGektaOpenStatus());
    return subscribePublicGektaOpenStatus(setStatus);
  }, []);
  const state = requested ? status : 'idle';
  const openGekta = () => {
    if (state === 'failed') {
      // Explicit recovery: reload fetches the assistant code again. No request
      // to the assistant API is repeated.
      window.location.reload();
      return;
    }
    setRequested(true);
    requestPublicGektaOpen({
      source: question ? 'public_prompt_card' : `public_entry_${variant}`,
      context: 'platform',
      prompts: [],
      draft: question || undefined,
      opener: buttonRef.current,
    });
  };
  const label = state === 'opening' ? COPY[lang].opening : state === 'failed' ? COPY[lang].failed : question || COPY[lang].ask;
  return <button
    ref={buttonRef}
    type='button'
    className={`pc-gekta-chat-button pc-gekta-chat-button--${variant} ${question ? 'pc-gekta-question' : ''} ${className}`.trim()}
    data-gekta-chat-entry='true'
    data-gekta-open-state={state}
    aria-haspopup='dialog'
    aria-controls='pc-public-assistant-panel'
    aria-busy={state === 'opening' ? true : undefined}
    aria-label={question && state === 'idle' ? `${COPY[lang].ask}: ${question}` : undefined}
    style={state === 'opening' ? { cursor: 'progress' } : undefined}
    onClick={openGekta}
  >
    <Sparkles size={variant === 'section' ? 17 : 15} strokeWidth={2.2} aria-hidden='true' />
    <span>{label}</span>
  </button>;
}
