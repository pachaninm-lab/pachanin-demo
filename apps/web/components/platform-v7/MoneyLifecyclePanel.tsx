'use client';

import { useState } from 'react';

type MoneyEventType = 'RESERVE' | 'RELEASE' | 'COMMISSION' | 'HOLD' | 'REFUND' | 'PENALTY' | 'PLATFORM_FEE';
type EventStatus = 'pending' | 'completed' | 'failed';

interface MoneyEvent {
  id: string;
  dealId: string;
  type: MoneyEventType;
  fromAccount: string;
  toAccount: string;
  amountKopecks: number;
  status: EventStatus;
  triggeredBy: string;
  createdAt: string;
  completedAt: string | null;
  idempotencyKey: string;
}

const EVENTS: MoneyEvent[] = [
  { id: 'me-001', dealId: 'DL-9095', type: 'RESERVE',    fromAccount: 'buyer_account:DL-9095',   toAccount: 'escrow_account:DL-9095',   amountKopecks: 6264000000, status: 'completed', triggeredBy: 'deal.created',        createdAt: '2024-03-01T10:00:00Z', completedAt: '2024-03-01T10:00:12Z', idempotencyKey: 'reserve.DL-9095.v1' },
  { id: 'me-002', dealId: 'DL-9095', type: 'RELEASE',    fromAccount: 'escrow_account:DL-9095',  toAccount: 'seller_account:AG-001',    amountKopecks: 6139440000, status: 'completed', triggeredBy: 'act.signed',          createdAt: '2024-03-20T11:30:00Z', completedAt: '2024-03-20T11:30:08Z', idempotencyKey: 'release.DL-9095.v1' },
  { id: 'me-003', dealId: 'DL-9095', type: 'COMMISSION', fromAccount: 'escrow_account:DL-9095',  toAccount: 'platform_account',         amountKopecks: 124560000,  status: 'completed', triggeredBy: 'act.signed',          createdAt: '2024-03-20T11:30:00Z', completedAt: '2024-03-20T11:30:09Z', idempotencyKey: 'commission.DL-9095.v1' },
  { id: 'me-004', dealId: 'DL-9110', type: 'RESERVE',    fromAccount: 'buyer_account:DL-9110',   toAccount: 'escrow_account:DL-9110',   amountKopecks: 2355000000, status: 'completed', triggeredBy: 'deal.created',        createdAt: '2024-03-10T14:00:00Z', completedAt: '2024-03-10T14:00:07Z', idempotencyKey: 'reserve.DL-9110.v1' },
  { id: 'me-005', dealId: 'DL-9110', type: 'HOLD',       fromAccount: 'escrow_account:DL-9110',  toAccount: 'dispute_hold:DL-9110',     amountKopecks: 2355000000, status: 'completed', triggeredBy: 'dispute.opened',      createdAt: '2024-03-15T09:00:00Z', completedAt: '2024-03-15T09:00:04Z', idempotencyKey: 'hold.DL-9110.dispute-01' },
  { id: 'me-006', dealId: 'DL-8901', type: 'PLATFORM_FEE', fromAccount: 'escrow_account:DL-8901', toAccount: 'platform_account',        amountKopecks: 56700000,   status: 'completed', triggeredBy: 'deal.closed',         createdAt: '2024-02-20T16:00:00Z', completedAt: '2024-02-20T16:00:05Z', idempotencyKey: 'platform_fee.DL-8901.v1' },
];

const TYPE_CFG: Record<MoneyEventType, { label: string; bg: string; color: string; dir: string }> = {
  RESERVE:     { label: 'Резерв',      bg: '#EFF6FF', color: '#1E40AF', dir: '→ Эскроу' },
  RELEASE:     { label: 'Выплата',     bg: '#D1FAE5', color: '#065F46', dir: '→ Продавец' },
  COMMISSION:  { label: 'Комиссия',    bg: '#F5F3FF', color: '#5B21B6', dir: '→ Платформа' },
  HOLD:        { label: 'Заморозка',   bg: '#FEF3C7', color: '#92400E', dir: '→ Диспут-счёт' },
  REFUND:      { label: 'Возврат',     bg: '#FEE2E2', color: '#991B1B', dir: '→ Покупатель' },
  PENALTY:     { label: 'Штраф',       bg: '#FEE2E2', color: '#991B1B', dir: '→ Платформа' },
  PLATFORM_FEE:{ label: 'Сбор плат.',  bg: '#F5F3FF', color: '#5B21B6', dir: '→ Платформа' },
};

