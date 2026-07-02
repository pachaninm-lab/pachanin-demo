'use client';

import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type Scenario = 'base' | 'conservative' | 'stress';

const SCENARIOS: Record<Scenario, { label: string; color: string; gmv: number[]; conv: number; take: number; cac: number }> = {
  base: {
    label: 'Базовый',
    color: '#0A7A5F',
    gmv: [500, 1200, 2800, 5500, 8900, 14000, 20000, 28000, 38000, 50000, 65000, 82000],
    conv: 40,
    take: 1.0,
    cac: 85000,
  },
  conservative: {
    label: 'Консервативный',
    color: '#2563EB',
    gmv: [300, 700, 1400, 2600, 4000, 6000, 8500, 11000, 14000, 18000, 23000, 29000],
    conv: 25,
    take: 0.8,
    cac: 120000,
  },
  stress: {
    label: 'Стресс',
    color: '#DC2626',
    gmv: [200, 400, 700, 1100, 1600, 2200, 2900, 3600, 4500, 5800, 7200, 9000],
    conv: 15,
    take: 0.6,
    cac: 200000,
  },
};

const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

function rub(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} млрд ₽`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн ₽`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} тыс. ₽`;
  return `${n} ₽`;
}

const METRICS = [
  { key: 'gmv', label: 'GMV (год 1)', formula: 'Сумма всех закрытых сделок за период' },
  { key: 'takeRate', label: 'Take Rate', formula: 'Комиссия платформы / GMV' },
  { key: 'revenue', label: 'Выручка', formula: 'GMV × Take Rate' },
  { key: 'costPerDeal', label: 'Cost per Deal', formula: '(Инфраструктура + Support + ML) / кол-во сделок' },
  { key: 'cm', label: 'Contribution Margin', formula: 'Выручка − прямые переменные затраты' },
  { key: 'ltv', label: 'LTV (организация)', formula: 'Средний GMV/мес × avg lifetime × take rate' },
  { key: 'cac', label: 'CAC', formula: 'Маркетинг + Sales / новые активные орг' },
  { key: 'supportCPD', label: 'Support Cost per Deal', formula: 'Тикеты × avg time × hourly rate / сделок' },
];

function computeMetrics(sc: Scenario) {
  const s = SCENARIOS[sc];
  const totalGmv = s.gmv.reduce((a, b) => a + b, 0) * 1_000_000;
  const takeRate = s.take / 100;
  const revenue = totalGmv * takeRate;
  const deals = Math.round(totalGmv / 3_500_000);
  const infra = 4_500_000;
  const costPerDeal = deals > 0 ? (infra / deals) : 0;
  const cm = revenue - infra * 0.4;
  const ltv = (totalGmv / 12) * 18 * takeRate;
  const cac = s.cac;
  const supportCPD = deals > 0 ? (850_000 / deals) : 0;

  return { gmv: totalGmv, takeRate: `${s.take}%`, revenue, costPerDeal, cm, ltv, cac, supportCPD };
}

const label: React.CSSProperties = {
  fontSize: 11, fontWeight: 900, color: '#64748B',
  textTransform: 'uppercase', letterSpacing: '0.06em',
};
const card: React.CSSProperties = {
  padding: '14px 16px', borderRadius: 14, border: '1px solid #E4E6EA',
  background: '#F8FAFB', display: 'grid', gap: 4,
};

export function UnitEconomicsPassport() {
  const [scenario, setScenario] = useState<Scenario>('base');
  const sc = SCENARIOS[scenario];
  const m = computeMetrics(scenario);

  const chartData = MONTHS.map((month, i) => ({
    month,
    gmv: sc.gmv[i],
    revenue: +(sc.gmv[i] * sc.take / 100).toFixed(1),
  }));

  const metricValues: Record<string, string> = {
    gmv: rub(m.gmv),
    takeRate: m.takeRate,
    revenue: rub(m.revenue),
    costPerDeal: rub(m.costPerDeal),
    cm: rub(m.cm),
    ltv: rub(m.ltv),
    cac: rub(m.cac),
    supportCPD: rub(m.supportCPD),
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Scenario selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(Object.keys(SCENARIOS) as Scenario[]).map((s) => (
          <button
            key={s}
            onClick={() => setScenario(s)}
            style={{
              padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 800,
              background: scenario === s ? SCENARIOS[s].color : 'transparent',
              color: scenario === s ? '#fff' : '#64748B',
              outline: scenario === s ? 'none' : '1px solid #E4E6EA',
            }}
          >
            {SCENARIOS[s].label}
          </button>
        ))}
      </div>

      {/* GMV Chart */}
      <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16 }}>
        <div style={{ ...label, marginBottom: 12 }}>GMV нарастающим итогом · млн ₽ / мес</div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={sc.color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={sc.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94A3B8' }} />
            <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E4E6EA' }}
              formatter={(v: number) => [`${v} млн ₽`]}
            />
            <Area type="monotone" dataKey="gmv" stroke={sc.color} strokeWidth={2} fill="url(#gmvGrad)" name="GMV" />
            <Area type="monotone" dataKey="revenue" stroke="#F59E0B" strokeWidth={1.5} fill="none" strokeDasharray="4 2" name="Выручка" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
        {METRICS.map((metric) => (
          <div key={metric.key} style={card}>
            <div style={label}>{metric.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#0F1419' }}>{metricValues[metric.key]}</div>
            <div style={{ fontSize: 10, color: '#94A3B8', lineHeight: 1.4 }}>{metric.formula}</div>
          </div>
        ))}
      </div>

      {/* Key indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ ...card, borderColor: '#BBF7D0', background: '#F0FDF4' }}>
          <div style={{ ...label, color: '#0A7A5F' }}>Конверсия заявка→сделка</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#0A7A5F' }}>{sc.conv}%</div>
        </div>
        <div style={{ ...card, borderColor: '#BFDBFE', background: '#EFF6FF' }}>
          <div style={{ ...label, color: '#2563EB' }}>Срок окупаемости CAC</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#2563EB' }}>
            {Math.round(m.cac / (m.revenue / 12 / Math.max(1, Math.round(m.gmv / 10_000_000))))} мес
          </div>
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Демо-модель. В боевом контуре данные из ClickHouse + Airflow DAG. Сценарии: Базовый — конверсия 40%, Conservative — 25%, Stress — конкурент + отток 20%.
      </div>
    </div>
  );
}
