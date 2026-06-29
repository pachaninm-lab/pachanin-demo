import type { MetadataRoute } from 'next';

const siteUrl = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/platform-v7',
          '/platform-v7/demo',
          '/platform-v7/contact',
          '/platform-v7/voprosy-otvety',
          '/platform-v7/prodavtsam',
          '/platform-v7/pokupatelyam',
          '/platform-v7/bezopasnaya-sdelka',
          '/platform-v7/fgis-zerno-i-dokumenty',
        ],
        disallow: [
          '/api/',
          '/platform-v7/login',
          '/platform-v7/deals',
          '/platform-v7/operator',
          '/platform-v7/buyer',
          '/platform-v7/seller',
          '/platform-v7/logistics',
          '/platform-v7/driver',
          '/platform-v7/elevator',
          '/platform-v7/lab',
          '/platform-v7/surveyor',
          '/platform-v7/bank',
          '/platform-v7/arbitrator',
          '/platform-v7/compliance',
          '/platform-v7/executive',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
