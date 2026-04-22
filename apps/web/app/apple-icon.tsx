import { ImageResponse } from 'next/og';
import { BrandMarkSvg } from '@/components/v7r/BrandMark';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
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
          borderRadius: 40,
        }}
      >
        <BrandMarkSvg size={148} background='#0F5B4F' frame='#D9E5E0' accent='#7EF2C4' />
      </div>
    ),
    size,
  );
}
