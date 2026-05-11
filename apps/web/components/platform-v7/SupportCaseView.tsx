import type { CSSProperties } from 'react';
import Link from 'next/link';
import type { SupportAuditEvent, SupportCase, SupportInternalNote, SupportMessage } from '@/lib/platform-v7/support-types';
import { SUPPORT_CATEGORY_LABELS, SUPPORT_PRIORITY_LABELS, SUPPORT_STATUS_LABELS, supportAuditTransitionLabel, supportFormatRub, supportInternalNoteIntegrityLabel, supportLinkedExecutionHref, supportObjectLabel, supportSlaLabel, supportSortedAuditEvents, supportSortedInternalNotes } from '@/lib/platform-v7/support-helpers';

const card: CSSProperties = { background: 'var(--pc-bg-card, #fff)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 16 };
const muted: CSSProperties = { color: 'var(--pc-text-muted, #64748b)', fontSize: 13, lineHeight: 1.6 };
const pill: CSSProperties = { display: 'inline-flex', padding: '5px 9px', borderRadius: 999, border: '1px solid var(--pc-border, #E4E6EA)', fontSize: 11, fontWeight: 800 };

function dt(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function SupportCaseView({ item, messages, notes, audit }: { item: SupportCase; messages: SupportMessage[]; notes: SupportInternalNote[]; audit: SupportAuditEvent[] }) {
  const linkedExecutionHref = supportLinkedExecutionHref(item);
  const sortedNotes = supportSortedInternalNotes(notes);
  const sortedAudit = supportSortedAuditEvents(audit);

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1120, margin: '0 auto' }}>
      <section style={{ ...card, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><span style={pill}>{item.id}</span><span style={pill}>{SUPPORT_PRIORITY_LABELS[item.priority]}</span><span style={pill}>{SUPPORT_CATEGORY_LABELS[item.category]}</span><span style={pill}>{SUPPORT_STATUS_LABELS[item.status]}</span><span style={pill}>{supportSlaLabel(item)}</span></div>
        <h1 style={{ margin: 0, fontSize: 28 }}>{item.title}</h1>
        <p style={{ ...muted, maxWidth: 760 }}>{item.description}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Link href='/platform-v7/support' style={{ color: 'var(--pc-accent, #0A7A5F)', fontWeight: 900, textDecoration: 'none' }}>Все обращения</Link><Link href='/platform-v7/support/operator' style={{ color: 'var(--pc-accent, #0A7A5F)', fontWeight: 900, textDecoration: 'none' }}>Операторская очередь</Link><Link href={linkedExecutionHref} style={{ color: 'var(--pc-accent, #0A7A5F)', fontWeight: 900, textDecoration: 'none' }}>Связанный контур исполнения</Link></div>
      </section>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        <div style={card}><div style={muted}>Объект</div><b>{supportObjectLabel(item)}</b></div><div style={card}><div style={muted}>SLA</div><b>{supportSlaLabel(item)} · {dt(item.slaDueAt)}</b></div><div style={card}><div style={muted}>Ответственный</div><b>{item.owner}</b></div><div style={card}><div style={muted}>Деньги под риском</div><b>{supportFormatRub(item.moneyAtRiskRub)}</b></div>
      </section>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
        <div style={{ display: 'grid', gap: 14 }}>
          <section style={{ ...card, display: 'grid', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Что происходит сейчас</h2>
            <div style={muted}>Блокер: <b style={{ color: 'var(--pc-text-primary, #0F1419)' }}>{item.blocker}</b></div>
            <div style={muted}>Следующий шаг: <b style={{ color: 'var(--pc-text-primary, #0F1419)' }}>{item.nextAction}</b></div>
            <Link href={linkedExecutionHref} style={{ color: 'var(--pc-accent, #0A7A5F)', fontWeight: 900, textDecoration: 'none' }}>Открыть связанный объект</Link>
          </section>
          {item.evidenceNeeded.length > 0 ? (
            <section style={{ ...card, display: 'grid', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Что нужно для продолжения</h2>
              <div style={{ ...muted, fontWeight: 800 }}>Отсутствующие доказательства</div>
              <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'grid', gap: 6 }}>
                {item.evidenceNeeded.map((evidence) => (
                  <li key={evidence} style={{ ...muted, listStyle: 'disc' }}>{evidence}</li>
                ))}
              </ul>
              <div style={{ ...muted, fontSize: 12 }}>Поддержка не может продолжить обращение, пока эти материалы не приложены или не подтверждены.</div>
            </section>
          ) : null}
          <section style={{ ...card, display: 'grid', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Сообщения</h2>
            {messages.map((m) => <div key={m.id} style={{ border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 14, padding: 12 }}><b>{m.author}</b><div style={muted}>{dt(m.createdAt)}</div><p style={{ margin: '8px 0 0', lineHeight: 1.6 }}>{m.body}</p></div>)}
          </section>
        </div>
        <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          {sortedNotes.length > 0 ? (
            <section style={{ ...card, display: 'grid', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Внутренние заметки</h2>
              {sortedNotes.map((note) => <div key={note.id} style={{ display: 'grid', gap: 4 }}><div style={muted}>{supportInternalNoteIntegrityLabel(note)}</div><div style={muted}><b>{note.author}:</b> {note.body}</div></div>)}
            </section>
          ) : null}
          <section style={{ ...card, display: 'grid', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Журнал действий</h2>
            {sortedAudit.map((e) => { const transition = supportAuditTransitionLabel(e); return <div key={e.id} style={{ borderLeft: '2px solid var(--pc-accent, #0A7A5F)', paddingLeft: 10, display: 'grid', gap: 4 }}><b>{e.actor} · {e.action}</b><div style={muted}>{dt(e.createdAt)} · {e.description}</div>{transition ? <div style={muted}>Переход: {transition}</div> : null}<div style={muted}>ID события: {e.id}</div></div>; })}
          </section>
        </aside>
      </section>
    </div>
  );
}
