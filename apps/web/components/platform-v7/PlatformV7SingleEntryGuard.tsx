'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { platformV7RoleCanOpenHref, platformV7RoleRoute } from '@/lib/platform-v7/shellRoutes';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

export const PLATFORM_V7_ACTIVE_ROLE_KEY = 'pc-v7-active-role';

const PUBLIC_PATHS = new Set([
  '/platform-v7',
  '/platform-v7/open',
  '/platform-v7/login',
  '/platform-v7/register',
  '/platform-v7/demo',
  '/platform-v7/contact',
  '/platform-v7/request',
  '/platform-v7/staff/cabinet-handoff',
]);

const PLATFORM_ROLES: readonly PlatformRole[] = [
  'operator',
  'buyer',
  'seller',
  'logistics',
  'driver',
  'surveyor',
  'elevator',
  'lab',
  'bank',
  'arbitrator',
  'compliance',
  'executive',
];

function normalize(pathname: string): string {
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(normalize(pathname));
}

function isPlatformRole(value: string | null): value is PlatformRole {
  return PLATFORM_ROLES.includes(value as PlatformRole);
}

function readActiveRole(): PlatformRole | null {
  if (typeof window === 'undefined') return null;
  const stored = window.sessionStorage.getItem(PLATFORM_V7_ACTIVE_ROLE_KEY);
  return isPlatformRole(stored) ? stored : null;
}

function loginHref(pathname: string): string {
  return `/platform-v7/login?next=${encodeURIComponent(normalize(pathname))}`;
}

export function platformV7RoleHome(role: PlatformRole): string {
  return platformV7RoleRoute(role);
}

function roleAllows(role: PlatformRole, pathname: string): boolean {
  const path = normalize(pathname);
  if (isPublicPath(path)) return true;
  return platformV7RoleCanOpenHref(role, path);
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

  return null;
}
