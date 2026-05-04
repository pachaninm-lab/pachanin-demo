import type { ReactNode } from 'react';
import { PLATFORM_V7_TOKENS } from '@/lib/platform-v7/design/tokens';
import { P7_THEME_CSS } from '@/components/platform-v7/p7Theme';

export interface P7SectionProps {
  readonly children: ReactNode;
  readonly title?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly actions?: ReactNode;
  readonly testId?: string;
  readonly surface?: 'plain' | 'card' | 'muted';
}

export function P7Section({ children, title, subtitle, eyebrow, actions, testId, surface = 'plain' }: P7SectionProps) {
  const isCard = surface !== 'plain';

  return (
    <section
      data-testid={testId}
      style={{
        display: 'grid',
        gap: PLATFORM_V7_TOKENS.spacing.md,
        border: isCard ? `1px solid ${P7_THEME_CSS.color.border}` : undefined,
        borderRadius: isCard ? PLATFORM_V7_TOKENS.radius.xl : undefined,
        background:
          surface === 'card'
            ? P7_THEME_CSS.surface.card
            : surface === 'muted'
              ? P7_THEME_CSS.surface.muted
              : undefined,
        boxShadow: surface === 'card' ? P7_THEME_CSS.shadow.soft : undefined,
        color: P7_THEME_CSS.color.textPrimary,
        padding: isCard ? PLATFORM_V7_TOKENS.spacing.lg : undefined,
      }}
    >
      {(title || subtitle || eyebrow || actions) && (
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: PLATFORM_V7_TOKENS.spacing.md, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.xs, maxWidth: 820 }}>
            {eyebrow && (
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
                {eyebrow}
              </div>
            )}
            {title && (
              <h2
                style={{
                  margin: 0,
                  color: P7_THEME_CSS.color.textPrimary,
                  fontSize: PLATFORM_V7_TOKENS.typography.h2.size,
                  lineHeight: PLATFORM_V7_TOKENS.typography.h2.lineHeight,
                  fontWeight: PLATFORM_V7_TOKENS.typography.h2.weight,
                  letterSpacing: PLATFORM_V7_TOKENS.typography.h2.letterSpacing,
                }}
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <div
                style={{
                  color: P7_THEME_CSS.color.textSecondary,
                  fontSize: PLATFORM_V7_TOKENS.typography.body.size,
                  lineHeight: PLATFORM_V7_TOKENS.typography.body.lineHeight,
                  maxWidth: 760,
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
          {actions && <div>{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
