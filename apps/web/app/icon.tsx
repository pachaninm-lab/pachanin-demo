import { ImageResponse } from 'next/og';
import { BRAND_LOGO_DATA_URI } from '@/components/v7r/brand-logo-asset';

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
          background: '#F5F2EB',
        }}
      >
        <img
          src={BRAND_LOGO_DATA_URI}
          alt=''
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </div>
    ),
    size,
  );
}
