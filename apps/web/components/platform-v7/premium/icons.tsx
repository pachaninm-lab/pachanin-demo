import type { ReactNode } from 'react';

// Self-contained inline SVG glyph set so the premium primitives stay portable
// and test-friendly (no external icon runtime dependency).
export type PremiumGlyph =
  | 'bag'
  | 'truck'
  | 'shield-check'
  | 'alert'
  | 'doc'
  | 'scale'
  | 'coins'
  | 'flask'
  | 'route'
  | 'camera'
  | 'clock'
  | 'users'
  | 'gauge';

const COMMON = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function PremiumIcon({ glyph }: { glyph: PremiumGlyph }): ReactNode {
  switch (glyph) {
    case 'bag':
      return (
        <svg {...COMMON}>
          <path d='M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z' />
          <path d='M3 6h18M16 10a4 4 0 0 1-8 0' />
        </svg>
      );
    case 'truck':
      return (
        <svg {...COMMON}>
          <path d='M1 3h15v13H1zM16 8h4l3 3v5h-7' />
          <circle cx='5.5' cy='18.5' r='2.5' />
          <circle cx='18.5' cy='18.5' r='2.5' />
        </svg>
      );
    case 'shield-check':
      return (
        <svg {...COMMON}>
          <path d='M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5Z' />
          <path d='m9 12 2 2 4-4' />
        </svg>
      );
    case 'alert':
      return (
        <svg {...COMMON}>
          <path d='M12 3 2 20h20Z' />
          <path d='M12 9v5M12 17h.01' />
        </svg>
      );
    case 'doc':
      return (
        <svg {...COMMON}>
          <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z' />
          <path d='M14 2v6h6M8 13h8M8 17h6' />
        </svg>
      );
    case 'scale':
      return (
        <svg {...COMMON}>
          <path d='M12 3v18M5 21h14M7 7h10M7 7 4 14h6ZM17 7l-3 7h6Z' />
        </svg>
      );
    case 'coins':
      return (
        <svg {...COMMON}>
          <circle cx='9' cy='9' r='6' />
          <path d='M15.5 4.5a6 6 0 0 1 0 15M9 6v6l3 2' />
        </svg>
      );
    case 'flask':
      return (
        <svg {...COMMON}>
          <path d='M9 2h6M10 2v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V2' />
          <path d='M7 15h10' />
        </svg>
      );
    case 'route':
      return (
        <svg {...COMMON}>
          <circle cx='6' cy='19' r='3' />
          <circle cx='18' cy='5' r='3' />
          <path d='M9 19h6a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h3' />
        </svg>
      );
    case 'camera':
      return (
        <svg {...COMMON}>
          <path d='M3 7h4l2-3h6l2 3h4v13H3Z' />
          <circle cx='12' cy='13' r='4' />
        </svg>
      );
    case 'clock':
      return (
        <svg {...COMMON}>
          <circle cx='12' cy='12' r='9' />
          <path d='M12 7v5l3 2' />
        </svg>
      );
    case 'users':
      return (
        <svg {...COMMON}>
          <path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
          <circle cx='9' cy='7' r='4' />
          <path d='M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11' />
        </svg>
      );
    case 'gauge':
      return (
        <svg {...COMMON}>
          <path d='M12 14 16 9M3.5 19a9 9 0 1 1 17 0Z' />
        </svg>
      );
    default:
      return null;
  }
}
