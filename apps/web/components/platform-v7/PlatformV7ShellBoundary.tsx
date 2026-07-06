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
import { RoleAssistantWidget } from '@/components/platform-v7/RoleAssistantWidget';
import { PlatformFooter } from '@/components/platform-v7/PlatformFooter';
import { OnboardingTour } from '@/components/platform-v7/OnboardingTour';
import { PlatformV7UnifiedHeader } from '@/components/platform-v7/PlatformV7UnifiedHeader';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const PUBLIC_EXACT_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register', '/platform-v7/demo', '/platform-v7/contact', '/platform-v7/request', '/platform-v7/docs']);
const PUBLIC_PREFIXES = ['/platform-v7/demo/', '/platform-v7/contact/', '/platform-v7/request/', '/platform-v7/docs/'];

function normalize(pathname: string | null) {
  if (!pathname) return '/platform-v7';
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function isPublicPlatformPath(pathname: string | null) {
  const path = normalize(pathname);
  return PUBLIC_EXACT_PATHS.has(path) || PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function PlatformV7PrivateShell({ children, initialRole }: { children: ReactNode; initialRole: PlatformRole }) {
  return (
    <AppShellV4 initialRole={initialRole}>
      <>
        <ScopedShellGuard />
        <PlatformV7SingleEntryGuard />
        <PlatformV7ShellUxController />
        <RbacCabinetGuard />
        <ShellCopyNormalizer />
        <RoleAssistantWidget />
        {children}
        <PlatformFooter />
        <OnboardingTour />
      </>
    </AppShellV4>
  );
}

export function PlatformV7ShellBoundary({ children, initialRole }: { children: ReactNode; initialRole: PlatformRole }) {
  const pathname = usePathname();
  const publicPath = isPublicPlatformPath(pathname);

  return (
    <ToastProvider>
      <PlatformThemeSync />
      <PlatformV7UnifiedHeader />
      {publicPath ? children : <><ShellCopyNormalizer /><PlatformV7PrivateShell initialRole={initialRole}>{children}</PlatformV7PrivateShell></>}
    </ToastProvider>
  );
}
