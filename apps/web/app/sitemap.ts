import type { MetadataRoute } from 'next';
import publicSeoRouteRegistry from '@/lib/platform-v7/public-seo-routes.json';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://xn----8sbjf4befbjgs9b.xn--p1ai';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return publicSeoRouteRegistry.routes.map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency as MetadataRoute.Sitemap[number]['changeFrequency'],
    priority: route.priority,
  }));
}
