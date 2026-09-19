'use client';

import { useState } from 'react';

type HealthStatus = 'ready' | 'planned' | 'required';

interface ServiceHealth {
  name: string;
  endpoint: string;
  status: HealthStatus;
  latencyTargetMs: number;
  versionPolicy: string;
  commitPolicy: string;
  checks: { name: string; status: HealthStatus; detail?: string }[];
}

const STATUS_CONFIG: Record<HealthStatus, { label: string; color: string; bg: string; dot: string }> = {
  ready:    { label: 'READY',    color: '#065F46', bg: '#D1FAE5', dot: '#0A7A5F' },
  planned:  { label: 'PLANNED',  color: '#92400E', bg: '#FEF3C7', dot: '#D97706' },
  required: { label: 'REQUIRED', color: '#991B1B', bg: '#FEE2E2', dot: '#DC2626' },
};

const SERVICES: ServiceHealth[] = [
  {
    name: 'deal-service', endpoint: '/health', status: 'ready', latencyTargetMs: 500, versionPolicy: 'semver + build metadata', commitPolicy: 'git sha from deploy',
    checks: [
      { name: 'database', status: 'planned', detail: 'PostgreSQL health требует промышленной БД и connection pool' },
      { name: 'event-bus', status: 'planned', detail: 'Kafka-compatible lag и consumer group проверяются после подключения event backbone' },
      { name: 'cache-locks', status: 'planned', detail: 'Redis/lock health должен проверять TTL, contention и safe fallback' },
      { name: 'outbox', status: 'ready', detail: 'Pending/dead/manual_review являются обязательными сигналами сделки' },
    ],
  },
  {
    name: 'payment-service', endpoint: '/health', status: 'planned', latencyTargetMs: 700, versionPolicy: 'semver + migrations', commitPolicy: 'git sha from deploy',
    checks: [
      { name: 'database', status: 'planned' },
      { name: 'event-bus', status: 'planned' },
      { name: 'secret-store', status: 'required', detail: 'Vault/secret-store не считать подключённым без live-секретов и ротации' },
      { name: 'bank_api', status: 'required', detail: 'Банк не подключён без договоров, боевых доступов, callback и reconciliation' },
    ],
  },
  {
    name: 'document-service', endpoint: '/health', status: 'planned', latencyTargetMs: 700, versionPolicy: 'semver + template version', commitPolicy: 'git sha from deploy',
    checks: [
      { name: 'database', status: 'planned' },
      { name: 'edo', status: 'required', detail: 'ЭДО/Диадок не считать подключённым без договора, ключей и live-документооборота' },
      { name: 'object_storage', status: 'planned', detail: 'Хранилище документов требует bucket policy, retention и audit trail' },
      { name: 'signature', status: 'required', detail: 'КЭП/КриптоПро не считать подключёнными без сертификатов и проверенного signing-flow' },
    ],
  },
  {
    name: 'notification-svc', endpoint: '/health', status: 'planned', latencyTargetMs: 1000, versionPolicy: 'semver + channel adapters', commitPolicy: 'git sha from deploy',
    checks: [
      { name: 'event-bus', status: 'planned' },
      { name: 'smtp', status: 'planned', detail: 'Доставка писем требует провайдера, bounce handling и audit log' },
      { name: 'telegram', status: 'planned', detail: 'Бот требует токена, webhook и privacy controls' },
      { name: 'sms', status: 'required', detail: 'SMS-канал не считать подключённым без договора и failover' },
    ],
  },
  {
    name: 'ai-risk-agent', endpoint: '/health', status: 'required', latencyTargetMs: 1200, versionPolicy: 'model version + prompt version', commitPolicy: 'artifact hash',
    checks: [
      { name: 'model_loaded', status: 'required', detail: 'ИИ-контур должен помогать сделке, документам, рискам и спору, но не выдавать ML как live без runtime' },
      { name: 'feature_store', status: 'required', detail: 'Feature store требует промышленного хранилища и контроля данных' },
      { name: 'inference_queue', status: 'planned', detail: 'Очередь нужна для деградации без блокировки сделки' },
    ],
  },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function HealthStatusPanel() {
  const [selected, setSelected] = useState<string | null>(null);

  const ready = SERVICES.filter((s) => s.status === 'ready').length;
  const planned = SERVICES.filter((s) => s.status === 'planned').length;
  const required = SERVICES.filter((s) => s.status === 'required').length;

  const svc = SERVICES.find((s) => s.name === selected);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8 }}>
        {[
          { label: 'Сервисов', value: SERVICES.length, color: '#0F1419' },
          { label: 'READY', value: ready, color: '#0A7A5F' },
          { label: 'PLANNED', value: planned, color: planned > 0 ? '#D97706' : '#0A7A5F' },
          { label: 'REQUIRED', value: required, color: required > 0 ? '#DC2626' : '#0A7A5F' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Service list */}
      <div style={{ display: 'grid', gap: 6 }}>
        {SERVICES.map((s) => {
          const cfg = STATUS_CONFIG[s.status];
          const isOpen = selected === s.name;
          return (
            <div key={s.name} style={{ borderRadius: 12, border: `1px solid ${isOpen ? cfg.dot : '#E4E6EA'}`, overflow: 'hidden' }}>
              <button
                onClick={() => setSelected(isOpen ? null : s.name)}
                style={{ width: '100%', padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center', background: isOpen ? cfg.bg + '80' : '#F8FAFB', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 5, background: cfg.dot, flexShrink: 0, boxShadow: s.status === 'required' ? `0 0 6px ${cfg.dot}` : 'none' }} />
                <code style={{ fontSize: 11, fontWeight: 700, color: '#0F1419', flex: 1 }}>{s.name}</code>
                <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                <span style={{ fontSize: 10, color: '#64748B', minWidth: 70 }}>p95 ≤ {s.latencyTargetMs} мс</span>
              </button>

              {isOpen && (
                <div style={{ borderTop: '1px solid #E4E6EA', padding: '10px 12px', background: '#fff' }}>
                  <div style={{ ...lbl, marginBottom: 6 }}>Readiness checks · <code style={{ fontSize: 9 }}>{s.endpoint}/detailed</code></div>
                  <div style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
                    {s.checks.map((c) => {
                      const cc = STATUS_CONFIG[c.status];
                      return (
                        <div key={c.name} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 8px', borderRadius: 6, background: cc.bg + '60', border: `1px solid ${cc.dot}30` }}>
                          <span style={{ width: 7, height: 7, borderRadius: 4, background: cc.dot, flexShrink: 0 }} />
                          <code style={{ fontSize: 10, fontWeight: 700, color: '#0F1419', minWidth: 100 }}>{c.name}</code>
                          <span style={{ fontSize: 9, fontWeight: 800, color: cc.color }}>{cc.label}</span>
                          {c.detail && <span style={{ fontSize: 9, color: '#64748B', flex: 1 }}>{c.detail}</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 9, color: '#94A3B8', fontFamily: 'monospace' }}>
                    version policy: {s.versionPolicy} · commit policy: {s.commitPolicy} · endpoint: GET {s.endpoint}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* DR table */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Disaster Recovery · целевые RPO/RTO, не подтверждённый SLA</div>
        <div style={{ display: 'grid', gap: 4 }}>
          {[
            { scenario: 'Отказ одного Pod', rpo: '0', rto: '< 30 сек', mechanism: 'K8s PDB + HPA · требует live-cluster' },
            { scenario: 'Отказ одной ноды', rpo: '0', rto: '< 2 мин', mechanism: 'K8s rescheduling · требует DR-теста' },
            { scenario: 'Отказ зоны доступности', rpo: '< 1 мин', rto: '< 10 мин', mechanism: 'Multi-AZ deployment · требует провайдера' },
            { scenario: 'Полный отказ ДЦ', rpo: '< 5 мин', rto: '< 30 мин', mechanism: 'Active-Passive failover · требует промышленного runbook' },
          ].map((row) => (
            <div key={row.scenario} style={{ display: 'grid', gridTemplateColumns: '2fr 60px 80px 1fr', gap: 8, padding: '6px 10px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA', fontSize: 10, alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: '#0F1419' }}>{row.scenario}</span>
              <span style={{ color: '#0A7A5F', fontWeight: 800 }}>RPO: {row.rpo}</span>
              <span style={{ color: '#D97706', fontWeight: 800 }}>RTO: {row.rto}</span>
              <span style={{ color: '#64748B' }}>{row.mechanism}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Health/readiness model · GET /health · GET /ready · GET /metrics · GET /version · liveness/readiness probes · synthetic monitoring — целевой контур; фактический статус требует подключённого промышленного мониторинга.
      </div>
    </div>
  );
}
