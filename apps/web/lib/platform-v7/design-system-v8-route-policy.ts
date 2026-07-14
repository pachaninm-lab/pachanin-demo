const DESIGN_SYSTEM_V8_EXACT_ROUTES = new Set([
  '/platform-v7/control-tower',
  '/platform-v7/status',
  '/platform-v7/connectors',
  '/platform-v7/profile',
  '/platform-v7/reports',
  '/platform-v7/operator',
  '/platform-v7/buyer',
  '/platform-v7/seller',
  '/platform-v7/logistics',
  '/platform-v7/driver',
  '/platform-v7/driver/field',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/surveyor',
  '/platform-v7/bank',
  '/platform-v7/compliance',
  '/platform-v7/arbitrator',
  '/platform-v7/executive',
  '/platform-v7/deals',
  '/platform-v7/documents',
  '/platform-v7/disputes',
  '/platform-v7/money',
  '/platform-v7/bank/release-safety',
  '/platform-v7/fgis-access',
  '/platform-v7/deal-logistics',
  '/platform-v7/deal-acceptance',
  '/platform-v7/deal-documents-basis',
]);

const DESIGN_SYSTEM_V8_PREFIX_ROUTES = [
  '/platform-v7/deals/',
  '/platform-v7/auction',
] as const;

function normalizePath(value: string | null | undefined): string {
  return (value || '').split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

export function isDesignSystemV8Route(value: string | null | undefined): boolean {
  const pathname = normalizePath(value);
  return DESIGN_SYSTEM_V8_EXACT_ROUTES.has(pathname)
    || DESIGN_SYSTEM_V8_PREFIX_ROUTES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export const DESIGN_SYSTEM_V8_ROUTE_POLICY = Object.freeze({
  exact: Object.freeze([...DESIGN_SYSTEM_V8_EXACT_ROUTES]),
  prefixes: Object.freeze([...DESIGN_SYSTEM_V8_PREFIX_ROUTES]),
});
