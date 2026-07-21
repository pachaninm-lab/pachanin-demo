import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { canRoleAccessCabinet } from '@/lib/platform-v7/cabinet-access-policy';
import { isDesignSystemV8Route } from '@/lib/platform-v7/design-system-v8-route-policy';
import { platformV7RoleRoute } from '@/lib/platform-v7/shellRoutes';
import {
  readVerifiedCabinetRole,
  readVerifiedCabinetSessionRole,
} from '@/lib/platform-v7/verified-session';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

export const metadata: Metadata = {
  title: { default: 'Прозрачная Цена', template: '%s · Прозрачная Цена' },
  description: 'Цифровой контур исполнения зерновой сделки: допуск, логистика, приёмка, качество, документы, расчёты, спор и доказательства.',
  keywords: ['зерно', 'агроторговля', 'элеватор', 'логистика зерна', 'сделка', 'документы', 'расчёты'],
  creator: 'Прозрачная Цена',
  robots: { index: false, follow: false },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: 'Прозрачная Цена',
    title: 'Прозрачная Цена — контур исполнения зерновой сделки',
    description: 'Логистика, приёмка, качество, документы, расчёты, спор и доказательства в одном проверяемом процессе.',
  },
  metadataBase: new URL('https://xn----8sbjf4befbjgs9b.xn--p1ai'),
};

const LANDING_PATH = '/platform-v7';
const STAFF_PREFIX = '/platform-v7/staff';
const CABINET_SESSION_COOKIE = 'pc_v7_cabinet';
const AUTH_PATHS = new Set([
  '/platform-v7/login',
  '/platform-v7/forgot-password',
]);
const PUBLIC_EXACT_PATHS = new Set([
  LANDING_PATH,
  ...AUTH_PATHS,
  '/platform-v7/open',
  '/platform-v7/register',
  '/platform-v7/help',
  '/platform-v7/pricing',
  '/platform-v7/roadmap',
  '/platform-v7/deal-flow',
  '/platform-v7/how-it-works',
  '/platform-v7/ai-in-action',
  '/platform-v7/demo',
  '/platform-v7/contact',
  '/platform-v7/request',
  '/platform-v7/docs',
  '/platform-v7/about',
  '/platform-v7/oferta',
  '/platform-v7/privacy',
  '/platform-v7/roles',
  '/platform-v7/terms',
  '/platform-v7/secure-grain-deal',
  '/platform-v7/grain-logistics',
  '/platform-v7/grain-quality',
  '/platform-v7/grain-documents',
  '/platform-v7/grain-payment',
  '/platform-v7/fgis-zerno',
]);
const PUBLIC_PREFIX_PATHS = [
  '/platform-v7/role-preview',
  '/platform-v7/demo',
];

// Server redirects remain valid compatibility entrypoints, but no arbitrary URL
// may reach authentication or disclose a role-specific shell before Next.js 404.
const ALIAS_EXACT_PATHS = new Set([
  '/platform-v7/access',
  '/platform-v7/admin',
  '/platform-v7/ai',
  '/platform-v7/analytics',
  '/platform-v7/anti-bypass/grain',
  '/platform-v7/anti-bypass',
  '/platform-v7/arbitrator/grain',
  '/platform-v7/assistant',
  '/platform-v7/auth',
  '/platform-v7/bank/clean',
  '/platform-v7/bank/escrow',
  '/platform-v7/bank/events',
  '/platform-v7/bank/grain',
  '/platform-v7/bank/payment-basis',
  '/platform-v7/batches/create',
  '/platform-v7/batches/new',
  '/platform-v7/batches',
  '/platform-v7/batches/view',
  '/platform-v7/buyer-lot',
  '/platform-v7/buyer/deals',
  '/platform-v7/buyer/lots',
  '/platform-v7/buyer/matches',
  '/platform-v7/buyer/offers',
  '/platform-v7/buyer/rfq/create',
  '/platform-v7/buyer/rfq/detail',
  '/platform-v7/buyer/rfq/new',
  '/platform-v7/companies',
  '/platform-v7/compliance/grain',
  '/platform-v7/control-tower/anti-bypass',
  '/platform-v7/control-tower/bypass-risk',
  '/platform-v7/control-tower/canonical-reconciliation',
  '/platform-v7/control-tower/grain',
  '/platform-v7/control-tower/hotlist',
  '/platform-v7/control-tower',
  '/platform-v7/data-room/grain',
  '/platform-v7/data-room',
  '/platform-v7/deploy-check',
  '/platform-v7/documents/grain',
  '/platform-v7/domain-core',
  '/platform-v7/driver/grain',
  '/platform-v7/driver',
  '/platform-v7/elevator/grain',
  '/platform-v7/elevator/terminal',
  '/platform-v7/evidence-pack',
  '/platform-v7/execution-map',
  '/platform-v7/executive/grain',
  '/platform-v7/fgis-to-lot',
  '/platform-v7/field',
  '/platform-v7/integrations/grain',
  '/platform-v7/integrations',
  '/platform-v7/investor',
  '/platform-v7/lab/grain',
  '/platform-v7/logistics/grain',
  '/platform-v7/lot/create',
  '/platform-v7/lots/compare',
  '/platform-v7/lots/create',
  '/platform-v7/lots',
  '/platform-v7/market-rfq',
  '/platform-v7/market',
  '/platform-v7/marketplace',
  '/platform-v7/offer-log',
  '/platform-v7/offer-to-deal',
  '/platform-v7/operator-cockpit/queues',
  '/platform-v7/operator/grain',
  '/platform-v7/pilot-runbook',
  '/platform-v7/procurement',
  '/platform-v7/proposals',
  '/platform-v7/readiness/grain',
  '/platform-v7/readiness',
  '/platform-v7/reports/esg',
  '/platform-v7/reports/grain',
  '/platform-v7/reports/regulator',
  '/platform-v7/runtime-status',
  '/platform-v7/security/grain',
  '/platform-v7/security',
  '/platform-v7/seller/batches/new',
  '/platform-v7/seller/batches',
  '/platform-v7/seller/deals',
  '/platform-v7/seller/fgis-parties',
  '/platform-v7/seller/lots/new',
  '/platform-v7/seller/lots',
  '/platform-v7/seller/matches',
  '/platform-v7/seller/offers',
  '/platform-v7/seller/quick-sale',
  '/platform-v7/settlement/grain',
  '/platform-v7/simulator',
  '/platform-v7/support/detail',
  '/platform-v7/support/grain',
  '/platform-v7/support/new',
  '/platform-v7/support/operator',
  '/platform-v7/support',
  '/platform-v7/surveyor/grain',
  '/platform-v7/trading',
  '/platform-v7/trust',
]);
const ALIAS_DYNAMIC_PATHS = [
  /^\/platform-v7\/auctions\/[^/]+$/,
  /^\/platform-v7\/bank\/events\/[^/]+$/,
  /^\/platform-v7\/batches\/[^/]+$/,
  /^\/platform-v7\/buyer\/rfq\/[^/]+$/,
  /^\/platform-v7\/companies\/[^/]+$/,
  /^\/platform-v7\/counterparties\/[^/]+$/,
  /^\/platform-v7\/counterparty\/[^/]+$/,
  /^\/platform-v7\/deal-drafts\/[^/]+$/,
  /^\/platform-v7\/deals\/[^/]+$/,
  /^\/platform-v7\/deals\/[^/]+\/(audit|clean|disputes|documents|evidence-pack|execution|logistics|money|quality|review|transport-documents)$/,
  /^\/platform-v7\/dispute\/[^/]+$/,
  /^\/platform-v7\/disputes\/[^/]+\/hold$/,
  /^\/platform-v7\/disputes\/[^/]+$/,
  /^\/platform-v7\/elevator\/terminal\/[^/]+$/,
  /^\/platform-v7\/investor\/deals\/[^/]+$/,
  /^\/platform-v7\/lot\/[^/]+$/,
  /^\/platform-v7\/lots\/[^/]+$/,
  /^\/platform-v7\/support\/[^/]+$/,
  /^\/platform-v7\/surveyor\/acts\/[^/]+$/,
] as const;

