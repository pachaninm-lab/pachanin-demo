import { ImageResponse } from 'next/og';
import type { GektaLocale } from '@/lib/gekta/content';

const COPY = {
  ru: { name: 'ГЕКТА', descriptor: 'Аграрный интеллект', line: 'ИИ для сельского хозяйства и агробизнеса', maker: 'Создано «Прозрачной Ценой»' },
  en: { name: 'GEKTA', descriptor: 'Agricultural intelligence', line: 'AI for farming and agribusiness', maker: 'Created by Prozrachnaya Tsena' },
  zh: { name: 'GEKTA', descriptor: '农业智能', line: '面向农业生产与农业经营的 AI', maker: '由“透明价格”创建' },
} as const;

export function gektaOpenGraph(locale: GektaLocale) {
  const copy = COPY[locale];
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#f5f2e8', color: '#0f172a', padding: '72px 82px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}><div style={{ width: 54, height: 54, borderRadius: 16, background: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 27 }}>G</div><div style={{ fontSize: 24, letterSpacing: 4, fontWeight: 800 }}>{copy.name}</div></div>
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 930 }}><div style={{ fontSize: 28, color: '#166534', fontWeight: 700 }}>{copy.descriptor}</div><div style={{ marginTop: 18, fontSize: 62, lineHeight: 1.05, letterSpacing: -2.5, fontWeight: 750 }}>{copy.line}</div></div>
      <div style={{ fontSize: 22, color: '#64748b' }}>{copy.maker}</div>
    </div>,
    { width: 1200, height: 630 }
  );
}
