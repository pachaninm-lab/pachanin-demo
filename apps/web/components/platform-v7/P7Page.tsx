import type { ReactNode } from 'react';
import { PLATFORM_V7_TOKENS } from '@/lib/platform-v7/design/tokens';
import { P7_THEME_CSS } from '@/components/platform-v7/p7Theme';

export interface P7PageProps {
  readonly children: ReactNode;
  readonly title?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly actions?: ReactNode;
  readonly testId?: string;
  readonly maxWidth?: number | string;
}

export function P7Page({ children, title, subtitle, eyebrow, actions, testId, maxWidth = 1440 }: P7PageProps) {
  return (
    <main
      data-testid={testId}
      style={{
        display: 'grid',
        gap: PLATFORM_V7_TOKENS.spacing.xl,
        width: '100%',
        maxWidth,
        margin: '0 auto',
        minHeight: '100%',
        background: P7_THEME_CSS.color.background,
        color: P7_THEME_CSS.color.textPrimary,
        fontFamily: PLATFORM_V7_TOKENS.typography.fontSans,
      }}
    >
      {(title || subtitle || eyebrow || actions) && (
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: PLATFORM_V7_TOKENS.spacing.lg,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.xs, minWidth: 260, maxWidth: 860 }}>
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
              <h1
                style={{
                  margin: 0,
                  color: P7_THEME_CSS.color.textPrimary,
                  fontSize: PLATFORM_V7_TOKENS.typography.h1.size,
                  lineHeight: PLATFORM_V7_TOKENS.typography.h1.lineHeight,
                  fontWeight: PLATFORM_V7_TOKENS.typography.h1.weight,
                  letterSpacing: PLATFORM_V7_TOKENS.typography.h1.letterSpacing,
                }}
              >
                {title}
              </h1>
            )}
            {subtitle && (
              <div
                style={{
                  color: P7_THEME_CSS.color.textSecondary,
                  fontSize: PLATFORM_V7_TOKENS.typography.body.size,
                  lineHeight: PLATFORM_V7_TOKENS.typography.body.lineHeight,
                  fontWeight: PLATFORM_V7_TOKENS.typography.body.weight,
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
    </main>
  );
}
