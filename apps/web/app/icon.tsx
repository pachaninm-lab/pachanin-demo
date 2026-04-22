import { ImageResponse } from 'next/og';

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
          background: 'linear-gradient(135deg, #0A7A5F 0%, #21A038 100%)',
          color: '#ffffff',
          fontSize: 180,
          fontWeight: 800,
          borderRadius: 96,
        }}
      >
        ПЦ
      </div>
    ),
    size,
  );
}
