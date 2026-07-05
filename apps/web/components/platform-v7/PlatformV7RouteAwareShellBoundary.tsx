'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { PlatformV7ShellBoundary } from '@/components/platform-v7/PlatformV7ShellBoundary';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const ROLE_PREFIXES: Array<[string, PlatformRole]> = [
  ['/platform-v7/control-tower', 'operator'],
  ['/platform-v7/operator', 'operator'],
  ['/platform-v7/buyer', 'buyer'],
  ['/platform-v7/procurement', 'buyer'],
  ['/platform-v7/seller', 'seller'],
  ['/platform-v7/logistics', 'logistics'],
  ['/platform-v7/driver', 'driver'],
  ['/platform-v7/surveyor', 'surveyor'],
  ['/platform-v7/elevator', 'elevator'],
  ['/platform-v7/lab', 'lab'],
  ['/platform-v7/bank', 'bank'],
  ['/platform-v7/arbitrator', 'arbitrator'],
  ['/platform-v7/compliance', 'compliance'],
  ['/platform-v7/executive', 'executive'],
];

function normalize(pathname: string | null) {
  if (!pathname) return '/platform-v7';
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function roleFromPath(pathname: string | null): PlatformRole | null {
  const path = normalize(pathname);
  const match = ROLE_PREFIXES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return match?.[1] ?? null;
}

export function PlatformV7RouteAwareShellBoundary({ children, initialRole }: { children: ReactNode; initialRole: PlatformRole }) {
  const pathname = usePathname();
  const routeRole = roleFromPath(pathname);
  return <PlatformV7ShellBoundary initialRole={routeRole ?? initialRole}>{children}</PlatformV7ShellBoundary>;
}
