import type { CSSProperties } from 'react';

interface BrandMarkSvgProps {
  size?: number | string;
  emerald?: string;
  panel?: string;
  metalLight?: string;
  metalDark?: string;
  accent?: string;
}

interface BrandMarkProps extends BrandMarkSvgProps {
  rounded?: number;
  shadow?: boolean;
  style?: CSSProperties;
}

export function BrandMarkSvg({
  size = '100%',
  emerald = '#0E6E60',
  panel = '#0B1917',
  metalLight = '#F3F5F4',
  metalDark = '#98A09B',
  accent = '#8EF4CF',
}: BrandMarkSvgProps) {
  return (
    <svg viewBox='0 0 1024 1024' width={size} height={size} fill='none' xmlns='http://www.w3.org/2000/svg'>
      <defs>
        <linearGradient id='pc-outer' x1='112' y1='96' x2='910' y2='922' gradientUnits='userSpaceOnUse'>
          <stop stopColor='#0F8170' />
          <stop offset='0.52' stopColor={emerald} />
          <stop offset='1' stopColor='#0A5448' />
        </linearGradient>
        <linearGradient id='pc-panel' x1='248' y1='202' x2='770' y2='816' gradientUnits='userSpaceOnUse'>
          <stop stopColor='#14332E' />
          <stop offset='0.48' stopColor={panel} />
          <stop offset='1' stopColor='#071110' />
        </linearGradient>
        <linearGradient id='pc-gloss' x1='260' y1='170' x2='260' y2='446' gradientUnits='userSpaceOnUse'>
          <stop stopColor='rgba(255,255,255,0.34)' />
          <stop offset='1' stopColor='rgba(255,255,255,0)' />
        </linearGradient>
        <linearGradient id='pc-metal-light' x1='280' y1='252' x2='560' y2='760' gradientUnits='userSpaceOnUse'>
          <stop stopColor='#FFFFFF' />
          <stop offset='1' stopColor={metalLight} />
        </linearGradient>
        <linearGradient id='pc-metal-dark' x1='594' y1='240' x2='790' y2='774' gradientUnits='userSpaceOnUse'>
          <stop stopColor='#B7BDB9' />
          <stop offset='1' stopColor={metalDark} />
        </linearGradient>
        <filter id='pc-shadow' x='120' y='120' width='820' height='840' filterUnits='userSpaceOnUse' colorInterpolationFilters='sRGB'>
          <feDropShadow dx='0' dy='22' stdDeviation='26' floodColor='rgba(2,8,7,0.34)' />
        </filter>
        <filter id='pc-accent-shadow' x='210' y='398' width='624' height='364' filterUnits='userSpaceOnUse' colorInterpolationFilters='sRGB'>
          <feDropShadow dx='0' dy='0' stdDeviation='10' floodColor='rgba(142,244,207,0.30)' />
        </filter>
      </defs>

      <rect x='92' y='92' width='840' height='840' rx='214' fill='url(#pc-outer)' />
      <rect x='130' y='130' width='764' height='764' rx='188' stroke='rgba(255,255,255,0.08)' strokeWidth='10' />

      <g filter='url(#pc-shadow)'>
        <rect x='188' y='176' width='648' height='672' rx='144' fill='url(#pc-panel)' />
        <rect x='188' y='176' width='648' height='672' rx='144' stroke='rgba(245,248,246,0.72)' strokeWidth='14' />
        <rect x='206' y='194' width='612' height='636' rx='126' stroke='rgba(255,255,255,0.24)' strokeWidth='8' />
        <path d='M246 214H778C762 314 690 364 594 364H246V214Z' fill='url(#pc-gloss)' opacity='0.88' />
      </g>

      <path
        d='M314 684V314H556V404H412V684H314ZM556 314V594L480 670V314H556Z'
        fill='url(#pc-metal-light)'
      />
      <path
        d='M572 314H712V642H804V726H572V314Z'
        fill='url(#pc-metal-dark)'
      />

      <g filter='url(#pc-accent-shadow)'>
        <path
          d='M240 742H382C404 742 424 732 438 716L516 628C526 618 540 612 554 612H612C634 612 654 602 668 586L760 486'
          stroke={accent}
          strokeWidth='26'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </g>

      <circle cx='760' cy='486' r='46' fill={panel} stroke='rgba(255,255,255,0.18)' strokeWidth='10' />
      <circle cx='760' cy='486' r='28' fill={accent} />
    </svg>
  );
}

export function BrandMark({
  size = 40,
  rounded = 14,
  shadow = true,
  emerald = '#0E6E60',
  panel = '#0B1917',
  metalLight = '#F3F5F4',
  metalDark = '#98A09B',
  accent = '#8EF4CF',
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
        boxShadow: shadow ? '0 16px 30px rgba(7, 16, 13, 0.24)' : 'none',
        flexShrink: 0,
        ...style,
      }}
    >
      <BrandMarkSvg emerald={emerald} panel={panel} metalLight={metalLight} metalDark={metalDark} accent={accent} />
    </span>
  );
}
