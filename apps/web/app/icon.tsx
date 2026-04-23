import { ImageResponse } from 'next/og';
import { BrandMarkSvg, BRAND_MARK_BG } from '@/components/v7r/BrandMark';

export const size = {
  width: 512,
  height: 512,
};

export const contentType = 'image/png';

export default async function Icon() {
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
