'use client';

import * as React from 'react';

export type MoneyGateSegmentState = 'released' | 'reserved' | 'held' | 'blocked';

export type MoneyGateSegment = {
  readonly label: string;
  readonly amountRub: number;
  readonly state: MoneyGateSegmentState;
};

export type MoneyGateRingProps = {
  readonly title: string;
  readonly totalRub: number;
  readonly segments: readonly MoneyGateSegment[];
  readonly caption?: string;
};

const SEGMENT_COLORS: Record<MoneyGateSegmentState, string> = {
  released: 'var(--p7-color-success, #027A48)',
  reserved: 'var(--p7-color-money, #155EEF)',
  held: 'var(--p7-color-warning, #B54708)',
  blocked: 'var(--p7-color-danger, #B42318)',
};

const SEGMENT_STATE_LABELS: Record<MoneyGateSegmentState, string> = {
  released: 'банк подтвердил выплату',
  reserved: 'в резерве',
  held: 'удержано',
  blocked: 'остановлено условиями',
};

const RADIUS = 52;
const STROKE = 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function formatMoneyGateAmount(amountRub: number): string {
  if (amountRub >= 1_000_000) {
    const millions = amountRub / 1_000_000;
    return `${millions.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} млн ₽`;
  }
  if (amountRub >= 1_000) {
    return `${Math.round(amountRub / 1_000).toLocaleString('ru-RU')} тыс. ₽`;
  }
  return `${amountRub.toLocaleString('ru-RU')} ₽`;
}

export function MoneyGateRing({ title, totalRub, segments, caption }: MoneyGateRingProps) {
  const total = Math.max(totalRub, 1);
  let offsetFraction = 0;

  return (
    <section
      aria-label={title}
      data-testid='money-gate-ring'
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr)',
        gap: 18,
        alignItems: 'center',
        background: 'var(--pc-bg-card, #fff)',
        border: '1px solid var(--pc-border, rgba(63,56,38,0.12))',
        borderRadius: 16,
        padding: 18,
      }}
    >
      <svg width='128' height='128' viewBox='0 0 128 128' role='img' aria-hidden='true'>
        <circle cx='64' cy='64' r={RADIUS} fill='none' stroke='var(--p7-color-surface-strong, #EFEAE0)' strokeWidth={STROKE} />
        {segments.map((segment) => {
          const fraction = Math.min(segment.amountRub / total, 1);
          const dash = fraction * CIRCUMFERENCE;
          const dashOffset = -offsetFraction * CIRCUMFERENCE;
          offsetFraction += fraction;

          return (
            <circle
              key={segment.label}
              cx='64'
              cy='64'
              r={RADIUS}
              fill='none'
              stroke={SEGMENT_COLORS[segment.state]}
              strokeWidth={STROKE}
              strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
              strokeDashoffset={dashOffset}
              transform='rotate(-90 64 64)'
            />
          );
        })}
        <text
          x='64'
          y='60'
          textAnchor='middle'
          style={{ fontSize: 11, fill: 'var(--pc-text-muted, #58606E)', fontVariantNumeric: 'tabular-nums' }}
        >
          сумма сделки
        </text>
        <text
          x='64'
          y='78'
          textAnchor='middle'
          style={{ fontSize: 14, fontWeight: 800, fill: 'var(--pc-text-primary, #0F1419)', fontVariantNumeric: 'tabular-nums' }}
        >
          {formatMoneyGateAmount(totalRub)}
        </text>
      </svg>

      <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{title}</div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {segments.map((segment) => (
            <li key={segment.label} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12 }}>
              <span
                aria-hidden='true'
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  flexShrink: 0,
                  alignSelf: 'center',
                  background: SEGMENT_COLORS[segment.state],
                }}
              />
              <span style={{ color: 'var(--pc-text-secondary, #475569)' }}>{segment.label}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--pc-text-primary, #0F1419)' }}>
                {formatMoneyGateAmount(segment.amountRub)}
              </span>
              <span style={{ color: 'var(--pc-text-muted, #58606E)' }}>· {SEGMENT_STATE_LABELS[segment.state]}</span>
            </li>
          ))}
        </ul>
        {caption ? <div style={{ fontSize: 12, color: 'var(--pc-text-muted, #58606E)' }}>{caption}</div> : null}
      </div>
    </section>
  );
}
