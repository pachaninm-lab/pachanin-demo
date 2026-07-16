import type { MetadataRoute } from 'next';
import {
  PLATFORM_V7_PRIVATE_ROBOTS_PREFIXES,
  PLATFORM_V7_PUBLIC_SEO_PATHS,
} from '@/lib/platform-v7/public-seo-routes';

const siteUrl = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
'/',
...PLATFORM_V7_PUBLIC_SEO_PATHS,
'/robots.txt',
'/sitemap.xml',
'/indexnow.txt',
        ],
        disallow: [
'/api/',
'/admin/',
'/cabinet/',
...PLATFORM_V7_PRIVATE_ROBOTS_PREFIXES,
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
