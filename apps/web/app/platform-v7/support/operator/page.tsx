import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import type { SupportCategory, SupportPriority, SupportRelatedEntityType } from '@/lib/platform-v7/support-types';
import { SUPPORT_CASES } from '@/lib/platform-v7/support-data';
import { SUPPORT_CATEGORY_LABELS, SUPPORT_PRIORITY_LABELS, SUPPORT_STATUS_LABELS, supportFormatRub, supportObjectLabel, supportSortCases } from '@/lib/platform-v7/support-helpers';

export const metadata: Metadata = { title: 'Операторская очередь поддержки', description: 'Очередь обращений поддержки исполнения сделки.' };

const card: CSSProperties = { background: 'var(--pc-bg-card, #fff)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 16 };
const muted: CSSProperties = { color: 'var(--pc-text-muted, #64748b)', fontSize: 13, lineHeight: 1.6 };
const pill: CSSProperties = { display: 'inline-flex', padding: '6px 10px', borderRadius: 999, border: '1px solid var(--pc-border, #E4E6EA)', fontSize: 12, fontWeight: 800, textDecoration: 'none', color: 'inherit' };
const entityLabels: Record<SupportRelatedEntityType, string> = { deal: 'Сделка', lot: 'Лот', trip: 'Рейс', document: 'Документ', blocker: 'Блокер', dispute: 'Спор', money: 'Деньги', integration: 'Интеграция', other: 'Объект' };

function one(value: string | string[] | undefined): string | undefined { return Array.isArray(value) ? value[0] : value; }
function dt(value: string) { return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function q(key: string, value: string) { return `/platform-v7/support/operator?${key}=${value}`; }

export default async function SupportOperatorPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined> }) {
  const params = await Promise.resolve(searchParams ?? {});
  const priority = one(params.priority) as SupportPriority | undefined;
  const category = one(params.category) as SupportCategory | undefined;
  const entity = one(params.entity) as SupportRelatedEntityType | undefined;
  const moneyOnly = one(params.money) === 'risk';
  const todayOnly = one(params.sla) === 'today';

  const rows = supportSortCases(SUPPORT_CASES).filter((item) => {
    if (priority && item.priority !== priority) return false;
    if (category && item.category !== category) return false;
    if (entity && item.relatedEntityType !== entity) return false;
    if (moneyOnly && item.moneyAtRiskRub <= 0) return false;
    if (todayOnly && !item.slaDueAt.startsWith('2026-05-05')) return false;
    return true;
  });
  const selected = rows[0];
  const moneyTotal = rows.reduce((sum, item) => sum + item.moneyAtRiskRub, 0);

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1220, margin: '0 auto' }}>
      <section style={{ ...card, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--pc-accent, #0A7A5F)' }}>Операторская очередь поддержки исполнения</div>
        <h1 style={{ margin: 0, fontSize: 28 }}>Очередь обращений</h1>
        <p style={muted}>Оператор видит SLA, приоритет, категорию, роль, объект, сумму риска, блокер и следующий шаг. Все действия должны оставлять запись в журнале.</p>
      </section>

      <section style={{ ...card, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/support/operator' style={pill}>Все</Link>
        {(['P0', 'P1', 'P2', 'P3'] as SupportPriority[]).map((item) => <Link key={item} href={q('priority', item)} style={pill}>{SUPPORT_PRIORITY_LABELS[item]}</Link>)}
        {(['money', 'documents', 'logistics', 'acceptance', 'quality', 'dispute', 'access', 'integration'] as SupportCategory[]).map((item) => <Link key={item} href={q('category', item)} style={pill}>{SUPPORT_CATEGORY_LABELS[item]}</Link>)}
        {(['deal', 'trip', 'document', 'blocker'] as SupportRelatedEntityType[]).map((item) => <Link key={item} href={q('entity', item)} style={pill}>{entityLabels[item]}</Link>)}
        <Link href={q('money', 'risk')} style={pill}>С деньгами под риском</Link>
        <Link href={q('sla', 'today')} style={pill}>SLA сегодня</Link>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
        <div style={card}><div style={muted}>В очереди</div><div style={{ fontSize: 28, fontWeight: 900 }}>{rows.length}</div></div>
        <div style={card}><div style={muted}>Деньги под риском</div><div style={{ fontSize: 28, fontWeight: 900 }}>{supportFormatRub(moneyTotal)}</div></div>
        <div style={card}><div style={muted}>P0</div><div style={{ fontSize: 28, fontWeight: 900 }}>{rows.filter((item) => item.priority === 'P0').length}</div></div>
        <div style={card}><div style={muted}>Срок сегодня</div><div style={{ fontSize: 28, fontWeight: 900 }}>{rows.filter((item) => item.slaDueAt.startsWith('2026-05-05')).length}</div></div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
        <div style={{ ...card, display: 'grid', gap: 10 }}>
          {rows.map((item) => (
            <Link key={item.id} href={`/platform-v7/support/${item.id}`} style={{ textDecoration: 'none', color: 'inherit', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 16, padding: 14, display: 'grid', gap: 7, background: item.id === selected?.id ? 'var(--pc-accent-bg, rgba(10,122,95,0.08))' : 'var(--pc-bg-elevated, rgba(15,20,25,0.02))' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><b>{item.id}</b><span>{SUPPORT_PRIORITY_LABELS[item.priority]}</span><span>{SUPPORT_CATEGORY_LABELS[item.category]}</span><span>SLA {dt(item.slaDueAt)}</span></div>
              <div style={{ fontSize: 16, fontWeight: 900 }}>{item.title}</div>
              <div style={muted}>{supportObjectLabel(item)} · {supportFormatRub(item.moneyAtRiskRub)}</div>
              <div style={muted}>Блокер: {item.blocker}</div>
            </Link>
          ))}
          {rows.length === 0 ? <div style={muted}>По выбранным фильтрам обращений нет.</div> : null}
        </div>

        {selected ? (
          <aside style={{ ...card, display: 'grid', gap: 12, alignContent: 'start' }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{selected.title}</div>
            <div style={muted}>{SUPPORT_STATUS_LABELS[selected.status]} · {selected.owner}</div>
            <div><b>Деньги под риском:</b> {supportFormatRub(selected.moneyAtRiskRub)}</div>
            <div><b>Блокер:</b> {selected.blocker}</div>
            <div><b>Следующий шаг:</b> {selected.nextAction}</div>
            <Link href={`/platform-v7/support/${selected.id}`} style={{ color: 'var(--pc-accent, #0A7A5F)', fontWeight: 900, textDecoration: 'none' }}>Открыть карточку</Link>
            <div style={{ borderTop: '1px solid var(--pc-border, #E4E6EA)', paddingTop: 12, display: 'grid', gap: 8 }}>
              <b>Шаблоны ответа</b>
              <div style={muted}>Принято в работу. Проверяем объект и блокер.</div>
              <div style={muted}>Нужны дополнительные данные по сделке.</div>
              <div style={muted}>Передано ответственному контуру.</div>
            </div>
            <div style={{ borderTop: '1px solid var(--pc-border, #E4E6EA)', paddingTop: 12, display: 'grid', gap: 8 }}>
              <b>Эскалация</b>
              <div style={muted}>Банк · Логистика · Оператор сделки · Документы</div>
            </div>
          </aside>
        ) : null}
      </section>
    </div>
  );
}
