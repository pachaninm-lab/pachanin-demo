import type { ReactNode } from 'react';
import { PLATFORM_V7_TOKENS, type PlatformV7Tone } from '@/lib/platform-v7/design/tokens';
import { getP7ToneCssVariables } from '@/components/platform-v7/p7Theme';

export function P7Badge({ children, tone = 'neutral' }: { readonly children: ReactNode; readonly tone?: PlatformV7Tone }) {
  const colors = getP7ToneCssVariables(tone);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 28,
        borderRadius: PLATFORM_V7_TOKENS.radius.pill,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        color: colors.fg,
        padding: '5px 10px',
        fontFamily: PLATFORM_V7_TOKENS.typography.fontSans,
        fontSize: PLATFORM_V7_TOKENS.typography.caption.size,
        lineHeight: PLATFORM_V7_TOKENS.typography.caption.lineHeight,
        fontWeight: PLATFORM_V7_TOKENS.typography.caption.weight,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
