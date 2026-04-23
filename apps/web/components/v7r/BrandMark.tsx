import type { CSSProperties } from 'react';

export const BRAND_MARK_ASSET_SRC = '/apple-icon';
export const BRAND_MARK_BG = '#F5F2EB';

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

function normalizeSize(size: number | string) {
  return typeof size === 'number' ? `${size}px` : size;
}

export function BrandMarkSvg({
  size = '100%',
  emerald = '#0E6E60',
  panel = '#0B1917',
  metalLight = '#F3F5F4',
  metalDark = '#98A09B',
  accent = '#8EF4CF',
}: BrandMarkSvgProps) {
  void emerald;
  void panel;
  void metalLight;
  void metalDark;
  void accent;

  const dimension = normalizeSize(size);

  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        width: dimension,
        height: dimension,
        flexShrink: 0,
      }}
    >
      <img
        src={BRAND_MARK_ASSET_SRC}
        alt=''
        draggable={false}
        loading='eager'
        decoding='async'
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          flexShrink: 0,
        }}
      />
    </span>
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
        ...style,
      }}
    >
      <BrandMarkSvg
        size='100%'
        emerald={emerald}
        panel={panel}
        metalLight={metalLight}
        metalDark={metalDark}
        accent={accent}
      />
    </span>
  );
}
