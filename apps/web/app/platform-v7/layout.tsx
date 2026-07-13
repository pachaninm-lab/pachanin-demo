import '@/styles/platform-v7-fixed-header-contract.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { PlatformV7HeaderOffsetRuntime } from '@/components/platform-v7/PlatformV7HeaderOffsetRuntime';

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
const PUBLIC_PREFIX_PATHS = ['/platform-v7/role-preview'];

function normalizePath(value: string | null) {
  return (value || '').split('?')[0].replace(/\/$/, '') || LANDING_PATH;
}

function isPublicPath(pathname: string) {
  return PUBLIC_EXACT_PATHS.has(pathname) || PUBLIC_PREFIX_PATHS.some((prefix) => pathname.startsWith(prefix));
}

function isStaffPath(pathname: string) {
  return pathname === STAFF_PREFIX || pathname.startsWith(`${STAFF_PREFIX}/`);
}

export default async function PlatformV7Layout({ children }: { children: ReactNode }) {
  const pathname = normalizePath(headers().get('x-pc-pathname'));

  // Landing and authentication stay lean and server-rendered. Their canonical
  // header has a deterministic CSS offset and does not need a client observer.
  if (pathname === LANDING_PATH || AUTH_PATHS.has(pathname)) return children;

  const headerOffsetRuntime = <PlatformV7HeaderOffsetRuntime />;

  // The privileged Staff control plane owns an isolated critical path. It keeps
  // its own authority shell, while sharing only the presentation-level fixed
  // header measurement contract.
  if (isStaffPath(pathname)) {
    return (
      <>
        {headerOffsetRuntime}
        {children}
      </>
    );
  }

  // Public supporting pages and protected business workspaces use the same
  // physical header contract without sharing identity or role authority.
  const { PlatformV7FullStyleRuntime } = await import('@/components/platform-v7/PlatformV7FullStyleRuntime');
  if (isPublicPath(pathname)) {
    return (
      <>
        {headerOffsetRuntime}
        <PlatformV7FullStyleRuntime>{children}</PlatformV7FullStyleRuntime>
      </>
    );
  }

  const { PlatformV7ProtectedRuntime } = await import('@/components/platform-v7/PlatformV7ProtectedRuntime');
  return (
    <>
      {headerOffsetRuntime}
      <PlatformV7FullStyleRuntime>
        <PlatformV7ProtectedRuntime pathname={pathname}>{children}</PlatformV7ProtectedRuntime>
      </PlatformV7FullStyleRuntime>
    </>
  );
}
