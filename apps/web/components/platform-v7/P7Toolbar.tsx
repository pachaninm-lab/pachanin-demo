import type { ReactNode } from 'react';
import { PLATFORM_V7_TOKENS } from '@/lib/platform-v7/design/tokens';
import { P7_THEME_CSS } from '@/components/platform-v7/p7Theme';

export interface P7ToolbarProps {
  readonly children: ReactNode;
  readonly testId?: string;
  readonly tone?: 'plain' | 'muted' | 'command';
}

export function P7Toolbar({ children, testId, tone = 'plain' }: P7ToolbarProps) {
  return (
    <div
      data-testid={testId}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: PLATFORM_V7_TOKENS.spacing.sm,
        flexWrap: 'wrap',
        border: `1px solid ${P7_THEME_CSS.color.border}`,
        borderRadius: PLATFORM_V7_TOKENS.radius.lg,
        background: tone === 'muted' ? P7_THEME_CSS.surface.muted : P7_THEME_CSS.surface.card,
        color: P7_THEME_CSS.color.textPrimary,
        padding: PLATFORM_V7_TOKENS.spacing.sm,
        boxShadow: tone === 'command' ? P7_THEME_CSS.shadow.soft : P7_THEME_CSS.shadow.none,
        minHeight: 52,
      }}
    >
      {children}
    </div>
  );
}
