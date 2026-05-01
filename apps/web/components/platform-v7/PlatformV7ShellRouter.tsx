'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const PlatformV7ChromeShell = dynamic(
  () => import('@/components/platform-v7/PlatformV7ChromeShell').then((module) => module.PlatformV7ChromeShell),
  { ssr: false },
);

export function PlatformV7ShellRouter({
  children,
  initialRole,
}: {
  readonly children: ReactNode;
  readonly initialRole: PlatformRole;
}) {
  const pathname = usePathname();
  const isDriverFieldShell = pathname === '/platform-v7/driver' || pathname.startsWith('/platform-v7/driver/');

  if (isDriverFieldShell) {
    return <>{children}</>;
  }

  return <PlatformV7ChromeShell initialRole={initialRole}>{children}</PlatformV7ChromeShell>;
}
