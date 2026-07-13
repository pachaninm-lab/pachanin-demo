const DESIGN_SYSTEM_V8_EXACT_ROUTES: ReadonlySet<string> = new Set([
  '/platform-v7/control-tower',
  '/platform-v7/operator',
  '/platform-v7/buyer',
  '/platform-v7/seller',
  '/platform-v7/logistics',
  '/platform-v7/driver',
  '/platform-v7/driver/field',
  '/platform-v7/surveyor',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/bank',
  '/platform-v7/compliance',
  '/platform-v7/arbitrator',
  '/platform-v7/executive',
  '/platform-v7/deals',
  '/platform-v7/documents',
  '/platform-v7/disputes',
  '/platform-v7/bank/release-safety',
  '/platform-v7/money',
  '/platform-v7/auction',
  '/platform-v7/auction/import',
  '/platform-v7/auction/admission',
  '/platform-v7/auction/bids',
  '/platform-v7/auction/deal-basis',
  '/platform-v7/deal-logistics',
  '/platform-v7/deal-acceptance',
  '/platform-v7/deal-documents-basis',
]);

const CANONICAL_DEAL_EXECUTION_ROUTE = /^\/platform-v7\/deals\/[^/]+\/execution$/;

export function normalizePlatformV7Path(value: string | null | undefined): string {
  return (value || '')
    .split('?')[0]
    .replace(/\/+$/, '') || '/platform-v7';
}

/**
 * Returns true only for routes that have completed the route-scoped Design System
 * v8 acceptance contract. Historical and partially migrated routes deliberately
 * stay outside this list until their own evidence is registered.
 */
export function isDesignSystemV8Route(value: string | null | undefined): boolean {
  const pathname = normalizePlatformV7Path(value);
  return DESIGN_SYSTEM_V8_EXACT_ROUTES.has(pathname)
    || CANONICAL_DEAL_EXECUTION_ROUTE.test(pathname);
}

export const designSystemV8ExactRoutes = Object.freeze([...DESIGN_SYSTEM_V8_EXACT_ROUTES]);
