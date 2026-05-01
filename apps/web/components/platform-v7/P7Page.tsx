import type { ReactNode } from 'react';
import { PLATFORM_V7_TOKENS } from '@/lib/platform-v7/design/tokens';

export interface P7PageProps {
  readonly children: ReactNode;
  readonly title?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly actions?: ReactNode;
  readonly testId?: string;
}

export function P7Page({ children, title, subtitle, actions, testId }: P7PageProps) {
  return (
    <main
      data-testid={testId}
      style={{
        display: 'grid',
        gap: PLATFORM_V7_TOKENS.spacing.xl,
        minHeight: '100%',
        background: PLATFORM_V7_TOKENS.color.background,
        color: PLATFORM_V7_TOKENS.color.text,
        fontFamily: PLATFORM_V7_TOKENS.typography.fontSans,
      }}
    >
      <a
        href="#platform-v7-page-content"
        style={{
          display: 'inline-flex',
          minHeight: 44,
          width: 'fit-content',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: PLATFORM_V7_TOKENS.radius.md,
          border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`,
          background: PLATFORM_V7_TOKENS.color.surface,
          color: PLATFORM_V7_TOKENS.color.text,
          padding: '0 12px',
          fontSize: PLATFORM_V7_TOKENS.typography.caption.size,
          fontWeight: 700,
          textDecoration: 'none',
        }}
      >
        К содержанию
      </a>
      {(title || subtitle || actions) && (
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: PLATFORM_V7_TOKENS.spacing.lg,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.xs, minWidth: 260 }}>
            {title && (
              <h1
                style={{
                  margin: 0,
                  color: PLATFORM_V7_TOKENS.color.text,
                  fontSize: PLATFORM_V7_TOKENS.typography.h1.size,
                  lineHeight: PLATFORM_V7_TOKENS.typography.h1.lineHeight,
                  fontWeight: PLATFORM_V7_TOKENS.typography.h1.weight,
                  letterSpacing: '-0.03em',
                }}
              >
                {title}
              </h1>
            )}
            {subtitle && (
              <div
                style={{
                  color: PLATFORM_V7_TOKENS.color.textMuted,
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
      <div id="platform-v7-page-content" style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.xl }}>
        {children}
      </div>
    </main>
  );
}
