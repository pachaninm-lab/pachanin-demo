'use client';

import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

interface TestPlan {
  id: string;
  name: string;
  duration: string;
  vus: number;
  peakVus: number;
  targetRequests: string;
  p95TargetMs: number;
  p99TargetMs: number;
  errorRateTarget: number;
  status: 'planned' | 'required' | 'blocked';
  scenario: string;
  note: string;
}

const LOAD_TEST_PLAN: TestPlan[] = [
  { id: 'k6-plan-001', name: 'Baseline · normal load', duration: '25 мин', vus: 500, peakVus: 500, targetRequests: 'по профилю сделки', p95TargetMs: 500, p99TargetMs: 2000, errorRateTarget: 1, status: 'planned', scenario: 'baseline', note: 'Проверка штатного профиля: список сделок, карточка сделки, документы, логистика, банк/outbox.' },
  { id: 'k6-plan-002', name: 'Peak · 3x normal', duration: '25 мин', vus: 1500, peakVus: 1500, targetRequests: '3x baseline', p95TargetMs: 700, p99TargetMs: 2500, errorRateTarget: 1, status: 'planned', scenario: 'peak', note: 'Проверка пикового дня торгов, массовых обновлений статусов и одновременных действий ролей.' },
  { id: 'k6-plan-003', name: 'Stress · 5000 VU ramp', duration: '20 мин', vus: 5000, peakVus: 5000, targetRequests: 'до деградации', p95TargetMs: 1200, p99TargetMs: 3500, errorRateTarget: 3, status: 'required', scenario: 'stress', note: 'Нужен отдельный прогон в промышленном окружении. Цель — найти точку деградации, а не заявлять прохождение.' },
  { id: 'k6-plan-004', name: 'Spike · 1000 VU sudden', duration: '15 мин', vus: 1000, peakVus: 1000, targetRequests: 'резкий всплеск', p95TargetMs: 800, p99TargetMs: 2500, errorRateTarget: 2, status: 'planned', scenario: 'spike', note: 'Проверка внезапного входа пользователей после уведомления, смены статуса или торгового события.' },
];

const generateLoadCurve = (peakVus: number) =>
  [
    { t: '0:00', vus: 0, p95: 80 },
    { t: '5:00', vus: Math.round(peakVus * 0.33), p95: 220 },
    { t: '10:00', vus: peakVus, p95: 500 },
    { t: '15:00', vus: peakVus, p95: 650 },
    { t: '20:00', vus: Math.round(peakVus * 0.5), p95: 420 },
    { t: '25:00', vus: 0, p95: 120 },
  ];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function LoadTestingPanel() {
  const [selected, setSelected] = useState<string>(LOAD_TEST_PLAN[0].id);
  const plan = LOAD_TEST_PLAN.find((r) => r.id === selected) ?? LOAD_TEST_PLAN[0];
  const curve = generateLoadCurve(plan.peakVus);

  const planned = LOAD_TEST_PLAN.filter((r) => r.status === 'planned').length;
  const required = LOAD_TEST_PLAN.filter((r) => r.status === 'required').length;
  const blocked = LOAD_TEST_PLAN.filter((r) => r.status === 'blocked').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Сценариев', value: LOAD_TEST_PLAN.length, color: '#0F1419' },
          { label: 'Запланировано', value: planned, color: '#0A7A5F' },
          { label: 'Обязательно', value: required, color: '#92400E' },
          { label: 'Блокеров', value: blocked, color: blocked > 0 ? '#DC2626' : '#0A7A5F' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Plan selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {LOAD_TEST_PLAN.map((r) => (
          <button key={r.id} onClick={() => setSelected(r.id)} style={{ padding: '5px 12px', borderRadius: 8, border: selected === r.id ? 'none' : '1px solid #E4E6EA', background: selected === r.id ? (r.status === 'required' ? '#D97706' : '#0A7A5F') : '#F8FAFB', color: selected === r.id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {r.name}
          </button>
        ))}
      </div>

      {/* Selected plan metrics */}
      <div style={{ padding: '12px 14px', borderRadius: 12, background: plan.status === 'required' ? '#FFFBEB' : '#F0FDF4', border: `1px solid ${plan.status === 'required' ? '#FDE68A' : '#BBF7D0'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0F1419' }}>{plan.name}</div>
            <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{plan.duration} · {plan.scenario}</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 6, background: plan.status === 'required' ? '#D97706' : '#0A7A5F', color: '#fff' }}>
            {plan.status === 'required' ? 'REQUIRED RUN' : 'PLANNED'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
          {[
            { label: 'Макс. VU', value: plan.peakVus.toLocaleString('ru-RU') },
            { label: 'Профиль', value: plan.targetRequests },
            { label: 'p95 target', value: `${plan.p95TargetMs} мс` },
            { label: 'p99 target', value: `${plan.p99TargetMs} мс` },
            { label: 'Error target', value: `< ${plan.errorRateTarget}%` },
            { label: 'Статус', value: plan.status === 'required' ? 'нужен прогон' : 'план' },
          ].map((s) => (
            <div key={s.label} style={{ padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.9)' }}>
              <div style={lbl}>{s.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419', marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: '#64748B', marginTop: 10 }}>{plan.note}</div>
      </div>

      {/* Load curve chart */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Целевой профиль нагрузки · VU + p95 target</div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={curve} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="t" tick={{ fontSize: 9 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 9 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} />
            <Tooltip contentStyle={{ fontSize: 10 }} />
            <ReferenceLine yAxisId="right" y={plan.p95TargetMs} stroke="#DC2626" strokeDasharray="4 2" label={{ value: `p95 ${plan.p95TargetMs}мс`, fill: '#DC2626', fontSize: 8 }} />
            <Area yAxisId="left" type="monotone" dataKey="vus" stroke="#64748B" fill="#F1F5F9" name="VU" strokeWidth={1.5} />
            <Area yAxisId="right" type="monotone" dataKey="p95" stroke="#0A7A5F" fill="#D1FAE5" name="p95 мс" strokeWidth={2} fillOpacity={0.4} />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 12, fontSize: 9, color: '#94A3B8', marginTop: 4 }}>
          <span style={{ color: '#64748B' }}>— VU</span>
          <span style={{ color: '#0A7A5F' }}>— p95 target curve</span>
          <span style={{ color: '#DC2626' }}>-- целевой порог</span>
        </div>
      </div>

      {/* Thresholds */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Thresholds для промышленного прогона</div>
        <div style={{ display: 'grid', gap: 4 }}>
          {[
            { check: `http_req_duration p95 < ${plan.p95TargetMs} мс`, actual: 'требует запуска' },
            { check: `http_req_duration p99 < ${plan.p99TargetMs} мс`, actual: 'требует запуска' },
            { check: `http_req_failed rate < ${plan.errorRateTarget}%`, actual: 'требует запуска' },
            { check: 'idempotency / outbox / retry не создают дублей', actual: 'требует проверки' },
          ].map((t) => (
            <div key={t.check} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 8px', borderRadius: 6, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <span style={{ fontSize: 11, flexShrink: 0 }}>!</span>
              <span style={{ fontSize: 10, flex: 1, color: '#374151' }}>{t.check}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#92400E' }}>{t.actual}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        k6 load testing plan · baseline 500 VU → peak 1500 VU → stress 5000 VU · результаты не заявляются без отдельного промышленного прогона и сохранённого отчёта.
      </div>
    </div>
  );
}
