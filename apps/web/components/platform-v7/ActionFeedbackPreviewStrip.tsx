import {
  ACTION_FEEDBACK_PREVIEWS,
  IDEMPOTENCY_DESCRIPTIONS,
  type ActionFeedbackContext,
  type ActionIdempotency,
} from '../../lib/platform-v7/action-feedback-preview';

const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.07em' } as const;

const IDEMPOTENCY_COLORS: Record<ActionIdempotency, string> = {
  safe_to_retry: '#0A7A5F',
  requires_confirmation: '#B45309',
  one_shot: '#B91C1C',
};

function PreviewField({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div
      data-testid={testId}
      style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 10, display: 'grid', gap: 5, minWidth: 0 }}
    >
      <div style={micro}>{label}</div>
      <div style={{ color: '#0F1419', fontSize: 13, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  );
}

export function ActionFeedbackPreviewStrip({ context }: { context: ActionFeedbackContext }) {
  const preview = ACTION_FEEDBACK_PREVIEWS[context];
  const idempotencyColor = IDEMPOTENCY_COLORS[preview.idempotency];

  return (
    <div
      data-testid='platform-v7-action-feedback-preview-strip'
      style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12, minWidth: 0 }}
    >
      <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
        <div style={micro}>предпросмотр действия · контур исполнения</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ color: '#0F1419', fontSize: 17, fontWeight: 950, lineHeight: 1.1, overflowWrap: 'anywhere' }}>
            {preview.actionLabel}
          </span>
          <span
            data-testid='platform-v7-action-feedback-idempotency-badge'
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 9px',
              borderRadius: 999,
              background: `${idempotencyColor}12`,
              border: `1px solid ${idempotencyColor}28`,
              color: idempotencyColor,
              fontSize: 11,
              fontWeight: 900,
              whiteSpace: 'normal',
            }}
          >
            {IDEMPOTENCY_DESCRIPTIONS[preview.idempotency]}
          </span>
        </div>
      </div>

      <PreviewField
        label='что произойдёт после действия'
        value={preview.whatHappensNext}
        testId='platform-v7-action-feedback-what-next'
      />

      <PreviewField
        label='черновик аудиторской записи'
        value={preview.auditDraft}
        testId='platform-v7-action-feedback-audit-draft'
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8, minWidth: 0 }}>
        <div
          data-testid='platform-v7-action-feedback-responsible'
          style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 10, display: 'grid', gap: 5, minWidth: 0 }}
        >
          <div style={micro}>ответственный</div>
          <div style={{ color: '#0F1419', fontSize: 13, fontWeight: 900, overflowWrap: 'anywhere' }}>{preview.responsibleRole}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 10, display: 'grid', gap: 5, minWidth: 0 }}>
          <div style={micro}>техническая сверка</div>
          <div style={{ color: idempotencyColor, fontSize: 13, fontWeight: 900, overflowWrap: 'anywhere' }}>{preview.idempotencyLabel}</div>
        </div>
      </div>

      <div
        data-testid='platform-v7-action-feedback-external-boundary'
        style={{
          background: 'rgba(37,99,235,0.04)',
          border: '1px solid rgba(37,99,235,0.12)',
          borderRadius: 12,
          padding: 10,
          display: 'grid',
          gap: 5,
          minWidth: 0,
        }}
      >
        <div style={micro}>граница внешнего подтверждения</div>
        <div style={{ color: '#334155', fontSize: 13, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{preview.externalConfirmationBoundary}</div>
      </div>

      <div
        data-testid='platform-v7-action-feedback-pilot-note'
        style={{
          background: 'rgba(100,116,139,0.06)',
          border: '1px solid rgba(100,116,139,0.14)',
          borderRadius: 10,
          padding: '8px 12px',
          color: '#64748B',
          fontSize: 12,
          lineHeight: 1.45,
          overflowWrap: 'anywhere',
        }}
      >
        {preview.pilotNote}
      </div>
    </div>
  );
}
