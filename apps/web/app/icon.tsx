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
        }}
      >
        <div
          style={{
            width: 392,
            height: 392,
            borderRadius: 96,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0A7A5F 0%, #0F4F43 100%)',
            boxShadow: '0 36px 90px rgba(10, 122, 95, 0.28)',
          }}
        >
          <div
            style={{
              width: 236,
              height: 236,
              borderRadius: 72,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '18px solid rgba(255,255,255,0.92)',
              color: '#FFFFFF',
              fontSize: 88,
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
