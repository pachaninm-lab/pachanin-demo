import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { AppShellV4 } from '@/components/v7r/AppShellV4';
import { ToastProvider } from '@/components/v7r/Toast';
import { PlatformThemeSync } from '@/components/v7r/PlatformThemeSync';
import { ScopedShellGuard } from '@/components/platform-v7/ScopedShellGuard';
import { SupportHeaderIcon } from '@/components/platform-v7/SupportHeaderIcon';
import { CommandPalette } from '@/components/platform-v7/CommandPalette';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import '@/app/v9.css';
import '@/app/v9-accessibility.css';
import '@/styles/theme.css';
import '@/styles/enterprise-ui.css';
import '@/styles/design-fixes.css';
import '@/styles/mobile-polish.css';
import '@/styles/platform-v7-dark-role-fixes.css';
import '@/styles/platform-v7-shell-clarity.css';
import '@/styles/platform-v7-work-surfaces.css';
import '@/styles/platform-v7-mobile-excellence.css';
import '@/styles/platform-v7-premium-visual-polish.css';
import '@/styles/platform-v7-final-polish.css';

export const metadata: Metadata = {
  title: 'Прозрачная Цена',
  description: 'Цифровой контур исполнения сделки и операционного контроля',
};

const VALID_ROLES = new Set<PlatformRole>([
  'operator',
  'buyer',
  'seller',
  'logistics',
  'driver',
  'surveyor',
  'elevator',
  'lab',
  'bank',
  'arbitrator',
  'compliance',
  'executive',
]);

export default async function PlatformV7Layout({ children }: { children: ReactNode }) {
  const headerStore = await headers();
  const rawRole = headerStore.get('x-pc-role');
  const initialRole: PlatformRole =
    rawRole && VALID_ROLES.has(rawRole as PlatformRole) ? (rawRole as PlatformRole) : 'operator';

  return (
    <ToastProvider>
      <PlatformThemeSync />
      <AppShellV4 initialRole={initialRole}>
        <>
          <ScopedShellGuard />
          <SupportHeaderIcon />
          <CommandPalette />
          {children}
        </>
      </AppShellV4>
    </ToastProvider>
  );
}
