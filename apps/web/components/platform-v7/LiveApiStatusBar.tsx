import type { ReactNode } from 'react';
import { countRu } from '@/lib/format/plural';

// Единый набор SVG-иконок для статус-чипов: эмодзи (🚚 ⚠️ ⏳) рендерятся
// по-разному на iOS/Android/Windows и выглядят чужеродно в B2B-интерфейсе.
function ChipIcon({ kind }: { kind: 'clock' | 'dispute' | 'truck' | 'stop' | 'warn' }) {
  const common = { width: 11, height: 11, viewBox: '0 0 12 12', 'aria-hidden': true as const, style: { flexShrink: 0 } };
  switch (kind) {
    case 'clock':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <circle cx="6" cy="6" r="4.7" />
          <path d="M6 3.4V6l1.8 1" />
        </svg>
      );
    case 'dispute':
      return (
        <svg {...common} fill="currentColor">
          <path d="M6.8 1 2.8 6.6h2.1L5 11l4-5.6H6.7z" />
        </svg>
      );
    case 'truck':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
          <path d="M1 3.2h5.6v4.6H1z M6.6 5h2.2L10.8 7v.8H6.6z" />
          <circle cx="3.2" cy="9.4" r="1" />
          <circle cx="8.8" cy="9.4" r="1" />
        </svg>
      );
    case 'stop':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
          <path d="M4 1.5h4L10.5 4v4L8 10.5H4L1.5 8V4z" />
          <path d="M3.8 6h4.4" strokeLinecap="round" />
        </svg>
      );
    case 'warn':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
          <path d="M6 1.6 11 10H1z" />
          <path d="M6 4.6v2.6" />
          <circle cx="6" cy="8.7" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

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
          {apiOnline ? 'Данные с сервера · обновляются' : 'Демонстрационные данные — сервер недоступен'}
        </span>
        {role && (
          <span style={{ color: 'var(--pc-text-muted, #64748B)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {role}
          </span>
        )}

        {/* Metrics chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
          {pendingBankOps > 0 && (
            <Chip color="#B45309" bg="#FEF3C7">
              <ChipIcon kind="clock" /> {countRu(pendingBankOps, 'банк-операция', 'банк-операции', 'банк-операций')}
            </Chip>
          )}
          {openDisputes > 0 && (
            <Chip color="#B91C1C" bg="#FEE2E2">
              <ChipIcon kind="dispute" /> {countRu(openDisputes, 'спор', 'спора', 'споров')}
            </Chip>
          )}
          {activeShipments > 0 && (
            <Chip color="#1D4ED8" bg="#DBEAFE">
              <ChipIcon kind="truck" /> {countRu(activeShipments, 'рейс', 'рейса', 'рейсов')}
            </Chip>
          )}
          {stopCount > 0 && (
            <Chip color="#B91C1C" bg="#FEE2E2">
              <ChipIcon kind="stop" /> {countRu(stopCount, 'блокер', 'блокера', 'блокеров')}
            </Chip>
          )}
          {warnCount > 0 && (
            <Chip color="#92400E" bg="#FEF3C7">
              <ChipIcon kind="warn" /> {countRu(warnCount, 'предупреждение', 'предупреждения', 'предупреждений')}
            </Chip>
          )}
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <p style={{ margin: 0, color: 'var(--pc-text-secondary, #475569)', fontSize: 11, lineHeight: 1.4 }}>
          {summary}
        </p>
      )}

      {/* Stops list */}
      {stops.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {stops.map((blocker) => (
            <div key={blocker.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
              <SeverityDot severity={blocker.severity} />
              <div style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 700, color: '#1E293B', fontSize: 11 }}>{blocker.label}</span>
                {blocker.nextAction && (
                  <span style={{ color: 'var(--pc-text-muted, #64748B)', fontSize: 11, marginLeft: 6 }}>
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
