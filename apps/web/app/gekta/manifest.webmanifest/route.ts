import { NextResponse } from 'next/server';
import { GEKTA_PATHS, type GektaLocale } from '@/lib/gekta/content';
import { GEKTA_THEME_COLORS } from '@/lib/gekta/appearance';

const MANIFEST_COPY = {
  ru: { name: 'Гекта — аграрный ИИ', short_name: 'Гекта', lang: 'ru', description: 'Аграрные вопросы, расчёты и документы в одном диалоге.' },
  en: { name: 'Gekta — agricultural AI', short_name: 'Gekta', lang: 'en', description: 'Agricultural questions, calculations and documents in one chat.' },
  zh: { name: 'Gekta — 农业人工智能', short_name: 'Gekta', lang: 'zh-CN', description: '在一个对话中处理农业问题、计算与文档。' },
} as const;

export function GET(request: Request) {
  const language = new URL(request.url).searchParams.get('lang');
  const locale: GektaLocale = language === 'en' || language === 'zh' ? language : 'ru';
  return NextResponse.json({
    ...MANIFEST_COPY[locale],
    id: '/gekta',
    start_url: GEKTA_PATHS[locale],
    scope: '/gekta',
    display: 'standalone',
    background_color: GEKTA_THEME_COLORS.light,
    theme_color: GEKTA_THEME_COLORS.light,
    icons: [
      { src: '/gekta/icon', sizes: '192x192', type: 'image/png' },
      { src: '/gekta/app-icon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }, { headers: { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
