import type { Metadata } from 'next';
import Link from 'next/link';
import {
  formatSupportRub,
  getSupportCase,
  getSupportSlaLabel,
  platformV7SupportCases,
  supportCategoryLabel,
  supportPriorityLabel,
  supportRoleLabel,
  supportStatusLabel,
} from '@/lib/platform-v7/support-center';

export const metadata: Metadata = {
  title: 'Обращение поддержки',
  description: 'Карточка обращения по сделке, документам, рейсу, деньгам или спору.',
};

export function generateStaticParams() {
  return platformV7SupportCases.map((item) => ({ caseId: item.id }));
}

export default function PlatformV7SupportCasePage({ params }: { params: { caseId: string } }) {
  const item = getSupportCase(params.caseId);

  if (!item) {
    return (
      <main style={page}>
        <section style={hero}>
          <span style={micro}>обращение не найдено</span>
          <h1 style={h1}>Нет такой карточки</h1>
          <p style={lead}>Проверьте номер обращения или вернитесь в центр поддержки.</p>
          <Link href='/platform-v7/support' style={primary}>Открыть поддержку</Link>
        </section>
      </main>
    );
  }

  return (
    <main style={page}>
      <section style={hero}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 8, maxWidth: 820 }}>
            <span style={micro}>{item.id} · {supportCategoryLabel[item.category]} · {supportPriorityLabel[item.priority]}</span>
            <h1 style={h1}>{item.title}</h1>
            <p style={lead}>{item.description}</p>
          </div>
          <div style={actions}>
            <Link href='/platform-v7/support/operator' style={secondary}>Очередь оператора</Link>
            <Link href='/platform-v7/support' style={secondary}>Все обращения</Link>
          </div>
        </div>
        <div style={grid}>
          <Cell label='Статус' value={supportStatusLabel[item.status]} />
          <Cell label='SLA' value={getSupportSlaLabel(item)} danger={item.priority === 'P0'} />
          <Cell label='Заявитель' value={supportRoleLabel[item.requesterRole]} />
          <Cell label='Ответственный' value={item.owner ?? '—'} />
          <Cell label='Деньги под влиянием' value={formatSupportRub(item.moneyAtRiskRub)} danger={(item.moneyAtRiskRub ?? 0) > 0} />
          <Cell label='Блокер' value={item.blocker ?? '—'} danger />
          <Cell label='Сделка' value={item.dealId ?? '—'} />
          <Cell label='Рейс' value={item.tripId ?? '—'} />
          <Cell label='Следующий шаг' value={item.nextAction ?? '—'} wide />
        </div>
      </section>

      <section style={twoCols}>
        <div style={panel}>
          <span style={micro}>сообщения</span>
          <div style={{ display: 'grid', gap: 8 }}>
            {item.messages.map((message) => (
              <article key={message.id} style={messageBox}>
                <strong style={{ color: '#0F1419', fontSize: 13 }}>{message.author}</strong>
                <p style={muted}>{message.body}</p>
                <span style={smallText}>{message.createdAt}</span>
              </article>
            ))}
          </div>
        </div>

        <div style={panel}>
          <span style={micro}>журнал и внутренние заметки</span>
          <div style={{ display: 'grid', gap: 8 }}>
            {item.auditEvents.map((event) => (
              <article key={event.id} style={auditRow}>
                <strong style={{ color: '#0F1419', fontSize: 13 }}>{event.action}</strong>
                <span style={smallText}>{event.actor} · {event.createdAt}</span>
              </article>
            ))}
            {item.internalNotes.map((note) => (
              <article key={note.id} style={noteBox}>
                <strong style={{ color: '#7C2D12', fontSize: 13 }}>Внутренняя заметка · {note.author}</strong>
                <p style={{ ...muted, color: '#7C2D12' }}>{note.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Cell({ label, value, danger = false, wide = false }: { label: string; value: string; danger?: boolean; wide?: boolean }) {
  return <div style={{ ...cell, gridColumn: wide ? 'span 2' : undefined }}><span style={micro}>{label}</span><strong style={{ color: danger ? '#B91C1C' : '#0F1419', fontSize: 13, lineHeight: 1.35 }}>{value}</strong></div>;
}

const page = { display: 'grid', gap: 14, maxWidth: 1120, margin: '0 auto', paddingBottom: 28 } as const;
const hero = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 20, padding: 18, display: 'grid', gap: 12, boxShadow: 'var(--pc-shadow-sm)' } as const;
const panel = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 12 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,5vw,44px)', lineHeight: 1.04, letterSpacing: '-0.04em', fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55, maxWidth: 820 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 850, letterSpacing: '0.04em' } as const;
const muted = { margin: 0, color: '#64748B', fontSize: 13, lineHeight: 1.5 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primary = { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 42, borderRadius: 12, padding: '10px 14px', background: '#0F172A', border: '1px solid #0F172A', color: '#fff', fontSize: 13, fontWeight: 850 } as const;
const secondary = { ...primary, background: '#fff', color: '#0F1419', border: '1px solid #E4E6EA' } as const;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(165px,1fr))', gap: 8 } as const;
const cell = { border: '1px solid #E4E6EA', borderRadius: 12, padding: 10, background: '#F8FAFB', display: 'grid', gap: 5 } as const;
const twoCols = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 } as const;
const messageBox = { border: '1px solid #E4E6EA', borderRadius: 14, padding: 12, display: 'grid', gap: 5, background: '#F8FAFB' } as const;
const auditRow = { border: '1px solid #E4E6EA', borderRadius: 12, padding: 10, display: 'grid', gap: 4, background: '#fff' } as const;
const noteBox = { border: '1px solid rgba(217,119,6,0.18)', borderRadius: 12, padding: 10, display: 'grid', gap: 4, background: 'rgba(217,119,6,0.07)' } as const;
const smallText = { color: '#94A3B8', fontSize: 11 } as const;
