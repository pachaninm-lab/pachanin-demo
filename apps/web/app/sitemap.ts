import type { MetadataRoute } from 'next';
import { PLATFORM_V7_PUBLIC_SEO_ROUTES } from '@/lib/platform-v7/public-seo-routes';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://xn----8sbjf4befbjgs9b.xn--p1ai';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return PLATFORM_V7_PUBLIC_SEO_ROUTES.map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
