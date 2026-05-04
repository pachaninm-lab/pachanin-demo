import type { ReactNode } from 'react';
import { PLATFORM_V7_TOKENS } from '@/lib/platform-v7/design/tokens';

export interface P7HeroProps {
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly actions?: ReactNode;
  readonly children?: ReactNode;
  readonly testId?: string;
}

export function P7Hero({ title, subtitle, eyebrow, actions, children, testId }: P7HeroProps) {
  return (
    <section
      data-testid={testId}
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'grid',
        gap: PLATFORM_V7_TOKENS.spacing.lg,
        border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`,
        borderRadius: PLATFORM_V7_TOKENS.radius.xl,
        background: `linear-gradient(135deg, ${PLATFORM_V7_TOKENS.color.surface} 0%, ${PLATFORM_V7_TOKENS.color.background} 56%, ${PLATFORM_V7_TOKENS.color.brandSoft} 100%)`,
        boxShadow: PLATFORM_V7_TOKENS.shadow.elevated,
        padding: PLATFORM_V7_TOKENS.spacing.xl,
      }}
    >
      <div
        aria-hidden='true'
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(15,20,25,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(15,20,25,0.035) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'linear-gradient(135deg, rgba(0,0,0,0.7), transparent 72%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.md, maxWidth: 980 }}>
        {eyebrow && (
          <div
            style={{
              color: PLATFORM_V7_TOKENS.color.textMuted,
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
        <h1
          style={{
            margin: 0,
            color: PLATFORM_V7_TOKENS.color.textPrimary,
            fontSize: `clamp(34px, 7vw, ${PLATFORM_V7_TOKENS.typography.display.size}px)`,
            lineHeight: PLATFORM_V7_TOKENS.typography.display.lineHeight,
            fontWeight: PLATFORM_V7_TOKENS.typography.display.weight,
            letterSpacing: PLATFORM_V7_TOKENS.typography.display.letterSpacing,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <div
            style={{
              maxWidth: 760,
              color: PLATFORM_V7_TOKENS.color.textSecondary,
              fontSize: 17,
              lineHeight: 1.62,
              fontWeight: PLATFORM_V7_TOKENS.typography.body.weight,
            }}
          >
            {subtitle}
          </div>
        )}
        {actions && <div style={{ display: 'flex', gap: PLATFORM_V7_TOKENS.spacing.sm, flexWrap: 'wrap', marginTop: PLATFORM_V7_TOKENS.spacing.xs }}>{actions}</div>}
      </div>
      {children && <div style={{ position: 'relative' }}>{children}</div>}
    </section>
  );
}
