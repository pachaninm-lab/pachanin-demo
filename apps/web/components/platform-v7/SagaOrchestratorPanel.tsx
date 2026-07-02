'use client';

import { useState } from 'react';

type StepStatus = 'done' | 'active' | 'pending' | 'failed' | 'skipped';

interface SagaStep {
  name: string;
  service: string;
  status: StepStatus;
  startedAt?: string;
  durationMs?: number;
  retryCount?: number;
  error?: string;
}

interface SagaInstance {
  id: string;
  dealId: string;
  state: string;
  startedAt: string;
  steps: SagaStep[];
  dlqEntries: number;
}

const STEP_CONFIG: Record<StepStatus, { color: string; bg: string; icon: string }> = {
  done:    { color: '#065F46', bg: '#D1FAE5', icon: '✓' },
  active:  { color: '#1E40AF', bg: '#DBEAFE', icon: '⟳' },
  pending: { color: '#64748B', bg: '#F1F5F9', icon: '○' },
  failed:  { color: '#991B1B', bg: '#FEE2E2', icon: '✗' },
  skipped: { color: '#94A3B8', bg: '#F8FAFB', icon: '⊘' },
};

const DEMO_SAGAS: SagaInstance[] = [
  {
    id: 'saga-9095', dealId: 'DL-9095', state: 'SETTLED', startedAt: '2024-01-14T15:00:00Z', dlqEntries: 0,
    steps: [
      { name: 'reserve_funds',       service: 'payment-service',   status: 'done',    startedAt: '2024-01-14T15:01:00Z', durationMs: 312 },
      { name: 'create_contract',     service: 'document-service',  status: 'done',    startedAt: '2024-01-14T15:02:00Z', durationMs: 841 },
      { name: 'sign_contract_ukep',  service: 'document-service',  status: 'done',    startedAt: '2024-01-14T16:00:00Z', durationMs: 1420 },
      { name: 'assign_logistics',    service: 'logistics-service', status: 'done',    startedAt: '2024-01-14T16:05:00Z', durationMs: 220 },
      { name: 'verify_fgis_sdiz',    service: 'fgis-adapter',      status: 'done',    startedAt: '2024-01-14T17:00:00Z', durationMs: 2100 },
      { name: 'accept_delivery',     service: 'logistics-service', status: 'done',    startedAt: '2024-01-16T09:00:00Z', durationMs: 890 },
      { name: 'quality_check',       service: 'lab-service',       status: 'done',    startedAt: '2024-01-16T11:00:00Z', durationMs: 3600000 },
      { name: 'sign_acceptance_act', service: 'document-service',  status: 'done',    startedAt: '2024-01-17T09:00:00Z', durationMs: 1120 },
      { name: 'release_funds',       service: 'payment-service',   status: 'done',    startedAt: '2024-01-17T09:02:00Z', durationMs: 445 },
      { name: 'send_edo_upd',        service: 'edo-adapter',       status: 'done',    startedAt: '2024-01-17T09:05:00Z', durationMs: 1830 },
      { name: 'close_deal',          service: 'deal-service',      status: 'done',    startedAt: '2024-01-17T09:07:00Z', durationMs: 88 },
    ],
  },
  {
    id: 'saga-9110', dealId: 'DL-9110', state: 'QUALITY_CHECK', startedAt: '2024-03-12T09:00:00Z', dlqEntries: 1,
    steps: [
      { name: 'reserve_funds',       service: 'payment-service',   status: 'done',  startedAt: '2024-03-12T09:01:00Z', durationMs: 290 },
      { name: 'create_contract',     service: 'document-service',  status: 'done',  startedAt: '2024-03-12T09:02:00Z', durationMs: 760 },
      { name: 'sign_contract_ukep',  service: 'document-service',  status: 'done',  startedAt: '2024-03-12T10:00:00Z', durationMs: 1380 },
      { name: 'assign_logistics',    service: 'logistics-service', status: 'done',  startedAt: '2024-03-12T10:05:00Z', durationMs: 200 },
      { name: 'verify_fgis_sdiz',    service: 'fgis-adapter',      status: 'failed', startedAt: '2024-03-12T11:00:00Z', durationMs: 30000, retryCount: 3, error: 'ФГИС «Зерно» timeout: Афлатоксин B1 превышает норму, сертификат заблокирован' },
      { name: 'accept_delivery',     service: 'logistics-service', status: 'pending' },
      { name: 'quality_check',       service: 'lab-service',       status: 'active', startedAt: '2024-03-13T08:00:00Z' },
      { name: 'sign_acceptance_act', service: 'document-service',  status: 'pending' },
      { name: 'release_funds',       service: 'payment-service',   status: 'pending' },
      { name: 'send_edo_upd',        service: 'edo-adapter',       status: 'pending' },
      { name: 'close_deal',          service: 'deal-service',      status: 'pending' },
    ],
  },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

function fmtDuration(ms?: number) {
  if (!ms) return '';
  if (ms < 1000) return `${ms} мс`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} с`;
  return `${Math.round(ms / 60000)} мин`;
}

export function SagaOrchestratorPanel() {
  const [selected, setSelected] = useState<string>(DEMO_SAGAS[0].id);
  const saga = DEMO_SAGAS.find((s) => s.id === selected) ?? DEMO_SAGAS[0];

  const doneCount = saga.steps.filter(s => s.status === 'done').length;
  const failedCount = saga.steps.filter(s => s.status === 'failed').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Saga selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {DEMO_SAGAS.map((s) => (
          <button key={s.id} onClick={() => setSelected(s.id)} style={{ padding: '5px 14px', borderRadius: 8, border: selected === s.id ? 'none' : '1px solid #E4E6EA', background: selected === s.id ? '#0F1419' : '#F8FAFB', color: selected === s.id ? '#fff' : '#64748B', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            {s.dealId} · {s.state}
            {s.dlqEntries > 0 && <span style={{ marginLeft: 6, background: '#DC2626', color: '#fff', fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 3 }}>DLQ</span>}
          </button>
        ))}
      </div>

      {/* Saga summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8 }}>
        {[
          { label: 'Состояние',  value: saga.state,               color: '#0F1419' },
          { label: 'Шагов',      value: saga.steps.length,        color: '#0F1419' },
          { label: 'Выполнено',  value: doneCount,                color: '#0A7A5F' },
          { label: 'Ошибок',     value: failedCount,              color: failedCount > 0 ? '#DC2626' : '#0A7A5F' },
          { label: 'DLQ',        value: saga.dlqEntries,          color: saga.dlqEntries > 0 ? '#D97706' : '#0A7A5F' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
        <span style={{ color: '#64748B', minWidth: 60 }}>Прогресс</span>
        <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#E4E6EA', overflow: 'hidden' }}>
          <div style={{ width: `${(doneCount / saga.steps.length) * 100}%`, height: '100%', background: failedCount > 0 ? '#D97706' : '#0A7A5F', borderRadius: 4 }} />
        </div>
        <span style={{ fontWeight: 700, minWidth: 40, color: '#0F1419' }}>{doneCount}/{saga.steps.length}</span>
      </div>

      {/* Steps */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Шаги Saga (Оркестратор)</div>
        <div style={{ display: 'grid', gap: 3 }}>
          {saga.steps.map((step, i) => {
            const cfg = STEP_CONFIG[step.status];
            return (
              <div key={step.name} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.color}20` }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: cfg.color, minWidth: 14 }}>{cfg.icon}</span>
                <span style={{ fontSize: 9, color: '#94A3B8', minWidth: 16 }}>{i + 1}.</span>
                <code style={{ fontSize: 10, fontWeight: 700, flex: 1, color: '#0F1419' }}>{step.name}</code>
                <span style={{ fontSize: 9, color: '#64748B', minWidth: 100 }}>{step.service}</span>
                {step.durationMs && <span style={{ fontSize: 9, color: '#94A3B8', minWidth: 48 }}>{fmtDuration(step.durationMs)}</span>}
                {step.retryCount && step.retryCount > 0 && <span style={{ fontSize: 9, fontWeight: 800, color: '#D97706', background: '#FEF3C7', padding: '1px 5px', borderRadius: 4 }}>retry:{step.retryCount}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Failed step detail */}
      {saga.steps.filter(s => s.status === 'failed').map((step) => (
        <div key={step.name} style={{ padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <div style={{ ...lbl, color: '#DC2626', marginBottom: 4 }}>Ошибка шага: {step.name}</div>
          <div style={{ fontSize: 10, color: '#991B1B' }}>{step.error}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', fontWeight: 700, color: '#374151' }}>
              Повторить шаг
            </button>
            <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E6EA', background: '#fff', cursor: 'pointer', fontWeight: 700, color: '#374151' }}>
              Пропустить (override)
            </button>
            <button style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid #FEE2E2', background: '#FEF2F2', cursor: 'pointer', fontWeight: 700, color: '#DC2626' }}>
              В DLQ
            </button>
          </div>
        </div>
      ))}

      {saga.dlqEntries > 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <div style={{ ...lbl, color: '#92400E', marginBottom: 4 }}>Dead Letter Queue · {saga.dlqEntries} записей</div>
          <div style={{ fontSize: 10, color: '#B45309' }}>Сообщения в DLQ требуют ручного разбора. Возможные действия: повторная отправка, изменение payload, эскалация в Admin.</div>
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Saga Orchestrator · Kafka topics: grainflow.deals.commands · Retry: exponential backoff 2^n с · DLQ: grainflow.outbox.dead-letter · Ручное вмешательство: audit-запись · Демо-данные.
      </div>
    </div>
  );
}
