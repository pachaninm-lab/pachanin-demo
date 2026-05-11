import {
  getPolicyByContext,
  type IdempotencyAuditContext,
  type IdempotencyClass,
} from '@/lib/platform-v7/idempotency-audit-policy';

function idempotencyTone(cls: IdempotencyClass) {
  if (cls === 'safe_to_retry') {
    return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  }
  if (cls === 'one_shot') {
    return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  }
  return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
}

export function IdempotencyAuditPolicyStrip({ context }: { context: IdempotencyAuditContext }) {
  const policy = getPolicyByContext(context);
  if (!policy) return null;

  const tone = idempotencyTone(policy.idempotencyClass);

  return (
    <section
      data-testid="platform-v7-idempotency-audit-policy-strip"
      style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 12 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={micro}>аудит-предпросмотр · контролируемый пилот</div>
          <div style={{ marginTop: 4, fontSize: 15, fontWeight: 950, color: '#0F1419', lineHeight: 1.2 }}>
            {policy.actionLabel}
          </div>
          <div
            data-testid="platform-v7-idempotency-audit-action-id"
            style={{ marginTop: 3, fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}
          >
            {policy.actionId}
          </div>
        </div>
        <span
          data-testid="platform-v7-idempotency-audit-idempotency-badge"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '5px 10px',
            borderRadius: 999,
            border: `1px solid ${tone.border}`,
            background: tone.bg,
            color: tone.color,
            fontSize: 11,
            fontWeight: 900,
            whiteSpace: 'nowrap',
          }}
        >
          {policy.idempotencyClass.replace(/_/g, ' ')}
        </span>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <Row
          label="идемпотентность"
          testId="platform-v7-idempotency-audit-expectation"
          value={policy.idempotencyExpectation}
        />
        <Row
          label="правило повтора"
          testId="platform-v7-idempotency-audit-retry-rule"
          value={policy.retryRule}
        />
        <Row
          label="черновик аудита"
          testId="platform-v7-idempotency-audit-audit-draft"
          value={policy.auditDraftLabel}
          highlight
        />
        <Row
          label="внешняя граница подтверждения"
          testId="platform-v7-idempotency-audit-external-boundary"
          value={policy.externalConfirmationBoundary}
        />
      </div>

      <div
        data-testid="platform-v7-idempotency-audit-pilot-note"
        style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.4, borderTop: '1px solid #E4E6EA', paddingTop: 8 }}
      >
        {policy.pilotNote}
      </div>
    </section>
  );
}

function Row({
  label,
  testId,
  value,
  highlight = false,
}: {
  label: string;
  testId: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div style={{ background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 12, padding: '10px 12px', display: 'grid', gap: 4 }}>
      <div style={micro}>{label}</div>
      <div
        data-testid={testId}
        style={{ fontSize: 13, color: highlight ? '#0A7A5F' : '#0F1419', fontWeight: highlight ? 900 : 750, lineHeight: 1.45 }}
      >
        {value}
      </div>
    </div>
  );
}

const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
