import {
  DECISION_PACK_CONTEXT_LABEL,
  getDecisionPackRows,
  type DecisionPackContext,
  type DecisionPackPilotState,
} from '../../lib/platform-v7/document-money-decision-pack';

function stateTone(state: DecisionPackPilotState) {
  if (state === 'blocked') return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  if (state === 'allowed') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (state === 'manual_review') return { bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#1D4ED8' };
  return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
}

export function DecisionPackMiniPanel({ context }: { context: DecisionPackContext }) {
  const rows = getDecisionPackRows(context);

  return (
    <section
      data-testid='platform-v7-decision-pack-mini-panel'
      style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 12, minWidth: 0 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }}>
        <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <div style={micro}>документы · деньги · основание</div>
          <div style={{ color: '#0F1419', fontSize: 15, fontWeight: 950, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
            Пакет решения — {DECISION_PACK_CONTEXT_LABEL[context]}
          </div>
        </div>
        <span
          data-testid='platform-v7-decision-pack-disclaimer'
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
            whiteSpace: 'normal',
          }}
        >
          ручная проверка · не правовое заключение
        </span>
      </div>

      <div
        data-testid='platform-v7-decision-pack-rows'
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8, minWidth: 0 }}
      >
        {rows.map((row) => {
          const tone = stateTone(row.currentPilotState);
          return (
            <article
              key={row.rowId}
              data-testid='platform-v7-decision-pack-row'
              style={{ background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 14, padding: 13, display: 'grid', gap: 8, minWidth: 0 }}
            >
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap', minWidth: 0 }}>
                <div
                  data-testid='platform-v7-decision-pack-document'
                  style={{ color: '#0F1419', fontSize: 13, fontWeight: 950, lineHeight: 1.3, minWidth: 0, overflowWrap: 'anywhere', flex: 1 }}
                >
                  {row.requiredDocumentEvidence}
                </div>
                <span
                  data-testid='platform-v7-decision-pack-state'
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
                    whiteSpace: 'normal',
                  }}
                >
                  {row.currentPilotStateLabel}
                </span>
              </div>

              <Field label='ответственный' value={row.responsibleRole} testId='platform-v7-decision-pack-responsible' />
              <Field label='деньги' value={row.moneyImpactLabel} testId='platform-v7-decision-pack-money' />
              <Field label='операционное основание' value={row.operationalReason} testId='platform-v7-decision-pack-reason' />

              {row.blocker ? (
                <div
                  data-testid='platform-v7-decision-pack-blocker'
                  style={{ color: '#B91C1C', fontSize: 12, lineHeight: 1.45, overflowWrap: 'anywhere', minWidth: 0, borderTop: '1px solid rgba(220,38,38,0.12)', paddingTop: 7 }}
                >
                  {row.blocker}
                </div>
              ) : null}

              <Field label='безопасный следующий шаг' value={row.safeNextAction} testId='platform-v7-decision-pack-next' strong />
            </article>
          );
        })}
      </div>

      <div data-testid='platform-v7-decision-pack-note' style={{ color: '#94A3B8', fontSize: 11, lineHeight: 1.4, overflowWrap: 'anywhere' }}>
        контур исполнения · ручная проверка · требует внешнего подтверждения перед исполнением
      </div>
    </section>
  );
}

function Field({ label, value, testId, strong = false }: { label: string; value: string; testId: string; strong?: boolean }) {
  return (
    <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
      <div style={micro}>{label}</div>
      <div data-testid={testId} style={{ color: strong ? '#0F1419' : '#475569', fontSize: 12, lineHeight: 1.45, fontWeight: strong ? 800 : 700, overflowWrap: 'anywhere', minWidth: 0 }}>
        {value}
      </div>
    </div>
  );
}

const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.07em' } as const;
