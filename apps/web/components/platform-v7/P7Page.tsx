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
      className='p7-page'
      data-testid={testId}
      style={{
        display: 'grid',
        gap: PLATFORM_V7_TOKENS.spacing.xl,
        width: '100%',
        maxWidth,
        margin: '0 auto',
        minWidth: 0,
        minHeight: '100%',
        overflowX: 'clip',
        background: P7_THEME_CSS.color.background,
        color: P7_THEME_CSS.color.textPrimary,
        fontFamily: PLATFORM_V7_TOKENS.typography.fontSans,
      }}
    >
      {(title || subtitle || eyebrow || actions) && (
        <header
          className='p7-page-header'
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: PLATFORM_V7_TOKENS.spacing.lg,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          <div className='p7-page-header-copy' style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.xs, minWidth: 0, maxWidth: 860 }}>
            {eyebrow && (
              <div
                className='p7-page-eyebrow'
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
                className='p7-page-title'
                style={{
                  margin: 0,
                  color: P7_THEME_CSS.color.textPrimary,
                  fontSize: PLATFORM_V7_TOKENS.typography.h1.size,
                  lineHeight: PLATFORM_V7_TOKENS.typography.h1.lineHeight,
                  fontWeight: PLATFORM_V7_TOKENS.typography.h1.weight,
                  letterSpacing: PLATFORM_V7_TOKENS.typography.h1.letterSpacing,
                  overflowWrap: 'break-word',
                }}
              >
                {title}
              </h1>
            )}
            {subtitle && (
              <div
                className='p7-page-subtitle'
                style={{
                  color: P7_THEME_CSS.color.textSecondary,
                  fontSize: PLATFORM_V7_TOKENS.typography.body.size,
                  lineHeight: PLATFORM_V7_TOKENS.typography.body.lineHeight,
                  fontWeight: PLATFORM_V7_TOKENS.typography.body.weight,
                  maxWidth: 760,
                  minWidth: 0,
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
          {actions && <div className='p7-page-actions' style={{ minWidth: 0, maxWidth: '100%' }}>{actions}</div>}
        </header>
      )}
      {children}
    </main>
  );
}
