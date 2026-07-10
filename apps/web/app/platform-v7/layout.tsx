import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import '@/app/v9.css';
import '@/app/v9-accessibility.css';
import '@/styles/theme.css';
import '@/styles/enterprise-ui.css';
import '@/styles/design-fixes.css';
import '@/styles/mobile-polish.css';
import '@/styles/platform-v7-dark-role-fixes.css';
import '@/styles/platform-v7-shell-clarity.css';
import '@/styles/platform-v7-work-surfaces.css';
import '@/styles/platform-v7-mobile-excellence.css';
import '@/styles/platform-v7-premium-visual-polish.css';
import '@/styles/platform-v7-final-polish.css';
import '@/styles/platform-v7-living-deal.css';
import '@/styles/platform-v7-premium-cockpit.css';
import '@/styles/platform-v7-entry-fix.css';
import '@/styles/platform-v7-mobile-hardening.css';
import '@/styles/platform-v7-mobile-reflow-p0.css';
import '@/styles/platform-v7-shell-restore.css';
import '@/styles/platform-v7-register-header-override.css';
import '@/styles/platform-v7-mobile-screenshot-fixes.css';
import '@/styles/platform-v7-mobile-shell-p1.css';
import '@/styles/platform-v7-shell-critical.css';
import '@/styles/platform-v7-public-mobile-safe-area.css';
import '@/styles/platform-v7-seller-mobile-usability.css';
import '@/styles/platform-v7-mobile-bottom-tools.css';
import '@/styles/platform-v7-seller-workspace-v2.css';

const SITE_URL = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const PUBLIC_EXACT_PATHS = new Set([
  '/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/forgot-password',
  '/platform-v7/register', '/platform-v7/help', '/platform-v7/pricing', '/platform-v7/roadmap',
  '/platform-v7/deal-flow', '/platform-v7/demo', '/platform-v7/contact', '/platform-v7/request', '/platform-v7/docs',
]);
const PUBLIC_PREFIX_PATHS = ['/platform-v7/role-preview'];

function normalizePath(value: string | null) {
  return (value || '').split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function isPublicPath(value: string | null) {
  const pathname = normalizePath(value);
  return PUBLIC_EXACT_PATHS.has(pathname) || PUBLIC_PREFIX_PATHS.some((prefix) => pathname.startsWith(prefix));
}

export function generateMetadata(): Metadata {
  const pathname = normalizePath(headers().get('x-pc-pathname'));
  const isCanonicalEntry = pathname === '/platform-v7';
  return {
    title: { default: 'Прозрачная Цена', template: '%s · Прозрачная Цена' },
    description: 'Цифровой контур исполнения зерновой сделки: допуск, логистика, приёмка, качество, документы, расчёты, спор и доказательства.',
    keywords: ['зерно', 'агроторговля', 'элеватор', 'логистика зерна', 'сделка', 'документы', 'расчёты'],
    creator: 'Прозрачная Цена',
    robots: isCanonicalEntry ? { index: true, follow: true } : { index: false, follow: false, noarchive: true, nosnippet: true },
    alternates: isCanonicalEntry ? { canonical: `${SITE_URL}/platform-v7` } : undefined,
    openGraph: {
      type: 'website', locale: 'ru_RU', siteName: 'Прозрачная Цена',
      title: 'Прозрачная Цена — контур исполнения зерновой сделки',
      description: 'Логистика, приёмка, качество, документы, расчёты, спор и доказательства в одном проверяемом процессе.',
      url: isCanonicalEntry ? `${SITE_URL}/platform-v7` : undefined,
    },
    metadataBase: new URL(SITE_URL),
  };
}

export default async function PlatformV7Layout({ children }: { children: ReactNode }) {
  const pathname = headers().get('x-pc-pathname');
  if (isPublicPath(pathname)) return children;
  const { PlatformV7ProtectedRuntime } = await import('@/components/platform-v7/PlatformV7ProtectedRuntime');
  return <PlatformV7ProtectedRuntime>{children}</PlatformV7ProtectedRuntime>;
}
