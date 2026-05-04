export type PlatformV7QaPriority = 'P0' | 'P1' | 'P2';

export type PlatformV7ViewportKey =
  | 'android360'
  | 'iphoneSe375'
  | 'iphone14ProMax430'
  | 'ipad768'
  | 'ipadLandscape1024'
  | 'desktop1280'
  | 'desktop1366'
  | 'desktop1440'
  | 'desktop1728'
  | 'desktop1920'
  | 'desktop2560';

export const PLATFORM_V7_QA_VIEWPORTS: Readonly<Record<PlatformV7ViewportKey, { width: number; label: string }>> = {
  android360: { width: 360, label: 'Android compact / Chrome' },
  iphoneSe375: { width: 375, label: 'iPhone SE / Safari' },
  iphone14ProMax430: { width: 430, label: 'iPhone 14 Pro Max / Safari' },
  ipad768: { width: 768, label: 'iPad portrait' },
  ipadLandscape1024: { width: 1024, label: 'iPad landscape' },
  desktop1280: { width: 1280, label: 'Desktop 1280' },
  desktop1366: { width: 1366, label: 'Desktop 1366' },
  desktop1440: { width: 1440, label: 'Desktop 1440' },
  desktop1728: { width: 1728, label: 'Desktop 1728' },
  desktop1920: { width: 1920, label: 'Desktop 1920' },
  desktop2560: { width: 2560, label: 'Desktop 2560' },
} as const;

export type PlatformV7VisualQaRoute = {
  readonly path: string;
  readonly group: 'core' | 'extended' | 'system' | 'canonical';
  readonly priority: PlatformV7QaPriority;
  readonly expectedSurface: string;
  readonly mustAnswer: readonly string[];
};

export const PLATFORM_V7_VISUAL_QA_ROUTES: readonly PlatformV7VisualQaRoute[] = [
  {
    path: '/platform-v7',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'premium command center, not marketplace',
    mustAnswer: ['what happens now', 'deal spine', 'money', 'cargo', 'documents', 'blocker', 'next action'],
  },
  {
    path: '/platform-v7/seller',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'seller commercial execution',
    mustAnswer: ['my lot', 'accepted offer', 'why money is not released', 'documents', 'next owner', 'hidden buyer credit'],
  },
  {
    path: '/platform-v7/buyer',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'buyer commercial execution',
    mustAnswer: ['my bid', 'my reserve', 'my financing scenario', 'hidden closed bids', 'next action'],
  },
  {
    path: '/platform-v7/logistics',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'dispatch and route execution',
    mustAnswer: ['request after winner selection', 'vehicle', 'driver', 'ETA', 'transport documents', 'hidden grain price and bank'],
  },
  {
    path: '/platform-v7/logistics/inbox',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'logistics inbox',
    mustAnswer: ['new request', 'route', 'driver', 'ETA', 'next action', 'hidden bank reserve'],
  },
  {
    path: '/platform-v7/driver',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'mobile field app',
    mustAnswer: ['one trip', 'map', 'ETA', 'photo', 'seal', 'offline queue', 'hidden money'],
  },
  {
    path: '/platform-v7/elevator',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'receiving and weighing',
    mustAnswer: ['weight', 'quality', 'receiving act', 'deviation', 'payout impact', 'hidden bids and bank'],
  },
  {
    path: '/platform-v7/bank',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'bank money control',
    mustAnswer: ['reserve', 'release candidate', 'hold', 'blockers', 'documents', 'no fake payout'],
  },
  {
    path: '/platform-v7/documents',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'document release gate',
    mustAnswer: ['source', 'owner', 'status', 'signature', 'release impact', 'not just archive'],
  },
  {
    path: '/platform-v7/disputes',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'evidence and money impact',
    mustAnswer: ['reason', 'amount impact', 'SLA', 'evidence', 'owner', 'next action'],
  },
  {
    path: '/platform-v7/connectors',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'controlled-pilot connectors',
    mustAnswer: ['simulation-grade', 'access required', 'not live-integrated', 'affected screens', 'degraded state'],
  },
  {
    path: '/platform-v7/deals/DL-9106/clean',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'Deal 360 clean audit view',
    mustAnswer: ['money', 'cargo', 'documents', 'dispute', 'blocker', 'next owner'],
  },
  {
    path: '/platform-v7/lots/LOT-2403',
    group: 'core',
    priority: 'P0',
    expectedSurface: 'execution-ready lot detail',
    mustAnswer: ['lot passport', 'quality', 'documents', 'bid context', 'deal transition', 'not classified listing'],
  },
  {
    path: '/platform-v7/control-tower',
    group: 'extended',
    priority: 'P0',
    expectedSurface: 'operator command center',
    mustAnswer: ['blocker queue', 'money impact', 'SLA', 'owner', 'journal', 'no silent manual bypass'],
  },
  {
    path: '/platform-v7/lab',
    group: 'extended',
    priority: 'P1',
    expectedSurface: 'lab evidence surface',
    mustAnswer: ['sample', 'quality metrics', 'protocol', 'source', 'dispute impact', 'hidden price'],
  },
  {
    path: '/platform-v7/compliance',
    group: 'extended',
    priority: 'P1',
    expectedSurface: 'legal and access risk',
    mustAnswer: ['risk', 'document', 'basis', 'status', 'action', 'audit trail'],
  },
  {
    path: '/platform-v7/demo',
    group: 'system',
    priority: 'P0',
    expectedSurface: '3-minute guided execution route',
    mustAnswer: ['guided route', 'LOT-2403', 'DL-9106', 'reserve', 'trip', 'documents', 'money', 'dispute'],
  },
  {
    path: '/platform-v7/deploy-check',
    group: 'system',
    priority: 'P1',
    expectedSurface: 'service-only route',
    mustAnswer: ['not user-facing', 'internal check', 'return to platform'],
  },
];

export const PLATFORM_V7_VISUAL_QA_BLOCKERS = [
  'apps/landing changed',
  'production-ready or live-integrated claim appears without proof',
  'fake payout or release CTA appears without release conditions',
  'role sees forbidden money, bid, credit or bank data',
  'mobile horizontal scroll',
  'sticky element overlaps content or focus',
  'primary action smaller than 44px on touch routes',
  'table stays compressed desktop on mobile-critical routes',
  'catch-all masks an unknown broken route as valid product screen',
  'deploy-check appears as normal user product surface',
] as const;

export function getPlatformV7P0QaRoutes(): readonly PlatformV7VisualQaRoute[] {
  return PLATFORM_V7_VISUAL_QA_ROUTES.filter((route) => route.priority === 'P0');
}

export function getPlatformV7MobileCriticalRoutes(): readonly string[] {
  return PLATFORM_V7_VISUAL_QA_ROUTES
    .filter((route) => route.group === 'core' || route.path === '/platform-v7/demo')
    .map((route) => route.path);
}
