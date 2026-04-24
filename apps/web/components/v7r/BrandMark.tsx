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

const BRAND_LOGO_DATA_URI = 'data:image/webp;base64,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';

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
        overflow: 'visible',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        padding: 0,
        margin: 0,
        lineHeight: 0,
      }}
    >
      <img
        src={BRAND_LOGO_DATA_URI}
        alt=''
        draggable={false}
        loading='eager'
        decoding='async'
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          maxWidth: 'none',
          maxHeight: 'none',
          flex: '0 0 auto',
          objectFit: 'contain',
          objectPosition: 'center',
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
        overflow: 'visible',
        alignItems: 'center',
        justifyContent: 'center',
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
