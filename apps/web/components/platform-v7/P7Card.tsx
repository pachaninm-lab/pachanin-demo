import type { ReactNode } from 'react';
import { PLATFORM_V7_TOKENS } from '@/lib/platform-v7/design/tokens';

export interface P7CardProps {
  readonly children: ReactNode;
  readonly title?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly footer?: ReactNode;
  readonly testId?: string;
}

export function P7Card({ children, title, subtitle, footer, testId }: P7CardProps) {
  return (
    <section
      data-testid={testId}
      style={{
        display: 'grid',
        gap: PLATFORM_V7_TOKENS.spacing.md,
        border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`,
        borderRadius: PLATFORM_V7_TOKENS.radius.xl,
        background: PLATFORM_V7_TOKENS.color.surface,
        boxShadow: PLATFORM_V7_TOKENS.shadow.card,
        padding: PLATFORM_V7_TOKENS.spacing.lg,
      }}
    >
      {(title || subtitle) && (
        <header style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.xs }}>
          {title && (
            <div
              style={{
                color: PLATFORM_V7_TOKENS.color.text,
                fontFamily: PLATFORM_V7_TOKENS.typography.fontSans,
                fontSize: PLATFORM_V7_TOKENS.typography.h3.size,
                lineHeight: PLATFORM_V7_TOKENS.typography.h3.lineHeight,
                fontWeight: PLATFORM_V7_TOKENS.typography.h3.weight,
              }}
            >
              {title}
            </div>
          )}
          {subtitle && (
            <div
              style={{
                color: PLATFORM_V7_TOKENS.color.textMuted,
                fontFamily: PLATFORM_V7_TOKENS.typography.fontSans,
                fontSize: PLATFORM_V7_TOKENS.typography.caption.size,
                lineHeight: PLATFORM_V7_TOKENS.typography.caption.lineHeight,
                fontWeight: PLATFORM_V7_TOKENS.typography.caption.weight,
              }}
            >
              {subtitle}
            </div>
          )}
        </header>
      )}
      <div>{children}</div>
      {footer && <footer>{footer}</footer>}
    </section>
  );
}
