import type { MetadataRoute } from 'next';

const BASE = 'https://pachanin-web.vercel.app/platform-v7';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`,              lastModified: new Date(), changeFrequency: 'weekly',  priority: 1 },
    { url: `${BASE}/control-tower`, lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/deals`,         lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/lots`,          lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/executive`,     lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE}/investor`,      lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE}/disputes`,      lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${BASE}/logistics`,     lastModified: new Date(), changeFrequency: 'daily',   priority: 0.7 },
    { url: `${BASE}/connectors`,    lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${BASE}/buyer`,         lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE}/seller`,        lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE}/bank`,          lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${BASE}/lots/create`,   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];
}
