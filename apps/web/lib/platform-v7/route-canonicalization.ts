export const PLATFORM_V7_CANONICAL_ROUTES = {
  connectors: '/platform-v7/connectors',
  disputes: '/platform-v7/disputes',
  driverField: '/platform-v7/driver/field',
  lots: '/platform-v7/lots',
  controlTower: '/platform-v7/control-tower',
} as const;

export const PLATFORM_V7_ROUTE_ALIASES: Readonly<Record<string, string>> = {
  '/platform-v7/integrations': PLATFORM_V7_CANONICAL_ROUTES.connectors,
  '/platform-v7/marketplace': PLATFORM_V7_CANONICAL_ROUTES.lots,
  '/platform-v7/market': PLATFORM_V7_CANONICAL_ROUTES.lots,
  '/platform-v7/field': PLATFORM_V7_CANONICAL_ROUTES.driverField,
} as const;

export function canonicalizePlatformV7Route(pathname: string): string | undefined {
  if (pathname in PLATFORM_V7_ROUTE_ALIASES) return PLATFORM_V7_ROUTE_ALIASES[pathname];

  const singularDisputeMatch = pathname.match(/^\/platform-v7\/dispute\/([^/?#]+)$/);
  if (singularDisputeMatch?.[1]) return `${PLATFORM_V7_CANONICAL_ROUTES.disputes}/${singularDisputeMatch[1]}`;

  return undefined;
}

export function isPlatformV7KnownAlias(pathname: string): boolean {
  return canonicalizePlatformV7Route(pathname) !== undefined;
}
