import type { CSSProperties } from 'react';

export type ExecutiveSignalState = 'ok' | 'wait' | 'stop';

export type ExecutiveSignal = {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly state: ExecutiveSignalState;
};

const STATE_COLORS: Record<ExecutiveSignalState, string> = {
  ok: 'var(--pc-success, #027A48)',
  wait: 'var(--pc-warning, #B54708)',
  stop: 'var(--pc-danger, #B42318)',
};

const STATE_LABELS: Record<ExecutiveSignalState, string> = {
  ok: 'в норме',
  wait: 'требует внимания',
  stop: 'останавливает деньги',
};

const card: CSSProperties = {
  display: 'grid',
  gap: 10,
  alignContent: 'start',
  background: 'var(--pc-bg-card, #fff)',
  border: '1px solid var(--pc-border, rgba(63,56,38,0.12))',
  borderRadius: 16,
  padding: '20px 22px',
  minWidth: 0,
};

export function ExecutiveSignalWall({ signals }: { readonly signals: readonly ExecutiveSignal[] }) {
  return (
    <section
      aria-label='Сигналы исполнительного контроля'
      data-testid='executive-signal-wall'
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}
    >
      {signals.map((signal) => (
        <article key={signal.label} style={card}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--pc-text-muted, #58606E)',
            }}
          >
            {signal.label}
          </div>
          <div
            style={{
              fontSize: 32,
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: '-0.01em',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--pc-text-primary, #0F1419)',
              overflowWrap: 'anywhere',
            }}
          >
            {signal.value}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span
              aria-hidden='true'
              style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: STATE_COLORS[signal.state] }}
            />
            <span style={{ fontWeight: 700, color: STATE_COLORS[signal.state] }}>{STATE_LABELS[signal.state]}</span>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--pc-text-secondary, #475569)' }}>{signal.detail}</div>
        </article>
      ))}
    </section>
  );
}
