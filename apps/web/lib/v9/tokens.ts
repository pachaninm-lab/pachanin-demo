/**
 * Design tokens — source of truth for platform-v7
 * Proxied into tailwind.config.ts
 * §5 ТЗ v9.1
 */

export const spacing = {
  '50': '2px',
  '100': '4px',
  '150': '6px',
  '200': '8px',
  '300': '12px',
  '400': '16px',
  '500': '20px',
  '600': '24px',
  '800': '32px',
  '1000': '40px',
  '1200': '48px',
  '1600': '64px',
} as const;

export const colors = {
  bg: {
    canvas: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    muted: '#F4F5F7',
  },
  border: {
    default: '#E4E6EA',
    strong: '#C1C7D0',
  },
  text: {
    primary: '#0F1419',
    secondary: '#495057',
    muted: '#6B778C',
  },
  brand: {
    primary: '#0A7A5F',
    primaryHover: '#086850',
    accent: '#14B8A6',
  },
  status: {
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    info: '#0284C7',
  },
  sber: {
    live: '#16A34A',
    sandbox: '#D97706',
    offline: '#6B778C',
  },
} as const;

export const fonts = {
  sans: 'Inter, system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
} as const;

export const fontSizes = {
  xs: '12px',
  sm: '13px',
  base: '14px',
  md: '16px',
  lg: '18px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '40px',
} as const;

export const radii = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  glass: '16px',
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(9,30,66,0.06)',
  md: '0 2px 6px rgba(9,30,66,0.08)',
  lg: '0 8px 24px rgba(9,30,66,0.12)',
  glass: '0 20px 48px rgba(9,30,66,0.16)',
} as const;
