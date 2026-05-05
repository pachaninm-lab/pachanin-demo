export type PlatformV7RouteAuditStatus = 'current-smoke' | 'target-fast-pass' | 'known-gap';

export type PlatformV7RouteAuditItem = {
  route: string;
  surface: 'entry' | 'role' | 'ops' | 'money' | 'documents' | 'demo' | 'legacy';
  owner: 'seller' | 'buyer' | 'logistics' | 'driver' | 'elevator' | 'lab' | 'surveyor' | 'bank' | 'operator' | 'arbitrator' | 'compliance' | 'investor' | 'all';
  status: PlatformV7RouteAuditStatus;
  p0Smoke: boolean;
  notes?: string;
};

export const PLATFORM_V7_P0_SMOKE_ROUTES = [
  '/platform-v7',
  '/platform-v7/roles',
  '/platform-v7/seller',
  '/platform-v7/buyer',
  '/platform-v7/logistics',
  '/platform-v7/driver',
  '/platform-v7/driver/field',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/surveyor',
  '/platform-v7/bank',
  '/platform-v7/control-tower',
  '/platform-v7/disputes',
  '/platform-v7/compliance',
  '/platform-v7/arbitrator',
  '/platform-v7/investor',
  '/platform-v7/demo',
  '/platform-v7/support',
  '/platform-v7/support/new',
  '/platform-v7/support/operator',
] as const;

export const PLATFORM_V7_FAST_PASS_TARGET_ROUTES = [
  '/platform-v7',
  '/platform-v7/roles',
  '/platform-v7/seller',
  '/platform-v7/buyer',
  '/platform-v7/logistics',
  '/platform-v7/driver',
  '/platform-v7/driver/field',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/surveyor',
  '/platform-v7/bank',
  '/platform-v7/control-tower',
  '/platform-v7/disputes',
  '/platform-v7/compliance',
  '/platform-v7/arbitrator',
  '/platform-v7/investor',
  '/platform-v7/demo',
  '/platform-v7/connectors',
  '/platform-v7/documents',
  '/platform-v7/support',
  '/platform-v7/support/new',
  '/platform-v7/support/operator',
  '/platform-v7/support/SC-9103',
] as const;

export const PLATFORM_V7_FAST_PASS_ROUTE_AUDIT: readonly PlatformV7RouteAuditItem[] = [
  { route: '/platform-v7', surface: 'entry', owner: 'all', status: 'current-smoke', p0Smoke: true },
  { route: '/platform-v7/roles', surface: 'entry', owner: 'all', status: 'current-smoke', p0Smoke: true },
  { route: '/platform-v7/seller', surface: 'role', owner: 'seller', status: 'current-smoke', p0Smoke: true },
  { route: '/platform-v7/buyer', surface: 'role', owner: 'buyer', status: 'current-smoke', p0Smoke: true },
  { route: '/platform-v7/logistics', surface: 'role', owner: 'logistics', status: 'current-smoke', p0Smoke: true },
  { route: '/platform-v7/driver', surface: 'role', owner: 'driver', status: 'current-smoke', p0Smoke: true, notes: 'Compatibility route kept for existing links.' },
  { route: '/platform-v7/driver/field', surface: 'role', owner: 'driver', status: 'current-smoke', p0Smoke: true, notes: 'Focused field-shell route with mobile and leakage smoke coverage.' },
  { route: '/platform-v7/elevator', surface: 'role', owner: 'elevator', status: 'current-smoke', p0Smoke: true },
  { route: '/platform-v7/lab', surface: 'role', owner: 'lab', status: 'current-smoke', p0Smoke: true },
  { route: '/platform-v7/surveyor', surface: 'role', owner: 'surveyor', status: 'current-smoke', p0Smoke: true },
  { route: '/platform-v7/bank', surface: 'money', owner: 'bank', status: 'current-smoke', p0Smoke: true },
  { route: '/platform-v7/control-tower', surface: 'ops', owner: 'operator', status: 'current-smoke', p0Smoke: true },
  { route: '/platform-v7/disputes', surface: 'ops', owner: 'arbitrator', status: 'current-smoke', p0Smoke: true },
  { route: '/platform-v7/compliance', surface: 'ops', owner: 'compliance', status: 'current-smoke', p0Smoke: true },
  { route: '/platform-v7/arbitrator', surface: 'role', owner: 'arbitrator', status: 'current-smoke', p0Smoke: true },
  { route: '/platform-v7/investor', surface: 'demo', owner: 'investor', status: 'current-smoke', p0Smoke: true },
  { route: '/platform-v7/demo', surface: 'demo', owner: 'all', status: 'current-smoke', p0Smoke: true },
  { route: '/platform-v7/support', surface: 'ops', owner: 'all', status: 'current-smoke', p0Smoke: true },
  { route: '/platform-v7/support/new', surface: 'ops', owner: 'all', status: 'current-smoke', p0Smoke: true },
  { route: '/platform-v7/support/operator', surface: 'ops', owner: 'operator', status: 'current-smoke', p0Smoke: true },
  { route: '/platform-v7/support/SC-9103', surface: 'ops', owner: 'operator', status: 'target-fast-pass', p0Smoke: false },
  { route: '/platform-v7/connectors', surface: 'ops', owner: 'operator', status: 'target-fast-pass', p0Smoke: false },
  { route: '/platform-v7/documents', surface: 'documents', owner: 'all', status: 'target-fast-pass', p0Smoke: false },
] as const;

export function getPlatformV7P0SmokeRoutes(): readonly string[] {
  return PLATFORM_V7_FAST_PASS_ROUTE_AUDIT.filter((item) => item.p0Smoke).map((item) => item.route);
}

export function getPlatformV7KnownRouteGaps(): readonly PlatformV7RouteAuditItem[] {
  return PLATFORM_V7_FAST_PASS_ROUTE_AUDIT.filter((item) => item.status === 'known-gap');
}
