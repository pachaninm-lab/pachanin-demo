'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

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

function normalize(pathname: string): string {
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(normalize(pathname));
}

export function platformV7RoleHome(role: PlatformRole): string {
  return ROLE_HOME[role];
}

export function PlatformV7SingleEntryGuard() {
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    if (!pathname) return;
    const path = normalize(pathname);
    if (!path.startsWith('/platform-v7')) return;
    if (isPublicPath(path)) return;
  }, [pathname, router]);

  return null;
}
