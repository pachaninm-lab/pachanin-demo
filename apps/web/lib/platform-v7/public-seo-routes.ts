export type PlatformV7SeoChangeFrequency = 'daily' | 'weekly' | 'monthly';

export type PlatformV7PublicSeoRoute = Readonly<{
  path: string;
  priority: number;
  changeFrequency: PlatformV7SeoChangeFrequency;
}>;

/**
 * Canonical authority for platform-v7 pages that are intentionally public and
 * indexable. Middleware, robots, sitemap and live evidence must consume this
 * list instead of maintaining independent route inventories.
 */
export const PLATFORM_V7_PUBLIC_SEO_ROUTES = [
  { path: '/platform-v7', priority: 1, changeFrequency: 'daily' },
  { path: '/platform-v7/how-it-works', priority: 0.95, changeFrequency: 'weekly' },
  { path: '/platform-v7/secure-grain-deal', priority: 0.95, changeFrequency: 'daily' },
  { path: '/platform-v7/grain-logistics', priority: 0.85, changeFrequency: 'daily' },
  { path: '/platform-v7/grain-quality', priority: 0.85, changeFrequency: 'daily' },
  { path: '/platform-v7/grain-documents', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/platform-v7/grain-payment', priority: 0.85, changeFrequency: 'daily' },
  { path: '/platform-v7/fgis-zerno', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/platform-v7/about', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/platform-v7/demo', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/platform-v7/docs', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/platform-v7/contact', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/platform-v7/request', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/platform-v7/security', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/platform-v7/status', priority: 0.6, changeFrequency: 'daily' },
  { path: '/platform-v7/terms', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/platform-v7/privacy', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/platform-v7/oferta', priority: 0.4, changeFrequency: 'monthly' },
] as const satisfies readonly PlatformV7PublicSeoRoute[];

export const PLATFORM_V7_PUBLIC_SEO_PATHS = PLATFORM_V7_PUBLIC_SEO_ROUTES.map((route) => route.path);

/** Protected transaction and role workspaces must never enter robots or sitemap. */
export const PLATFORM_V7_PRIVATE_ROBOTS_PREFIXES = [
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
] as const;
