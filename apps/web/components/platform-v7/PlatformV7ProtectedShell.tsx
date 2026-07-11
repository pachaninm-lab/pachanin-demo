'use client';

import * as React from 'react';
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
import { StaffControlCenterEntry } from '@/components/platform-v7/StaffControlCenterEntry';
import { RoleIntentDashboard } from '@/components/platform-v7/RoleIntentDashboard';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

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

export function PlatformV7ProtectedShell({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const normalizedPath = normalizePath(pathname);
  const isStaffControlCenter = normalizedPath === '/platform-v7/staff' || normalizedPath.startsWith('/platform-v7/staff/');
  const initialRole = roleFromPath(pathname);
  const workSurface = ROLE_INTENT_ROOT_PATHS.has(normalizedPath)
    ? <RoleIntentDashboard role={initialRole} />
    : children;

  return (
    <>
      <ShellCopyNormalizer />
      <AppShellV4 initialRole={initialRole}>
        <>
          <ScopedShellGuard />
          {!isStaffControlCenter && <PlatformV7SingleEntryGuard />}
          <PlatformV7ShellUxController />
          {!isStaffControlCenter && <RbacCabinetGuard />}
          <ShellCopyNormalizer />
          <HeaderLanguageSwitch />
          <React.Suspense fallback={null}>
            <StaffControlCenterEntry />
          </React.Suspense>
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
