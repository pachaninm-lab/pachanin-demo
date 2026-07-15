import type { CSSProperties } from 'react';
import ApprovedHeaderLogo from './ApprovedHeaderLogo';

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

const APPROVED_MARK_STYLES = `
.pc-approved-brand-mark > .brand-logo-mark {
  display: inline-flex !important;
  width: 100% !important;
  height: 100% !important;
  flex: 0 0 100% !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: visible !important;
  line-height: 0 !important;
  background: transparent !important;
  padding: 0 !important;
  margin: 0 !important;
}
.pc-approved-brand-mark > .brand-logo-mark > .header-logo-image {
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  object-fit: contain !important;
  object-position: center !important;
  background: transparent !important;
  border: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
}
`;

export const BRAND_MARK_BG = 'transparent';

export function BrandMarkSvg({ size = '100%' }: BrandMarkSvgProps) {
  const dimension = normalizeSize(size);

  return (
    <>
      <style>{APPROVED_MARK_STYLES}</style>
      <span
        aria-hidden
        className='pc-approved-brand-mark'
        data-approved-brand-mark='owner-reference-203159d'
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
        <ApprovedHeaderLogo />
      </span>
    </>
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
      <BrandMarkSvg size='100%' />
    </span>
  );
}
