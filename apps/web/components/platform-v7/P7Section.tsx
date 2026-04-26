import type { ReactNode } from 'react';
import { PLATFORM_V7_TOKENS } from '@/lib/platform-v7/design/tokens';

export interface P7SectionProps {
  readonly children: ReactNode;
  readonly title?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly actions?: ReactNode;
  readonly testId?: string;
}

export function P7Section({ children, title, subtitle, actions, testId }: P7SectionProps) {
  return (
    <section data-testid={testId} style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.md }}>
      {(title || subtitle || actions) && (
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: PLATFORM_V7_TOKENS.spacing.md,
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.xs }}>
            {title && (
              <h2
                style={{
                  margin: 0,
                  color: PLATFORM_V7_TOKENS.color.text,
                  fontSize: PLATFORM_V7_TOKENS.typography.h2.size,
                  lineHeight: PLATFORM_V7_TOKENS.typography.h2.lineHeight,
                  fontWeight: PLATFORM_V7_TOKENS.typography.h2.weight,
                  letterSpacing: '-0.02em',
                }}
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <div
                style={{
                  color: PLATFORM_V7_TOKENS.color.textMuted,
                  fontSize: PLATFORM_V7_TOKENS.typography.caption.size + 1,
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
