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

export function BrandMarkSvg({ size = '100%' }: BrandMarkSvgProps) {
  const dimension = normalizeSize(size);

  return (
    <span
      aria-hidden
      style={{
        display: 'block',
        width: dimension,
        height: dimension,
        flexShrink: 0,
        overflow: 'hidden',
        borderRadius: '27%',
        backgroundColor: 'transparent',
        backgroundImage: `url(${BRAND_MARK_DATA_URI})`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: '50% 46%',
        backgroundSize: '155% 155%',
        lineHeight: 0,
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
        overflow: 'hidden',
        borderRadius: '27%',
        background: 'transparent',
        padding: 0,
        margin: 0,
        boxShadow: 'none',
        ...style,
      }}
    >
      <BrandMarkSvg size='100%' />
    </span>
  );
}
