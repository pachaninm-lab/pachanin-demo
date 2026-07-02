'use client';

import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

interface TestRun {
  id: string;
  name: string;
  runAt: string;
  duration: string;
  vus: number;
  peakVus: number;
  totalRequests: number;
  p95ms: number;
  p99ms: number;
  errorRate: number;
  passed: boolean;
  scenario: string;
}

const DEMO_RUNS: TestRun[] = [
  { id: 'k6-001', name: 'Baseline · normal load',  runAt: '2024-03-20T10:00:00Z', duration: '25 мин', vus: 500,  peakVus: 500,  totalRequests: 847200,  p95ms: 187, p99ms: 312, errorRate: 0.08, passed: true,  scenario: 'baseline' },
  { id: 'k6-002', name: 'Peak · 3x normal',        runAt: '2024-03-20T11:00:00Z', duration: '25 мин', vus: 1500, peakVus: 1500, totalRequests: 1842000, p95ms: 423, p99ms: 891, errorRate: 0.31, passed: true,  scenario: 'peak' },
  { id: 'k6-003', name: 'Stress · 5000 VU ramp',   runAt: '2024-03-19T14:00:00Z', duration: '20 мин', vus: 5000, peakVus: 5000, totalRequests: 2901000, p95ms: 748, p99ms: 1820, errorRate: 1.84, passed: false, scenario: 'stress' },
  { id: 'k6-004', name: 'Spike · 1000 VU sudden',  runAt: '2024-03-18T09:00:00Z', duration: '15 мин', vus: 1000, peakVus: 1000, totalRequests: 621000,  p95ms: 316, p99ms: 542, errorRate: 0.22, passed: true,  scenario: 'spike' },
];

const generateLoadCurve = (peakVus: number, passed: boolean) =>
  [
    { t: '0:00', vus: 0,                          p95: 50 },
    { t: '5:00', vus: Math.round(peakVus * 0.33), p95: Math.round(80 + Math.random() * 50) },
    { t: '10:00', vus: peakVus,                   p95: Math.round(passed ? 180 : 600) + Math.round(Math.random() * 100) },
    { t: '15:00', vus: peakVus,                   p95: Math.round(passed ? 200 : 750) + Math.round(Math.random() * 80) },
    { t: '20:00', vus: Math.round(peakVus * 0.5), p95: Math.round(passed ? 160 : 500) },
    { t: '25:00', vus: 0,                          p95: 45 },
  ];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function LoadTestingPanel() {
  const [selected, setSelected] = useState<string>(DEMO_RUNS[0].id);
  const run = DEMO_RUNS.find((r) => r.id === selected) ?? DEMO_RUNS[0];
  const curve = generateLoadCurve(run.peakVus, run.passed);

  const passed = DEMO_RUNS.filter((r) => r.passed).length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Запусков', value: DEMO_RUNS.length,  color: '#0F1419' },
          { label: 'Прошло',   value: passed,            color: '#0A7A5F' },
          { label: 'Провалов', value: DEMO_RUNS.length - passed, color: DEMO_RUNS.length - passed > 0 ? '#DC2626' : '#0A7A5F' },
          { label: 'Лучший p95', value: `${Math.min(...DEMO_RUNS.map(r => r.p95ms))} мс`, color: '#0F1419' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Run selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {DEMO_RUNS.map((r) => (
          <button key={r.id} onClick={() => setSelected(r.id)} style={{ padding: '5px 12px', borderRadius: 8, border: selected === r.id ? 'none' : '1px solid #E4E6EA', background: selected === r.id ? (r.passed ? '#0A7A5F' : '#DC2626') : '#F8FAFB', color: selected === r.id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {r.name}
          </button>
        ))}
      </div>

      {/* Selected run metrics */}
      <div style={{ padding: '12px 14px', borderRadius: 12, background: run.passed ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${run.passed ? '#BBF7D0' : '#FECACA'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0F1419' }}>{run.name}</div>
            <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{new Date(run.runAt).toLocaleString('ru-RU')} · {run.duration} · {run.scenario}</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 6, background: run.passed ? '#0A7A5F' : '#DC2626', color: '#fff' }}>
            {run.passed ? '✓ PASSED' : '✗ FAILED'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
          {[
            { label: 'Макс. VU',      value: run.peakVus.toLocaleString('ru-RU'), ok: true },
            { label: 'Запросов',      value: (run.totalRequests / 1000).toFixed(0) + ' тыс', ok: true },
            { label: 'p95 latency',   value: `${run.p95ms} мс`, ok: run.p95ms < 500 },
            { label: 'p99 latency',   value: `${run.p99ms} мс`, ok: run.p99ms < 2000 },
            { label: 'Error rate',    value: `${run.errorRate}%`, ok: run.errorRate < 1 },
            { label: 'SLO p95 < 500', value: run.p95ms < 500 ? 'OK' : 'FAIL', ok: run.p95ms < 500 },
          ].map((s) => (
            <div key={s.label} style={{ padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.9)' }}>
              <div style={lbl}>{s.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: s.ok ? '#0A7A5F' : '#DC2626', marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Load curve chart */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Профиль нагрузки · VU + p95 latency</div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={curve} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="t" tick={{ fontSize: 9 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 9 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} />
            <Tooltip contentStyle={{ fontSize: 10 }} />
            <ReferenceLine yAxisId="right" y={500} stroke="#DC2626" strokeDasharray="4 2" label={{ value: 'SLO 500мс', fill: '#DC2626', fontSize: 8 }} />
            <Area yAxisId="left"  type="monotone" dataKey="vus" stroke="#64748B" fill="#F1F5F9" name="VU" strokeWidth={1.5} />
            <Area yAxisId="right" type="monotone" dataKey="p95" stroke={run.passed ? '#0A7A5F' : '#DC2626'} fill={run.passed ? '#D1FAE5' : '#FEE2E2'} name="p95 мс" strokeWidth={2} fillOpacity={0.4} />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 12, fontSize: 9, color: '#94A3B8', marginTop: 4 }}>
          <span style={{ color: '#64748B' }}>— VU</span>
          <span style={{ color: run.passed ? '#0A7A5F' : '#DC2626' }}>— p95 мс</span>
          <span style={{ color: '#DC2626' }}>-- SLO 500 мс</span>
        </div>
      </div>

      {/* Thresholds */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Thresholds (k6 options)</div>
        <div style={{ display: 'grid', gap: 4 }}>
          {[
            { check: 'http_req_duration (p95 < 500 мс)', ok: run.p95ms < 500,     actual: `${run.p95ms} мс` },
            { check: 'http_req_duration (p99 < 2000 мс)', ok: run.p99ms < 2000,   actual: `${run.p99ms} мс` },
            { check: 'http_req_failed (rate < 1%)',        ok: run.errorRate < 1,  actual: `${run.errorRate}%` },
            { check: 'vus peak = target',                  ok: true,               actual: `${run.peakVus} VU` },
          ].map((t) => (
            <div key={t.check} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 8px', borderRadius: 6, background: t.ok ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${t.ok ? '#BBF7D0' : '#FECACA'}` }}>
              <span style={{ fontSize: 11, flexShrink: 0 }}>{t.ok ? '✓' : '✗'}</span>
              <span style={{ fontSize: 10, flex: 1, color: '#374151' }}>{t.check}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: t.ok ? '#065F46' : '#DC2626' }}>{t.actual}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        k6 · baseline 500 VU → peak 1500 VU (3x) → stress 5000 VU · SLO: p95 &lt; 500 мс, error rate &lt; 1% · CI quality gate: блокировка при превышении · Демо-данные.
      </div>
    </div>
  );
}
