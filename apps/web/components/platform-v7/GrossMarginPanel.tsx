'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

type RoleKey = 'seller' | 'buyer' | 'platform' | 'bank' | 'logistics' | 'lab';

interface RoleMargin {
  role: RoleKey;
  label: string;
  revenueRub: number;
  costRub: number;
  grossRub: number;
  marginPct: number;
  deals: number;
}

const DATA: RoleMargin[] = [
  { role: 'seller',    label: 'Продавец',    revenueRub: 96_500_000, costRub: 82_100_000, grossRub: 14_400_000, marginPct: 14.9, deals: 18 },
  { role: 'buyer',     label: 'Покупатель',  revenueRub: 96_500_000, costRub: 91_200_000, grossRub:  5_300_000, marginPct:  5.5, deals: 18 },
  { role: 'platform',  label: 'Платформа',   revenueRub:  2_895_000, costRub:    580_000, grossRub:  2_315_000, marginPct: 79.9, deals: 18 },
  { role: 'bank',      label: 'Банк',        revenueRub:  1_450_000, costRub:    290_000, grossRub:  1_160_000, marginPct: 80.0, deals:  6 },
  { role: 'logistics', label: 'Логистика',   revenueRub:  3_860_000, costRub:  2_980_000, grossRub:    880_000, marginPct: 22.8, deals: 18 },
  { role: 'lab',       label: 'Лаборатория', revenueRub:    420_000, costRub:    210_000, grossRub:    210_000, marginPct: 50.0, deals: 14 },
];

const ROLE_COLOR: Record<RoleKey, string> = {
  seller:    '#0A7A5F',
  buyer:     '#2563EB',
  platform:  '#7C3AED',
  bank:      '#D97706',
  logistics: '#0891B2',
  lab:       '#059669',
};

function formatM(rub: number) {
  if (rub >= 1_000_000) return `${(rub / 1_000_000).toFixed(1)} млн`;
  if (rub >= 1_000) return `${(rub / 1_000).toFixed(0)} тыс.`;
  return `${rub}`;
}

type MetricKey = 'grossRub' | 'marginPct' | 'revenueRub';

const METRIC_LABELS: Record<MetricKey, string> = {
  grossRub:   'Валовая прибыль (₽)',
  marginPct:  'Маржа (%)',
  revenueRub: 'Выручка (₽)',
};

interface TooltipProps { active?: boolean; payload?: Array<{ value: number; payload: RoleMargin }>; label?: string }

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 10, padding: '0.75rem', fontSize: 11, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 180 }}>
      <div style={{ fontWeight: 800, color: '#0F1419', marginBottom: 6 }}>{d.label}</div>
      <div style={{ display: 'grid', gap: 3 }}>
        <span>Выручка: <b>{formatM(d.revenueRub)} ₽</b></span>
        <span>Себестоимость: <b>{formatM(d.costRub)} ₽</b></span>
        <span style={{ color: '#0A7A5F' }}>Валовая прибыль: <b>{formatM(d.grossRub)} ₽</b></span>
        <span>Маржа: <b>{d.marginPct}%</b></span>
        <span style={{ color: '#64748B' }}>Сделок: {d.deals}</span>
      </div>
    </div>
  );
}

export function GrossMarginPanel() {
  const [metric, setMetric] = useState<MetricKey>('grossRub');
  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(null);

  const chartData = DATA.map((d) => ({
    ...d,
    value: d[metric],
    displayLabel: metric === 'grossRub' || metric === 'revenueRub' ? formatM(d[metric]) + ' ₽' : d[metric].toFixed(1) + '%',
  }));

  const totalGross = DATA.reduce((s, d) => s + d.grossRub, 0);
  const selectedData = selectedRole ? DATA.find((d) => d.role === selectedRole) : null;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Metric selector */}
      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
        {(Object.entries(METRIC_LABELS) as [MetricKey, string][]).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setMetric(k)}
            style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, cursor: 'pointer', background: metric === k ? 'var(--p7-color-brand, #0A7A5F)' : 'transparent', color: metric === k ? '#fff' : 'var(--pc-text-muted)', border: `1px solid ${metric === k ? 'transparent' : 'var(--p7-color-border)'}` }}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Summary pills */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
        <div style={{ padding: '0.75rem', borderRadius: 10, background: 'rgba(10,122,95,0.06)', border: '1px solid rgba(10,122,95,0.18)', display: 'grid', gap: 3 }}>
          <div style={{ fontSize: 10, color: '#0A7A5F', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Суммарная прибыль</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#0F1419' }}>{formatM(totalGross)} ₽</div>
        </div>
        <div style={{ padding: '0.75rem', borderRadius: 10, background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.14)', display: 'grid', gap: 3 }}>
          <div style={{ fontSize: 10, color: '#2563EB', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Лидер по марже</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>Банк · 80%</div>
        </div>
        <div style={{ padding: '0.75rem', borderRadius: 10, background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.14)', display: 'grid', gap: 3 }}>
          <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Комиссия платформы</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>3% GMV · {formatM(DATA.find(d=>d.role==='platform')!.grossRub)} ₽</div>
        </div>
      </div>

      {/* Bar chart */}
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 16, left: 8, bottom: 0 }} barSize={36}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => metric === 'marginPct' ? `${v}%` : `${(v/1_000_000).toFixed(0)}М`} />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="value"
              radius={[6, 6, 0, 0]}
              onClick={(d) => setSelectedRole(selectedRole === d.role ? null : d.role as RoleKey)}
              style={{ cursor: 'pointer' }}
            >
              {chartData.map((d) => (
                <Cell
                  key={d.role}
                  fill={ROLE_COLOR[d.role as RoleKey]}
                  opacity={selectedRole && selectedRole !== d.role ? 0.35 : 1}
                />
              ))}
              <LabelList dataKey="displayLabel" position="top" style={{ fontSize: 9, fontWeight: 700, fill: '#64748B' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Selected role detail */}
      {selectedData && (
        <div style={{ padding: '0.875rem', borderRadius: 12, background: `rgba(${hexToRgb(ROLE_COLOR[selectedData.role])},0.06)`, border: `1px solid rgba(${hexToRgb(ROLE_COLOR[selectedData.role])},0.2)`, display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0F1419' }}>{selectedData.label} · детальный срез</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: '0.375rem', fontSize: 11 }}>
            <span>Выручка: <b>{formatM(selectedData.revenueRub)} ₽</b></span>
            <span>Себестоимость: <b>{formatM(selectedData.costRub)} ₽</b></span>
            <span>Прибыль: <b style={{ color: '#0A7A5F' }}>{formatM(selectedData.grossRub)} ₽</b></span>
            <span>Маржа: <b>{selectedData.marginPct}%</b></span>
            <span>Сделок: <b>{selectedData.deals}</b></span>
          </div>
        </div>
      )}

      <div style={{ fontSize: 9, color: 'var(--pc-text-muted)', padding: '5px 9px', borderRadius: 7, background: 'var(--p7-color-surface-muted)', border: '1px solid var(--p7-color-border)' }}>
        Демо-данные. Валовая прибыль = выручка − прямая себестоимость. Нажмите на столбец для детального среза.
      </div>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
