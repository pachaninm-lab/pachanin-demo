import type { CSSProperties } from 'react';
import { BRAND_MARK_BG as BRAND_MARK_BG_VALUE, BRAND_MARK_DATA_URI } from './brand-mark-data';

export const BRAND_MARK_BG = BRAND_MARK_BG_VALUE;

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
    <img
      aria-hidden
      src={BRAND_MARK_DATA_URI}
      alt=''
      draggable={false}
      loading='eager'
      decoding='async'
      style={{
        display: 'block',
        width: dimension,
        height: dimension,
        objectFit: 'contain',
        flexShrink: 0,
      }}
    />
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
        background: BRAND_MARK_BG,
        ...style,
      }}
    >
      <BrandMarkSvg size='100%' />
    </span>
  );
}
