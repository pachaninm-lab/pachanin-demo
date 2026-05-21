import Link from 'next/link';

export interface BatonStripProps {
  from: string;
  mine: string;
  to: string;
  toHref?: string;
}

export function BatonStrip({ from, mine, to, toHref }: BatonStripProps) {
  return (
    <div style={shell} role="navigation" aria-label="Эстафета исполнения">
      <span style={segment}>
        <span style={icon}>←</span>
        <span style={label}>от кого</span>
        <span style={value}>{from}</span>
      </span>
      <span style={divider} aria-hidden />
      <span style={{ ...segment, ...centerSegment }}>
        <span style={dotIcon}>⦿</span>
        <span style={label}>что на мне</span>
        <span style={{ ...value, color: 'var(--pc-accent, #0A7A5F)', fontWeight: 900 }}>{mine}</span>
      </span>
      <span style={divider} aria-hidden />
      <span style={segment}>
        <span style={icon}>→</span>
        <span style={label}>кому</span>
        {toHref ? (
          <Link href={toHref} style={{ ...value, color: 'var(--pc-accent, #0A7A5F)', textDecoration: 'none', fontWeight: 850 }}>{to}</Link>
        ) : (
          <span style={value}>{to}</span>
        )}
      </span>
    </div>
  );
}

const shell = {
  display: 'flex',
  alignItems: 'center',
  gap: 0,
  borderRadius: 14,
  border: '1px solid var(--pc-border)',
  background: 'var(--pc-bg-card)',
  overflow: 'hidden',
  flexWrap: 'wrap' as const,
} as const;

const segment = {
  flex: '1 1 160px',
  display: 'grid',
  gap: 2,
  padding: '10px 14px',
} as const;

const centerSegment = {
  borderLeft: '1px solid var(--pc-border)',
  borderRight: '1px solid var(--pc-border)',
} as const;

const icon = {
  color: 'var(--pc-text-muted)',
  fontSize: 13,
  lineHeight: 1,
} as const;

const dotIcon = {
  color: 'var(--pc-accent, #0A7A5F)',
  fontSize: 13,
  lineHeight: 1,
} as const;

const label = {
  color: 'var(--pc-text-muted)',
  fontSize: 10,
  fontWeight: 900,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.07em',
  lineHeight: 1.2,
} as const;

const value = {
  color: 'var(--pc-text-primary)',
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.3,
} as const;

const divider = {
  display: 'none',
} as const;
