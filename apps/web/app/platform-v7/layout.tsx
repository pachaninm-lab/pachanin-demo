import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { getLocale } from 'next-intl/server';
import { PublicLocaleLink } from '@/components/platform-v7/PublicLocaleLink';
import { PublicSiteHeader } from '@/components/platform-v7/PublicSiteHeader';

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
]);
const PUBLIC_HEADERLESS_PATHS = new Set([
  '/platform-v7/help',
  '/platform-v7/pricing',
  '/platform-v7/roadmap',
]);
const PUBLIC_PREFIX_PATHS = ['/platform-v7/role-preview'];

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

  // Staff remains a separate privileged authority plane. The root CSS contract
  // fixes its shell without mounting business-role providers or observers.
  if (isStaffPath(pathname)) return children;

  const { PlatformV7FullStyleRuntime } = await import('@/components/platform-v7/PlatformV7FullStyleRuntime');
  if (isPublicPath(pathname)) {
    const publicContent = needsPublicHeader(pathname)
      ? <PlatformV7PublicPageShell>{children}</PlatformV7PublicPageShell>
      : children;

    return <PlatformV7FullStyleRuntime>{publicContent}</PlatformV7FullStyleRuntime>;
  }

  const { PlatformV7ProtectedRuntime } = await import('@/components/platform-v7/PlatformV7ProtectedRuntime');
  return (
    <PlatformV7FullStyleRuntime>
      <PlatformV7ProtectedRuntime pathname={pathname}>{children}</PlatformV7ProtectedRuntime>
    </PlatformV7FullStyleRuntime>
  );
}
