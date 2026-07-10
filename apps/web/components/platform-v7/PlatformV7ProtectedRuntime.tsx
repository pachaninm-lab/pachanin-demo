'use client';

import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/v7r/Toast';
import { PlatformThemeSync } from '@/components/v7r/PlatformThemeSync';
import { PlatformV7ShellSwitch } from '@/components/platform-v7/PlatformV7ShellSwitch';

export function PlatformV7ProtectedRuntime({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <PlatformThemeSync />
      <PlatformV7ShellSwitch>{children}</PlatformV7ShellSwitch>
    </ToastProvider>
  );
}
