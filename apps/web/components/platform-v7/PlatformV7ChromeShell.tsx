'use client';

import type { ReactNode } from 'react';
import { AppShellV3 } from '@/components/v7r/AppShellV3';
import { AiShellEnhancer } from '@/components/v7r/AiShellEnhancer';
import { ShellCopyNormalizer } from '@/components/v7r/ShellCopyNormalizer';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

export function PlatformV7ChromeShell({
  children,
  initialRole,
}: {
  readonly children: ReactNode;
  readonly initialRole: PlatformRole;
}) {
  return (
    <>
      <ShellCopyNormalizer />
      <AppShellV3 initialRole={initialRole}>
        <>
          <AiShellEnhancer />
          {children}
        </>
      </AppShellV3>
    </>
  );
}
