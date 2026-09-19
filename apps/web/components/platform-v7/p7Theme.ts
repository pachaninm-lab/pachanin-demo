import type { PlatformV7Tone } from '@/lib/platform-v7/design/tokens';

export const P7_THEME_CSS = {
  color: {
    background: 'var(--p7-color-background)',
    backgroundElevated: 'var(--p7-color-background-elevated)',
    surface: 'var(--p7-color-surface)',
    surfaceMuted: 'var(--p7-color-surface-muted)',
    surfaceStrong: 'var(--p7-color-surface-strong)',
    border: 'var(--p7-color-border)',
    borderStrong: 'var(--p7-color-border-strong)',
    text: 'var(--p7-color-text)',
    textPrimary: 'var(--p7-color-text-primary)',
    textSecondary: 'var(--p7-color-text-secondary)',
    textMuted: 'var(--p7-color-text-muted)',
    brand: 'var(--p7-color-brand)',
    brandHover: 'var(--p7-color-brand-hover)',
    brandSoft: 'var(--p7-color-brand-soft)',
    accent: 'var(--p7-color-accent)',
    accentSoft: 'var(--p7-color-accent-soft)',
  },
  shadow: {
    none: 'none',
    soft: 'var(--pc-shadow-sm)',
    elevated: 'var(--pc-shadow-md)',
    command: 'var(--pc-shadow-lg)',
    card: 'var(--pc-shadow-sm)',
  },
  surface: {
    card: 'var(--p7-color-surface)',
    muted: 'var(--p7-color-surface-muted)',
    elevated: 'var(--p7-color-background-elevated)',
    premium: 'linear-gradient(135deg, var(--p7-color-surface) 0%, var(--p7-color-background) 58%, var(--p7-color-brand-soft) 100%)',
    spine: 'color-mix(in srgb, var(--p7-color-surface) 82%, transparent)',
  },
} as const;

export interface P7ToneCssVariables {
  readonly fg: string;
  readonly bg: string;
  readonly border: string;
}

export function getP7ToneCssVariables(tone: PlatformV7Tone = 'neutral'): P7ToneCssVariables {
  if (tone === 'neutral') {
    return {
      fg: P7_THEME_CSS.color.textSecondary,
      bg: P7_THEME_CSS.color.surfaceMuted,
      border: P7_THEME_CSS.color.border,
    };
  }

  return {
    fg: `var(--p7-color-${tone})`,
    bg: `var(--p7-color-${tone}-soft)`,
    border: `color-mix(in srgb, var(--p7-color-${tone}) 32%, transparent)`,
  };
}
