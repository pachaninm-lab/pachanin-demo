import type { MetadataRoute } from 'next';

const siteUrl = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const lastModified = new Date('2026-07-01T00:00:00.000Z');

const routes = [
  { path: '/platform-v7', priority: 1.0 },
  { path: '/platform-v7/secure-grain-deal', priority: 0.92 },
  { path: '/platform-v7/grain-logistics', priority: 0.88 },
  { path: '/platform-v7/grain-quality', priority: 0.88 },
  { path: '/platform-v7/grain-documents', priority: 0.88 },
  { path: '/platform-v7/grain-payment', priority: 0.86 },
  { path: '/platform-v7/fgis-zerno', priority: 0.84 },
  { path: '/platform-v7/about', priority: 0.85 },
  { path: '/platform-v7/demo', priority: 0.8 },
  { path: '/platform-v7/docs', priority: 0.8 },
  { path: '/platform-v7/contact', priority: 0.75 },
  { path: '/platform-v7/request', priority: 0.75 },
  { path: '/platform-v7/security', priority: 0.65 },
  { path: '/platform-v7/status', priority: 0.6 },
  { path: '/platform-v7/terms', priority: 0.45 },
  { path: '/platform-v7/privacy', priority: 0.45 },
  { path: '/platform-v7/oferta', priority: 0.45 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map(({ path, priority }) => ({
    url: `${siteUrl}${path}`,
    lastModified,
    changeFrequency: 'weekly',
    priority,
  }));
}
