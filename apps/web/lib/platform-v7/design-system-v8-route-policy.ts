const DESIGN_SYSTEM_V8_EXACT_ROUTES = new Set([
  '/platform-v7/control-tower',
  '/platform-v7/status',
  '/platform-v7/connectors',
  '/platform-v7/api-docs',
  '/platform-v7/profile',
  '/platform-v7/profile/team',
  '/platform-v7/reports',
  '/platform-v7/onboarding',
  '/platform-v7/operator',
  '/platform-v7/operator-cockpit/queues',
  '/platform-v7/buyer',
  '/platform-v7/buyer/financing',
  '/platform-v7/buyer/reputation',
  '/platform-v7/seller',
  '/platform-v7/seller/rfq',
  '/platform-v7/seller/reputation',
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
  '/platform-v7/buyer/rfq',
  '/platform-v7/bank',
] as const;

const LEGACY_ROUTE_ALIAS_EXACT = Object.freeze({
  '/platform-v7/access': '/platform-v7/onboarding',
  '/platform-v7/admin': '/platform-v7/control-tower',
  '/platform-v7/ai': '/platform-v7/deals?view=assistant',
  '/platform-v7/anti-bypass/grain': '/platform-v7/control-tower?view=anti-bypass',
  '/platform-v7/anti-bypass': '/platform-v7/control-tower?view=anti-bypass',
  '/platform-v7/assistant': '/platform-v7/deals?view=assistant',
  '/platform-v7/audit-log': '/platform-v7/control-tower?view=audit',
  '/platform-v7/companies': '/platform-v7/compliance?view=companies',
  '/platform-v7/control-tower/anti-bypass': '/platform-v7/control-tower?view=anti-bypass',
  '/platform-v7/control-tower/bypass-risk': '/platform-v7/control-tower?view=bypass-risk',
  '/platform-v7/control-tower/canonical-reconciliation': '/platform-v7/control-tower?view=reconciliation',
  '/platform-v7/control-tower/hotlist': '/platform-v7/control-tower?view=hotlist',
  '/platform-v7/data-room/grain': '/platform-v7/reports?view=data-room',
  '/platform-v7/data-room': '/platform-v7/reports?view=data-room',
  '/platform-v7/elevator/terminal': '/platform-v7/elevator',
  '/platform-v7/evidence-pack': '/platform-v7/documents?view=evidence',
  '/platform-v7/execution-map': '/platform-v7/control-tower?view=execution-map',
  '/platform-v7/fgis-zerno': '/platform-v7/fgis-access',
  '/platform-v7/grain-documents': '/platform-v7/documents',
  '/platform-v7/grain-logistics': '/platform-v7/deal-logistics',
  '/platform-v7/grain-payment': '/platform-v7/money',
  '/platform-v7/grain-quality': '/platform-v7/deal-acceptance',
  '/platform-v7/health': '/platform-v7/status',
  '/platform-v7/investor': '/platform-v7/reports?view=investor',
  '/platform-v7/logistics/drivers': '/platform-v7/logistics?view=drivers',
  '/platform-v7/logistics/inbox': '/platform-v7/logistics?view=inbox',
  '/platform-v7/notifications': '/platform-v7/profile?view=notifications',
  '/platform-v7/offer-log': '/platform-v7/auction?view=offer-log',
  '/platform-v7/offer-to-deal': '/platform-v7/auction/deal-basis',
  '/platform-v7/pilot-runbook': '/platform-v7/status',
  '/platform-v7/procurement': '/platform-v7/buyer/rfq',
  '/platform-v7/proposals': '/platform-v7/buyer/rfq',
  '/platform-v7/readiness': '/platform-v7/status',
  '/platform-v7/reports/esg': '/platform-v7/reports?view=esg',
  '/platform-v7/reports/regulator': '/platform-v7/reports?view=regulator',
  '/platform-v7/secure-grain-deal': '/platform-v7/deals',
  '/platform-v7/security/grain': '/platform-v7/profile?view=security',
  '/platform-v7/security': '/platform-v7/profile?view=security',
  '/platform-v7/simulator': '/platform-v7/demo',
  '/platform-v7/support/detail': '/platform-v7/request?source=support-detail',
  '/platform-v7/support/grain': '/platform-v7/request?source=grain-support',
  '/platform-v7/support/new': '/platform-v7/request?source=cabinet-support',
  '/platform-v7/support/operator': '/platform-v7/control-tower?view=support',
  '/platform-v7/support': '/platform-v7/request?source=cabinet-support',
  '/platform-v7/trust': '/platform-v7/compliance?view=trust',
} satisfies Record<string, string>);

const LEGACY_ROUTE_ALIAS_PATTERNS = [
  {
    inventoryRoute: '/platform-v7/auctions/[id]',
    pattern: /^\/platform-v7\/auctions\/([^/]+)$/,
    build: (match: RegExpMatchArray) => `/platform-v7/auction?auctionId=${encodeRouteParam(match[1] ?? '')}`,
  },
  {
    inventoryRoute: '/platform-v7/companies/[inn]',
    pattern: /^\/platform-v7\/companies\/([^/]+)$/,
    build: (match: RegExpMatchArray) => `/platform-v7/compliance?companyInn=${encodeRouteParam(match[1] ?? '')}`,
  },
  {
    inventoryRoute: '/platform-v7/counterparties/[counterpartyId]',
    pattern: /^\/platform-v7\/counterparties\/([^/]+)$/,
    build: (match: RegExpMatchArray) => `/platform-v7/compliance?counterpartyId=${encodeRouteParam(match[1] ?? '')}`,
  },
  {
    inventoryRoute: '/platform-v7/counterparty/[inn]',
    pattern: /^\/platform-v7\/counterparty\/([^/]+)$/,
    build: (match: RegExpMatchArray) => `/platform-v7/compliance?counterpartyInn=${encodeRouteParam(match[1] ?? '')}`,
  },
  {
    inventoryRoute: '/platform-v7/deal-drafts/[draftId]',
    pattern: /^\/platform-v7\/deal-drafts\/([^/]+)$/,
    build: (match: RegExpMatchArray) => `/platform-v7/auction/deal-basis?draftId=${encodeRouteParam(match[1] ?? '')}`,
  },
  {
    inventoryRoute: '/platform-v7/disputes/[id]/hold',
    pattern: /^\/platform-v7\/disputes\/([^/]+)\/hold$/,
    build: (match: RegExpMatchArray) => `/platform-v7/disputes?disputeId=${encodeRouteParam(match[1] ?? '')}&view=hold`,
  },
  {
    inventoryRoute: '/platform-v7/disputes/[id]',
    pattern: /^\/platform-v7\/disputes\/([^/]+)$/,
    build: (match: RegExpMatchArray) => `/platform-v7/disputes?disputeId=${encodeRouteParam(match[1] ?? '')}`,
  },
  {
    inventoryRoute: '/platform-v7/elevator/terminal/[operationId]',
    pattern: /^\/platform-v7\/elevator\/terminal\/([^/]+)$/,
    build: (match: RegExpMatchArray) => `/platform-v7/elevator?operationId=${encodeRouteParam(match[1] ?? '')}`,
  },
  {
    inventoryRoute: '/platform-v7/investor/deals/[dealId]',
    pattern: /^\/platform-v7\/investor\/deals\/([^/]+)$/,
    build: (match: RegExpMatchArray) => `/platform-v7/reports?view=investor&dealId=${encodeRouteParam(match[1] ?? '')}`,
  },
  {
    inventoryRoute: '/platform-v7/logistics/[routeId]',
    pattern: /^\/platform-v7\/logistics\/([^/]+)$/,
    build: (match: RegExpMatchArray) => `/platform-v7/deal-logistics?routeId=${encodeRouteParam(match[1] ?? '')}`,
  },
  {
    inventoryRoute: '/platform-v7/support/[caseId]',
    pattern: /^\/platform-v7\/support\/([^/]+)$/,
    build: (match: RegExpMatchArray) => `/platform-v7/request?caseId=${encodeRouteParam(match[1] ?? '')}`,
  },
  {
    inventoryRoute: '/platform-v7/surveyor/acts/[id]',
    pattern: /^\/platform-v7\/surveyor\/acts\/([^/]+)$/,
    build: (match: RegExpMatchArray) => `/platform-v7/surveyor?actId=${encodeRouteParam(match[1] ?? '')}`,
  },
] as const;

export const LEGACY_ROUTE_ALIAS_INVENTORY_ROUTES = [
  '/platform-v7/[...slug]',
  '/platform-v7/access',
  '/platform-v7/admin',
  '/platform-v7/ai',
  '/platform-v7/anti-bypass/grain',
  '/platform-v7/anti-bypass',
  '/platform-v7/assistant',
  '/platform-v7/audit-log',
  '/platform-v7/companies',
  '/platform-v7/control-tower/anti-bypass',
  '/platform-v7/control-tower/bypass-risk',
  '/platform-v7/control-tower/canonical-reconciliation',
  '/platform-v7/control-tower/hotlist',
  '/platform-v7/data-room/grain',
  '/platform-v7/data-room',
  '/platform-v7/elevator/terminal',
  '/platform-v7/evidence-pack',
  '/platform-v7/execution-map',
  '/platform-v7/fgis-zerno',
  '/platform-v7/grain-documents',
  '/platform-v7/grain-logistics',
  '/platform-v7/grain-payment',
  '/platform-v7/grain-quality',
  '/platform-v7/health',
  '/platform-v7/investor',
  '/platform-v7/logistics/drivers',
  '/platform-v7/logistics/inbox',
  '/platform-v7/notifications',
  '/platform-v7/offer-log',
  '/platform-v7/offer-to-deal',
  '/platform-v7/pilot-runbook',
  '/platform-v7/procurement',
  '/platform-v7/proposals',
  '/platform-v7/readiness',
  '/platform-v7/reports/esg',
  '/platform-v7/reports/regulator',
  '/platform-v7/secure-grain-deal',
  '/platform-v7/security/grain',
  '/platform-v7/security',
  '/platform-v7/simulator',
  '/platform-v7/support/detail',
  '/platform-v7/support/grain',
  '/platform-v7/support/new',
  '/platform-v7/support/operator',
  '/platform-v7/support',
  '/platform-v7/trust',
  '/platform-v7/auctions/[id]',
  '/platform-v7/companies/[inn]',
  '/platform-v7/counterparties/[counterpartyId]',
  '/platform-v7/counterparty/[inn]',
  '/platform-v7/deal-drafts/[draftId]',
  '/platform-v7/disputes/[id]/hold',
  '/platform-v7/disputes/[id]',
  '/platform-v7/elevator/terminal/[operationId]',
  '/platform-v7/investor/deals/[dealId]',
  '/platform-v7/logistics/[routeId]',
  '/platform-v7/support/[caseId]',
  '/platform-v7/surveyor/acts/[id]',
] as const;

function normalizePath(value: string | null | undefined): string {
  return (value || '').split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function encodeRouteParam(value: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(value));
  } catch {
    return encodeURIComponent(value);
  }
}

export function resolveLegacyRouteAlias(value: string | null | undefined): string | null {
  const pathname = normalizePath(value);
  const exactTarget = LEGACY_ROUTE_ALIAS_EXACT[pathname];
  if (exactTarget) return exactTarget;

  for (const alias of LEGACY_ROUTE_ALIAS_PATTERNS) {
    const match = pathname.match(alias.pattern);
    if (match) return alias.build(match);
  }

  return null;
}

export function isDesignSystemV8Route(value: string | null | undefined): boolean {
  const pathname = normalizePath(value);
  return DESIGN_SYSTEM_V8_EXACT_ROUTES.has(pathname)
    || DESIGN_SYSTEM_V8_PREFIX_ROUTES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export const DESIGN_SYSTEM_V8_ROUTE_POLICY = Object.freeze({
  exact: Object.freeze([...DESIGN_SYSTEM_V8_EXACT_ROUTES]),
  prefixes: Object.freeze([...DESIGN_SYSTEM_V8_PREFIX_ROUTES]),
  legacyAliases: Object.freeze([...LEGACY_ROUTE_ALIAS_INVENTORY_ROUTES]),
});
