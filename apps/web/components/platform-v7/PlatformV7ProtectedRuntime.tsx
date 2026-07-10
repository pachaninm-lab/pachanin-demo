'use client';

import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/v7r/Toast';
import { PlatformThemeSync } from '@/components/v7r/PlatformThemeSync';
import { PlatformV7ProtectedShell } from '@/components/platform-v7/PlatformV7ProtectedShell';

export function PlatformV7ProtectedRuntime({ pathname, children }: { pathname: string; children: ReactNode }) {
  return (
    <ToastProvider>
      <PlatformThemeSync />
      <PlatformV7ProtectedShell pathname={pathname}>{children}</PlatformV7ProtectedShell>
    </ToastProvider>
  );
}
