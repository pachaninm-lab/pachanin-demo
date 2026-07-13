'use client';

import * as React from 'react';
import { AppShellV4 } from '@/components/v7r/AppShellV4';
import { ShellCopyNormalizer } from '@/components/v7r/ShellCopyNormalizer';
import { ScopedShellGuard } from '@/components/platform-v7/ScopedShellGuard';
import { RbacCabinetGuard } from '@/components/platform-v7/RbacCabinetGuard';
import { PlatformV7SingleEntryGuard } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import { PlatformV7ShellUxController } from '@/components/platform-v7/PlatformV7ShellUxController';
import { CalculatorHeaderWidget } from '@/components/platform-v7/CalculatorHeaderWidget';
import { HeaderUtilityMenu } from '@/components/platform-v7/HeaderUtilityMenu';
import { RoleAssistantWidget } from '@/components/platform-v7/RoleAssistantWidget';
import { PlatformFooter } from '@/components/platform-v7/PlatformFooter';
import { OnboardingTour } from '@/components/platform-v7/OnboardingTour';
import { HeaderLanguageSwitch } from '@/components/platform-v7/HeaderLanguageSwitch';
import { StaffControlCenterEntry } from '@/components/platform-v7/StaffControlCenterEntry';
import { RoleIntentDashboard } from '@/components/platform-v7/RoleIntentDashboard';
import { SESSION_COOKIE } from '@/lib/auth-cookies';
import {
  CONTROLLED_TEST_TENANT_ID,
  controlledOrganizationById,
} from '@/lib/platform-v7/controlled-test-organizations';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import styles from './PlatformV7ProtectedShell.module.css';

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

type ControlledOwnerPreview = {
  role: PlatformRole;
  organizationId: string;
  organizationName: string;
};

type PreviewState = {
  path: string;
  preview: ControlledOwnerPreview | null;
};

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

function parseSessionMarker(raw: string): Record<string, unknown> | null {
  let candidate = raw;
  for (let depth = 0; depth < 3; depth += 1) {
    try {
      const parsed = JSON.parse(candidate);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      // Current and legacy Next.js cookie writers may leave one extra URI-encoding layer.
    }

    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded === candidate) return null;
      candidate = decoded;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Presentation-only marker for the controlled owner review surface.
 *
 * It never grants a role, tenant or action permission. Every protected action is
 * still authorized by the API and the signed HttpOnly cabinet session. The
 * marker only decides whether the owner sees the complete existing cabinet UI
 * or the backend-only canonical workspace on the cabinet root.
 */
function readControlledOwnerPreview(expectedRole: PlatformRole): ControlledOwnerPreview | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${SESSION_COOKIE}=`;
  const candidates = document.cookie
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(prefix))
    .map((part) => part.slice(prefix.length))
    .reverse();

  for (const raw of candidates) {
    const parsed = parseSessionMarker(raw);
    if (!parsed) continue;
    if (
      parsed.ownerAccess !== true
      || parsed.role !== expectedRole
      || parsed.tenantId !== CONTROLLED_TEST_TENANT_ID
      || typeof parsed.organizationId !== 'string'
    ) continue;

    const organization = controlledOrganizationById(parsed.organizationId);
    if (!organization?.testData || organization.tenantId !== CONTROLLED_TEST_TENANT_ID) continue;
    return {
      role: expectedRole,
      organizationId: organization.id,
      organizationName: organization.name,
    };
  }
  return null;
}

export function PlatformV7ProtectedShell({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const normalizedPath = normalizePath(pathname);
  const isStaffControlCenter = normalizedPath === '/platform-v7/staff' || normalizedPath.startsWith('/platform-v7/staff/');
  const initialRole = roleFromPath(pathname);
  const isRoleRoot = ROLE_INTENT_ROOT_PATHS.has(normalizedPath);
  const [previewState, setPreviewState] = React.useState<PreviewState | null>(null);

  React.useEffect(() => {
    setPreviewState({
      path: normalizedPath,
      preview: isRoleRoot ? readControlledOwnerPreview(initialRole) : null,
    });
  }, [initialRole, isRoleRoot, normalizedPath]);

  // Staff authority is a separate control plane. It must not inherit business-role
  // navigation, role widgets, onboarding, footer copy or client-side cabinet guards.
  // The staff route owns its own shell and all authority remains server-issued.
  if (isStaffControlCenter) {
    return (
      <>
        <ShellCopyNormalizer />
        {children}
      </>
    );
  }

  const previewResolved = !isRoleRoot || previewState?.path === normalizedPath;
  const ownerPreview = previewResolved ? previewState?.preview || null : null;

  const workSurface = isRoleRoot
    ? !previewResolved
      ? (
        <section className={styles.cabinetLoading} aria-live='polite'>
          <strong>Открываем интерфейс кабинета…</strong>
        </section>
      )
      : ownerPreview
        ? (
          <>
            <section className={styles.ownerPreview} data-controlled-owner-cabinet-preview='true'>
              <div className={styles.previewHeading}>
                <span className={styles.previewBadge}>TEST</span>
                <strong className={styles.previewTitle}>Полный интерфейс кабинета</strong>
              </div>
              <div className={styles.organizationName}>{ownerPreview.organizationName}</div>
              <p className={styles.previewText}>
                Данные и сценарии тестовые. Внешние интеграции, электронная подпись и движение денег не активированы. Действия исполняются только после серверной проверки полномочий.
              </p>
            </section>
            {children}
          </>
        )
        : <RoleIntentDashboard role={initialRole} />
    : children;

  const showPlatformFooter = !isRoleRoot || (previewResolved && !ownerPreview);

  return (
    <>
      <ShellCopyNormalizer />
      <AppShellV4 initialRole={initialRole}>
        <>
          <ScopedShellGuard />
          <PlatformV7SingleEntryGuard />
          <PlatformV7ShellUxController role={initialRole} />
          <RbacCabinetGuard />
          <ShellCopyNormalizer />
          <HeaderLanguageSwitch />
          <React.Suspense fallback={null}>
            <StaffControlCenterEntry />
          </React.Suspense>
          <CalculatorHeaderWidget />
          <HeaderUtilityMenu />
          <RoleAssistantWidget />
          {workSurface}
          {showPlatformFooter ? <PlatformFooter /> : null}
          <OnboardingTour />
        </>
      </AppShellV4>
    </>
  );
}
