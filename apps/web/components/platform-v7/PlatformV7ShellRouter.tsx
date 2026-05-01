'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const PlatformV7ChromeShell = dynamic(
  () => import('@/components/platform-v7/PlatformV7ChromeShell').then((module) => module.PlatformV7ChromeShell),
  { ssr: false },
);

const executionContourPrefixes = [
  '/platform-v7/lots',
  '/platform-v7/buyer',
  '/platform-v7/seller',
  '/platform-v7/logistics/requests',
  '/platform-v7/logistics/trips',
  '/platform-v7/driver',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/bank/release-safety',
  '/platform-v7/deals',
] as const;

function isExecutionContourRoute(pathname: string): boolean {
  return executionContourPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function PlatformV7ShellRouter({
  children,
  initialRole,
}: {
  readonly children: ReactNode;
  readonly initialRole: PlatformRole;
}) {
  const pathname = usePathname();

  if (isExecutionContourRoute(pathname)) {
    return <>{children}</>;
  }

  return <PlatformV7ChromeShell initialRole={initialRole}>{children}</PlatformV7ChromeShell>;
}
