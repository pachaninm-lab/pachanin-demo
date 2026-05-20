'use client';

import * as React from 'react';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';
import { DEALS, DISPUTES } from '@/lib/v7r/data';

const HIDDEN_ROLES = new Set<PlatformRole>(['driver', 'elevator', 'lab', 'surveyor']);

function rub(n: number) {
  if (n === 0) return '0 ₽';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} млн ₽`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} тыс. ₽`;
  return `${n} ₽`;
}

const activeDeals = DEALS.filter((d) => d.status !== 'closed');
const totalReserved = activeDeals.reduce((s, d) => s + (d.reservedAmount ?? 0), 0);
const totalHeld = activeDeals.reduce((s, d) => s + (d.holdAmount ?? 0), 0);
const totalRelease = activeDeals.reduce((s, d) => s + (d.releaseAmount ?? 0), 0);
const openDisputes = DISPUTES.filter((d) => d.status === 'open').length;

export function MoneySpineStrip() {
  const role = usePlatformV7RStore((s) => s.role);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Reserve space before hydration to avoid CLS
    return <div style={{ height: 34, marginBottom: 10 }} aria-hidden />;
  }
  if (HIDDEN_ROLES.has(role)) return null;

  const items =
    role === 'bank'
      ? [
          { label: 'резерв', value: rub(totalReserved), danger: false },
          { label: 'к выплате', value: rub(totalRelease), danger: totalRelease === 0 },
          { label: 'удержание', value: rub(totalHeld), danger: totalHeld > 0 },
        ]
      : role === 'arbitrator'
        ? [{ label: 'споры', value: `${openDisputes} открытых`, danger: openDisputes > 0 }]
        : [
            { label: 'резерв', value: rub(totalReserved), danger: false },
            { label: 'удержание', value: rub(totalHeld), danger: totalHeld > 0 },
            { label: 'споры', value: `${openDisputes}`, danger: openDisputes > 0 },
          ];

  return (
    <div style={shell} role="status" aria-label="Денежная позиция">
      <span style={spineLabel}>₽</span>
      {items.map((it, i) => (
        <span key={it.label} style={{ display: 'contents' }}>
          {i > 0 && <span style={sep} aria-hidden>·</span>}
          <span style={itemRow}>
            <span style={metaLabel}>{it.label}</span>
            <span style={{ ...val, color: it.danger ? '#B91C1C' : 'var(--pc-text-primary)' }}>{it.value}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

const shell = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '5px 14px',
  borderRadius: 10,
  background: 'var(--pc-bg-card)',
  border: '1px solid var(--pc-border)',
  marginBottom: 10,
  flexWrap: 'wrap' as const,
  fontSize: 12,
} as const;

const spineLabel = {
  color: 'var(--pc-accent, #0A7A5F)',
  fontWeight: 900,
  fontSize: 13,
  flexShrink: 0,
} as const;

const sep = {
  color: 'var(--pc-text-muted)',
  userSelect: 'none' as const,
} as const;

const itemRow = {
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: 4,
} as const;

const metaLabel = {
  color: 'var(--pc-text-muted)',
  fontSize: 10,
  fontWeight: 850,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
} as const;

const val = {
  fontWeight: 800,
  fontVariantNumeric: 'tabular-nums',
  fontSize: 12,
} as const;
