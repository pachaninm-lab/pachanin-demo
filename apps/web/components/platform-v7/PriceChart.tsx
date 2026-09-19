'use client';

import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

export type GrainCultureKey = 'wheat_3' | 'wheat_4' | 'barley' | 'corn' | 'sunflower';

const CULTURE_LABELS: Record<GrainCultureKey, string> = {
  wheat_3: 'Пшеница 3кл',
  wheat_4: 'Пшеница 4кл',
  barley: 'Ячмень 2кл',
  corn: 'Кукуруза',
  sunflower: 'Подсолнечник',
};

const CULTURE_COLOR: Record<GrainCultureKey, string> = {
  wheat_3: '#0A7A5F',
  wheat_4: '#2563EB',
  barley: '#D97706',
  corn: '#059669',
  sunflower: '#DC2626',
};

function genSeries(base: number, months: number, volatility: number): number[] {
  const result: number[] = [base];
  for (let i = 1; i < months; i++) {
    const change = (Math.random() - 0.5) * 2 * volatility;
    const seasonal = Math.sin((i / 12) * Math.PI * 2) * (volatility * 0.5);
    result.push(Math.round(result[i - 1] + change + seasonal));
  }
  return result;
}

const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const MONTHS_24 = [...MONTHS.map((m) => `${m} 25`), ...MONTHS.map((m) => `${m} 26`)];

const BASE_PRICES: Record<GrainCultureKey, number> = {
  wheat_3: 16_500, wheat_4: 15_800, barley: 14_200, corn: 13_600, sunflower: 28_000,
};

const SERIES_DATA: Record<GrainCultureKey, number[]> = Object.fromEntries(
  Object.entries(BASE_PRICES).map(([k, base]) => [k, genSeries(base, 24, base * 0.05)])
) as Record<GrainCultureKey, number[]>;

const CHART_DATA = MONTHS_24.map((month, i) => {
  const row: Record<string, string | number> = { month };
  (Object.keys(SERIES_DATA) as GrainCultureKey[]).forEach((k) => { row[k] = SERIES_DATA[k][i]; });
  return row;
});

const PERIOD_OPTIONS = [
  { label: '3 мес', months: 3 },
  { label: '6 мес', months: 6 },
  { label: '12 мес', months: 12 },
  { label: '24 мес', months: 24 },
];

function formatPrice(v: number | string): string {
  if (typeof v !== 'number') return String(v);
  return `${(v / 1000).toFixed(1)} тыс. ₽/т`;
}

interface Props {
  cultures?: GrainCultureKey[];
  defaultPeriod?: number;
  title?: string;
}

export function PriceChart({ cultures = ['wheat_3', 'wheat_4', 'barley'], defaultPeriod = 12, title = 'Динамика цен на зерно' }: Props) {
  const [period, setPeriod] = useState(defaultPeriod);
  const [activeCultures, setActiveCultures] = useState<Set<GrainCultureKey>>(new Set(cultures));

  const slicedData = CHART_DATA.slice(-period);

  function toggleCulture(key: GrainCultureKey) {
    setActiveCultures((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  }

  const latestIdx = slicedData.length - 1;
  const prevIdx = Math.max(0, slicedData.length - 2);

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--pc-text-primary)', flex: 1 }}>{title}</span>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.months}
              onClick={() => setPeriod(opt.months)}
              style={{
                padding: '0.25rem 0.625rem', borderRadius: '6px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                background: period === opt.months ? 'var(--p7-color-brand)' : 'transparent',
                color: period === opt.months ? '#fff' : 'var(--pc-text-muted)',
                border: `1px solid ${period === opt.months ? 'var(--p7-color-brand)' : 'var(--p7-color-border)'}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Culture toggles */}
      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
        {cultures.map((key) => {
          const active = activeCultures.has(key);
          return (
            <button
              key={key}
              onClick={() => toggleCulture(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.25rem 0.625rem', borderRadius: '999px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                background: active ? `${CULTURE_COLOR[key]}18` : 'transparent',
                color: active ? CULTURE_COLOR[key] : 'var(--pc-text-muted)',
                border: `1px solid ${active ? CULTURE_COLOR[key] : 'var(--p7-color-border)'}`,
                opacity: active ? 1 : 0.5,
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: CULTURE_COLOR[key], display: 'inline-block', flexShrink: 0 }} />
              {CULTURE_LABELS[key]}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={slicedData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--p7-color-border)" strokeOpacity={0.5} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 9, fill: 'var(--pc-text-muted)' }}
              interval={Math.floor(period / 6)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 9, fill: 'var(--pc-text-muted)' }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              formatter={(value: number, name: string) => [formatPrice(value), CULTURE_LABELS[name as GrainCultureKey] ?? name]}
              contentStyle={{ background: 'var(--p7-color-surface)', border: '1px solid var(--p7-color-border)', borderRadius: '8px', fontSize: '11px' }}
              labelStyle={{ color: 'var(--pc-text-muted)', fontSize: '10px' }}
            />
            {cultures.filter((k) => activeCultures.has(k)).map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={CULTURE_COLOR[key]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Price summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.375rem' }}>
        {cultures.filter((k) => activeCultures.has(k)).map((key) => {
          const latest = Number(slicedData[latestIdx]?.[key] ?? 0);
          const prev = Number(slicedData[prevIdx]?.[key] ?? 0);
          const delta = latest - prev;
          const pct = prev > 0 ? ((delta / prev) * 100).toFixed(1) : '0.0';
          return (
            <div key={key} style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'var(--p7-color-surface-muted)', border: '1px solid var(--p7-color-border)' }}>
              <div style={{ fontSize: '9px', color: 'var(--pc-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                {CULTURE_LABELS[key]}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--pc-text-primary)' }}>
                {(latest / 1000).toFixed(1)}k ₽/т
              </div>
              <div style={{ fontSize: '10px', fontWeight: 600, color: delta >= 0 ? 'var(--status-active-text, #059669)' : 'var(--status-error-text, #DC2626)' }}>
                {delta >= 0 ? '+' : ''}{pct}% к пред.
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