function normalizePath(value: string | null) {
  return (value || '').split('?')[0].replace(/\/$/, '') || LANDING_PATH;
}

function isPublicPath(pathname: string) {
  return PUBLIC_EXACT_PATHS.has(pathname) || PUBLIC_PREFIX_PATHS.some((prefix) => pathname.startsWith(prefix));
}

function isStaffPath(pathname: string) {
  return pathname === STAFF_PREFIX || pathname.startsWith(`${STAFF_PREFIX}/`);
}

function isKnownProtectedPath(value: string) {
  return isDesignSystemV8Route(value)
    || ALIAS_EXACT_PATHS.has(value)
    || ALIAS_DYNAMIC_PATHS.some((pattern) => pattern.test(value));
}

function loginHref(pathname: string): string {
  return `/platform-v7/login?next=${encodeURIComponent(pathname)}`;
}

async function verifiedCabinetRole(): Promise<PlatformRole | null> {
  const secret = String(process.env.JWT_SECRET || process.env.PC_CABINET_SESSION_SECRET || '').trim();
  if (!secret) return null;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const cookieStore = await cookies();
  return (
    await readVerifiedCabinetSessionRole(cookieStore.get(CABINET_SESSION_COOKIE)?.value ?? null, secret, nowSeconds)
  ) ?? (
    await readVerifiedCabinetRole(cookieStore.get(ACCESS_COOKIE)?.value ?? null, secret, nowSeconds)
  );
}

export default async function PlatformV7Layout({ children }: { children: ReactNode }) {
  const pathname = normalizePath((await headers()).get('x-pc-pathname'));

  // Every public route owns its static route-level shell, locale copy and CSS.
  if (isPublicPath(pathname)) return children;

  // Staff remains a separate privileged authority plane and authenticates through
  // its own server-issued staff session rather than a business cabinet role.
  if (isStaffPath(pathname)) return children;

  // Unknown paths fail closed before login redirects, RBAC evaluation or shell creation.
  if (!isKnownProtectedPath(pathname)) notFound();

  // A protected business cabinet is rendered only after the signed cabinet/access
  // JWT has been verified. URL, query, pc-role, localStorage and client state never
  // assign the role. Unauthorized routes are rejected before any role-specific UI
  // or page code reaches the client.
  const role = await verifiedCabinetRole();
  if (!role) redirect(loginHref(pathname));
  if (!canRoleAccessCabinet(role, pathname)) redirect(platformV7RoleRoute(role));

  const { PlatformV7ProtectedRuntime } = await import('@/components/platform-v7/PlatformV7ProtectedRuntime');
  const protectedContent = (
    <>
      <style>{'.pc-shell-root-v4 .p7-route-loading{min-height:calc(100dvh - 136px)}'}</style>
      <PlatformV7ProtectedRuntime pathname={pathname} verifiedRole={role}>{children}</PlatformV7ProtectedRuntime>
    </>
  );

  if (!isDesignSystemV8Route(pathname)) return protectedContent;

  const { PlatformV7DesignSystemV8Runtime } = await import('@/components/platform-v7/PlatformV7DesignSystemV8Runtime');
  return <PlatformV7DesignSystemV8Runtime>{protectedContent}</PlatformV7DesignSystemV8Runtime>;
}
