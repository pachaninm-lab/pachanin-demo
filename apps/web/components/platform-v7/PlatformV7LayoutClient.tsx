'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AppShellV4 } from '@/components/v7r/AppShellV4';
import { ToastProvider } from '@/components/v7r/Toast';
import { PlatformThemeSync } from '@/components/v7r/PlatformThemeSync';
import { ShellCopyNormalizer } from '@/components/v7r/ShellCopyNormalizer';
import { ScopedShellGuard } from '@/components/platform-v7/ScopedShellGuard';
import { RbacCabinetGuard } from '@/components/platform-v7/RbacCabinetGuard';
import { PlatformV7SingleEntryGuard } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import { PlatformV7ShellUxController } from '@/components/platform-v7/PlatformV7ShellUxController';
import { SupportHeaderIcon } from '@/components/platform-v7/SupportHeaderIcon';
import { CalculatorHeaderWidget } from '@/components/platform-v7/CalculatorHeaderWidget';
import { NotepadHeaderWidget } from '@/components/platform-v7/NotepadHeaderWidget';
import { RoleAssistantWidget } from '@/components/platform-v7/RoleAssistantWidget';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const PUBLIC_EXACT_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register', '/platform-v7/docs']);

function normalize(pathname: string | null) {
  if (!pathname) return '/platform-v7';
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function isPublicPath(pathname: string | null) {
  return PUBLIC_EXACT_PATHS.has(normalize(pathname));
}

export function PlatformV7LayoutClient({ children, initialRole }: { children: ReactNode; initialRole: PlatformRole }) {
  const pathname = usePathname();
  const publicPath = isPublicPath(pathname);

  if (publicPath) {
    return (
      <ToastProvider>
        <PlatformThemeSync />
        {children}
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <PlatformThemeSync />
      <ShellCopyNormalizer />
      <AppShellV4 initialRole={initialRole}>
        <>
          <ScopedShellGuard />
          <PlatformV7SingleEntryGuard />
          <PlatformV7ShellUxController role={initialRole} />
          <RbacCabinetGuard />
          <ShellCopyNormalizer />
          <CalculatorHeaderWidget />
          <NotepadHeaderWidget />
          <SupportHeaderIcon />
          <RoleAssistantWidget />
          {children}
        </>
      </AppShellV4>
    </ToastProvider>
  );
}
