import { ImageResponse } from 'next/og';
import { BrandMarkSvg } from '@/components/v7r/BrandMark';

export const size = {
  width: 512,
  height: 512,
};

export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B1513',
        }}
      >
        <BrandMarkSvg size={420} background='#0F5B4F' frame='#D9E5E0' accent='#7EF2C4' />
      </div>
    ),
    size,
  );
}
