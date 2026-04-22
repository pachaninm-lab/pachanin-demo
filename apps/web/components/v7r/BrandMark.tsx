import type { CSSProperties } from 'react';

interface BrandMarkSvgProps {
  size?: number | string;
  background?: string;
  frame?: string;
  accent?: string;
}

interface BrandMarkProps extends BrandMarkSvgProps {
  rounded?: number;
  shadow?: boolean;
  style?: CSSProperties;
}

export function BrandMarkSvg({
  size = '100%',
  background = '#0F5B4F',
  frame = '#D9E5E0',
  accent = '#7EF2C4',
}: BrandMarkSvgProps) {
  return (
    <svg viewBox='0 0 1024 1024' width={size} height={size} fill='none' xmlns='http://www.w3.org/2000/svg'>
      <rect x='72' y='72' width='880' height='880' rx='228' fill={background} />
      <rect x='228' y='246' width='520' height='534' rx='118' stroke={frame} strokeWidth='84' />
      <path d='M748 350H822V604H748V350Z' fill={frame} />
      <circle cx='786' cy='334' r='104' fill={frame} />
      <circle cx='786' cy='334' r='42' fill={background} />
      <path
        d='M344 690V370H426V590L628 388L686 446L486 646H620V728H344V690Z'
        fill={accent}
      />
    </svg>
  );
}

export function BrandMark({
  size = 40,
  rounded = 14,
  shadow = true,
  background = '#0F5B4F',
  frame = '#D9E5E0',
  accent = '#7EF2C4',
  style,
}: BrandMarkProps) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        width: size,
        height: size,
        borderRadius: rounded,
        overflow: 'hidden',
        boxShadow: shadow ? '0 14px 28px rgba(7, 16, 13, 0.28)' : 'none',
        flexShrink: 0,
        ...style,
      }}
    >
      <BrandMarkSvg background={background} frame={frame} accent={accent} />
    </span>
  );
}
