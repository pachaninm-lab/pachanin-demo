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
    <svg aria-hidden viewBox='0 0 256 256' width={dimension} height={dimension} style={{ display: 'block', flexShrink: 0 }} xmlns='http://www.w3.org/2000/svg'>
      <rect x='24' y='20' width='208' height='208' rx='40' fill='#0E6E60' />
      <rect x='42' y='38' width='172' height='172' rx='30' fill='#0B1917' stroke='#DDE3E0' strokeWidth='4' />
      <rect x='48' y='44' width='160' height='160' rx='26' fill='none' stroke='rgba(255,255,255,0.42)' strokeWidth='1.5' />
      <path d='M81 77h56v22h-34v92h-22V77Zm56 0h18v84l-18 16V77Z' fill='#F3F5F4' />
      <path d='M156 77h21v99h25v16h-46V77Z' fill='#98A09B' />
      <path d='M51 187l26-26h22l32-36h22l34-34' fill='none' stroke='rgba(6,17,15,0.72)' strokeWidth='12' strokeLinecap='round' strokeLinejoin='round' />
      <path d='M51 187l26-26h22l32-36h22l34-34' fill='none' stroke='#8EF4CF' strokeWidth='8' strokeLinecap='round' strokeLinejoin='round' />
      <circle cx='187' cy='91' r='11' fill='#9AF7D4' stroke='rgba(6,17,15,0.75)' strokeWidth='5' />
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
