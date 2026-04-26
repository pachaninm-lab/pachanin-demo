import type { ReactNode } from 'react';
import { PLATFORM_V7_TOKENS, getPlatformV7ToneTokens, type PlatformV7Tone } from '@/lib/platform-v7/design/tokens';

export interface P7MetricCardProps {
  readonly title: ReactNode;
  readonly value: ReactNode;
  readonly note?: ReactNode;
  readonly footer?: ReactNode;
  readonly tone?: PlatformV7Tone;
  readonly testId?: string;
}

export function P7MetricCard({ title, value, note, footer, tone = 'neutral', testId }: P7MetricCardProps) {
  const toneTokens = getPlatformV7ToneTokens(tone);

  return (
    <section
      data-testid={testId}
      style={{
        display: 'grid',
        gap: PLATFORM_V7_TOKENS.spacing.sm,
        minHeight: 150,
        border: `1px solid ${toneTokens.border}`,
        borderRadius: PLATFORM_V7_TOKENS.radius.xl,
        background: toneTokens.bg,
        padding: PLATFORM_V7_TOKENS.spacing.lg,
      }}
    >
      <div
        style={{
          color: PLATFORM_V7_TOKENS.color.textMuted,
          fontFamily: PLATFORM_V7_TOKENS.typography.fontSans,
          fontSize: PLATFORM_V7_TOKENS.typography.caption.size,
          lineHeight: PLATFORM_V7_TOKENS.typography.caption.lineHeight,
          fontWeight: 800,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: PLATFORM_V7_TOKENS.color.text,
          fontFamily: PLATFORM_V7_TOKENS.typography.fontMono,
          fontSize: PLATFORM_V7_TOKENS.typography.metric.size,
          lineHeight: PLATFORM_V7_TOKENS.typography.metric.lineHeight,
          fontWeight: PLATFORM_V7_TOKENS.typography.metric.weight,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      {note && (
        <div
          style={{
            color: PLATFORM_V7_TOKENS.color.textMuted,
            fontFamily: PLATFORM_V7_TOKENS.typography.fontSans,
            fontSize: PLATFORM_V7_TOKENS.typography.caption.size,
            lineHeight: PLATFORM_V7_TOKENS.typography.caption.lineHeight,
            fontWeight: PLATFORM_V7_TOKENS.typography.body.weight,
          }}
        >
          {note}
        </div>
      )}
      {footer && <div style={{ marginTop: 'auto' }}>{footer}</div>}
    </section>
  );
}
