import type { CSSProperties } from 'react';

interface BrandMarkSvgProps {
  size?: number | string;
}

interface BrandMarkProps extends BrandMarkSvgProps {
  rounded?: number;
  shadow?: boolean;
  style?: CSSProperties;
}

function normalizeSize(size: number | string) {
  return typeof size === 'number' ? `${size}px` : size;
}

export const BRAND_MARK_BG = 'transparent';

const BRAND_MARK_CSS_RESET = `
  .pc-header-brand > span:first-child,
  .app-header-brand > span:first-child,
  .pc-brand-mark-fallback {
    background-image: none !important;
    background-color: transparent !important;
  }

  .pc-header-brand > span:first-child img,
  .app-header-brand > span:first-child img {
    opacity: 1 !important;
    visibility: visible !important;
    display: block !important;
  }
`;

export function BrandMarkSvg({ size = '100%' }: BrandMarkSvgProps) {
  const dimension = normalizeSize(size);

  return (
    <svg
      aria-hidden
      viewBox='0 0 256 256'
      width={dimension}
      height={dimension}
      role='img'
      xmlns='http://www.w3.org/2000/svg'
      style={{ display: 'block', flexShrink: 0, background: 'transparent' }}
    >
      <defs>
        <radialGradient id='pcOuterGlow' cx='38%' cy='18%' r='82%'>
          <stop offset='0%' stopColor='#1F8F77' />
          <stop offset='58%' stopColor='#0B6F5F' />
          <stop offset='100%' stopColor='#024338' />
        </radialGradient>
        <linearGradient id='pcInner' x1='54' y1='39' x2='205' y2='218' gradientUnits='userSpaceOnUse'>
          <stop offset='0%' stopColor='#18342F' />
          <stop offset='55%' stopColor='#071F1C' />
          <stop offset='100%' stopColor='#051816' />
        </linearGradient>
        <linearGradient id='pcGlass' x1='45' y1='45' x2='210' y2='213' gradientUnits='userSpaceOnUse'>
          <stop offset='0%' stopColor='#FFFFFF' stopOpacity='0.86' />
          <stop offset='42%' stopColor='#DDE7E0' stopOpacity='0.58' />
          <stop offset='100%' stopColor='#78948B' stopOpacity='0.44' />
        </linearGradient>
        <linearGradient id='pcIvory' x1='70' y1='58' x2='111' y2='175' gradientUnits='userSpaceOnUse'>
          <stop offset='0%' stopColor='#F7F7EF' />
          <stop offset='100%' stopColor='#C9CCC0' />
        </linearGradient>
        <linearGradient id='pcMetal' x1='139' y1='58' x2='183' y2='192' gradientUnits='userSpaceOnUse'>
          <stop offset='0%' stopColor='#D6D8D0' />
          <stop offset='55%' stopColor='#6B746B' />
          <stop offset='100%' stopColor='#373F3A' />
        </linearGradient>
        <linearGradient id='pcLine' x1='42' y1='183' x2='194' y2='99' gradientUnits='userSpaceOnUse'>
          <stop offset='0%' stopColor='#B8FFE6' />
          <stop offset='54%' stopColor='#80F1CA' />
          <stop offset='100%' stopColor='#64DFBE' />
        </linearGradient>
        <filter id='pcShadow' x='-20%' y='-20%' width='140%' height='150%'>
          <feDropShadow dx='0' dy='12' stdDeviation='11' floodColor='#000000' floodOpacity='0.34' />
        </filter>
        <filter id='pcSoft' x='-20%' y='-20%' width='140%' height='140%'>
          <feDropShadow dx='0' dy='4' stdDeviation='4' floodColor='#000000' floodOpacity='0.35' />
        </filter>
      </defs>

      <g filter='url(#pcShadow)'>
        <rect x='24' y='23' width='208' height='208' rx='49' fill='url(#pcOuterGlow)' />
        <rect x='49' y='49' width='158' height='158' rx='29' fill='url(#pcInner)' />
        <rect x='45' y='45' width='166' height='166' rx='34' fill='none' stroke='url(#pcGlass)' strokeWidth='7' />
        <rect x='53' y='53' width='150' height='150' rx='27' fill='none' stroke='#042D28' strokeWidth='3' opacity='0.86' />

        <g filter='url(#pcSoft)'>
          <path d='M76 76H127V144L107 164V101H96V181H76V76Z' fill='url(#pcIvory)' />
          <path d='M147 76H172V165H191V189H128V165H147V76Z' fill='url(#pcMetal)' />
        </g>

        <path d='M44 181L66 158H91L122 125H142L181 86' fill='none' stroke='#062420' strokeWidth='18' strokeLinecap='round' strokeLinejoin='round' opacity='0.58' />
        <path d='M44 181L66 158H91L122 125H142L181 86' fill='none' stroke='url(#pcLine)' strokeWidth='10' strokeLinecap='round' strokeLinejoin='round' />
        <circle cx='181' cy='86' r='18' fill='#062420' opacity='0.62' />
        <circle cx='181' cy='86' r='12' fill='#83F3CD' stroke='#062420' strokeWidth='4' />

        <path d='M56 205C73 219 91 224 126 224H172C199 224 221 203 228 176C221 211 192 233 154 233H85C55 233 31 211 25 180C32 190 42 198 56 205Z' fill='#032F28' opacity='0.34' />
        <path d='M65 55C82 45 101 41 128 41H173C196 41 213 57 217 78C207 64 191 58 167 58H86C73 58 64 60 55 66C57 62 60 58 65 55Z' fill='#FFFFFF' opacity='0.11' />
      </g>
    </svg>
  );
}

export function BrandMark({ size = 40, rounded = 14, shadow = true, style }: BrandMarkProps) {
  void rounded;
  void shadow;

  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        width: size,
        height: size,
        flexShrink: 0,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '27%',
        background: 'transparent',
        padding: 0,
        margin: 0,
        boxShadow: 'none',
        lineHeight: 0,
        ...style,
      }}
    >
      <style>{BRAND_MARK_CSS_RESET}</style>
      <BrandMarkSvg size='100%' />
    </span>
  );
}
