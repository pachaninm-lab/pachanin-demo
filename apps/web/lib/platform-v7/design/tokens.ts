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
    textPrimary: '#0F1419',
    textSecondary: '#475569',
    textMuted: '#667085',
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
    moneySoft: '#EFF4FF',
    evidence: '#6941C6',
    evidenceSoft: '#F4F3FF',
    integration: '#0E9384',
    integrationSoft: '#F0FDF9',
    bank: '#1E293B',
    bankSoft: '#F1F5F9',
    logistics: '#5B21B6',
    logisticsSoft: '#F5F3FF',
    document: '#0369A1',
    documentSoft: '#EFF6FF',
    dispute: '#9F1239',
    disputeSoft: '#FFF1F2',
  },
  radius: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 20,
    xl: 28,
    xxl: 28,
    pill: 999,
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    compact: 20,
    lg: 24,
    xl: 32,
    section: 40,
    xxl: 56,
  },
  typography: {
    fontSans: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontMono: 'JetBrains Mono, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    display: { size: 56, lineHeight: 1.02, weight: 820, letterSpacing: '-0.06em' },
    h1: { size: 32, lineHeight: 1.12, weight: 760, letterSpacing: '-0.04em' },
    h2: { size: 24, lineHeight: 1.18, weight: 720, letterSpacing: '-0.03em' },
    h3: { size: 17, lineHeight: 1.35, weight: 700, letterSpacing: '-0.01em' },
    body: { size: 14, lineHeight: 1.6, weight: 450 },
    caption: { size: 12, lineHeight: 1.5, weight: 600 },
    micro: { size: 11, lineHeight: 1.35, weight: 760, letterSpacing: '0.06em' },
    metric: { size: 30, lineHeight: 1.05, weight: 800 },
  },
  shadow: {
    none: 'none',
    soft: '0 1px 2px rgba(15, 20, 25, 0.05), 0 8px 24px rgba(15, 20, 25, 0.06)',
    elevated: '0 18px 55px rgba(15, 20, 25, 0.10)',
    command: '0 24px 80px rgba(15, 20, 25, 0.16)',
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

export type PlatformV7Tone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'money'
  | 'evidence'
  | 'integration'
  | 'bank'
  | 'logistics'
  | 'document'
  | 'dispute';

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
      return { fg: PLATFORM_V7_TOKENS.color.money, bg: PLATFORM_V7_TOKENS.color.moneySoft, border: '#B2CCFF' };
    case 'evidence':
      return { fg: PLATFORM_V7_TOKENS.color.evidence, bg: PLATFORM_V7_TOKENS.color.evidenceSoft, border: '#D9D6FE' };
    case 'integration':
      return { fg: PLATFORM_V7_TOKENS.color.integration, bg: PLATFORM_V7_TOKENS.color.integrationSoft, border: '#99F6E0' };
    case 'bank':
      return { fg: PLATFORM_V7_TOKENS.color.bank, bg: PLATFORM_V7_TOKENS.color.bankSoft, border: '#CBD5E1' };
    case 'logistics':
      return { fg: PLATFORM_V7_TOKENS.color.logistics, bg: PLATFORM_V7_TOKENS.color.logisticsSoft, border: '#DDD6FE' };
    case 'document':
      return { fg: PLATFORM_V7_TOKENS.color.document, bg: PLATFORM_V7_TOKENS.color.documentSoft, border: '#BAE6FD' };
    case 'dispute':
      return { fg: PLATFORM_V7_TOKENS.color.dispute, bg: PLATFORM_V7_TOKENS.color.disputeSoft, border: '#FECDD3' };
    case 'neutral':
    default:
      return { fg: PLATFORM_V7_TOKENS.color.textSecondary, bg: PLATFORM_V7_TOKENS.color.surfaceMuted, border: PLATFORM_V7_TOKENS.color.border };
  }
}