const STATUS_CFG: Record<EventStatus, { label: string; color: string }> = {
  completed: { label: '✓ Выполнено', color: '#065F46' },
  pending:   { label: '⏳ В процессе', color: '#92400E' },
  failed:    { label: '✗ Ошибка',    color: '#DC2626' },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

function fmtKopecks(k: number) {
  const rub = k / 100;
  if (rub >= 1_000_000) return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  return `${(rub / 1_000).toFixed(0)} тыс. ₽`;
}

type Tab = 'flow' | 'events' | 'invariants';

export function MoneyLifecyclePanel() {
  const [tab, setTab] = useState<Tab>('flow');
  const [dealFilter, setDealFilter] = useState<string>('all');

  const deals = [...new Set(EVENTS.map(e => e.dealId))];
  const filtered = dealFilter === 'all' ? EVENTS : EVENTS.filter(e => e.dealId === dealFilter);

  const totalReleased = EVENTS.filter(e => e.type === 'RELEASE' && e.status === 'completed').reduce((s, e) => s + e.amountKopecks, 0);
  const totalHeld = EVENTS.filter(e => e.type === 'HOLD' && e.status === 'completed').reduce((s, e) => s + e.amountKopecks, 0);
  const totalCommission = EVENTS.filter(e => (e.type === 'COMMISSION' || e.type === 'PLATFORM_FEE') && e.status === 'completed').reduce((s, e) => s + e.amountKopecks, 0);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
        {[
          { label: 'Выплачено продавцам', value: fmtKopecks(totalReleased), color: '#065F46' },
          { label: 'В заморозке',         value: fmtKopecks(totalHeld),     color: '#92400E' },
          { label: 'Комиссии платформы',  value: fmtKopecks(totalCommission), color: '#5B21B6' },
          { label: 'Событий',             value: EVENTS.length,              color: '#0F1419' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {([['flow', 'Схема движения'], ['events', 'События'], ['invariants', 'Инварианты']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '4px 10px', borderRadius: 6, border: tab === id ? 'none' : '1px solid #E4E6EA', background: tab === id ? '#0F1419' : '#F8FAFB', color: tab === id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'flow' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {[
            { step: 'Покупатель оплачивает', type: 'RESERVE', desc: 'RESERVE: buyer_account → escrow_account (заморозка до выполнения условий сделки)', color: '#1E40AF', bg: '#EFF6FF' },
            { step: 'Условия выполнены', type: 'RELEASE', desc: 'RELEASE: escrow_account → seller_account (сумма − комиссия)', color: '#065F46', bg: '#D1FAE5' },
            { step: 'Комиссия платформы', type: 'COMMISSION', desc: 'COMMISSION: escrow_account → platform_account (2% от суммы)', color: '#5B21B6', bg: '#F5F3FF' },
            { step: 'Открыт спор', type: 'HOLD', desc: 'HOLD: escrow_account → dispute_hold_account (дополнительная заморозка)', color: '#92400E', bg: '#FEF3C7' },
            { step: 'Виновен продавец → возврат', type: 'REFUND', desc: 'REFUND: dispute_hold_account → buyer_account + PENALTY → platform', color: '#DC2626', bg: '#FEE2E2' },
            { step: 'Виновен покупатель → выплата', type: 'RELEASE', desc: 'RELEASE: dispute_hold_account → seller_account (арбитр подтвердил)', color: '#065F46', bg: '#D1FAE5' },
          ].map((item, i) => (
            <div key={i} style={{ padding: '8px 12px', borderRadius: 10, background: item.bg, border: `1px solid ${item.color}22`, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: item.color, flexShrink: 0, minWidth: 20 }}>{i + 1}.</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0F1419' }}>{item.step}</div>
                <code style={{ fontSize: 9, color: item.color, display: 'block', marginTop: 3 }}>{item.desc}</code>
              </div>
            </div>
          ))}
          <div style={{ padding: '8px 12px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: 9, color: '#065F46', fontWeight: 700 }}>
            Все суммы в INTEGER kopecks · Никогда FLOAT · Двойная запись · PostgreSQL SERIALIZABLE · Атомарность через транзакцию
          </div>
        </div>
      )}

      {tab === 'events' && (
        <div style={{ display: 'grid', gap: 5 }}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
            {['all', ...deals].map((d) => (
              <button key={d} onClick={() => setDealFilter(d)} style={{ padding: '3px 8px', borderRadius: 5, border: dealFilter === d ? 'none' : '1px solid #E4E6EA', background: dealFilter === d ? '#374151' : '#F8FAFB', color: dealFilter === d ? '#fff' : '#64748B', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>
                {d === 'all' ? 'Все' : d}
              </button>
            ))}
          </div>
          {filtered.map((ev) => {
            const tc = TYPE_CFG[ev.type];
            const sc = STATUS_CFG[ev.status];
            return (
              <div key={ev.id} style={{ padding: '7px 10px', borderRadius: 8, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: tc.bg, color: tc.color }}>{tc.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 900, color: '#0F1419', flex: 1 }}>{fmtKopecks(ev.amountKopecks)}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: sc.color }}>{sc.label}</span>
                  <span style={{ fontSize: 8, color: '#94A3B8' }}>{ev.dealId}</span>
                </div>
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 3 }}>
                  {tc.dir} · trigger: {ev.triggeredBy} · {new Date(ev.createdAt).toLocaleString('ru-RU')}
                </div>
                <code style={{ fontSize: 8, color: '#94A3B8', display: 'block', marginTop: 1 }}>{ev.idempotencyKey}</code>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'invariants' && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={lbl}>Транзакционные инварианты PostgreSQL (SERIALIZABLE)</div>
          {[
            { inv: 'Нет отрицательного баланса', check: 'balance_kopecks >= 0', trigger: 'check_money_invariants() BEFORE INSERT', ok: true },
            { inv: 'Резерв ≤ остатку на счёте', check: 'reserved_kopecks ≤ balance_kopecks', trigger: 'check_money_invariants() ENTRY_TYPE=RESERVE', ok: true },
            { inv: 'Σ дебет = Σ кредит (каждая запись)', check: 'debit_account + credit_account balanced', trigger: 'PostgreSQL constraint CHECK', ok: true },
            { inv: 'Суммы только в INTEGER kopecks', check: 'BIGINT NOT NULL, no FLOAT', trigger: 'Column type constraint', ok: true },
            { inv: 'idempotencyKey UNIQUE', check: 'UNIQUE constraint', trigger: 'Prevents duplicate events', ok: true },
            { inv: 'Escrow никогда не уходит в минус', check: 'escrow_balance >= sum(HOLD)', trigger: 'dispute.opened saga check', ok: true },
          ].map((item) => (
            <div key={item.inv} style={{ padding: '7px 10px', borderRadius: 8, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: item.ok ? '#065F46' : '#DC2626' }}>{item.ok ? '✓' : '✗'}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', flex: 1 }}>{item.inv}</span>
              </div>
              <div style={{ fontSize: 9, color: '#64748B', marginTop: 3 }}>
                <code style={{ color: '#1E40AF' }}>{item.check}</code> · {item.trigger}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Ledger: INTEGER kopecks · Двойная запись · PostgreSQL SERIALIZABLE · idempotencyKey UNIQUE · check_money_invariants() триггер · Демо-данные.
      </div>
    </div>
  );
}
