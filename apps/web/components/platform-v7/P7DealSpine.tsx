import type { ReactNode } from 'react';
import { PLATFORM_V7_TOKENS, type PlatformV7Tone } from '@/lib/platform-v7/design/tokens';
import { P7_THEME_CSS, getP7ToneCssVariables } from '@/components/platform-v7/p7Theme';

export interface P7DealSpineStep {
  readonly label: string;
  readonly value: ReactNode;
  readonly tone?: PlatformV7Tone;
}

export interface P7DealSpineProps {
  readonly steps: readonly P7DealSpineStep[];
  readonly testId?: string;
}

export function P7DealSpine({ steps, testId }: P7DealSpineProps) {
  return (
    <div
      data-testid={testId}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))',
        gap: PLATFORM_V7_TOKENS.spacing.sm,
        border: `1px solid ${P7_THEME_CSS.color.border}`,
        borderRadius: PLATFORM_V7_TOKENS.radius.xl,
        background: P7_THEME_CSS.surface.spine,
        color: P7_THEME_CSS.color.textPrimary,
        padding: PLATFORM_V7_TOKENS.spacing.sm,
        boxShadow: P7_THEME_CSS.shadow.soft,
      }}
    >
      {steps.map((step, index) => {
        const tone = getP7ToneCssVariables(step.tone ?? 'neutral');

        return (
          <div
            key={`${step.label}-${index}`}
            style={{
              position: 'relative',
              display: 'grid',
              gap: PLATFORM_V7_TOKENS.spacing.xs,
              minHeight: 104,
              border: `1px solid ${tone.border}`,
              borderRadius: PLATFORM_V7_TOKENS.radius.lg,
              background: tone.bg,
              padding: PLATFORM_V7_TOKENS.spacing.md,
            }}
          >
            <span
              aria-hidden='true'
              style={{
                width: 8,
                height: 8,
                borderRadius: PLATFORM_V7_TOKENS.radius.pill,
                background: tone.fg,
                boxShadow: `0 0 0 4px ${tone.bg}`,
              }}
            />
            <div
              style={{
                color: P7_THEME_CSS.color.textMuted,
                fontSize: PLATFORM_V7_TOKENS.typography.micro.size,
                lineHeight: PLATFORM_V7_TOKENS.typography.micro.lineHeight,
                fontWeight: PLATFORM_V7_TOKENS.typography.micro.weight,
                letterSpacing: PLATFORM_V7_TOKENS.typography.micro.letterSpacing,
                textTransform: 'uppercase',
              }}
            >
              {step.label}
            </div>
            <div
              style={{
                color: P7_THEME_CSS.color.textPrimary,
                fontSize: PLATFORM_V7_TOKENS.typography.body.size,
                lineHeight: 1.42,
                fontWeight: 760,
              }}
            >
              {step.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
