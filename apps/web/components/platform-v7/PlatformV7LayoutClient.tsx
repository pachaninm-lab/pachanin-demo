'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AppShellV4 } from '@/components/v7r/AppShellV4';
import { ToastProvider } from '@/components/v7r/Toast';
import { PlatformThemeSync } from '@/components/v7r/PlatformThemeSync';
import { RbacCabinetGuard } from '@/components/platform-v7/RbacCabinetGuard';
import { PlatformV7SingleEntryGuard } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import { PlatformV7ShellUxController } from '@/components/platform-v7/PlatformV7ShellUxController';
import { SupportHeaderIcon } from '@/components/platform-v7/SupportHeaderIcon';
import { CalculatorHeaderWidget } from '@/components/platform-v7/CalculatorHeaderWidget';
import { NotepadHeaderWidget } from '@/components/platform-v7/NotepadHeaderWidget';
import { RoleAssistantWidget } from '@/components/platform-v7/RoleAssistantWidget';
import { getShellPolicy } from '@/lib/platform-v7/shell-role-policy';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import styles from './PlatformV7ProtectedShell.module.css';

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
  const normalizedPath = normalize(pathname);
  const publicPath = isPublicPath(pathname);
  const shellPolicy = getShellPolicy(initialRole, normalizedPath);

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
      <div className={styles.shellPolicy} data-shell-policy={shellPolicy} data-shell-role={initialRole}>
        <AppShellV4 initialRole={initialRole}>
          <>
            <PlatformV7SingleEntryGuard />
            <PlatformV7ShellUxController role={initialRole} />
            <RbacCabinetGuard />
            <CalculatorHeaderWidget />
            <NotepadHeaderWidget />
            <SupportHeaderIcon />
            <RoleAssistantWidget />
            {children}
          </>
        </AppShellV4>
      </div>
    </ToastProvider>
  );
}
