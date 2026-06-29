'use client';

import { useState } from 'react';

type HealthStatus = 'ok' | 'degraded' | 'down';

interface ServiceHealth {
  name: string;
  endpoint: string;
  status: HealthStatus;
  latencyMs: number;
  version: string;
  commit: string;
  checks: { name: string; status: HealthStatus; detail?: string }[];
}

const STATUS_CONFIG: Record<HealthStatus, { label: string; color: string; bg: string; dot: string }> = {
  ok:       { label: 'OK',       color: '#065F46', bg: '#D1FAE5', dot: '#0A7A5F' },
  degraded: { label: 'DEGRADED', color: '#92400E', bg: '#FEF3C7', dot: '#D97706' },
  down:     { label: 'DOWN',     color: '#991B1B', bg: '#FEE2E2', dot: '#DC2626' },
};

const SERVICES: ServiceHealth[] = [
  {
    name: 'deal-service', endpoint: '/health', status: 'ok', latencyMs: 12, version: 'v2.14.1', commit: 'a3f8b2c',
    checks: [
      { name: 'database',  status: 'ok',       detail: 'PostgreSQL 16 · ping 4 мс' },
      { name: 'kafka',     status: 'ok',       detail: 'broker count: 3, lag: 0' },
      { name: 'redis',     status: 'ok',       detail: 'cluster 3M+3R · ping 1 мс' },
      { name: 'outbox',    status: 'ok',       detail: 'pending: 0, dead: 0' },
    ],
  },
  {
    name: 'payment-service', endpoint: '/health', status: 'ok', latencyMs: 8, version: 'v1.9.4', commit: 'c1d2e3f',
    checks: [
      { name: 'database', status: 'ok' },
      { name: 'kafka',    status: 'ok' },
      { name: 'vault',    status: 'ok', detail: 'secrets sealed: false · token ttl: 23 ч' },
      { name: 'bank_api', status: 'ok', detail: 'СберБизнес API · latency 89 мс' },
    ],
  },
  {
    name: 'document-service', endpoint: '/health', status: 'degraded', latencyMs: 431, version: 'v1.6.2', commit: 'f4a5b6c',
    checks: [
      { name: 'database',   status: 'ok'       },
      { name: 'diadok',     status: 'degraded', detail: 'Контур.Диадок API нестабилен · timeout rate 12%' },
      { name: 's3_storage', status: 'ok',       detail: 'Yandex Object Storage · ping 22 мс' },
      { name: 'cryptopro',  status: 'ok'       },
    ],
  },
  {
    name: 'notification-svc', endpoint: '/health', status: 'degraded', latencyMs: 621, version: 'v1.3.0', commit: 'b7c8d9e',
    checks: [
      { name: 'kafka',    status: 'ok'       },
      { name: 'smtp',     status: 'degraded', detail: 'Delivery rate 94% (SLO: 99%)' },
      { name: 'telegram', status: 'ok'       },
      { name: 'sms',      status: 'ok'       },
    ],
  },
  {
    name: 'ml-serving', endpoint: '/health', status: 'ok', latencyMs: 45, version: 'v0.8.3', commit: 'd0e1f2a',
    checks: [
      { name: 'model_loaded',    status: 'ok', detail: 'price-predictor v2.3.1 · fraud-detector v1.9.0' },
      { name: 'redis_features',  status: 'ok', detail: 'Feature Store · 2 модели загружены' },
      { name: 'inference_queue', status: 'ok', detail: 'queue depth: 3' },
    ],
  },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function HealthStatusPanel() {
  const [selected, setSelected] = useState<string | null>(null);

  const ok = SERVICES.filter((s) => s.status === 'ok').length;
  const degraded = SERVICES.filter((s) => s.status === 'degraded').length;
  const down = SERVICES.filter((s) => s.status === 'down').length;

  const svc = SERVICES.find((s) => s.name === selected);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8 }}>
        {[
          { label: 'Сервисов', value: SERVICES.length, color: '#0F1419' },
          { label: 'OK',       value: ok,       color: '#0A7A5F' },
          { label: 'DEGRADED', value: degraded, color: degraded > 0 ? '#D97706' : '#0A7A5F' },
          { label: 'DOWN',     value: down,     color: down > 0 ? '#DC2626' : '#0A7A5F' },
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
                {/* Status dot */}
                <span style={{ width: 10, height: 10, borderRadius: 5, background: cfg.dot, flexShrink: 0, boxShadow: s.status !== 'ok' ? `0 0 6px ${cfg.dot}` : 'none' }} />
                <code style={{ fontSize: 11, fontWeight: 700, color: '#0F1419', flex: 1 }}>{s.name}</code>
                <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                <span style={{ fontSize: 10, color: '#64748B', minWidth: 60 }}>{s.latencyMs} мс</span>
                <span style={{ fontSize: 9, color: '#94A3B8', minWidth: 50, fontFamily: 'monospace' }}>{s.version}</span>
              </button>

              {isOpen && (
                <div style={{ borderTop: '1px solid #E4E6EA', padding: '10px 12px', background: '#fff' }}>
                  <div style={{ ...lbl, marginBottom: 6 }}>Health checks · <code style={{ fontSize: 9 }}>{s.endpoint}/detailed</code></div>
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
                    version: {s.version} · commit: {s.commit} · endpoint: GET {s.endpoint}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* DR table */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Disaster Recovery · RPO / RTO</div>
        <div style={{ display: 'grid', gap: 4 }}>
          {[
            { scenario: 'Отказ одного Pod',        rpo: '0',      rto: '< 30 сек', mechanism: 'K8s PDB + HPA' },
            { scenario: 'Отказ одной ноды',         rpo: '0',      rto: '< 2 мин',  mechanism: 'K8s rescheduling' },
            { scenario: 'Отказ зоны доступности', rpo: '< 1 мин', rto: '< 10 мин', mechanism: 'Multi-AZ deployment' },
            { scenario: 'Полный отказ ДЦ',          rpo: '< 5 мин', rto: '< 30 мин', mechanism: 'Active-Passive failover' },
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
        GET /health · GET /ready · GET /metrics (Prometheus) · GET /version · Kubernetes liveness + readiness probes · Synth monitoring каждые 5 мин · Демо-данные.
      </div>
    </div>
  );
}
