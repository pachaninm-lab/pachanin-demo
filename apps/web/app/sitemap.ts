import type { MetadataRoute } from 'next';

const BASE = 'https://pachanin-web.vercel.app/platform-v7';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/control-tower`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/deals`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/lots`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/documents`, lastModified: now, changeFrequency: 'daily', priority: 0.85 },
    { url: `${BASE}/disputes`, lastModified: now, changeFrequency: 'daily', priority: 0.85 },
    { url: `${BASE}/companies`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/bank`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/executive`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/investor`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/logistics`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE}/buyer`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/seller`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/connectors`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/profile`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/docs`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/lots/create`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
