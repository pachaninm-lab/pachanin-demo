'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { SupportCaseView } from './SupportCaseView';
import { useSupportCases } from '@/lib/platform-v7/support-client-store';

const card: CSSProperties = { background: 'var(--pc-bg-card, #fff)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 16 };

export function SupportCaseRouteClient({ caseId }: { caseId: string }) {
  const { cases, messages, internalNotes, auditEvents } = useSupportCases();
  const item = cases.find((supportCase) => supportCase.id === caseId);

  if (!item) {
    return (
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gap: 14 }}>
        <section style={{ ...card, display: 'grid', gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 28 }}>Обращение не найдено</h1>
          <p style={{ margin: 0, color: 'var(--pc-text-muted, #64748b)', lineHeight: 1.6 }}>В текущем контуре нет обращения с таким ID. Откройте список обращений или создайте новое обращение с привязкой к объекту платформы.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/support' style={{ color: 'var(--pc-accent, #0A7A5F)', fontWeight: 900, textDecoration: 'none' }}>Все обращения</Link>
            <Link href='/platform-v7/support/new' style={{ color: 'var(--pc-accent, #0A7A5F)', fontWeight: 900, textDecoration: 'none' }}>Создать обращение</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <SupportCaseView
      item={item}
      messages={messages.filter((message) => message.caseId === item.id && message.public)}
      notes={internalNotes.filter((note) => note.caseId === item.id)}
      audit={auditEvents.filter((event) => event.caseId === item.id)}
    />
  );
}
