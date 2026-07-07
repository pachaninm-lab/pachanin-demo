'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

const TOP_ROUTES = new Set([
  '/platform-v7',
  '/platform-v7/open',
  '/platform-v7/login',
  '/platform-v7/register',
  '/platform-v7/contact',
  '/platform-v7/request',
  '/platform-v7/deal-flow',
  '/platform-v7/demo',
  '/platform-v7/docs',
  '/platform-v7/control-tower',
  '/platform-v7/buyer',
  '/platform-v7/seller',
  '/platform-v7/logistics',
  '/platform-v7/driver',
  '/platform-v7/driver/field',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/bank',
  '/platform-v7/compliance',
  '/platform-v7/arbitrator',
  '/platform-v7/executive',
]);

function normalize(pathname: string | null) {
  if (!pathname) return '/platform-v7';
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function shouldReset(pathname: string | null, query: string) {
  const path = normalize(pathname);
  if (TOP_ROUTES.has(path)) return true;
  if (query.includes('logout=1') || query.includes('recovery=1') || query.includes('l10n=')) return true;
  return false;
}

function resetScroll() {
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
  window.scrollTo({ left: 0, top: 0, behavior: 'auto' });
}

export function PlatformV7ScrollRestorationGuard() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams?.toString() ?? '';

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useEffect(() => {
    if (!shouldReset(pathname, query)) return;
    resetScroll();
    const timers = [60, 180, 420].map((delay) => window.setTimeout(resetScroll, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [pathname, query]);

  return null;
}
