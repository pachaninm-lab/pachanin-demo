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
        <BrandMarkSvg
          size={420}
          emerald='#0F5B4F'
          panel='#0B1917'
          metalLight='#F3F5F4'
          metalDark='#98A09B'
          accent='#7EF2C4'
        />
      </div>
    ),
    size,
  );
}
