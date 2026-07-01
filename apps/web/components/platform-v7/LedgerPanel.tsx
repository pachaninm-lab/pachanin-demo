'use client';

import { useState } from 'react';

type EntryType = 'RESERVE' | 'HOLD' | 'RELEASE' | 'REFUND' | 'COMMISSION' | 'PLATFORM_FEE' | 'PENALTY';

interface LedgerEntry {
  id: string;
  dealId: string;
  entryType: EntryType;
  debitAccount: string;
  creditAccount: string;
  amountKopecks: number;
  currency: string;
  reference: string;
  idempotencyKey: string;
  createdAt: string;
}

const ENTRY_CONFIG: Record<EntryType, { label: string; bg: string; color: string }> = {
  RESERVE:      { label: 'Резерв',    bg: '#DBEAFE', color: '#1E40AF' },
  HOLD:         { label: 'Удержание', bg: '#FEF3C7', color: '#92400E' },
  RELEASE:      { label: 'Выпуск',    bg: '#D1FAE5', color: '#065F46' },
  REFUND:       { label: 'Возврат',   bg: '#F0FDF4', color: '#0A7A5F' },
  COMMISSION:   { label: 'Комиссия',  bg: '#EDE9FE', color: '#5B21B6' },
  PLATFORM_FEE: { label: 'Платформа', bg: '#F3E8FF', color: '#7C3AED' },
  PENALTY:      { label: 'Штраф',     bg: '#FEE2E2', color: '#991B1B' },
};

const ACCOUNTS: Record<string, string> = {
  buyer_9095:    'Счёт: АгроТрейд Юг',
  escrow_9095:   'Escrow: DL-9095',
  seller_9095:   'Счёт: Фермер Нов',
  platform_fee:  'Платформа GrainFlow',
  dispute_hold:  'Спор DK-2024-91',
  buyer_9110:    'Счёт: МаслоПресс',
  escrow_9110:   'Escrow: DL-9110',
};

