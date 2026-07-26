import type { MetadataRoute } from 'next';

const siteUrl = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';

const privateRoutes = [
  '/api/',
  '/admin/',
  '/cabinet/',
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
  '/platform-v7/control-tower',
  '/platform-v7/procurement',
  '/platform-v7/lots',
  '/platform-v7/connectors',
  '/platform-v7/analytics',
  '/platform-v7/disputes',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: privateRoutes,
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
