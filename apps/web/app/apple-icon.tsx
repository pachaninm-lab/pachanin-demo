import { ImageResponse } from 'next/og';

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
          background: '#F5F2EB',
          color: '#0A7A5F',
          fontSize: 54,
          fontWeight: 900,
          letterSpacing: -4,
        }}
      >
        ПЦ
      </div>
    ),
    size,
  );
}
