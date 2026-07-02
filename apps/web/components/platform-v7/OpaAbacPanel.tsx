'use client';

import { useState } from 'react';

type PolicyDecision = 'allow' | 'deny' | 'partial';

interface OpaPolicy {
  id: string;
  package: string;
  rule: string;
  decision: PolicyDecision;
  subject: string;
  resource: string;
  action: string;
  conditions: string[];
  evaluatedAt: string;
  durationMs: number;
}

interface AbacAttribute {
  category: 'subject' | 'resource' | 'environment';
  key: string;
  value: string;
}

const DECISION_CONFIG: Record<PolicyDecision, { label: string; bg: string; color: string; icon: string }> = {
  allow:   { label: 'Разрешено', bg: '#D1FAE5', color: '#065F46', icon: '✓' },
  deny:    { label: 'Запрещено', bg: '#FEE2E2', color: '#991B1B', icon: '✗' },
  partial: { label: 'Частично',  bg: '#FEF3C7', color: '#92400E', icon: '!' },
};

const DEMO_POLICIES: OpaPolicy[] = [
  {
    id: 'pol-001', package: 'grainflow.deals.release', rule: 'allow_release',
    decision: 'allow', subject: 'OPERATOR', resource: 'deal:DL-9095', action: 'release_funds',
    conditions: ['deal.status == ACCEPTED', 'dispute.count == 0', 'documents.all_signed == true', 'quality.passed == true'],
    evaluatedAt: '2024-01-17T09:01:55Z', durationMs: 2,
  },
  {
    id: 'pol-002', package: 'grainflow.deals.release', rule: 'allow_release',
    decision: 'deny', subject: 'OPERATOR', resource: 'deal:DL-9110', action: 'release_funds',
    conditions: ['deal.status == QUALITY_CHECK (fail: not ACCEPTED)', 'dispute.count == 1 (fail: must be 0)', 'documents.all_signed == false', 'quality.passed == false'],
    evaluatedAt: '2024-03-14T12:00:00Z', durationMs: 3,
  },
  {
    id: 'pol-003', package: 'grainflow.admin.impersonate', rule: 'allow_impersonate',
    decision: 'deny', subject: 'MANAGER', resource: 'user:buyer_9095', action: 'impersonate',
    conditions: ['subject.role in [SUPER_ADMIN] (fail: MANAGER not allowed)', 'audit.trail.enabled == true'],
    evaluatedAt: '2024-03-20T10:30:00Z', durationMs: 1,
  },
  {
    id: 'pol-004', package: 'grainflow.disputes.access', rule: 'allow_view_dispute',
    decision: 'allow', subject: 'ARBITRATOR', resource: 'dispute:DK-2024-91', action: 'view',
    conditions: ['subject.role in [ARBITRATOR, SUPER_ADMIN]', 'dispute.status != CLOSED'],
    evaluatedAt: '2024-03-14T11:05:00Z', durationMs: 1,
  },
  {
    id: 'pol-005', package: 'grainflow.kyc.verify', rule: 'can_verify_counterparty',
    decision: 'partial', subject: 'COMPLIANCE', resource: 'org:fermerop', action: 'verify_kyc',
    conditions: ['subject.role in [COMPLIANCE, OPERATOR]', 'org.documents_submitted == true (warn: inn_confirmed pending)'],
    evaluatedAt: '2024-03-19T15:00:00Z', durationMs: 4,
  },
];

