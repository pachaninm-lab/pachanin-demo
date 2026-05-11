import {
  getGuardRows,
  ACTION_GUARD_CONTEXT_LABEL,
  type ActionGuardContext,
  type GuardResult,
} from '@/lib/platform-v7/action-guard-preview';

function resultTone(result: GuardResult) {
  if (result === 'allowed') {
    return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  }
  if (result === 'blocked') {
    return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  }
  return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
}

export function ActionGuardPreviewMatrix({ context }: { context: ActionGuardContext }) {
  const rows = getGuardRows(context);

  return (
    <section
      data-testid="platform-v7-action-guard-preview-matrix"
      style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 12 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={micro}>guard-предпросмотр · контролируемый пилот</div>
          <div style={{ marginTop: 4, fontSize: 15, fontWeight: 950, color: '#0F1419', lineHeight: 1.2 }}>
            Предпросмотр охранников действий — {ACTION_GUARD_CONTEXT_LABEL[context]}
          </div>
        </div>
        <span
          data-testid="platform-v7-action-guard-preview-disclaimer"
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
          preview-only · ручная проверка
        </span>
      </div>

      <div
        data-testid="platform-v7-action-guard-preview-disclaimer-note"
        style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5, padding: '8px 12px', background: '#F8FAFB', borderRadius: 10, border: '1px solid #E4E6EA' }}
      >
        Этот блок — предпросмотр охранников действий. Реальные мутации не выполняются. Каждое действие требует
        backend / внешней интеграции перед исполнением.
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((row) => {
          const tone = resultTone(row.guardResult);
          return (
            <div
              key={row.actionId}
              data-testid="platform-v7-action-guard-preview-row"
              style={{ background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}
            >
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div
                    data-testid="platform-v7-action-guard-preview-action-label"
                    style={{ fontSize: 14, fontWeight: 950, color: '#0F1419', lineHeight: 1.25 }}
                  >
                    {row.actionLabel}
                  </div>
                  <div
                    data-testid="platform-v7-action-guard-preview-actor"
                    style={{ marginTop: 2, fontSize: 12, color: '#64748B', fontWeight: 750 }}
                  >
                    {row.actorRole}
                  </div>
                </div>
                <span
                  data-testid="platform-v7-action-guard-preview-result-badge"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 10px',
                    borderRadius: 999,
                    border: `1px solid ${tone.border}`,
                    background: tone.bg,
                    color: tone.color,
                    fontSize: 11,
                    fontWeight: 900,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.guardResultLabel}
                </span>
              </div>

              {row.guardResult !== 'allowed' && (
                <div
                  data-testid="platform-v7-action-guard-preview-stop-reason"
                  style={{ fontSize: 13, color: '#B45309', fontWeight: 750, lineHeight: 1.45 }}
                >
                  {row.stopReason}
                </div>
              )}

              <div>
                <div style={micro}>обязательные доказательства</div>
                <div
                  data-testid="platform-v7-action-guard-preview-evidence"
                  style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 5 }}
                >
                  {row.requiredEvidence.map((ev) => {
                    const missing = row.missingEvidence.includes(ev);
                    return (
                      <span
                        key={ev}
                        style={{
                          fontSize: 11,
                          fontWeight: 900,
                          padding: '3px 8px',
                          borderRadius: 999,
                          border: missing ? '1px solid rgba(220,38,38,0.2)' : '1px solid rgba(10,122,95,0.2)',
                          background: missing ? 'rgba(220,38,38,0.06)' : 'rgba(10,122,95,0.06)',
                          color: missing ? '#B91C1C' : '#0A7A5F',
                        }}
                      >
                        {ev}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div
                data-testid="platform-v7-action-guard-preview-safe-fallback"
                style={{ fontSize: 12, color: '#475569', lineHeight: 1.45, borderTop: '1px solid #E4E6EA', paddingTop: 8 }}
              >
                <span style={{ fontWeight: 900, color: '#64748B' }}>безопасный откат: </span>
                {row.safeFallback}
              </div>

              <div
                data-testid="platform-v7-action-guard-preview-pilot-note"
                style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.4 }}
              >
                {row.pilotNote}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
