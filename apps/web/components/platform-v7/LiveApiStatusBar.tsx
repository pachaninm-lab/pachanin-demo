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
  /** Предпочтительный честный проп; legacy `blockers` оставлен как fallback. */
  liveStops?: LiveBlocker[];
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
        minWidth: 0,
        maxWidth: '100%',
        padding: '3px 9px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.02em',
        lineHeight: 1.15,
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
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
  liveStops,
  blockers,
  pendingBankOps = 0,
  openDisputes = 0,
  activeShipments = 0,
  summary,
  role,
}: LiveApiStatusBarProps) {
  const stops = liveStops ?? blockers ?? [];
  const stopCount = stops.filter((b) => b.severity === 'stop').length;
  const warnCount = stops.filter((b) => b.severity === 'warn').length;

  return (
    <div
      className='p7-live-api-status'
      style={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        overflow: 'hidden',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: apiOnline ? '#16A34A' : '#EA580C',
            flexShrink: 0,
          }}
        />
        <span style={{ minWidth: 0, fontWeight: 800, color: apiOnline ? '#15803D' : '#C2410C', fontSize: 11, overflowWrap: 'anywhere' }}>
          {apiOnline ? 'API-контур доступен · данные текущего сценария' : 'API-контур недоступен · показан локальный сценарий'}
        </span>
        {role && (
          <span style={{ minWidth: 0, color: 'var(--pc-text-muted, #64748B)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', overflowWrap: 'anywhere' }}>
            {role}
          </span>
        )}

        {/* Metrics chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto', minWidth: 0, maxWidth: '100%' }}>
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
            <Chip color="#B91C1C" bg="#FEE2E2">
              🛑 {stopCount} блокер
            </Chip>
          )}
          {warnCount > 0 && (
            <Chip color="#92400E" bg="#FEF3C7">
              ⚠️ {warnCount} предупреждение
            </Chip>
          )}
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <p style={{ margin: 0, color: 'var(--pc-text-secondary, #475569)', fontSize: 11, lineHeight: 1.4, minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' }}>
          {summary}
        </p>
      )}

      {/* Stops list */}
      {stops.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, maxWidth: '100%' }}>
          {stops.map((blocker, index) => (
            <div key={`${blocker.id}-${index}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 0, minWidth: 0, maxWidth: '100%' }}>
              <SeverityDot severity={blocker.severity} />
              <div style={{ minWidth: 0, maxWidth: '100%' }}>
                <span style={{ fontWeight: 700, color: '#1E293B', fontSize: 11, overflowWrap: 'anywhere' }}>{blocker.label}</span>
                {blocker.nextAction && (
                  <span style={{ color: 'var(--pc-text-muted, #64748B)', fontSize: 11, marginLeft: 6, overflowWrap: 'anywhere' }}>
                    → {blocker.nextAction}
                  </span>
                )}
                {blocker.responsibleRole && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: '#566070',
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
