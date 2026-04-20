interface SberKorusBadgeProps {
  subtitle?: string;
  compact?: boolean;
}

export function SberKorusBadge({ subtitle = 'Перевозочные документы', compact = false }: SberKorusBadgeProps) {
  return (
    <div
      title="СберКорус"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 8 : 10,
        padding: compact ? '6px 10px' : '10px 12px',
        borderRadius: compact ? 999 : 14,
        background: '#fff',
        border: '1px solid rgba(33,160,56,0.18)',
        maxWidth: '100%',
      }}
    >
      <svg width={compact ? 22 : 34} height={compact ? 22 : 34} viewBox="0 0 36 36" aria-label="СберКорус" role="img">
        <defs>
          <linearGradient id="sberKorusGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#21A038" />
            <stop offset="100%" stopColor="#00B8F0" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="28" height="28" rx="10" fill="url(#sberKorusGradient)" opacity="0.12" />
        <path d="M13 13h10v10H13z" fill="none" stroke="#21A038" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M16 10h4" stroke="#21A038" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M11.5 18h2.5m8 0h2.5" stroke="#00B8F0" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M17 18h2" stroke="#21A038" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M18 22l2-2m-2 2l-2-2" fill="none" stroke="#00B8F0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 12 : 16, lineHeight: 1, fontWeight: 800, color: '#1F2937', whiteSpace: 'nowrap' }}>СберКорус</div>
        {!compact ? (
          <div style={{ fontSize: 11, color: '#6B778C', lineHeight: 1.2, wordBreak: 'break-word' }}>{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}
