import {
  EVIDENCE_READINESS_CONTEXT_LABEL,
  EVIDENCE_READINESS_ROWS,
  EVIDENCE_READINESS_STATE_LABEL,
  getContextBlockerCount,
  type EvidenceReadinessContext,
  type EvidenceReadinessState,
} from '@/lib/platform-v7/evidence-readiness-matrix';

function stateTone(state: EvidenceReadinessState) {
  if (state === 'ready') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (state === 'blocked') return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  if (state === 'partial') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  return { bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#1D4ED8' };
}

export function EvidenceReadinessMiniMatrix({ context }: { context: EvidenceReadinessContext }) {
  const rows = EVIDENCE_READINESS_ROWS[context];
  const blockerCount = getContextBlockerCount(context);

  return (
    <section
      data-testid="platform-v7-evidence-readiness-mini-matrix"
      style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 12 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            пилотный контур · доказательства
          </div>
          <div style={{ marginTop: 4, fontSize: 15, fontWeight: 950, color: '#0F1419', lineHeight: 1.2 }}>
            Готовность доказательств — {EVIDENCE_READINESS_CONTEXT_LABEL[context]}
          </div>
        </div>
        <span
          data-testid="platform-v7-evidence-readiness-mini-matrix-summary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '5px 10px',
            borderRadius: 999,
            border: blockerCount ? '1px solid rgba(217,119,6,0.18)' : '1px solid rgba(10,122,95,0.18)',
            background: blockerCount ? 'rgba(217,119,6,0.08)' : 'rgba(10,122,95,0.08)',
            color: blockerCount ? '#B45309' : '#0A7A5F',
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          {blockerCount ? `${blockerCount} не готово · пилотный контур` : 'Пакет закрыт'}
        </span>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {rows.map((row) => {
          const tone = stateTone(row.pilotState);
          return (
            <div
              key={row.item}
              data-testid="platform-v7-evidence-readiness-mini-matrix-row"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))',
                gap: 8,
                alignItems: 'start',
                background: '#F8FAFB',
                border: '1px solid #EEF1F4',
                borderRadius: 10,
                padding: '8px 10px',
                minWidth: 0,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 900, color: '#0F1419', minWidth: 0, overflowWrap: 'anywhere' }}>
                {row.item}
              </div>
              <span
                style={{
                  whiteSpace: 'normal',
                  width: 'fit-content',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: tone.bg,
                  border: `1px solid ${tone.border}`,
                  color: tone.color,
                  fontSize: 11,
                  fontWeight: 900,
                  lineHeight: 1.2,
                }}
              >
                {EVIDENCE_READINESS_STATE_LABEL[row.pilotState]}
              </span>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.35, minWidth: 0, overflowWrap: 'anywhere' }}>
                <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                  ответственный
                </span>
                {row.responsible}
              </div>
              <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.35, fontWeight: 750, minWidth: 0, overflowWrap: 'anywhere' }}>
                <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                  следующий шаг
                </span>
                {row.nextStep}
              </div>
              {row.stopReason ? (
                <div
                  data-testid="platform-v7-evidence-readiness-mini-matrix-stop-reason"
                  style={{
                    fontSize: 11,
                    color: '#B91C1C',
                    lineHeight: 1.35,
                    minWidth: 0,
                    overflowWrap: 'anywhere',
                    gridColumn: '1 / -1',
                    background: 'rgba(220,38,38,0.05)',
                    border: '1px solid rgba(220,38,38,0.14)',
                    borderRadius: 8,
                    padding: '5px 8px',
                  }}
                >
                  <span style={{ fontSize: 10, color: '#B91C1C', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                    причина остановки
                  </span>
                  {row.stopReason}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