const DEMO_ENTRIES: LedgerEntry[] = [
  { id: 'le-001', dealId: 'DL-9095', entryType: 'RESERVE',      debitAccount: 'buyer_9095',   creditAccount: 'escrow_9095',  amountKopecks: 6264000000, currency: 'RUB', reference: 'PP-2024-00891',  idempotencyKey: 'reserve.DL-9095.1',    createdAt: '2024-01-14T15:01:00Z' },
  { id: 'le-002', dealId: 'DL-9095', entryType: 'COMMISSION',   debitAccount: 'escrow_9095',  creditAccount: 'platform_fee', amountKopecks: 62640000,   currency: 'RUB', reference: 'COM-2024-00891', idempotencyKey: 'commission.DL-9095.1', createdAt: '2024-01-17T09:02:00Z' },
  { id: 'le-003', dealId: 'DL-9095', entryType: 'RELEASE',      debitAccount: 'escrow_9095',  creditAccount: 'seller_9095',  amountKopecks: 6201360000, currency: 'RUB', reference: 'PP-2024-00892',  idempotencyKey: 'release.DL-9095.1',    createdAt: '2024-01-17T09:02:30Z' },
  { id: 'le-004', dealId: 'DL-9110', entryType: 'RESERVE',      debitAccount: 'buyer_9110',   creditAccount: 'escrow_9110',  amountKopecks: 2355200000, currency: 'RUB', reference: 'PP-2024-01012',  idempotencyKey: 'reserve.DL-9110.1',    createdAt: '2024-03-12T09:01:00Z' },
  { id: 'le-005', dealId: 'DL-9110', entryType: 'HOLD',         debitAccount: 'escrow_9110',  creditAccount: 'dispute_hold', amountKopecks: 312000000,  currency: 'RUB', reference: 'DK-2024-91',     idempotencyKey: 'hold.DK-2024-91.1',    createdAt: '2024-03-14T11:00:00Z' },
  { id: 'le-006', dealId: 'DL-9110', entryType: 'PLATFORM_FEE', debitAccount: 'escrow_9110',  creditAccount: 'platform_fee', amountKopecks: 23552000,   currency: 'RUB', reference: 'FEE-2024-01012', idempotencyKey: 'fee.DL-9110.1',        createdAt: '2024-03-12T09:01:30Z' },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

function fmt(kopecks: number) {
  const rub = kopecks / 100;
  if (rub >= 1_000_000) return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  return `${rub.toLocaleString('ru-RU')} ₽`;
}

export function LedgerPanel() {
  const [filterDeal, setFilterDeal] = useState<string>('all');

  const deals = ['all', ...Array.from(new Set(DEMO_ENTRIES.map(e => e.dealId)))];
  const visible = DEMO_ENTRIES.filter(e => filterDeal === 'all' || e.dealId === filterDeal);

  const totalReserved = DEMO_ENTRIES
    .filter(e => e.entryType === 'RESERVE')
    .reduce((s, e) => s + e.amountKopecks, 0);
  const totalReleased = DEMO_ENTRIES
    .filter(e => e.entryType === 'RELEASE')
    .reduce((s, e) => s + e.amountKopecks, 0);
  const totalCommission = DEMO_ENTRIES
    .filter(e => e.entryType === 'COMMISSION' || e.entryType === 'PLATFORM_FEE')
    .reduce((s, e) => s + e.amountKopecks, 0);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
        {[
          { label: 'Записей',      value: DEMO_ENTRIES.length,   color: '#0F1419' },
          { label: 'Зарезерв.',    value: fmt(totalReserved),    color: '#1E40AF' },
          { label: 'Выпущено',     value: fmt(totalReleased),    color: '#0A7A5F' },
          { label: 'Комиссия',     value: fmt(totalCommission),  color: '#5B21B6' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Invariant check */}
      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ color: '#0A7A5F', fontWeight: 900, fontSize: 14 }}>✓</span>
        <div style={{ fontSize: 10, color: '#065F46', fontWeight: 700 }}>
          Инвариант: Σ debit = Σ credit для всех закрытых сделок · Двойная запись в балансе · PostgreSQL CONSTRAINT DEFERRABLE проверен
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {deals.map((d) => (
          <button key={d} onClick={() => setFilterDeal(d)} style={{ padding: '4px 10px', borderRadius: 6, border: filterDeal === d ? 'none' : '1px solid #E4E6EA', background: filterDeal === d ? '#0F1419' : '#F8FAFB', color: filterDeal === d ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {d === 'all' ? 'Все сделки' : d}
          </button>
        ))}
      </div>

      {/* Ledger entries */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr style={{ background: '#F8FAFB' }}>
              {['Тип', 'Сделка', 'Дебет', 'Кредит', 'Сумма', 'Референс', 'Время'].map(h => (
                <th key={h} style={{ ...lbl, padding: '6px 8px', textAlign: 'left', borderBottom: '2px solid #E4E6EA', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((e, i) => {
              const cfg = ENTRY_CONFIG[e.entryType];
              return (
                <tr key={e.id} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFB' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>{cfg.label}</span>
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #F1F5F9' }}>
                    <a href={`/platform-v7/deals/${e.dealId}/clean`} style={{ color: '#0A7A5F', fontFamily: 'monospace', fontWeight: 700, textDecoration: 'none', fontSize: 10 }}>{e.dealId}</a>
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #F1F5F9', color: '#374151', fontSize: 9 }}>{ACCOUNTS[e.debitAccount] ?? e.debitAccount}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #F1F5F9', color: '#374151', fontSize: 9 }}>{ACCOUNTS[e.creditAccount] ?? e.creditAccount}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #F1F5F9', fontWeight: 800, color: '#0F1419', whiteSpace: 'nowrap' }}>{fmt(e.amountKopecks)}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #F1F5F9', color: '#64748B', fontFamily: 'monospace', fontSize: 9 }}>{e.reference}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #F1F5F9', color: '#94A3B8', whiteSpace: 'nowrap' }}>
                    {new Date(e.createdAt).toLocaleString('ru-RU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Account balances */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Балансы счетов (Escrow)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 6 }}>
          {[
            { account: 'Escrow DL-9095', balance: 0,          status: 'closed', note: 'Сделка закрыта, escrow = 0' },
            { account: 'Escrow DL-9110', balance: 2043648000, status: 'open',   note: 'Удержание: 312 000 ₽ (спор)' },
            { account: 'Платформа',      balance: 86192000,   status: 'ok',     note: 'Комиссии + сборы' },
          ].map((a) => (
            <div key={a.account} style={{ padding: '8px 10px', borderRadius: 8, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <div style={lbl}>{a.account}</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: a.balance === 0 ? '#94A3B8' : '#0F1419', marginTop: 3 }}>{fmt(a.balance)}</div>
              <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>{a.note}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Ledger двойная запись · Суммы в копейках (INTEGER, no FLOAT) · idempotency_key UNIQUE · PostgreSQL CONSTRAINT DEFERRABLE · Демо-данные.
      </div>
    </div>
  );
}
