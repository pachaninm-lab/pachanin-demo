'use client';

import { useState } from 'react';

type MatchStatus = 'matched' | 'unmatched' | 'partial';

interface Statement {
  id: string;
  date: string;
  amount: number;
  counterparty: string;
  ref: string;
  matchStatus: MatchStatus;
  dealId?: string;
}

const STATEMENTS: Statement[] = [
  { id: 'ST-001', date: '27.06.2026', amount: 1_650_000, counterparty: 'ООО «ЗернаТрейд»', ref: 'п/п 4521', matchStatus: 'matched', dealId: 'DL-9102' },
  { id: 'ST-002', date: '27.06.2026', amount: 2_340_000, counterparty: 'АО «АгроМаркет»', ref: 'п/п 4522', matchStatus: 'matched', dealId: 'DL-9107' },
  { id: 'ST-003', date: '26.06.2026', amount: 890_000, counterparty: 'ООО «ВолгаГрейн»', ref: 'п/п 3980', matchStatus: 'unmatched' },
  { id: 'ST-004', date: '26.06.2026', amount: 4_100_000, counterparty: 'ИП Соловьёв А.К.', ref: 'п/п 3981', matchStatus: 'partial', dealId: 'DL-9114' },
  { id: 'ST-005', date: '25.06.2026', amount: 720_000, counterparty: 'ООО «КубаньЗерно»', ref: 'п/п 3744', matchStatus: 'matched', dealId: 'DL-9109' },
];

const STATUS_CONFIG: Record<MatchStatus, { label: string; bg: string; color: string }> = {
  matched: { label: 'Сопоставлен', bg: '#F0FDF4', color: '#0A7A5F' },
  unmatched: { label: 'Не сопоставлен', bg: '#FFF1F1', color: '#DC2626' },
  partial: { label: 'Частично', bg: '#FFFBEB', color: '#D97706' },
};

function rub(n: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
}

export function BankReconciliationPanel() {
  const [filter, setFilter] = useState<MatchStatus | 'all'>('all');
  const [imported, setImported] = useState(false);

  const filtered = filter === 'all' ? STATEMENTS : STATEMENTS.filter((s) => s.matchStatus === filter);
  const matched = STATEMENTS.filter((s) => s.matchStatus === 'matched').length;
  const unmatched = STATEMENTS.filter((s) => s.matchStatus === 'unmatched').length;
  const partial = STATEMENTS.filter((s) => s.matchStatus === 'partial').length;
  const totalImported = STATEMENTS.reduce((sum, s) => sum + s.amount, 0);

  const label: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };
  const chip = (active: boolean, color: string): React.CSSProperties => ({
    padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
    border: active ? 'none' : '1px solid #E4E6EA',
    background: active ? color : 'transparent',
    color: active ? '#fff' : '#64748B',
  });

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
        {[
          { label: 'Импортировано', value: rub(totalImported), sub: `${STATEMENTS.length} записей`, color: '#0F1419' },
          { label: 'Сопоставлено', value: matched, sub: 'автоматически', color: '#0A7A5F' },
          { label: 'Не сопоставлено', value: unmatched, sub: 'ручная обработка', color: '#DC2626' },
          { label: 'Частично', value: partial, sub: 'требует уточнения', color: '#D97706' },
        ].map((stat) => (
          <div key={stat.label} style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid #E4E6EA', background: '#F8FAFB' }}>
            <div style={label}>{stat.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: stat.color, marginTop: 4 }}>{stat.value}</div>
            <div style={{ fontSize: 10, color: '#94A3B8' }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Import panel */}
      <div
        style={{
          border: `2px dashed ${imported ? '#BBF7D0' : '#CBD5E1'}`,
          borderRadius: 14, padding: '16px', textAlign: 'center',
          background: imported ? '#F0FDF4' : '#F8FAFB', cursor: 'pointer',
        }}
        onClick={() => setImported(true)}
      >
        {imported ? (
          <div style={{ color: '#0A7A5F', fontWeight: 700, fontSize: 13 }}>✓ Выписка МТ940 импортирована · 27.06.2026</div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600 }}>Импорт банковской выписки</div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Поддерживаются форматы МТ940, CSV, Excel</div>
          </>
        )}
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button style={chip(filter === 'all', '#0F1419')} onClick={() => setFilter('all')}>Все ({STATEMENTS.length})</button>
        <button style={chip(filter === 'matched', '#0A7A5F')} onClick={() => setFilter('matched')}>Сопоставлены ({matched})</button>
        <button style={chip(filter === 'unmatched', '#DC2626')} onClick={() => setFilter('unmatched')}>Не сопоставлены ({unmatched})</button>
        <button style={chip(filter === 'partial', '#D97706')} onClick={() => setFilter('partial')}>Частично ({partial})</button>
      </div>

      {/* Statements table */}
      <div style={{ border: '1px solid #E4E6EA', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
        {filtered.map((s, i) => {
          const sc = STATUS_CONFIG[s.matchStatus];
          return (
            <div
              key={s.id}
              style={{
                display: 'grid', gridTemplateColumns: '80px 1fr 120px 110px',
                gap: 12, padding: '12px 16px', alignItems: 'center',
                borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none',
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0F1419' }}>{s.date}</div>
                <div style={{ fontSize: 10, color: '#94A3B8' }}>{s.ref}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419' }}>{s.counterparty}</div>
                {s.dealId && (
                  <div style={{ fontSize: 10, color: '#2563EB', marginTop: 2 }}>↳ {s.dealId}</div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0F1419' }}>{rub(s.amount)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 8,
                  background: sc.bg, color: sc.color,
                }}>
                  {sc.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Демо-превью. В боевом контуре — ежедневный автоимпорт выписки через API банка (МТ940), автосопоставление по ИНН + сумме + дате, очередь ручной обработки для Support Ops.
      </div>
    </div>
  );
}
