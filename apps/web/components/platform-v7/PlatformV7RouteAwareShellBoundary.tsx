'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { PlatformV7ShellBoundary } from '@/components/platform-v7/PlatformV7ShellBoundary';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

export function PlatformV7RouteAwareShellBoundary({ children, initialRole }: { children: ReactNode; initialRole: PlatformRole }) {
  usePathname();
  return <PlatformV7ShellBoundary initialRole={initialRole}>{children}</PlatformV7ShellBoundary>;
}
