import { describe, expect, it } from 'vitest';
import { meetsWcagAaLargeTextOrUi, meetsWcagAaText } from '@/lib/platform-v7/design/contrast';
import {
  getPlatformV7ThemeTokens,
  getPlatformV7ToneTokens,
  PLATFORM_V7_DARK_TOKENS,
  PLATFORM_V7_LIGHT_TOKENS,
  PLATFORM_V7_TOKENS,
  type PlatformV7Tone,
} from '@/lib/platform-v7/design/tokens';

const REQUIRED_COLOR_KEYS = [
  'background',
  'backgroundElevated',
  'surface',
  'surfaceMuted',
  'surfaceStrong',
  'border',
  'borderStrong',
  'text',
  'textPrimary',
  'textSecondary',
  'textMuted',
  'brand',
  'brandHover',
  'brandSoft',
  'accent',
  'accentSoft',
  'success',
  'successSoft',
  'warning',
  'warningSoft',
  'danger',
  'dangerSoft',
  'info',
  'infoSoft',
  'money',
  'moneySoft',
  'evidence',
  'evidenceSoft',
  'integration',
  'integrationSoft',
  'bank',
  'bankSoft',
  'logistics',
  'logisticsSoft',
  'document',
  'documentSoft',
  'dispute',
  'disputeSoft',
] as const;

const SEMANTIC_TONES: readonly PlatformV7Tone[] = [
  'neutral',
  'success',
  'warning',
  'danger',
  'info',
  'money',
  'evidence',
  'integration',
  'bank',
  'logistics',
  'document',
  'dispute',
];

describe('platform-v7 dark token foundation', () => {
  it('keeps the legacy PLATFORM_V7_TOKENS export compatible with the light token set', () => {
    expect(PLATFORM_V7_TOKENS).toBe(PLATFORM_V7_LIGHT_TOKENS);
    expect(PLATFORM_V7_TOKENS.color.brand).toBe('#0A7A5F');
  });

  it('exposes complete light and dark color maps', () => {
    for (const key of REQUIRED_COLOR_KEYS) {
      expect(PLATFORM_V7_LIGHT_TOKENS.color[key]).toMatch(/^#[0-9A-F]{6}$/i);
      expect(PLATFORM_V7_DARK_TOKENS.color[key]).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('returns theme-specific token maps', () => {
    expect(getPlatformV7ThemeTokens('light')).toBe(PLATFORM_V7_LIGHT_TOKENS);
    expect(getPlatformV7ThemeTokens('dark')).toBe(PLATFORM_V7_DARK_TOKENS);
    expect(getPlatformV7ThemeTokens().color.background).toBe(PLATFORM_V7_LIGHT_TOKENS.color.background);
  });

  it('keeps dark base text colors AA-compliant on core dark surfaces', () => {
    const dark = PLATFORM_V7_DARK_TOKENS.color;

    expect(meetsWcagAaText(dark.textPrimary, dark.background)).toBe(true);
    expect(meetsWcagAaText(dark.textPrimary, dark.surface)).toBe(true);
    expect(meetsWcagAaText(dark.textSecondary, dark.surface)).toBe(true);
    expect(meetsWcagAaText(dark.textMuted, dark.surface)).toBe(true);
    expect(meetsWcagAaLargeTextOrUi(dark.borderStrong, dark.background)).toBe(true);
  });

  it('keeps every dark semantic tone readable and non-acidic', () => {
    for (const tone of SEMANTIC_TONES) {
      const colors = getPlatformV7ToneTokens(tone, 'dark');

      expect(colors.fg).toMatch(/^#[0-9A-F]{6}$/i);
      expect(colors.bg).toMatch(/^#[0-9A-F]{6}$/i);
      expect(colors.border).toMatch(/^#[0-9A-F]{6}$/i);
      expect(meetsWcagAaText(colors.fg, colors.bg)).toBe(true);
      expect(colors.fg).not.toBe('#FFFFFF');
      expect(colors.bg).not.toBe('#000000');
    }
  });

  it('keeps light semantic tones backward-compatible by default', () => {
    expect(getPlatformV7ToneTokens('success')).toMatchObject({ fg: '#027A48', bg: '#ECFDF3' });
    expect(getPlatformV7ToneTokens('money')).toMatchObject({ fg: '#155EEF', bg: '#EFF4FF' });
    expect(getPlatformV7ToneTokens('bank')).toMatchObject({ fg: '#1E293B', bg: '#F1F5F9' });
  });
});
