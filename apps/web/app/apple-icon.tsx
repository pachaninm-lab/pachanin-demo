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
        }}
      >
        <div
          style={{
            width: 138,
            height: 138,
            borderRadius: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0A7A5F 0%, #0F4F43 100%)',
          }}
        >
          <div
            style={{
              width: 86,
              height: 86,
              borderRadius: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '7px solid rgba(255,255,255,0.92)',
              color: '#FFFFFF',
              fontSize: 32,
              fontWeight: 900,
              letterSpacing: '-0.08em',
            }}
          >
            ПЦ
          </div>
        </div>
      </div>
    ),
    size,
  );
}
