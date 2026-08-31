import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ name: 'Гекта — Аграрный интеллект', short_name: 'Гекта', description: 'Аграрный ИИ для сельского хозяйства и агробизнеса', start_url: '/gekta', scope: '/gekta', display: 'standalone', background_color: '#fcfbf7', theme_color: '#166534', icons: [{ src: '/gekta/icon', sizes: '64x64', type: 'image/png' }, { src: '/gekta/apple-icon', sizes: '180x180', type: 'image/png' }] }, { headers: { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
