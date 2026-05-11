export type P7ActionStateChipStatus = 'active' | 'waiting' | 'blocked' | 'manual';

export interface P7ActionStateChipProps {
  status: P7ActionStateChipStatus;
  label: string;
  nextActor?: string;
  blocker?: string;
  moneyEffect?: string;
}

const STATUS_STYLE: Record<P7ActionStateChipStatus, { bg: string; border: string; color: string }> = {
  active:  { bg: 'rgba(10,122,95,0.08)',  border: 'rgba(10,122,95,0.18)',  color: '#0A7A5F' },
  waiting: { bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.18)',  color: '#B45309' },
  blocked: { bg: 'rgba(220,38,38,0.07)',  border: 'rgba(220,38,38,0.18)',  color: '#B91C1C' },
  manual:  { bg: 'rgba(15,23,42,0.06)',   border: 'rgba(15,23,42,0.18)',   color: '#475569' },
};

export function P7ActionStateChip({ status, label, nextActor, blocker, moneyEffect }: P7ActionStateChipProps) {
  const s = STATUS_STYLE[status];
  return (
    <div
      data-testid='p7-action-state-chip'
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        gap: 6,
        alignItems: 'center',
        padding: '6px 10px',
        borderRadius: 12,
        background: s.bg,
        border: `1px solid ${s.border}`,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: s.color, fontSize: 12, fontWeight: 900 }}>
        <span
          aria-hidden='true'
          data-testid='p7-action-state-dot'
          style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }}
        />
        {label}
      </span>
      {nextActor && (
        <span data-testid='p7-action-state-next' style={{ color: '#475569', fontSize: 11, fontWeight: 700 }}>
          → {nextActor}
        </span>
      )}
      {blocker && (
        <span
          data-testid='p7-action-state-blocker'
          style={{
            color: '#B45309',
            fontSize: 11,
            fontWeight: 700,
            background: 'rgba(217,119,6,0.08)',
            border: '1px solid rgba(217,119,6,0.18)',
            borderRadius: 999,
            padding: '2px 7px',
          }}
        >
          {blocker}
        </span>
      )}
      {moneyEffect && (
        <span
          data-testid='p7-action-state-money'
          style={{
            color: '#155EEF',
            fontSize: 11,
            fontWeight: 700,
            background: 'rgba(21,94,239,0.07)',
            border: '1px solid rgba(21,94,239,0.16)',
            borderRadius: 999,
            padding: '2px 7px',
          }}
        >
          {moneyEffect}
        </span>
      )}
    </div>
  );
}
