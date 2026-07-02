'use client';

import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface SloMetric {
  service: string;
  sli: string;
  slo: number;
  current: number;
  errorBudgetUsed: number;
  p95ms?: number;
  lastIncident?: string;
}

const SLO_METRICS: SloMetric[] = [
  { service: 'API (write)', sli: 'Успешные 2xx / все', slo: 99.9, current: 99.93, errorBudgetUsed: 28, p95ms: 183 },
  { service: 'API (read)', sli: 'Успешные 2xx / все', slo: 99.95, current: 99.97, errorBudgetUsed: 15, p95ms: 89 },
  { service: 'Deal transitions', sli: 'Без потерь', slo: 99.99, current: 99.99, errorBudgetUsed: 5, p95ms: 244 },
  { service: 'Документы (upload)', sli: 'Доступность', slo: 99.9, current: 99.88, errorBudgetUsed: 61, p95ms: 1420, lastIncident: '24.06.2026 02:14' },
  { service: 'УКЭП signing', sli: 'Успех подписания', slo: 99.5, current: 99.62, errorBudgetUsed: 12, p95ms: 810 },
  { service: 'Платёжные операции', sli: 'Без потерь', slo: 99.999, current: 100.0, errorBudgetUsed: 0 },
];

const LATENCY_SERIES = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  api: Math.round(80 + Math.random() * 120 + (i >= 10 && i <= 14 ? 80 : 0)),
  deals: Math.round(180 + Math.random() * 160 + (i >= 10 && i <= 14 ? 120 : 0)),
  docs: Math.round(900 + Math.random() * 400 + (i >= 10 && i <= 14 ? 400 : 0)),
}));

function BudgetBar({ used }: { used: number }) {
  const color = used >= 80 ? '#DC2626' : used >= 50 ? '#D97706' : '#0A7A5F';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#E4E6EA', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(used, 100)}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color, minWidth: 32 }}>{used}%</span>
    </div>
  );
}

export function SloSlaPanel() {
  const [view, setView] = useState<'table' | 'chart'>('table');

  const label: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

  const criticalServices = SLO_METRICS.filter((s) => s.errorBudgetUsed >= 50).length;
  const avgUptime = (SLO_METRICS.reduce((sum, s) => sum + s.current, 0) / SLO_METRICS.length).toFixed(3);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
        {[
          { label: 'Сервисов', value: SLO_METRICS.length, color: '#0F1419' },
          { label: 'Средний uptime', value: `${avgUptime}%`, color: '#0A7A5F' },
          { label: 'Бюджет риска', value: criticalServices, sub: '≥50% исчерпано', color: criticalServices > 0 ? '#DC2626' : '#0F1419' },
          { label: 'Инцидентов (30д)', value: 1, color: '#D97706' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#F8FAFB' }}>
            <div style={label}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
            {'sub' in s && s.sub && <div style={{ fontSize: 10, color: '#94A3B8' }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['table', 'chart'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 800,
              background: view === v ? '#0F1419' : 'transparent',
              color: view === v ? '#fff' : '#64748B',
              outline: view === v ? 'none' : '1px solid #E4E6EA',
            }}
          >
            {v === 'table' ? 'SLO-таблица' : 'Latency chart'}
          </button>
        ))}
      </div>

      {view === 'table' ? (
        <div style={{ border: '1px solid #E4E6EA', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 80px 80px 1fr', gap: 12, padding: '8px 14px', background: '#F8FAFB', borderBottom: '1px solid #E4E6EA' }}>
            {['Сервис', 'SLI', 'SLO', 'Факт', 'Error Budget'].map((h) => (
              <div key={h} style={label}>{h}</div>
            ))}
          </div>
          {SLO_METRICS.map((m, i) => {
            const ok = m.current >= m.slo;
            return (
              <div
                key={m.service}
                style={{
                  display: 'grid', gridTemplateColumns: '160px 1fr 80px 80px 1fr',
                  gap: 12, padding: '10px 14px', alignItems: 'center',
                  borderBottom: i < SLO_METRICS.length - 1 ? '1px solid #F1F5F9' : 'none',
                  background: m.errorBudgetUsed >= 80 ? '#FFF5F5' : 'transparent',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419' }}>{m.service}</div>
                  {m.lastIncident && <div style={{ fontSize: 10, color: '#DC2626' }}>⚠ {m.lastIncident}</div>}
                </div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{m.sli}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', fontFamily: 'var(--font-mono)' }}>{m.slo}%</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: ok ? '#0A7A5F' : '#DC2626', fontFamily: 'var(--font-mono)' }}>{m.current}%</div>
                <BudgetBar used={m.errorBudgetUsed} />
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16 }}>
          <div style={{ ...label, marginBottom: 12 }}>p95 Latency · мс · 24 часа</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={LATENCY_SERIES} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="apiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0A7A5F" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#0A7A5F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#94A3B8' }} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E4E6EA' }} formatter={(v: number) => [`${v}мс`]} />
              <ReferenceLine y={500} stroke="#DC2626" strokeDasharray="3 3" label={{ value: 'SLO 500мс', fontSize: 9, fill: '#DC2626' }} />
              <Area type="monotone" dataKey="api" stroke="#0A7A5F" strokeWidth={2} fill="url(#apiGrad)" name="API" />
              <Area type="monotone" dataKey="deals" stroke="#2563EB" strokeWidth={1.5} fill="none" name="Сделки" />
              <Area type="monotone" dataKey="docs" stroke="#D97706" strokeWidth={1.5} fill="none" strokeDasharray="4 2" name="Документы" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Error budget policy */}
      <div style={{ padding: '12px 16px', borderRadius: 14, background: '#FFFBEB', border: '1px solid #FDE68A', fontSize: 12, lineHeight: 1.6, color: '#92400E' }}>
        <strong>Error Budget Policy:</strong> при исчерпании &gt;50% ежемесячного бюджета — freeze новых фич,<br/>
        фокус на надёжность. При &gt;80% — P1-инцидент, war room.
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Демо-превью. В боевом контуре — Prometheus + Grafana + SLO-дашборды, Alertmanager → PagerDuty. Grafana Synthetic Monitoring на критичных путях каждые 5 мин.
      </div>
    </div>
  );
}
