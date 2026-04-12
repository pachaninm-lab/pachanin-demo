import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // v9 design tokens — §5 ТЗ v9.1
      spacing: {
        '0.5': '2px',
        '1': '4px',
        '1.5': '6px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
      },
      colors: {
        // Brand
        brand: {
          DEFAULT: '#0A7A5F',
          hover: '#086850',
          accent: '#14B8A6',
        },
        // Semantic status
        success: '#16A34A',
        warning: '#D97706',
        danger: '#DC2626',
        info: '#0284C7',
        // Sber integration
        sber: {
          live: '#16A34A',
          sandbox: '#D97706',
          offline: '#6B778C',
        },
        // Surface/BG
        canvas: '#FAFAFA',
        surface: '#FFFFFF',
        muted: '#F4F5F7',
        // Text
        'text-primary': '#0F1419',
        'text-secondary': '#495057',
        'text-muted': '#6B778C',
        // Border
        border: '#E4E6EA',
        'border-strong': '#C1C7D0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '18px' }],
        base: ['14px', { lineHeight: '20px' }],
        md: ['16px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '28px' }],
        xl: ['24px', { lineHeight: '32px' }],
        '2xl': ['32px', { lineHeight: '40px' }],
        '3xl': ['40px', { lineHeight: '48px' }],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        glass: '16px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(9,30,66,0.06)',
        DEFAULT: '0 2px 6px rgba(9,30,66,0.08)',
        md: '0 2px 6px rgba(9,30,66,0.08)',
        lg: '0 8px 24px rgba(9,30,66,0.12)',
        glass: '0 20px 48px rgba(9,30,66,0.16)',
      },
    },
  },
  corePlugins: {
    // Don't reset base styles — globals.css handles that for v7
    // v9 components use explicit classes only
    preflight: false,
  },
  plugins: [],
};

export default config;
