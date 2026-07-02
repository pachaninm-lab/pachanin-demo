'use client';

import { useState } from 'react';

type EscrowStatus = 'funded' | 'held' | 'released' | 'refunded' | 'disputed';

interface EscrowAccount {
  id: string;
  dealId: string;
  buyerName: string;
  sellerName: string;
  amountKopecks: number;
  currency: string;
  status: EscrowStatus;
  fundedAt: string;
  releaseConditions: string[];
  blockers: string[];
  bankRef: string;
}

const STATUS_CONFIG: Record<EscrowStatus, { label: string; bg: string; color: string }> = {
  funded:   { label: 'Пополнен',    bg: '#DBEAFE', color: '#1E40AF' },
  held:     { label: 'Удержан',     bg: '#FEF3C7', color: '#92400E' },
  released: { label: 'Выпущен',     bg: '#D1FAE5', color: '#065F46' },
  refunded: { label: 'Возвращён',   bg: '#F0FDF4', color: '#0A7A5F' },
  disputed: { label: 'Под спором',  bg: '#FEE2E2', color: '#991B1B' },
};

const DEMO_ACCOUNTS: EscrowAccount[] = [
  {
    id: 'esc-9095', dealId: 'DL-9095', buyerName: 'АгроТрейд Юг', sellerName: 'Фермер Нов',
    amountKopecks: 6264000000, currency: 'RUB', status: 'released', fundedAt: '2024-01-14T15:01:00Z', bankRef: 'SBR-ESC-9095',
    releaseConditions: ['Акт приёмки подписан УКЭП', 'Протокол качества лаборатории', 'СДИЗ закрыт в ФГИС «Зерно»', 'УПД отправлен через Диадок'],
    blockers: [],
  },
  {
    id: 'esc-9110', dealId: 'DL-9110', buyerName: 'МаслоПресс', sellerName: 'ЗерноЮг КФХ',
    amountKopecks: 2355200000, currency: 'RUB', status: 'disputed', fundedAt: '2024-03-12T09:01:00Z', bankRef: 'SBR-ESC-9110',
    releaseConditions: ['Акт приёмки подписан УКЭП', 'Протокол качества лаборатории', 'СДИЗ закрыт в ФГИС «Зерно»', 'Спор разрешён'],
    blockers: ['Афлатоксин B1 превышает норму — СДИЗ заблокирован', 'Открытый спор DK-2024-91 · удержание 312 000 ₽'],
  },
  {
    id: 'esc-9118', dealId: 'DL-9118', buyerName: 'СибЗерно', sellerName: 'Алтай Агро',
    amountKopecks: 1890000000, currency: 'RUB', status: 'funded', fundedAt: '2024-03-19T11:30:00Z', bankRef: 'SBR-ESC-9118',
    releaseConditions: ['Акт приёмки подписан УКЭП', 'Протокол качества лаборатории', 'СДИЗ закрыт в ФГИС «Зерно»', 'УПД отправлен через Диадок'],
    blockers: ['Ожидается доставка и приёмка'],
  },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

function fmt(kopecks: number) {
  const rub = kopecks / 100;
  if (rub >= 1_000_000) return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  return `${rub.toLocaleString('ru-RU')} ₽`;
}

export function EscrowPanel() {
  const [selected, setSelected] = useState<string | null>(null);

  const totalFunded = DEMO_ACCOUNTS.filter(a => a.status === 'funded' || a.status === 'held' || a.status === 'disputed').reduce((s, a) => s + a.amountKopecks, 0);
  const totalReleased = DEMO_ACCOUNTS.filter(a => a.status === 'released').reduce((s, a) => s + a.amountKopecks, 0);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
        {[
          { label: 'Счетов',      value: DEMO_ACCOUNTS.length, color: '#0F1419' },
          { label: 'В заморозке', value: fmt(totalFunded),     color: '#1E40AF' },
          { label: 'Выпущено',    value: fmt(totalReleased),   color: '#0A7A5F' },
          { label: 'Споры',       value: DEMO_ACCOUNTS.filter(a => a.status === 'disputed').length, color: '#DC2626' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Escrow lifecycle */}
      <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#065F46', marginBottom: 6 }}>Жизненный цикл Escrow</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {['Пополнение → банк', 'Верификация документов', 'Приёмка + качество', 'СДИЗ в ФГИС', 'Release → продавцу'].map((step, i, arr) => (
            <span key={step} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#D1FAE5', color: '#065F46' }}>{step}</span>
              {i < arr.length - 1 && <span style={{ color: '#0A7A5F', fontSize: 12 }}>→</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Account list */}
      <div style={{ display: 'grid', gap: 6 }}>
        {DEMO_ACCOUNTS.map((acc) => {
          const cfg = STATUS_CONFIG[acc.status];
          const isOpen = selected === acc.id;
          return (
            <div key={acc.id} style={{ borderRadius: 12, border: `1px solid ${isOpen ? '#0A7A5F' : '#E4E6EA'}`, overflow: 'hidden' }}>
              <button onClick={() => setSelected(isOpen ? null : acc.id)} style={{ width: '100%', padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center', background: isOpen ? '#F0FDF4' : '#F8FAFB', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0A7A5F', fontFamily: 'monospace' }}>{acc.dealId}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    {acc.blockers.length > 0 && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#FEE2E2', color: '#DC2626' }}>⚠ {acc.blockers.length} блокер</span>}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{acc.buyerName} → {acc.sellerName}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#0F1419' }}>{fmt(acc.amountKopecks)}</div>
                  <div style={{ fontSize: 9, color: '#94A3B8' }}>{acc.bankRef}</div>
                </div>
              </button>
              {isOpen && (
                <div style={{ borderTop: '1px solid #E4E6EA', padding: '10px 12px', background: '#fff', display: 'grid', gap: 10 }}>
                  <div>
                    <div style={lbl}>Условия выпуска</div>
                    <div style={{ marginTop: 4, display: 'grid', gap: 3 }}>
                      {acc.releaseConditions.map((cond) => {
                        const done = acc.blockers.length === 0 || acc.status === 'released';
                        return (
                          <div key={cond} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10, color: done ? '#065F46' : '#374151' }}>
                            <span style={{ fontWeight: 900, color: done ? '#0A7A5F' : '#94A3B8' }}>{done ? '✓' : '○'}</span>
                            {cond}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {acc.blockers.length > 0 && (
                    <div style={{ padding: '8px 10px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA' }}>
                      <div style={{ ...lbl, color: '#DC2626', marginBottom: 4 }}>Блокеры выпуска</div>
                      {acc.blockers.map((b) => (
                        <div key={b} style={{ fontSize: 10, color: '#991B1B', marginTop: 2 }}>• {b}</div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 700 }}>История операций</button>
                    {acc.status === 'disputed' && (
                      <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #FEE2E2', background: '#FEF2F2', cursor: 'pointer', color: '#DC2626', fontWeight: 700 }}>Открыть спор</button>
                    )}
                    {acc.status === 'funded' && (
                      <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #BBF7D0', background: '#F0FDF4', cursor: 'pointer', color: '#065F46', fontWeight: 700 }}>Запросить выпуск</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Escrow: Сбер Безопасные Сделки · Release привязан к документам + приёмке + ФГИС + статусу спора · Суммы в копейках · Демо-данные.
      </div>
    </div>
  );
}
