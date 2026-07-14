import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getLocale } from 'next-intl/server';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { canRoleAccessCabinet } from '@/lib/platform-v7/cabinet-access-policy';
import { isKnownPlatformV7Route } from '@/lib/platform-v7/known-route-policy';
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
const PUBLIC_HEADERLESS_PATHS = new Set([
  '/platform-v7/help',
  '/platform-v7/pricing',
  '/platform-v7/roadmap',
]);
const PUBLIC_PREFIX_PATHS = [
  '/platform-v7/role-preview',
  '/platform-v7/demo',
];

type ShellLocale = 'ru' | 'en' | 'zh';

const SUPPORTING_COPY: Record<ShellLocale, {
  header: string;
  tagline: string;
  home: string;
  login: string;
}> = {
  ru: { header: 'Шапка сайта', tagline: 'Контур исполнения сделки', home: 'На главную', login: 'Войти' },
  en: { header: 'Site header', tagline: 'Transaction execution circuit', home: 'Home', login: 'Sign in' },
  zh: { header: '网站页眉', tagline: '交易执行闭环', home: '返回首页', login: '登录' },
};

function normalizePath(value: string | null) {
  return (value || '').split('?')[0].replace(/\/$/, '') || LANDING_PATH;
}

function isPublicPath(pathname: string) {
  return PUBLIC_EXACT_PATHS.has(pathname) || PUBLIC_PREFIX_PATHS.some((prefix) => pathname.startsWith(prefix));
}

function needsPublicHeader(pathname: string) {
  return PUBLIC_HEADERLESS_PATHS.has(pathname) || PUBLIC_PREFIX_PATHS.some((prefix) => pathname.startsWith(prefix));
}

function isStaffPath(pathname: string) {
  return pathname === STAFF_PREFIX || pathname.startsWith(`${STAFF_PREFIX}/`);
}

function loginHref(pathname: string): string {
  return `/platform-v7/login?next=${encodeURIComponent(pathname)}`;
}

async function verifiedCabinetRole(): Promise<PlatformRole | null> {
  const secret = String(process.env.JWT_SECRET || process.env.PC_CABINET_SESSION_SECRET || '').trim();
  if (!secret) return null;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const cookieStore = cookies();
  return (
    await readVerifiedCabinetSessionRole(cookieStore.get(CABINET_SESSION_COOKIE)?.value ?? null, secret, nowSeconds)
  ) ?? (
    await readVerifiedCabinetRole(cookieStore.get(ACCESS_COOKIE)?.value ?? null, secret, nowSeconds)
  );
}

async function PlatformV7PublicPageShell({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const copy = SUPPORTING_COPY[locale === 'en' || locale === 'zh' ? locale : 'ru'];

  return (
    <div data-public-supporting-shell>
      <PublicSiteHeader
        ariaLabel={copy.header}
        tagline={copy.tagline}
        showMobileMenu={false}
        localeControl={<PublicLocaleLink />}
        actions={(
          <>
            <a className='pc-site-action' href='/platform-v7' aria-label={copy.home} title={copy.home}>
              <span aria-hidden='true'>←</span>
              <span>{copy.home}</span>
            </a>
            <a className='pc-site-action is-primary' href='/platform-v7/login' aria-label={copy.login} title={copy.login}>
              <span aria-hidden='true'>↪</span>
              <span>{copy.login}</span>
            </a>
          </>
        )}
      />
      <div className='pc-public-supporting-content'>{children}</div>
    </div>
  );
}

export default async function PlatformV7Layout({ children }: { children: ReactNode }) {
  const pathname = normalizePath(headers().get('x-pc-pathname'));

  // Landing and authentication stay lean and server-rendered.
  if (pathname === LANDING_PATH || AUTH_PATHS.has(pathname)) return children;

  // Staff remains a separate privileged authority plane and authenticates through
  // its own server-issued staff session rather than a business cabinet role.
  if (isStaffPath(pathname)) return children;

  if (isPublicPath(pathname)) {
    return needsPublicHeader(pathname)
      ? <PlatformV7PublicPageShell>{children}</PlatformV7PublicPageShell>
      : children;
  }

  // Unknown Platform V7 URLs fail closed before auth redirects, role shell creation,
  // or any client runtime can disclose navigation or cabinet context.
  if (!isKnownPlatformV7Route(pathname)) notFound();

  // A protected business cabinet is rendered only after the signed cabinet/access
  // JWT has been verified. URL, query, pc-role, localStorage and client state never
  // assign the role. Unauthorized routes are rejected before any role-specific UI
  // or page code reaches the client.
  const role = await verifiedCabinetRole();
  if (!role) redirect(loginHref(pathname));
  if (!canRoleAccessCabinet(role, pathname)) redirect(platformV7RoleRoute(role));

  const { PlatformV7ProtectedRuntime } = await import('@/components/platform-v7/PlatformV7ProtectedRuntime');
  const { PlatformV7DesignSystemV8Runtime } = await import('@/components/platform-v7/PlatformV7DesignSystemV8Runtime');
  const protectedContent = (
    <PlatformV7ProtectedRuntime pathname={pathname} verifiedRole={role}>{children}</PlatformV7ProtectedRuntime>
  );

  return <PlatformV7DesignSystemV8Runtime>{protectedContent}</PlatformV7DesignSystemV8Runtime>;
}
