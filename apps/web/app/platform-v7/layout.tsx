import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { AppShellV3 } from '@/components/v7r/AppShellV3';
import { ToastProvider } from '@/components/v7r/Toast';
import { AiShellEnhancer } from '@/components/v7r/AiShellEnhancer';
import { ShellCopyNormalizer } from '@/components/v7r/ShellCopyNormalizer';
import { RoleExecutionSummaryGate } from '@/components/platform-v7/RoleExecutionSummaryGate';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import '@/app/v9.css';
import '@/app/v9-accessibility.css';
import '@/styles/theme.css';
import '@/styles/enterprise-ui.css';
import '@/styles/design-fixes.css';

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
      <ShellCopyNormalizer />
      <AppShellV3 initialRole={initialRole}>
        <>
          <AiShellEnhancer />
          <RoleExecutionSummaryGate />
          {children}
        </>
      </AppShellV3>
    </ToastProvider>
  );
}
