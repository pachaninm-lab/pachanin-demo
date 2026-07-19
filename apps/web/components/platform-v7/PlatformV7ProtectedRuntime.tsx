'use client';

import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/v7r/Toast';
import { PlatformThemeSync } from '@/components/v7r/PlatformThemeSync';
import { CabinetContactDock } from '@/components/platform-v7/CabinetContactDock';
import { HydrationSafeChatSupport } from '@/components/platform-v7/HydrationSafeChatSupport';
import { PlatformV7ProtectedShell } from '@/components/platform-v7/PlatformV7ProtectedShell';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const ASSISTANT_WORKSPACE = '/platform-v7/assistant';

export function PlatformV7ProtectedRuntime({
  pathname,
  verifiedRole,
  children,
}: {
  pathname: string;
  verifiedRole: PlatformRole;
  children: ReactNode;
}) {
  const assistantContext = pathname === ASSISTANT_WORKSPACE ? 'workspace' : 'private';

  return (
    <ToastProvider>
      <PlatformThemeSync />
      <PlatformV7ProtectedShell pathname={pathname} verifiedRole={verifiedRole}>{children}</PlatformV7ProtectedShell>
      <CabinetContactDock role={verifiedRole} assistantContext={assistantContext} />
      <HydrationSafeChatSupport verifiedRole={verifiedRole} renderDock={false} />
    </ToastProvider>
  );
}
