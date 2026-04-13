'use client';
import * as React from 'react';
import { Badge } from '@/components/v9/ui/badge';
import { useSessionStore } from '@/stores/useSessionStore';

const analytics = {
  monthlyDeals: [
    { month: 'Янв', count: 12, volume: 45000000 },
    { month: 'Фев', count: 18, volume: 67000000 },
    { month: 'Мар', count: 24, volume: 91000000 },
    { month: 'Апр', count: 31, volume: 118000000 },
  ],
  disputeRate: 0.08,
  avgDealSize: 4200000,
  avgDaysToClose: 8.3,
  topSellers: [
    { name: 'КФХ Ковалёв А.С.', deals: 8, volume: 18400000 },
    { name: 'ООО «АгроКубань»', deals: 6, volume: 16100000 },
    { name: 'ООО «ЮгЗерно»', deals: 5, volume: 14200000 },
  ],
  topBuyers: [
    { name: 'ОАО «Агроинвест»', deals: 7, volume: 22100000 },
    { name: 'ПАО «Ростзерно»', deals: 5, volume: 17300000 },
    { name: 'ООО «ЗернаТрейд»', deals: 4, volume: 15100000 },
  ],
};

function fmtMoney(value: number) {
  return value.toLocaleString('ru-RU') + ' ₽';
}

function SimpleBars({ data }: { data: Array<{ month: string; count: number }> }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'end', gap: 12, height: 180, paddingTop: 12 }}>
      {data.map(item => (
        <div key={item.month} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11, color: '#6B778C' }}>{item.count}</div>
          <div style={{ width: '100%', maxWidth: 44, height: `${Math.max(18, Math.round((item.count / max) * 132))}px`, background: '#0A7A5F', borderRadius: 8 }} />
          <div style={{ fontSize: 11, color: '#6B778C' }}>{item.month}</div>
        </div>
      ))}
    </div>
  );
}

function SimpleLine({ data }: { data: Array<{ month: string; volume: number }> }) {
  const max = Math.max(...data.map(d => d.volume), 1);
  const points = data.map((item, i) => {
    const x = 20 + i * (260 / Math.max(1, data.length - 1));
    const y = 150 - (item.volume / max) * 110;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="300" height="180" viewBox="0 0 300 180" role="img" aria-label="Оборот по месяцам">
        <line x1="20" y1="150" x2="280" y2="150" stroke="#E4E6EA" />
        <line x1="20" y1="20" x2="20" y2="150" stroke="#E4E6EA" />
        <polyline fill="none" stroke="#0A7A5F" strokeWidth="3" points={points} />
        {data.map((item, i) => {
          const x = 20 + i * (260 / Math.max(1, data.length - 1));
          const y = 150 - (item.volume / max) * 110;
          return (
            <g key={item.month}>
              <circle cx={x} cy={y} r="4" fill="#0A7A5F" />
              <text x={x} y="170" textAnchor="middle" fontSize="11" fill="#6B778C">{item.month}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function AnalyticsPage() {
  const demoMode = useSessionStore(s => s.demoMode);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ borderLeft: '4px solid #0A7A5F', paddingLeft: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F1419', margin: 0 }}>Аналитика</h1>
          <p style={{ fontSize: 13, color: '#6B778C', marginTop: 4 }}>Executive view по исполнению сделок, обороту и спорности</p>
        </div>
        {demoMode && <Badge variant="neutral">SANDBOX</Badge>}
      </div>

      <div className="v9-bento">
        <div className="v9-card"><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Спорность</div><div style={{ fontSize: 28, fontWeight: 800 }}>{(analytics.disputeRate * 100).toFixed(1)}%</div></div>
        <div className="v9-card"><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Средний чек сделки</div><div style={{ fontSize: 28, fontWeight: 800 }}>{fmtMoney(analytics.avgDealSize)}</div></div>
        <div className="v9-card"><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Среднее время закрытия</div><div style={{ fontSize: 28, fontWeight: 800 }}>{analytics.avgDaysToClose} дн.</div></div>
        <div className="v9-card"><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Сделок в апреле</div><div style={{ fontSize: 28, fontWeight: 800 }}>{analytics.monthlyDeals[analytics.monthlyDeals.length - 1].count}</div></div>
      </div>

      <section className="v9-card">
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Сделки по месяцам</h2>
        <SimpleBars data={analytics.monthlyDeals} />
      </section>

      <section className="v9-card">
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Оборот по месяцам</h2>
        <SimpleLine data={analytics.monthlyDeals} />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <section className="v9-card">
          <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Топ продавцы</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {analytics.topSellers.map((item, idx) => (
              <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: idx < analytics.topSellers.length - 1 ? '1px solid #F4F5F7' : 'none' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: '#6B778C' }}>{item.deals} сделок</div>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{fmtMoney(item.volume)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="v9-card">
          <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Топ покупатели</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {analytics.topBuyers.map((item, idx) => (
              <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: idx < analytics.topBuyers.length - 1 ? '1px solid #F4F5F7' : 'none' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: '#6B778C' }}>{item.deals} сделок</div>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{fmtMoney(item.volume)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
