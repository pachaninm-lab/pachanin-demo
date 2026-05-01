'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AppShellV3 } from '@/components/v7r/AppShellV3';
import { AiShellEnhancer } from '@/components/v7r/AiShellEnhancer';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

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

  return (
    <AppShellV3 initialRole={initialRole}>
      <>
        <AiShellEnhancer />
        {children}
      </>
    </AppShellV3>
  );
}
