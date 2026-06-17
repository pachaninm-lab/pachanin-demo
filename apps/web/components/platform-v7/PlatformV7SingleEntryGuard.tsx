'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

export const PLATFORM_V7_ACTIVE_ROLE_KEY = 'pc-v7-active-role';

const PUBLIC_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register']);

const ROLE_HOME: Record<PlatformRole, string> = {
  operator: '/platform-v7/control-tower',
  buyer: '/platform-v7/buyer',
  seller: '/platform-v7/seller',
  logistics: '/platform-v7/logistics',
  driver: '/platform-v7/driver',
  surveyor: '/platform-v7/surveyor',
  elevator: '/platform-v7/elevator',
  lab: '/platform-v7/lab',
  bank: '/platform-v7/bank',
  arbitrator: '/platform-v7/arbitrator',
  compliance: '/platform-v7/compliance',
  executive: '/platform-v7/executive',
};

const ALLOWED: Record<PlatformRole, readonly string[]> = {
  operator: ['/platform-v7/control-tower', '/platform-v7/deals', '/platform-v7/lots', '/platform-v7/logistics', '/platform-v7/bank', '/platform-v7/disputes', '/platform-v7/connectors', '/platform-v7/executive'],
  buyer: ['/platform-v7/buyer', '/platform-v7/procurement', '/platform-v7/deals', '/platform-v7/bank'],
  seller: ['/platform-v7/seller', '/platform-v7/lots', '/platform-v7/deals'],
  logistics: ['/platform-v7/logistics', '/platform-v7/driver', '/platform-v7/elevator', '/platform-v7/lab'],
  driver: ['/platform-v7/driver'],
  surveyor: ['/platform-v7/surveyor', '/platform-v7/disputes'],
  elevator: ['/platform-v7/elevator', '/platform-v7/deals'],
  lab: ['/platform-v7/lab', '/platform-v7/deals'],
  bank: ['/platform-v7/bank', '/platform-v7/deals', '/platform-v7/disputes'],
  arbitrator: ['/platform-v7/arbitrator', '/platform-v7/disputes'],
  compliance: ['/platform-v7/compliance', '/platform-v7/connectors', '/platform-v7/deals'],
  executive: ['/platform-v7/executive', '/platform-v7/control-tower', '/platform-v7/bank'],
};

function normalize(pathname: string): string {
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(normalize(pathname));
}

function readActiveRole(): PlatformRole | null {
  if (typeof globalThis === 'undefined') return null;
  return globalThis.sessionStorage?.getItem(PLATFORM_V7_ACTIVE_ROLE_KEY) as PlatformRole | null;
}

function loginHref(pathname: string): string {
  return `/platform-v7/login?next=${encodeURIComponent(normalize(pathname))}`;
}

export function platformV7RoleHome(role: PlatformRole): string {
  return ROLE_HOME[role];
}

function roleAllows(role: PlatformRole, pathname: string): boolean {
  const path = normalize(pathname);
  if (isPublicPath(path)) return true;
  if (path === '/platform-v7/ai') return true;
  return ALLOWED[role].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function PlatformV7SingleEntryGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const role = usePlatformV7RStore((state) => state.role);
  const setRole = usePlatformV7RStore((state) => state.setRole);

  React.useEffect(() => {
    if (!pathname) return;
    const path = normalize(pathname);
    if (!path.startsWith('/platform-v7')) return;
    if (isPublicPath(path)) return;
    const activeRole = readActiveRole();
    if (!activeRole) {
      router.replace(loginHref(path));
      return;
    }
    if (role !== activeRole) setRole(activeRole);
    if (!roleAllows(activeRole, path)) router.replace(platformV7RoleHome(activeRole));
  }, [pathname, role, router, setRole]);

  return <style>{`.pc-v4-switch-cabinet{display:none!important;}`}</style>;
}
