import type { CSSProperties } from 'react';

export type QualityIndicator = {
  readonly label: string;
  /** Фактическое значение показателя */
  readonly value: number;
  readonly unit: string;
  /** Нижняя граница допуска (если задана) */
  readonly min?: number;
  /** Верхняя граница допуска (если задана) */
  readonly max?: number;
  /** Подпись допуска словами — статус всегда дублируется текстом */
  readonly limitLabel: string;
};

export function qualityIndicatorState(indicator: QualityIndicator): 'ok' | 'stop' {
  if (indicator.min !== undefined && indicator.value < indicator.min) return 'stop';
  if (indicator.max !== undefined && indicator.value > indicator.max) return 'stop';
  return 'ok';
}

const TONE = {
  ok: { color: 'var(--pc-success, #027A48)', soft: 'var(--p7-color-success-soft, #ECFDF3)', text: 'в допуске' },
  stop: { color: 'var(--pc-danger, #B42318)', soft: 'var(--p7-color-danger-soft, #FEF3F2)', text: 'вне допуска' },
} as const;

function scaleBounds(indicator: QualityIndicator): { lo: number; hi: number } {
  const anchors = [indicator.value, indicator.min ?? indicator.value, indicator.max ?? indicator.value];
  const hi = Math.max(...anchors) * 1.25 || 1;
  return { lo: 0, hi };
}

function pct(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(((value - lo) / (hi - lo)) * 100, 0), 100);
}

const numStyle: CSSProperties = { fontVariantNumeric: 'tabular-nums', fontWeight: 800, letterSpacing: '-0.01em' };

export function QualityDeltaBars({ title, indicators }: { readonly title: string; readonly indicators: readonly QualityIndicator[] }) {
  return (
    <section
      aria-label={title}
      data-testid='quality-delta-bars'
      style={{
        background: 'var(--pc-bg-card, #fff)',
        border: '1px solid var(--pc-border, rgba(63,56,38,0.12))',
        borderRadius: 16,
        padding: '18px 20px',
        display: 'grid',
        gap: 16,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--pc-text-muted, #667085)' }}>
        {title}
      </div>

      {indicators.map((indicator) => {
        const state = qualityIndicatorState(indicator);
        const tone = TONE[state];
        const { lo, hi } = scaleBounds(indicator);
        const okFrom = pct(indicator.min ?? lo, lo, hi);
        const okTo = pct(indicator.max ?? hi, lo, hi);
        const fact = pct(indicator.value, lo, hi);

        return (
          <div key={indicator.label} style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--pc-text-primary, #0F1419)' }}>{indicator.label}</span>
              <span style={{ ...numStyle, fontSize: 15, color: state === 'stop' ? tone.color : 'var(--pc-text-primary, #0F1419)' }}>
                {indicator.value.toLocaleString('ru-RU')}{indicator.unit}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: tone.color }}>{tone.text}</span>
            </div>

            <div
              role='img'
              aria-label={`${indicator.label}: факт ${indicator.value}${indicator.unit}, ${indicator.limitLabel}, ${tone.text}`}
              style={{ position: 'relative', height: 10, borderRadius: 999, background: 'var(--p7-color-surface-strong, #EFEAE0)', overflow: 'visible' }}
            >
              <div
                style={{
                  position: 'absolute',
                  insetBlock: 0,
                  left: `${okFrom}%`,
                  width: `${Math.max(okTo - okFrom, 2)}%`,
                  borderRadius: 999,
                  background: TONE.ok.soft,
                  border: `1px solid ${TONE.ok.color}33`,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: -3,
                  bottom: -3,
                  left: `calc(${fact}% - 2px)`,
                  width: 4,
                  borderRadius: 2,
                  background: tone.color,
                  boxShadow: '0 1px 4px rgba(46,40,23,0.25)',
                }}
              />
            </div>

            <div style={{ fontSize: 12, color: 'var(--pc-text-muted, #667085)' }}>{indicator.limitLabel}</div>
          </div>
        );
      })}
    </section>
  );
}
