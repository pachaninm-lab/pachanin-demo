import type { ReactNode } from 'react';
import { getLocale } from 'next-intl/server';

/** Surrounds published Russian legal artifacts without changing consent-pinned page bytes. */
export async function PublicLegalLanguageFrame({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const language = locale.startsWith('zh') ? 'zh' : locale.startsWith('en') ? 'en' : 'ru';
  return <div lang='ru' data-public-legal-original='ru' style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0, gap: 16, maxWidth: 1040, margin: '0 auto', overflowWrap: 'break-word', hyphens: 'auto' }}>
    {language !== 'ru' ? <p lang={language} role='note' style={{ margin: 0, padding: '12px 16px', borderRadius: 12, background: '#F8FAFB', color: '#334155', lineHeight: 1.5 }}>
      {language === 'zh' ? '本页法律说明目前提供俄语原文。' : 'This legal information is currently available in Russian.'}
    </p> : null}
    {children}
  </div>;
}
