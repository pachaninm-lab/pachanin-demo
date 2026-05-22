import type { ReactNode } from 'react';

export interface LiveBlocker {
  id: string;
  label: string;
  severity: 'stop' | 'warn' | 'info';
  responsibleRole?: string;
  nextAction?: string;
}

export interface LiveApiStatusBarProps {
  apiOnline: boolean;
  blockers?: LiveBlocker[];
  pendingBankOps?: number;
  openDisputes?: number;
  activeShipments?: number;
  summary?: string;
  role?: string;
  dealId?: string;
}

function SeverityDot({ severity }: { severity: LiveBlocker['severity'] }) {
  const colors = {
    stop: '#DC2626',
    warn: '#D97706',
    info: '#2563EB',
  };
  return (
    <span
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: colors[severity],
        marginRight: 6,
        flexShrink: 0,
      }}
    />
  );
}

function Chip({ children, color, bg }: { children: ReactNode; color: string; bg: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 9px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.02em',
        color,
        background: bg,
        border: `1px solid ${color}22`,
      }}
    >
      {children}
    </span>
  );
}

export function LiveApiStatusBar({
  apiOnline,
  blockers = [],
  pendingBankOps = 0,
  openDisputes = 0,
  activeShipments = 0,
  summary,
  role,
}: LiveApiStatusBarProps) {
  const stopCount = blockers.filter((b) => b.severity === 'stop').length;
  const warnCount = blockers.filter((b) => b.severity === 'warn').length;

  return (
    <div
      style={{
        background: apiOnline ? '#F0FDF4' : '#FFF7ED',
        border: `1px solid ${apiOnline ? '#BBF7D0' : '#FED7AA'}`,
        borderRadius: 12,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontSize: 12,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: apiOnline ? '#16A34A' : '#EA580C',
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 800, color: apiOnline ? '#15803D' : '#C2410C', fontSize: 11 }}>
          {apiOnline ? 'API онлайн · данные актуальны' : 'API недоступен · показаны демо-данные'}
        </span>
        {role && (
          <span style={{ color: '#64748B', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {role}
          </span>
        )}

        {/* Metrics chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
          {pendingBankOps > 0 && (
            <Chip color="#B45309" bg="#FEF3C7">
              ⏳ {pendingBankOps} банк
            </Chip>
          )}
          {openDisputes > 0 && (
            <Chip color="#B91C1C" bg="#FEE2E2">
              ⚡ {openDisputes} {openDisputes === 1 ? 'спор' : 'спора'}
            </Chip>
          )}
          {activeShipments > 0 && (
            <Chip color="#1D4ED8" bg="#DBEAFE">
              🚚 {activeShipments} рейс{activeShipments > 1 ? 'а' : ''}
            </Chip>
          )}
          {stopCount > 0 && (
            <Chip color="#DC2626" bg="#FEE2E2">
              🛑 {stopCount} блокер
            </Chip>
          )}
          {warnCount > 0 && (
            <Chip color="#D97706" bg="#FEF3C7">
              ⚠️ {warnCount} предупреждение
            </Chip>
          )}
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <p style={{ margin: 0, color: '#475569', fontSize: 11, lineHeight: 1.4 }}>
          {summary}
        </p>
      )}

      {/* Blockers list */}
      {blockers.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {blockers.map((blocker) => (
            <div key={blocker.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
              <SeverityDot severity={blocker.severity} />
              <div style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 700, color: '#1E293B', fontSize: 11 }}>{blocker.label}</span>
                {blocker.nextAction && (
                  <span style={{ color: '#64748B', fontSize: 11, marginLeft: 6 }}>
                    → {blocker.nextAction}
                  </span>
                )}
                {blocker.responsibleRole && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: '#94A3B8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginLeft: 6,
                    }}
                  >
                    [{blocker.responsibleRole}]
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
