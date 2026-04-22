import { ImageResponse } from 'next/og';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          background: 'linear-gradient(135deg, #0A7A5F 0%, #0F1419 100%)',
          color: '#ffffff',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: 24, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800 }}>
            ПЦ
          </div>
          <div style={{ fontSize: 30, fontWeight: 700 }}>Прозрачная Цена</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 900 }}>
          <div style={{ fontSize: 64, lineHeight: 1.05, fontWeight: 800 }}>
            Цифровой контур исполнения зерновой сделки
          </div>
          <div style={{ fontSize: 28, lineHeight: 1.35, color: 'rgba(255,255,255,0.88)' }}>
            Цена, сделка, логистика, приёмка, документы, деньги и спор в одной системе.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
