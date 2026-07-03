import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vermillion-kitsune-0e7b97.netlify.app';

// Sitemap и robots.ts обязаны говорить одно и то же: раньше sitemap рекламировал
// /platform-v7/deals, /operator, /buyer и конкретные ID сделок, которые robots.ts
// одновременно запрещал (Disallow) — поисковик получал конфликтные сигналы, а
// внутренние кабинеты и ID сделок утекали в публичный файл. Здесь остаются только
// страницы, публичные и по robots.ts, и по middleware (PLATFORM_V7_PUBLIC_EXACT).
// Пока весь сайт под x-robots-tag: noindex (режим закрытого пилота), sitemap носит
// декларативный характер; при открытии индексации список расширять синхронно с robots.ts.
const PUBLIC_ROUTES: Array<{ url: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
  { url: '/platform-v7',          priority: 1.0, changeFrequency: 'weekly' },
  { url: '/platform-v7/help',     priority: 0.6, changeFrequency: 'monthly' },
  { url: '/platform-v7/pricing',  priority: 0.7, changeFrequency: 'monthly' },
  { url: '/platform-v7/roadmap',  priority: 0.5, changeFrequency: 'monthly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_ROUTES.map((r) => ({
    url: `${BASE_URL}${r.url}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
