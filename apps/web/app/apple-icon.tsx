import { ImageResponse } from 'next/og';
import { BrandMarkSvg, BRAND_MARK_BG } from '@/components/v7r/BrandMark';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: BRAND_MARK_BG,
        }}
      >
        <BrandMarkSvg size='100%' />
      </div>
    ),
    size,
  );
}
