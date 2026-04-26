import type { ReactNode } from 'react';
import { PLATFORM_V7_TOKENS } from '@/lib/platform-v7/design/tokens';

export interface P7ToolbarProps {
  readonly children: ReactNode;
  readonly testId?: string;
}

export function P7Toolbar({ children, testId }: P7ToolbarProps) {
  return (
    <div
      data-testid={testId}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: PLATFORM_V7_TOKENS.spacing.sm,
        flexWrap: 'wrap',
        border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`,
        borderRadius: PLATFORM_V7_TOKENS.radius.xl,
        background: PLATFORM_V7_TOKENS.color.surface,
        padding: PLATFORM_V7_TOKENS.spacing.sm,
        boxShadow: PLATFORM_V7_TOKENS.shadow.none,
      }}
    >
      {children}
    </div>
  );
}
