export const PLATFORM_V7_TOKENS = {
  color: {
    background: '#F7F9F5',
    backgroundElevated: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceMuted: '#F2F6F0',
    surfaceStrong: '#E7EFE8',
    border: '#D7DEE3',
    borderStrong: '#B9C4CC',
    text: '#0F1419',
    textMuted: '#475569',
    textSubtle: '#667085',
    brand: '#0A7A5F',
    brandHover: '#086850',
    brandSoft: '#E5F4EF',
    accent: '#B68A35',
    accentSoft: '#FFF4D8',
    success: '#027A48',
    successSoft: '#ECFDF3',
    warning: '#B54708',
    warningSoft: '#FFFAEB',
    danger: '#B42318',
    dangerSoft: '#FEF3F2',
    info: '#175CD3',
    infoSoft: '#EFF8FF',
    money: '#155EEF',
    evidence: '#6941C6',
    integration: '#0E9384',
  },
  radius: {
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 28,
    pill: 999,
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  typography: {
    fontSans: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontMono: 'JetBrains Mono, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    h1: { size: 28, lineHeight: 1.15, weight: 750 },
    h2: { size: 22, lineHeight: 1.2, weight: 700 },
    h3: { size: 16, lineHeight: 1.35, weight: 700 },
    body: { size: 14, lineHeight: 1.6, weight: 450 },
    caption: { size: 12, lineHeight: 1.5, weight: 600 },
    metric: { size: 30, lineHeight: 1.05, weight: 800 },
  },
  shadow: {
    none: 'none',
    card: '0 1px 2px rgba(15, 20, 25, 0.05), 0 8px 24px rgba(15, 20, 25, 0.06)',
    floating: '0 16px 48px rgba(15, 20, 25, 0.14)',
  },
  zIndex: {
    base: 0,
    sticky: 20,
    drawer: 40,
    modal: 60,
    toast: 80,
  },
} as const;

export type PlatformV7Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'money' | 'evidence' | 'integration';

export interface PlatformV7ToneTokens {
  readonly fg: string;
  readonly bg: string;
  readonly border: string;
}

export function getPlatformV7ToneTokens(tone: PlatformV7Tone): PlatformV7ToneTokens {
  switch (tone) {
    case 'success':
      return { fg: PLATFORM_V7_TOKENS.color.success, bg: PLATFORM_V7_TOKENS.color.successSoft, border: '#ABEFC6' };
    case 'warning':
      return { fg: PLATFORM_V7_TOKENS.color.warning, bg: PLATFORM_V7_TOKENS.color.warningSoft, border: '#FEDF89' };
    case 'danger':
      return { fg: PLATFORM_V7_TOKENS.color.danger, bg: PLATFORM_V7_TOKENS.color.dangerSoft, border: '#FECDCA' };
    case 'info':
      return { fg: PLATFORM_V7_TOKENS.color.info, bg: PLATFORM_V7_TOKENS.color.infoSoft, border: '#B2DDFF' };
    case 'money':
      return { fg: PLATFORM_V7_TOKENS.color.money, bg: '#EFF4FF', border: '#B2CCFF' };
    case 'evidence':
      return { fg: PLATFORM_V7_TOKENS.color.evidence, bg: '#F4F3FF', border: '#D9D6FE' };
    case 'integration':
      return { fg: PLATFORM_V7_TOKENS.color.integration, bg: '#F0FDF9', border: '#99F6E0' };
    case 'neutral':
    default:
      return { fg: PLATFORM_V7_TOKENS.color.textMuted, bg: PLATFORM_V7_TOKENS.color.surfaceMuted, border: PLATFORM_V7_TOKENS.color.border };
  }
}
