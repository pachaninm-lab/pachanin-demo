import {
  getDecisionPackRows,
  DECISION_PACK_CONTEXT_LABEL,
  type DecisionPackContext,
  type DecisionPackPilotState,
} from '@/lib/platform-v7/document-money-decision-pack';

function stateTone(state: DecisionPackPilotState) {
  if (state === 'blocked') {
    return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  }
  if (state === 'allowed') {
    return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  }
  if (state === 'manual_review') {
    return { bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#1D4ED8' };
  }
  return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
}

export function DecisionPackMiniPanel({ context }: { context: DecisionPackContext }) {
  const rows = getDecisionPackRows(context);

  return (
    <section
      data-testid="platform-v7-decision-pack-mini-panel"
      style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 12 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={micro}>document / evidence basis · контролируемый пилот</div>
          <div style={{ marginTop: 4, fontSize: 15, fontWeight: 950, color: '#0F1419', lineHeight: 1.2 }}>
            Пакет решений — {DECISION_PACK_CONTEXT_LABEL[context]}
          </div>
        </div>
        <span
          data-testid="platform-v7-decision-pack-disclaimer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '5px 10px',
            borderRadius: 999,
            border: '1px solid rgba(37,99,235,0.18)',
            background: 'rgba(37,99,235,0.06)',
            color: '#1D4ED8',
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          manual review · не является правовым заключением
        </span>
      </div>

      <div
        data-testid="platform-v7-decision-pack-rows"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 8,
        }}
      >
        {rows.map((row) => {
          const tone = stateTone(row.currentPilotState);
          return (
            <div
              key={row.rowId}
              data-testid="platform-v7-decision-pack-row"
              style={{ background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 14, padding: 13, display: 'grid', gap: 8, minWidth: 0 }}
            >
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div
                  data-testid="platform-v7-decision-pack-document"
                  style={{ fontSize: 13, fontWeight: 950, color: '#0F1419', lineHeight: 1.3, minWidth: 0, overflowWrap: 'anywhere', flex: 1 }}
                >
                  {row.requiredDocumentEvidence}
                </div>
                <span
                  data-testid="platform-v7-decision-pack-state-badge"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '3px 9px',
                    borderRadius: 999,
                    border: `1px solid ${tone.border}`,
                    background: tone.bg,
                    color: tone.color,
                    fontSize: 10,
                    fontWeight: 900,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {row.currentPilotState}
                </span>
              </div>

              <div style={{ display: 'grid', gap: 5 }}>
                <div style={micro}>ответственный</div>
                <div
                  data-testid="platform-v7-decision-pack-responsible"
                  style={{ fontSize: 12, color: '#475569', fontWeight: 750, overflowWrap: 'anywhere', minWidth: 0 }}
                >
                  {row.responsibleRole}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 5 }}>
                <div style={micro}>влияние на деньги</div>
                <div
                  data-testid="platform-v7-decision-pack-money-impact"
                  style={{ fontSize: 12, color: '#475569', lineHeight: 1.45, overflowWrap: 'anywhere', minWidth: 0 }}
                >
                  {row.moneyImpactLabel}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 5 }}>
                <div style={micro}>операционное основание</div>
                <div
                  data-testid="platform-v7-decision-pack-legal-reason"
                  style={{ fontSize: 12, color: '#64748B', lineHeight: 1.45, overflowWrap: 'anywhere', minWidth: 0 }}
                >
                  {row.legalOperationalReason}
                </div>
              </div>

              {row.blocker !== null && (
                <div
                  data-testid="platform-v7-decision-pack-blocker"
                  style={{ fontSize: 12, color: '#B91C1C', lineHeight: 1.45, overflowWrap: 'anywhere', minWidth: 0, borderTop: '1px solid rgba(220,38,38,0.12)', paddingTop: 7 }}
                >
                  {row.blocker}
                </div>
              )}

              <div style={{ borderTop: '1px solid #E4E6EA', paddingTop: 7, display: 'grid', gap: 4 }}>
                <div style={micro}>безопасный следующий шаг</div>
                <div
                  data-testid="platform-v7-decision-pack-safe-next"
                  style={{ fontSize: 12, color: '#0F1419', lineHeight: 1.45, fontWeight: 750, overflowWrap: 'anywhere', minWidth: 0 }}
                >
                  {row.safeNextAction}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        data-testid="platform-v7-decision-pack-pilot-note"
        style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.4 }}
      >
        контролируемый пилот · предпросмотр пакета решений · требует ручной проверки · не является правовым заключением · требует банковской / интеграционной проверки перед исполнением
      </div>
    </section>
  );
}

const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
