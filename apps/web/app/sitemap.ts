import type { MetadataRoute } from 'next';

const siteUrl = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const lastModified = new Date();

const routes: Array<{ path: string; priority: number; changeFrequency: 'weekly' | 'monthly' }> = [
  { path: '/platform-v7', priority: 1, changeFrequency: 'weekly' },
  { path: '/platform-v7/demo', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/platform-v7/contact', priority: 0.85, changeFrequency: 'weekly' },
  { path: '/platform-v7/voprosy-otvety', priority: 0.85, changeFrequency: 'weekly' },
  { path: '/platform-v7/prodavtsam', priority: 0.78, changeFrequency: 'monthly' },
  { path: '/platform-v7/pokupatelyam', priority: 0.78, changeFrequency: 'monthly' },
  { path: '/platform-v7/bezopasnaya-sdelka', priority: 0.78, changeFrequency: 'monthly' },
  { path: '/platform-v7/fgis-zerno-i-dokumenty', priority: 0.72, changeFrequency: 'monthly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
