import { ImageResponse } from 'next/og';
import type { GektaLocale } from '@/lib/gekta/content';
import { GEKTA_BRAND, GektaGlyph } from '@/lib/gekta/brand';

const COPY = {
  ru: { name: 'Гекта', line: 'Аграрный ИИ для хозяйства', details: 'Агрономия, экономика и документы', maker: 'От «Прозрачной Цены»' },
  en: { name: 'Gekta', line: 'AI for your farm', details: 'Agronomy, farm economics and documents', maker: 'By Prozrachnaya Tsena' },
  zh: { name: 'Gekta', line: '面向农业生产的 AI', details: '农艺、经营与文档', maker: '出自“透明价格”' },
} as const;

export function gektaOpenGraph(locale: GektaLocale) {
  const copy = COPY[locale];
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', flexDirection: 'column', justifyContent: 'space-between', background: GEKTA_BRAND.background, color: GEKTA_BRAND.ink, padding: '67px 78px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', position: 'absolute', right: -55, bottom: -116, opacity: 0.18 }}><GektaGlyph size={500} /></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 62, height: 62, borderRadius: 18, background: '#305940' }}><GektaGlyph size={41} /></div>
        <div style={{ fontSize: 34, fontWeight: 750 }}>{copy.name}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 765 }}>
        <div style={{ fontSize: 76, lineHeight: 1.08, letterSpacing: -2, fontWeight: 750 }}>{copy.line}</div>
        <div style={{ marginTop: 20, fontSize: 33, color: '#c7dbbc' }}>{copy.details}</div>
      </div>
      <div style={{ fontSize: 22, color: '#c7dbbc' }}>{copy.maker}</div>
    </div>,
    { width: 1200, height: 630 }
  );
}
