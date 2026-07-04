import {
  DECISION_PILOT_STATE_LABEL,
  DECISION_RECOMMENDATION_DATA,
  type DecisionRecommendationContext,
  type DecisionRecommendationState,
} from '@/lib/platform-v7/decision-recommendation';

// Семантические тона из токенов — theme-aware (светлая/тёмная), без стоячих hex.
function stateTone(state: DecisionRecommendationState) {
  if (state === 'ready_for_decision') return { bg: 'var(--pc-success-bg)', border: 'var(--pc-success)', color: 'var(--pc-success)' };
  if (state === 'requires_manual_review') return { bg: 'var(--pc-warning-bg)', border: 'var(--pc-warning)', color: 'var(--pc-warning)' };
  return { bg: 'var(--pc-danger-bg)', border: 'var(--pc-danger)', color: 'var(--pc-danger)' };
}

export function DecisionRecommendationStrip({ context }: { context: DecisionRecommendationContext }) {
  const data = DECISION_RECOMMENDATION_DATA[context];
  const tone = stateTone(data.pilotState);

  return (
    <section
      data-testid="platform-v7-decision-recommendation-strip"
      style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 16, display: 'grid', gap: 12 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--pc-text-muted, #64748B)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            контур исполнения · рекомендация решения
          </div>
          <div style={{ marginTop: 4, fontSize: 15, fontWeight: 950, color: 'var(--pc-text-primary, #0F1419)', lineHeight: 1.2 }}>
            Следующее рекомендуемое решение
          </div>
        </div>
        <span
          data-testid="platform-v7-decision-recommendation-strip-state"
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
          }}
        >
          {DECISION_PILOT_STATE_LABEL[data.pilotState]}
        </span>
      </div>

      <div
        data-testid="platform-v7-decision-recommendation-strip-recommendation"
        style={{ fontSize: 14, fontWeight: 900, color: 'var(--pc-text-primary)', lineHeight: 1.45, background: 'var(--pc-bg-subtle)', border: '1px solid var(--pc-border)', borderRadius: 12, padding: '10px 12px' }}
      >
        {data.recommendation}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--pc-text-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ответственный
          </span>
          <div
            data-testid="platform-v7-decision-recommendation-strip-responsible"
            style={{ fontSize: 13, color: 'var(--pc-text-primary, #0F1419)', fontWeight: 900, lineHeight: 1.35 }}
          >
            {data.responsible}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--pc-text-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            требуемые доказательства
          </span>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {data.requiredEvidence.map((item) => (
              <span
                key={item}
                style={{ display: 'inline-flex', padding: '3px 7px', borderRadius: 999, background: 'var(--pc-bg-subtle)', border: '1px solid var(--pc-border)', color: 'var(--pc-text-secondary)', fontSize: 11, fontWeight: 850 }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div
        data-testid="platform-v7-decision-recommendation-strip-blocker"
        style={{
          fontSize: 12,
          color: 'var(--pc-danger)',
          lineHeight: 1.45,
          background: 'var(--pc-danger-bg)',
          border: '1px solid var(--pc-danger)',
          borderRadius: 10,
          padding: '8px 10px',
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--pc-danger)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 3 }}>
          причина остановки · решение не продолжается
        </span>
        {data.cannotProceedBecause}
      </div>
    </section>
  );
}
