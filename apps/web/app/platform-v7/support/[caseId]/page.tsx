import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SUPPORT_AUDIT_EVENTS, SUPPORT_CASES, SUPPORT_INTERNAL_NOTES, SUPPORT_MESSAGES } from '@/lib/platform-v7/support-data';
import { SUPPORT_CATEGORY_LABELS, SUPPORT_PRIORITY_LABELS, SUPPORT_STATUS_LABELS, supportFormatRub, supportObjectLabel } from '@/lib/platform-v7/support-helpers';

export const metadata: Metadata = {
  title: 'Карточка обращения',
  description: 'Карточка обращения поддержки исполнения сделки.',
};

const card = { background: 'var(--pc-bg-card, #fff)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 16 };
const muted = { color: 'var(--pc-text-muted, #64748b)', fontSize: 13, lineHeight: 1.6 };
const pill = { display: 'inline-flex', padding: '5px 9px', borderRadius: 999, border: '1px solid var(--pc-border, #E4E6EA)', fontSize: 11, fontWeight: 800 };

function dateTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default async function SupportCasePage({ params }: { params: Promise<{ caseId: string }> | { caseId: string } }) {
  const { caseId } = await Promise.resolve(params);
  const item = SUPPORT_CASES.find((supportCase) => supportCase.id === caseId);
  if (!item) notFound();
  const messages = SUPPORT_MESSAGES.filter((message) => message.caseId === item.id && message.public);
  const notes = SUPPORT_INTERNAL_NOTES.filter((note) => note.caseId === item.id);
  const audit = SUPPORT_AUDIT_EVENTS.filter((event) => event.caseId === item.id);

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1120, margin: '0 auto' }}>
      <section style={{ ...card, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={pill}>{item.id}</span>
          <span style={pill}>{SUPPORT_PRIORITY_LABELS[item.priority]}</span>
          <span style={pill}>{SUPPORT_CATEGORY_LABELS[item.category]}</span>
          <span style={pill}>{SUPPORT_STATUS_LABELS[item.status]}</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 28 }}>{item.title}</h1>
        <p style={{ ...muted, maxWidth: 760 }}>{item.description}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href='/platform-v7/support' style={{ color: 'var(--pc-accent, #0A7A5F)', fontWeight: 900, textDecoration: 'none' }}>Все обращения</Link>
          <Link href='/platform-v7/support/operator' style={{ color: 'var(--pc-accent, #0A7A5F)', fontWeight: 900, textDecoration: 'none' }}>Операторская очередь</Link>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        <div style={card}><div style={muted}>Объект</div><b>{supportObjectLabel(item)}</b></div>
        <div style={card}><div style={muted}>SLA</div><b>{dateTime(item.slaDueAt)}</b></div>
        <div style={card}><div style={muted}>Ответственный</div><b>{item.owner}</b></div>
        <div style={card}><div style={muted}>Деньги под риском</div><b>{supportFormatRub(item.moneyAtRiskRub)}</b></div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 14 }}>
        <div style={{ display: 'grid', gap: 14 }}>
          <section style={{ ...card, display: 'grid', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Что происходит сейчас</h2>
            <div style={muted}>Блокер: <b style={{ color: 'var(--pc-text-primary, #0F1419)' }}>{item.blocker}</b></div>
            <div style={muted}>Следующий шаг: <b style={{ color: 'var(--pc-text-primary, #0F1419)' }}>{item.nextAction}</b></div>
          </section>
          <section style={{ ...card, display: 'grid', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Сообщения</h2>
            {messages.map((message) => <div key={message.id} style={{ border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 14, padding: 12 }}><b>{message.author}</b><div style={muted}>{dateTime(message.createdAt)}</div><p style={{ margin: '8px 0 0', lineHeight: 1.6 }}>{message.body}</p></div>)}
          </section>
        </div>
        <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <section style={{ ...card, display: 'grid', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Внутренние заметки</h2>
            {notes.map((note) => <div key={note.id} style={muted}><b>{note.author}:</b> {note.body}</div>)}
            {notes.length === 0 ? <div style={muted}>Заметок нет.</div> : null}
          </section>
          <section style={{ ...card, display: 'grid', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Журнал действий</h2>
            {audit.map((event) => <div key={event.id} style={{ borderLeft: '2px solid var(--pc-accent, #0A7A5F)', paddingLeft: 10 }}><b>{event.actor}</b><div style={muted}>{dateTime(event.createdAt)} · {event.description}</div></div>)}
          </section>
        </aside>
      </section>
    </div>
  );
}
