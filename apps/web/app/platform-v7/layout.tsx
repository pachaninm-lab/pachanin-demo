import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';

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

const LEAN_PUBLIC_ENTRY_PATHS = new Set([
  '/platform-v7',
  '/platform-v7/login',
  '/platform-v7/forgot-password',
]);
const PUBLIC_EXACT_PATHS = new Set([
  ...LEAN_PUBLIC_ENTRY_PATHS,
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
  return (value || '').split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function isPublicPath(pathname: string) {
  return PUBLIC_EXACT_PATHS.has(pathname) || PUBLIC_PREFIX_PATHS.some((prefix) => pathname.startsWith(prefix));
}

export default async function PlatformV7Layout({ children }: { children: ReactNode }) {
  const pathname = normalizePath(headers().get('x-pc-pathname'));
  if (LEAN_PUBLIC_ENTRY_PATHS.has(pathname)) return children;

  await import('./_styles/full-platform');
  if (isPublicPath(pathname)) return children;

  const { PlatformV7ProtectedRuntime } = await import('@/components/platform-v7/PlatformV7ProtectedRuntime');
  return <PlatformV7ProtectedRuntime pathname={pathname}>{children}</PlatformV7ProtectedRuntime>;
}
