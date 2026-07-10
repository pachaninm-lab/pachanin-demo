"use client";

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { AppShellV4 } from '@/components/v7r/AppShellV4';
import { ShellCopyNormalizer } from '@/components/v7r/ShellCopyNormalizer';
import { ScopedShellGuard } from '@/components/platform-v7/ScopedShellGuard';
import { RbacCabinetGuard } from '@/components/platform-v7/RbacCabinetGuard';
import { PlatformV7SingleEntryGuard } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import { PlatformV7ShellUxController } from '@/components/platform-v7/PlatformV7ShellUxController';
import { CalculatorHeaderWidget } from '@/components/platform-v7/CalculatorHeaderWidget';
import { MobileHeaderActionRail } from '@/components/platform-v7/MobileHeaderActionRail';
import { NotepadHeaderWidget } from '@/components/platform-v7/NotepadHeaderWidget';
import { RoleAssistantWidget } from '@/components/platform-v7/RoleAssistantWidget';
import { PlatformFooter } from '@/components/platform-v7/PlatformFooter';
import { OnboardingTour } from '@/components/platform-v7/OnboardingTour';
import { SupportHeaderIcon } from '@/components/platform-v7/SupportHeaderIcon';
import { HeaderLanguageSwitch } from '@/components/platform-v7/HeaderLanguageSwitch';
import { RoleIntentDashboard } from '@/components/platform-v7/RoleIntentDashboard';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const PUBLIC_EXACT_PATHS = new Set([
  '/platform-v7',
  '/platform-v7/open',
  '/platform-v7/login',
  '/platform-v7/forgot-password',
  '/platform-v7/register',
  '/platform-v7/help',
  '/platform-v7/pricing',
  '/platform-v7/roadmap',
  '/platform-v7/deal-flow',
  '/platform-v7/demo',
  '/platform-v7/contact',
  '/platform-v7/request',
  '/platform-v7/docs',
]);
const PUBLIC_PREFIX_PATHS = ['/platform-v7/role-preview'];
const ROLE_INTENT_ROOT_PATHS = new Set([
  '/platform-v7/control-tower',
  '/platform-v7/buyer',
  '/platform-v7/seller',
  '/platform-v7/logistics',
  '/platform-v7/driver',
  '/platform-v7/surveyor',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/bank',
  '/platform-v7/compliance',
  '/platform-v7/arbitrator',
  '/platform-v7/executive',
]);

function normalizePath(pathname: string): string {
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function isPublicPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return PUBLIC_EXACT_PATHS.has(path) || PUBLIC_PREFIX_PATHS.some((prefix) => path.startsWith(prefix));
}

function shouldShowRoleIntentDashboard(pathname: string): boolean {
  return ROLE_INTENT_ROOT_PATHS.has(normalizePath(pathname));
}

function roleFromPath(pathname: string): PlatformRole {
  const path = normalizePath(pathname);
  if (path.startsWith('/platform-v7/driver')) return 'driver';
  if (path.startsWith('/platform-v7/surveyor')) return 'surveyor';
  if (path.startsWith('/platform-v7/elevator')) return 'elevator';
  if (path.startsWith('/platform-v7/lab')) return 'lab';
  if (path.startsWith('/platform-v7/bank')) return 'bank';
  if (path.startsWith('/platform-v7/arbitrator') || path.startsWith('/platform-v7/disputes')) return 'arbitrator';
  if (path.startsWith('/platform-v7/compliance') || path.startsWith('/platform-v7/connectors')) return 'compliance';
  if (path.startsWith('/platform-v7/buyer') || path.startsWith('/platform-v7/procurement')) return 'buyer';
  if (path.startsWith('/platform-v7/seller') || path.startsWith('/platform-v7/lots')) return 'seller';
  if (path.startsWith('/platform-v7/logistics')) return 'logistics';
  if (path.startsWith('/platform-v7/executive') || path.startsWith('/platform-v7/analytics')) return 'executive';
  return 'operator';
}

export function PlatformV7ShellSwitch({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/platform-v7';

  if (isPublicPath(pathname)) return <>{children}</>;

  const initialRole = roleFromPath(pathname);
  const showRoleIntentDashboard = shouldShowRoleIntentDashboard(pathname);
  const workSurface = showRoleIntentDashboard
    ? <RoleIntentDashboard role={initialRole} />
    : children;

  return (
    <>
      <ShellCopyNormalizer />
      <AppShellV4 initialRole={initialRole}>
        <>
          <ScopedShellGuard />
          <PlatformV7SingleEntryGuard />
          <PlatformV7ShellUxController />
          <RbacCabinetGuard />
          <ShellCopyNormalizer />
          <HeaderLanguageSwitch />
          <CalculatorHeaderWidget />
          <NotepadHeaderWidget />
          <SupportHeaderIcon />
          <MobileHeaderActionRail />
          <RoleAssistantWidget />
          {workSurface}
          <PlatformFooter />
          <OnboardingTour />
        </>
      </AppShellV4>
    </>
  );
}
