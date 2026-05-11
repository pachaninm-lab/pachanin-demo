'use client';

import type { CSSProperties } from 'react';
import * as React from 'react';
import Link from 'next/link';
import { useSupportCases } from '@/lib/platform-v7/support-client-store';
import type { SupportCategory, SupportPriority, SupportStatus } from '@/lib/platform-v7/support-types';
import { SUPPORT_CATEGORY_LABELS, SUPPORT_MATURITY_LABEL, SUPPORT_PRIORITY_LABELS, SUPPORT_STATUS_LABELS, supportFormatRub, supportLastMessage, supportObjectLabel, supportSortCases } from '@/lib/platform-v7/support-helpers';

const card: CSSProperties = { background: 'var(--pc-bg-card, #fff)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 16 };
const muted: CSSProperties = { color: 'var(--pc-text-muted, #64748b)', fontSize: 13, lineHeight: 1.6 };
const pill: CSSProperties = { display: 'inline-flex', padding: '5px 9px', borderRadius: 999, border: '1px solid var(--pc-border, #E4E6EA)', fontSize: 11, fontWeight: 800 };
const filterBtn = (active: boolean): CSSProperties => ({ display: 'inline-flex', padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: 'pointer', border: active ? '2px solid var(--pc-accent, #0A7A5F)' : '1px solid var(--pc-border, #E4E6EA)', background: active ? 'var(--pc-accent-bg, rgba(10,122,95,0.08))' : 'transparent', color: active ? 'var(--pc-accent, #0A7A5F)' : 'inherit' });

function dt(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

const CATEGORY_FILTERS: { value: SupportCategory | null; label: string }[] = [
  { value: null, label: 'Все' },
  { value: 'money', label: 'Деньги' },
  { value: 'documents', label: 'Документы' },
  { value: 'logistics', label: 'Логистика' },
  { value: 'acceptance', label: 'Приёмка' },
  { value: 'quality', label: 'Качество' },
  { value: 'dispute', label: 'Спор' },
  { value: 'access', label: 'Доступ' },
];

const PRIORITY_FILTERS: { value: SupportPriority | null; label: string }[] = [
  { value: null, label: 'Все' },
  { value: 'P0', label: 'P0 Критично' },
  { value: 'P1', label: 'P1 Высоко' },
  { value: 'P2', label: 'P2 Обычно' },
];

const STATUS_FILTERS: { value: SupportStatus | null; label: string }[] = [
  { value: null, label: 'Все' },
  { value: 'assigned_operator', label: 'У оператора' },
  { value: 'assigned_bank', label: 'В банке' },
  { value: 'assigned_logistics', label: 'В логистике' },
  { value: 'waiting_user', label: 'Нужны данные' },
  { value: 'escalated', label: 'Эскалировано' },
  { value: 'resolved', label: 'Решено' },
];

export function SupportIndexPage() {
  const { cases, messages } = useSupportCases();
  const [filterCategory, setFilterCategory] = React.useState<SupportCategory | null>(null);
  const [filterPriority, setFilterPriority] = React.useState<SupportPriority | null>(null);
  const [filterStatus, setFilterStatus] = React.useState<SupportStatus | null>(null);

  const sortedCases = supportSortCases(cases).filter((item) => {
    if (filterCategory && item.category !== filterCategory) return false;
    if (filterPriority && item.priority !== filterPriority) return false;
    if (filterStatus && item.status !== filterStatus) return false;
    return true;
  });

  const allCases = supportSortCases(cases);
  const totalMoney = allCases.reduce((sum, item) => sum + item.moneyAtRiskRub, 0);
  const urgent = allCases.filter((item) => item.priority === 'P0' || item.priority === 'P1').length;

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1180, margin: '0 auto' }}>
      <section style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ ...pill, width: 'fit-content' }}>{SUPPORT_MATURITY_LABEL}</div>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.1 }}>Центр поддержки исполнения сделки</h1>
          <p style={muted}>Каждое обращение привязано к сделке, документу, рейсу, деньгам, спору или блокеру. Пользователь видит статус и следующий шаг. Оператор видит очередь, сумму риска и журнал действий.</p>
        </div>
        <Link href='/platform-v7/support/new' style={{ textDecoration: 'none', padding: '12px 14px', borderRadius: 14, background: 'var(--pc-accent, #0A7A5F)', color: '#fff', fontSize: 13, fontWeight: 900, width: 'fit-content' }}>Создать обращение</Link>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
        <div style={card}><div style={muted}>Всего обращений</div><div style={{ fontSize: 28, fontWeight: 900 }}>{allCases.length}</div></div>
        <div style={card}><div style={muted}>Срочные (P0/P1)</div><div style={{ fontSize: 28, fontWeight: 900 }}>{urgent}</div></div>
        <div style={card}><div style={muted}>Деньги под риском</div><div style={{ fontSize: 28, fontWeight: 900 }}>{supportFormatRub(totalMoney)}</div></div>
        <div style={card}><div style={muted}>Операторская очередь</div><Link href='/platform-v7/support/operator' style={{ color: 'var(--pc-accent, #0A7A5F)', fontSize: 14, fontWeight: 900, textDecoration: 'none' }}>Открыть очередь</Link></div>
      </section>

      <section style={{ ...card, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 13 }}>Фильтр по категории</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATEGORY_FILTERS.map((f) => (
            <button key={String(f.value)} onClick={() => setFilterCategory(f.value)} style={filterBtn(filterCategory === f.value)}>{f.label}</button>
          ))}
        </div>
        <div style={{ fontWeight: 800, fontSize: 13 }}>Приоритет</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PRIORITY_FILTERS.map((f) => (
            <button key={String(f.value)} onClick={() => setFilterPriority(f.value)} style={filterBtn(filterPriority === f.value)}>{f.label}</button>
          ))}
        </div>
        <div style={{ fontWeight: 800, fontSize: 13 }}>Статус</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map((f) => (
            <button key={String(f.value)} onClick={() => setFilterStatus(f.value)} style={filterBtn(filterStatus === f.value)}>{f.label}</button>
          ))}
        </div>
      </section>

      <section style={{ ...card, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Мои обращения</h2>
          <Link href='/platform-v7/support/new' style={{ color: 'var(--pc-accent, #0A7A5F)', fontWeight: 900, textDecoration: 'none' }}>+ Новое обращение</Link>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {sortedCases.map((item) => (
            <Link key={item.id} href={`/platform-v7/support/${item.id}`} style={{ textDecoration: 'none', color: 'inherit', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 16, padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, background: 'var(--pc-bg-elevated, rgba(15,20,25,0.02))' }}>
              <div style={{ display: 'grid', gap: 7 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><span style={pill}>{item.id}</span><span style={pill}>{SUPPORT_PRIORITY_LABELS[item.priority]}</span><span style={pill}>{SUPPORT_CATEGORY_LABELS[item.category]}</span></div>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{item.title}</div>
                <div style={muted}>{supportLastMessage(item.id, messages)}</div>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={muted}>Статус</div><b>{SUPPORT_STATUS_LABELS[item.status]}</b>
                <div style={muted}>Следующий шаг: {item.nextAction}</div>
                {item.evidenceNeeded.length > 0 ? <div style={{ ...muted, color: 'var(--pc-danger, #B42318)', fontWeight: 700 }}>Не хватает: {item.evidenceNeeded.length} пункт(а)</div> : null}
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={muted}>{supportObjectLabel(item)}</div>
                <b>SLA: {dt(item.slaDueAt)}</b>
                <b>{supportFormatRub(item.moneyAtRiskRub)}</b>
              </div>
            </Link>
          ))}
          {sortedCases.length === 0 ? <div style={muted}>По выбранным фильтрам обращений нет.</div> : null}
        </div>
      </section>
    </div>
  );
}
