import { ImageResponse } from 'next/og';
import { GEKTA_BRAND, GektaGlyph } from './brand';

export function gektaAppIcon(width: number) {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', background: GEKTA_BRAND.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <GektaGlyph size={Math.round(width * 0.62)} />
    </div>,
    { width, height: width },
  );
}
