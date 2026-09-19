import { PLATFORM_V7_LEXICON } from './lexicon';

export interface PlatformV7BreadcrumbItem {
  href: string;
  label: string;
  isLast: boolean;
}

const LABEL_BY_SEGMENT: Record<string, string> = {
  'platform-v7': PLATFORM_V7_LEXICON.breadcrumbs.platformV7,
  'control-tower': PLATFORM_V7_LEXICON.breadcrumbs.controlTower,
  deals: PLATFORM_V7_LEXICON.breadcrumbs.deals,
  lots: PLATFORM_V7_LEXICON.breadcrumbs.lots,
  create: PLATFORM_V7_LEXICON.breadcrumbs.create,
  buyer: PLATFORM_V7_LEXICON.breadcrumbs.buyer,
  seller: PLATFORM_V7_LEXICON.breadcrumbs.seller,
  logistics: PLATFORM_V7_LEXICON.breadcrumbs.logistics,
  field: PLATFORM_V7_LEXICON.breadcrumbs.field,
  bank: PLATFORM_V7_LEXICON.breadcrumbs.bank,
  disputes: PLATFORM_V7_LEXICON.breadcrumbs.disputes,
  compliance: PLATFORM_V7_LEXICON.breadcrumbs.compliance,
  analytics: PLATFORM_V7_LEXICON.breadcrumbs.analytics,
  executive: PLATFORM_V7_LEXICON.breadcrumbs.executive,
  procurement: PLATFORM_V7_LEXICON.breadcrumbs.procurement,
  driver: PLATFORM_V7_LEXICON.breadcrumbs.driver,
  surveyor: PLATFORM_V7_LEXICON.breadcrumbs.surveyor,
  elevator: PLATFORM_V7_LEXICON.breadcrumbs.elevator,
  lab: PLATFORM_V7_LEXICON.breadcrumbs.lab,
  arbitrator: PLATFORM_V7_LEXICON.breadcrumbs.arbitrator,
  connectors: PLATFORM_V7_LEXICON.breadcrumbs.connectors,
  investor: PLATFORM_V7_LEXICON.breadcrumbs.investor,
  demo: PLATFORM_V7_LEXICON.breadcrumbs.demo,
  market: PLATFORM_V7_LEXICON.breadcrumbs.market,
  notifications: PLATFORM_V7_LEXICON.breadcrumbs.notifications,
};

export function platformV7BreadcrumbSegmentLabel(segment: string): string {
  return LABEL_BY_SEGMENT[segment] ?? segment;
}

export function platformV7Breadcrumbs(pathname: string): PlatformV7BreadcrumbItem[] {
  const parts = pathname.split('?')[0]?.split('#')[0]?.split('/').filter(Boolean) ?? [];

  return parts.map((part, index) => ({
    href: `/${parts.slice(0, index + 1).join('/')}`,
    label: platformV7BreadcrumbSegmentLabel(part),
    isLast: index === parts.length - 1,
  }));
}

export function shouldShowPlatformV7Breadcrumbs(pathname: string): boolean {
  const crumbs = platformV7Breadcrumbs(pathname);
  return pathname !== '/platform-v7' && pathname !== '/platform-v7/roles' && crumbs.length > 1;
}