const DEMO_ATTRIBUTES: AbacAttribute[] = [
  { category: 'subject',     key: 'role',          value: 'OPERATOR' },
  { category: 'subject',     key: 'org_id',         value: 'grainflow-platform' },
  { category: 'subject',     key: 'mfa_verified',   value: 'true' },
  { category: 'resource',    key: 'deal.status',    value: 'ACCEPTED' },
  { category: 'resource',    key: 'deal.amount',    value: '62 640 000 ₽' },
  { category: 'resource',    key: 'dispute.count',  value: '0' },
  { category: 'environment', key: 'time.utc',       value: '09:01:55' },
  { category: 'environment', key: 'env',            value: 'production' },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function OpaAbacPanel() {
  const [selected, setSelected] = useState<string | null>(null);

  const allowCount = DEMO_POLICIES.filter(p => p.decision === 'allow').length;
  const denyCount = DEMO_POLICIES.filter(p => p.decision === 'deny').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8 }}>
        {[
          { label: 'Политик',   value: DEMO_POLICIES.length, color: '#0F1419' },
          { label: 'Allow',     value: allowCount,           color: '#065F46' },
          { label: 'Deny',      value: denyCount,            color: '#991B1B' },
          { label: 'Атрибутов', value: DEMO_ATTRIBUTES.length, color: '#1E40AF' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* OPA architecture info */}
      <div style={{ padding: '10px 14px', borderRadius: 10, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#1E40AF', marginBottom: 4 }}>Open Policy Agent · ABAC архитектура</div>
        <div style={{ fontSize: 9, color: '#3B82F6', lineHeight: 1.6 }}>
          OPA запускается как sidecar · Политики на языке Rego · gRPC/REST /v1/data API · Решения кэшируются 30 с · Bundle server для обновления политик · Audit log каждого decision в Kafka topic grainflow.opa.decisions
        </div>
      </div>

      {/* ABAC Attributes */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>ABAC Атрибуты контекста запроса</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 4 }}>
          {DEMO_ATTRIBUTES.map((attr) => {
            const catColor = attr.category === 'subject' ? '#1E40AF' : attr.category === 'resource' ? '#065F46' : '#5B21B6';
            const catBg = attr.category === 'subject' ? '#DBEAFE' : attr.category === 'resource' ? '#D1FAE5' : '#EDE9FE';
            return (
              <div key={attr.key} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '5px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
                <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: catBg, color: catColor, flexShrink: 0 }}>{attr.category}</span>
                <code style={{ fontSize: 9, color: '#0F1419', flex: 1 }}>{attr.key}</code>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>{attr.value}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Policy decisions */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Журнал решений политик</div>
        <div style={{ display: 'grid', gap: 5 }}>
          {DEMO_POLICIES.map((pol) => {
            const cfg = DECISION_CONFIG[pol.decision];
            const isOpen = selected === pol.id;
            return (
              <div key={pol.id} style={{ borderRadius: 10, border: `1px solid ${isOpen ? '#0A7A5F' : '#E4E6EA'}`, overflow: 'hidden' }}>
                <button onClick={() => setSelected(isOpen ? null : pol.id)} style={{ width: '100%', padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center', background: isOpen ? '#F0FDF4' : '#F8FAFB', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: cfg.color, minWidth: 12 }}>{cfg.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <code style={{ fontSize: 10, fontWeight: 700, color: '#0F1419' }}>{pol.package}.{pol.rule}</code>
                      <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    </div>
                    <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>{pol.subject} → {pol.action} → {pol.resource}</div>
                  </div>
                  <span style={{ fontSize: 9, color: '#94A3B8', flexShrink: 0 }}>{pol.durationMs} мс</span>
                </button>
                {isOpen && (
                  <div style={{ borderTop: '1px solid #E4E6EA', padding: '8px 12px', background: '#fff', display: 'grid', gap: 6 }}>
                    <div style={lbl}>Условия политики</div>
                    {pol.conditions.map((cond, i) => {
                      const isFail = cond.includes('fail:');
                      const isWarn = cond.includes('warn:');
                      return (
                        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 9, fontWeight: 900, color: isFail ? '#DC2626' : isWarn ? '#D97706' : '#0A7A5F', minWidth: 10 }}>{isFail ? '✗' : isWarn ? '!' : '✓'}</span>
                          <code style={{ fontSize: 9, color: isFail ? '#991B1B' : isWarn ? '#92400E' : '#374151', lineHeight: 1.5 }}>{cond}</code>
                        </div>
                      );
                    })}
                    <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 4 }}>
                      Evaluated: {new Date(pol.evaluatedAt).toLocaleString('ru-RU')} · {pol.durationMs} мс
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        OPA v0.63 · Rego policies · ABAC (subject/resource/environment) · gRPC decision API · audit log → Kafka · Bundle server · Демо-данные.
      </div>
    </div>
  );
}
