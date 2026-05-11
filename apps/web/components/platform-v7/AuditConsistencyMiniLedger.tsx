import {
  AUDIT_LEDGER_DATA,
  BOUNDARY_STATUS_ICONS,
  type AuditLedgerContext,
  type AuditBoundaryStatus,
  type AuditMoneyImpact,
} from '../../lib/platform-v7/audit-consistency-ledger';

const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.07em' } as const;

const MONEY_IMPACT_COLORS: Record<AuditMoneyImpact, string> = {
  none: '#64748B',
  blocks_release: '#B91C1C',
  affects_hold: '#B45309',
  informs_reserve: '#0A7A5F',
};

const BOUNDARY_COLORS: Record<AuditBoundaryStatus, string> = {
  internal: '#0A7A5F',
  pending_external: '#B45309',
  requires_bank_event: '#2563EB',
};

export function AuditConsistencyMiniLedger({ context }: { context: AuditLedgerContext }) {
  const ledger = AUDIT_LEDGER_DATA[context];

  return (
    <div
      data-testid='platform-v7-audit-consistency-mini-ledger'
      style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 }}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={micro}>{ledger.title}</div>
        <div
          data-testid='platform-v7-audit-ledger-disclaimer'
          style={{
            display: 'inline-flex',
            width: 'fit-content',
            padding: '5px 10px',
            borderRadius: 999,
            background: 'rgba(100,116,139,0.07)',
            border: '1px solid rgba(100,116,139,0.15)',
            color: '#64748B',
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          {ledger.pilotDisclaimer}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {ledger.entries.map((entry) => {
          const moneyColor = MONEY_IMPACT_COLORS[entry.moneyImpact];
          const boundaryColor = BOUNDARY_COLORS[entry.boundaryStatus];

          return (
            <div
              key={entry.id}
              data-testid='platform-v7-audit-ledger-entry'
              style={{
                background: '#F8FAFB',
                border: `1px solid ${entry.moneyImpact === 'blocks_release' ? 'rgba(185,28,28,0.15)' : '#E4E6EA'}`,
                borderRadius: 14,
                padding: 12,
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: moneyColor, fontSize: 12, fontWeight: 950 }}>
                  {entry.eventLabel}
                </span>
                <span style={{ color: '#64748B', fontSize: 11 }}>·</span>
                <span
                  data-testid='platform-v7-audit-ledger-actor'
                  style={{ color: '#475569', fontSize: 11, fontWeight: 900 }}
                >
                  {entry.actorRole}
                </span>
                <span style={{ marginLeft: 'auto', color: '#94A3B8', fontSize: 11, fontWeight: 900 }}>
                  {entry.id}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 6 }}>
                <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 10, padding: 8, display: 'grid', gap: 3 }}>
                  <div style={micro}>объект</div>
                  <div style={{ color: '#0F1419', fontSize: 12, fontWeight: 900 }}>{entry.entity}</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 10, padding: 8, display: 'grid', gap: 3 }}>
                  <div style={micro}>ссылка на доказательство</div>
                  <div style={{ color: '#475569', fontSize: 12 }}>{entry.evidenceRef}</div>
                </div>
              </div>

              <div
                data-testid='platform-v7-audit-ledger-money-impact'
                style={{
                  background: '#fff',
                  border: `1px solid ${moneyColor}20`,
                  borderRadius: 10,
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ color: moneyColor, fontSize: 13, fontWeight: 950, lineHeight: 1 }}>₽</span>
                <span style={{ color: moneyColor, fontSize: 12, fontWeight: 900 }}>{entry.moneyImpactLabel}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span
                  data-testid='platform-v7-audit-ledger-boundary'
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: `${boundaryColor}10`,
                    border: `1px solid ${boundaryColor}25`,
                    color: boundaryColor,
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  <span>{BOUNDARY_STATUS_ICONS[entry.boundaryStatus]}</span>
                  <span>{entry.boundaryStatusLabel}</span>
                </span>
              </div>

              <div
                data-testid='platform-v7-audit-ledger-preview-note'
                style={{ color: '#94A3B8', fontSize: 11, lineHeight: 1.45, fontStyle: 'italic' }}
              >
                {entry.auditPreviewNote}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
