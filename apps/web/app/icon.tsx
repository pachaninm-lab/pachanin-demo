import { ImageResponse } from 'next/og';

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
          color: '#0A7A5F',
          fontSize: 156,
          fontWeight: 900,
          letterSpacing: -12,
        }}
      >
        ПЦ
      </div>
    ),
    size,
  );
}
