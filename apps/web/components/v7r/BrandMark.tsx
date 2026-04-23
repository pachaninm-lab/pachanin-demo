import type { CSSProperties } from 'react';
import { BRAND_MARK_DATA_URI } from './brand-mark-data';

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
    background-position: center !important;
    background-repeat: no-repeat !important;
    background-size: contain !important;
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
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        width: dimension,
        height: dimension,
        flexShrink: 0,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '27%',
        background: 'transparent',
        padding: 0,
        margin: 0,
        lineHeight: 0,
      }}
    >
      <img
        src={BRAND_MARK_DATA_URI}
        alt=''
        draggable={false}
        loading='eager'
        decoding='async'
        style={{
          display: 'block',
          width: '155%',
          height: '155%',
          maxWidth: 'none',
          maxHeight: 'none',
          flex: '0 0 auto',
          objectFit: 'cover',
          objectPosition: '50% 46%',
          background: 'transparent',
          border: 0,
          padding: 0,
          margin: 0,
        }}
      />
    </span>
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
