'use client';

import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/v7r/Toast';
import { PlatformThemeSync } from '@/components/v7r/PlatformThemeSync';
import { HydrationSafeChatSupport } from '@/components/platform-v7/HydrationSafeChatSupport';
import { PlatformV7ProtectedShell } from '@/components/platform-v7/PlatformV7ProtectedShell';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

export function PlatformV7ProtectedRuntime({
  pathname,
  verifiedRole,
  children,
}: {
  pathname: string;
  verifiedRole: PlatformRole;
  children: ReactNode;
}) {
  return (
    <ToastProvider>
      <PlatformThemeSync />
      <PlatformV7ProtectedShell pathname={pathname} verifiedRole={verifiedRole}>{children}</PlatformV7ProtectedShell>
      <HydrationSafeChatSupport />
    </ToastProvider>
  );
}
