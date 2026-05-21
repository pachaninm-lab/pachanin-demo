import {
  DECISION_PILOT_STATE_LABEL,
  DECISION_RECOMMENDATION_DATA,
  type DecisionRecommendationContext,
  type DecisionRecommendationState,
} from '@/lib/platform-v7/decision-recommendation';

function stateTone(state: DecisionRecommendationState) {
  if (state === 'ready_for_decision') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (state === 'requires_manual_review') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
}

export function DecisionRecommendationStrip({ context }: { context: DecisionRecommendationContext }) {
  const data = DECISION_RECOMMENDATION_DATA[context];
  const tone = stateTone(data.pilotState);

  return (
    <section
      data-testid="platform-v7-decision-recommendation-strip"
      style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 12 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            пилотный контур · рекомендация решения
          </div>
          <div style={{ marginTop: 4, fontSize: 15, fontWeight: 950, color: '#0F1419', lineHeight: 1.2 }}>
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
        style={{ fontSize: 14, fontWeight: 900, color: '#0F1419', lineHeight: 1.45, background: '#F8FAFB', border: '1px solid #EEF1F4', borderRadius: 12, padding: '10px 12px' }}
      >
        {data.recommendation}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ответственный
          </span>
          <div
            data-testid="platform-v7-decision-recommendation-strip-responsible"
            style={{ fontSize: 13, color: '#0F1419', fontWeight: 900, lineHeight: 1.35 }}
          >
            {data.responsible}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            требуемые доказательства
          </span>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {data.requiredEvidence.map((item) => (
              <span
                key={item}
                style={{ display: 'inline-flex', padding: '3px 7px', borderRadius: 999, background: '#fff', border: '1px solid #E4E6EA', color: '#475569', fontSize: 11, fontWeight: 850 }}
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
          color: '#B91C1C',
          lineHeight: 1.45,
          background: 'rgba(220,38,38,0.05)',
          border: '1px solid rgba(220,38,38,0.14)',
          borderRadius: 10,
          padding: '8px 10px',
        }}
      >
        <span style={{ fontSize: 10, color: '#B91C1C', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 3 }}>
          причина остановки · решение не продолжается
        </span>
        {data.cannotProceedBecause}
      </div>
    </section>
  );
}
