const PLATFORM_V7_RADIUS_TOKENS = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 28,
  pill: 999,
} as const;

const PLATFORM_V7_SPACING_TOKENS = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  compact: 20,
  lg: 24,
  xl: 32,
  section: 40,
  xxl: 56,
} as const;

const PLATFORM_V7_TYPOGRAPHY_TOKENS = {
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
} as const;

const PLATFORM_V7_Z_INDEX_TOKENS = {
  base: 0,
  sticky: 20,
  drawer: 40,
  modal: 60,
  toast: 80,
} as const;

export const PLATFORM_V7_LIGHT_TOKENS = {
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
  radius: PLATFORM_V7_RADIUS_TOKENS,
  spacing: PLATFORM_V7_SPACING_TOKENS,
  typography: PLATFORM_V7_TYPOGRAPHY_TOKENS,
  shadow: {
    none: 'none',
    soft: '0 1px 2px rgba(15, 20, 25, 0.05), 0 8px 24px rgba(15, 20, 25, 0.06)',
    elevated: '0 18px 55px rgba(15, 20, 25, 0.10)',
    command: '0 24px 80px rgba(15, 20, 25, 0.16)',
    card: '0 1px 2px rgba(15, 20, 25, 0.05), 0 8px 24px rgba(15, 20, 25, 0.06)',
    floating: '0 16px 48px rgba(15, 20, 25, 0.14)',
  },
  zIndex: PLATFORM_V7_Z_INDEX_TOKENS,
} as const;

export const PLATFORM_V7_DARK_TOKENS = {
  color: {
    background: '#07110F',
    backgroundElevated: '#111F1C',
    surface: '#0E1A18',
    surfaceMuted: '#14211D',
    surfaceStrong: '#1B2B26',
    border: '#24342F',
    borderStrong: '#3A4D46',
    text: '#E8F0EC',
    textPrimary: '#E8F0EC',
    textSecondary: '#B8C7C2',
    textMuted: '#8EA09A',
    textSubtle: '#8EA09A',
    brand: '#7DDDB5',
    brandHover: '#9FE8CB',
    brandSoft: '#0F2A22',
    accent: '#D4A94E',
    accentSoft: '#302713',
    success: '#7DDDB5',
    successSoft: '#0E241D',
    warning: '#E8B85A',
    warningSoft: '#2A2212',
    danger: '#F08C90',
    dangerSoft: '#2A1517',
    info: '#8DB7FF',
    infoSoft: '#101D30',
    money: '#8FB5FF',
    moneySoft: '#101C33',
    evidence: '#C4B5FD',
    evidenceSoft: '#1D1633',
    integration: '#76D6CB',
    integrationSoft: '#0D2422',
    bank: '#A9B8C9',
    bankSoft: '#121B27',
    logistics: '#B6A7F5',
    logisticsSoft: '#1B1630',
    document: '#8FD3FF',
    documentSoft: '#0D2330',
    dispute: '#FDA4AF',
    disputeSoft: '#2A1218',
  },
  radius: PLATFORM_V7_RADIUS_TOKENS,
  spacing: PLATFORM_V7_SPACING_TOKENS,
  typography: PLATFORM_V7_TYPOGRAPHY_TOKENS,
  shadow: {
    none: 'none',
    soft: '0 1px 2px rgba(0, 0, 0, 0.34), 0 10px 28px rgba(0, 0, 0, 0.24)',
    elevated: '0 20px 58px rgba(0, 0, 0, 0.42)',
    command: '0 28px 90px rgba(0, 0, 0, 0.52)',
    card: '0 1px 2px rgba(0, 0, 0, 0.34), 0 10px 28px rgba(0, 0, 0, 0.24)',
    floating: '0 18px 54px rgba(0, 0, 0, 0.48)',
  },
  zIndex: PLATFORM_V7_Z_INDEX_TOKENS,
} as const;

export const PLATFORM_V7_TOKENS = PLATFORM_V7_LIGHT_TOKENS;

export type PlatformV7Theme = 'light' | 'dark';
export type PlatformV7ThemeTokens = typeof PLATFORM_V7_LIGHT_TOKENS | typeof PLATFORM_V7_DARK_TOKENS;

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

export function getPlatformV7ThemeTokens(theme: PlatformV7Theme = 'light'): PlatformV7ThemeTokens {
  return theme === 'dark' ? PLATFORM_V7_DARK_TOKENS : PLATFORM_V7_LIGHT_TOKENS;
}

export function getPlatformV7ToneTokens(tone: PlatformV7Tone, theme: PlatformV7Theme = 'light'): PlatformV7ToneTokens {
  const tokens = getPlatformV7ThemeTokens(theme);

  switch (tone) {
    case 'success':
      return { fg: tokens.color.success, bg: tokens.color.successSoft, border: theme === 'dark' ? '#245544' : '#ABEFC6' };
    case 'warning':
      return { fg: tokens.color.warning, bg: tokens.color.warningSoft, border: theme === 'dark' ? '#5C4620' : '#FEDF89' };
    case 'danger':
      return { fg: tokens.color.danger, bg: tokens.color.dangerSoft, border: theme === 'dark' ? '#5C2D31' : '#FECDCA' };
    case 'info':
      return { fg: tokens.color.info, bg: tokens.color.infoSoft, border: theme === 'dark' ? '#28486F' : '#B2DDFF' };
    case 'money':
      return { fg: tokens.color.money, bg: tokens.color.moneySoft, border: theme === 'dark' ? '#2B4774' : '#B2CCFF' };
    case 'evidence':
      return { fg: tokens.color.evidence, bg: tokens.color.evidenceSoft, border: theme === 'dark' ? '#493873' : '#D9D6FE' };
    case 'integration':
      return { fg: tokens.color.integration, bg: tokens.color.integrationSoft, border: theme === 'dark' ? '#245651' : '#99F6E0' };
    case 'bank':
      return { fg: tokens.color.bank, bg: tokens.color.bankSoft, border: theme === 'dark' ? '#354658' : '#CBD5E1' };
    case 'logistics':
      return { fg: tokens.color.logistics, bg: tokens.color.logisticsSoft, border: theme === 'dark' ? '#46396D' : '#DDD6FE' };
    case 'document':
      return { fg: tokens.color.document, bg: tokens.color.documentSoft, border: theme === 'dark' ? '#24576D' : '#BAE6FD' };
    case 'dispute':
      return { fg: tokens.color.dispute, bg: tokens.color.disputeSoft, border: theme === 'dark' ? '#63303B' : '#FECDD3' };
    case 'neutral':
    default:
      return { fg: tokens.color.textSecondary, bg: tokens.color.surfaceMuted, border: tokens.color.border };
  }
}
