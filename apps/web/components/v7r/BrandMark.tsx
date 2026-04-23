import type { CSSProperties } from 'react';

export const BRAND_MARK_BG = '#F5F2EB';

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

export function BrandMarkSvg({ size = '100%' }: BrandMarkSvgProps) {
  const dimension = normalizeSize(size);

  return (
    <svg
      aria-hidden
      viewBox='0 0 256 256'
      width={dimension}
      height={dimension}
      style={{ display: 'block', flexShrink: 0 }}
      xmlns='http://www.w3.org/2000/svg'
    >
      <defs>
        <linearGradient id='pcLogoBg' x1='38' y1='28' x2='218' y2='228' gradientUnits='userSpaceOnUse'>
          <stop offset='0' stopColor='#F7F0DF' />
          <stop offset='1' stopColor='#E3D5B6' />
        </linearGradient>
        <linearGradient id='pcLogoEmerald' x1='50' y1='38' x2='210' y2='218' gradientUnits='userSpaceOnUse'>
          <stop offset='0' stopColor='#12A886' />
          <stop offset='0.55' stopColor='#0E6E60' />
          <stop offset='1' stopColor='#063A34' />
        </linearGradient>
        <linearGradient id='pcLogoGold' x1='78' y1='54' x2='184' y2='198' gradientUnits='userSpaceOnUse'>
          <stop offset='0' stopColor='#FFF6CF' />
          <stop offset='0.38' stopColor='#D8B55C' />
          <stop offset='1' stopColor='#8C6A25' />
        </linearGradient>
        <linearGradient id='pcLogoMint' x1='60' y1='170' x2='198' y2='82' gradientUnits='userSpaceOnUse'>
          <stop offset='0' stopColor='#79F2C6' />
          <stop offset='1' stopColor='#E8FFF6' />
        </linearGradient>
      </defs>

      <rect x='14' y='14' width='228' height='228' rx='52' fill='url(#pcLogoBg)' />
      <rect x='28' y='26' width='200' height='200' rx='44' fill='url(#pcLogoEmerald)' />
      <path d='M67 47h117c19 0 34 15 34 34v98c0 19-15 34-34 34H72c-19 0-34-15-34-34V76c0-16 13-29 29-29Z' fill='#092B27' opacity='0.92' />
      <path d='M47 76c0-18 15-33 33-33h101c18 0 33 15 33 33v101c0 18-15 33-33 33H80c-18 0-33-15-33-33V76Z' fill='none' stroke='#E8E2C9' strokeWidth='5' />
      <path d='M58 177l24-26h22l28-35h24l32-36' fill='none' stroke='#061916' strokeWidth='15' strokeLinecap='round' strokeLinejoin='round' opacity='0.56' />
      <path d='M58 177l24-26h22l28-35h24l32-36' fill='none' stroke='url(#pcLogoMint)' strokeWidth='9' strokeLinecap='round' strokeLinejoin='round' />
      <path d='M78 72h78v28h-26v96h-31v-96H78V72Z' fill='url(#pcLogoGold)' />
      <path d='M150 72h28c22 0 39 16 39 38 0 23-17 39-40 39h-3v47h-24V72Zm24 25v28h6c8 0 14-6 14-14s-6-14-14-14h-6Z' fill='#F3E3A8' />
      <path d='M78 72h78v11H88c-6 0-10 4-10 10V72Z' fill='#FFF7D2' opacity='0.72' />
      <circle cx='188' cy='81' r='12' fill='#F7E8A8' stroke='#092B27' strokeWidth='5' />
      <path d='M51 190c11 13 28 21 47 21h84c17 0 31-8 39-20-10 22-32 37-58 37H92c-25 0-46-16-55-39 4 1 9 1 14 1Z' fill='#041D1A' opacity='0.25' />
    </svg>
  );
}

export function BrandMark({ size = 40, rounded = 14, shadow = true, style }: BrandMarkProps) {
  void rounded;
  void shadow;

  return (
    <span aria-hidden style={{ display: 'inline-flex', width: size, height: size, flexShrink: 0, ...style }}>
      <BrandMarkSvg size='100%' />
    </span>
  );
}
