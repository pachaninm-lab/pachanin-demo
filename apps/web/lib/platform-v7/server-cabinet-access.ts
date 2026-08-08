import { cabinetAccessDecision } from '@/lib/platform-v7/cabinet-access-policy';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

/** Retained only so obsolete deployment configuration can be detected and removed. */
export const PLATFORM_V7_SERVER_CABINET_RBAC_FLAG = 'PLATFORM_V7_SERVER_CABINET_RBAC';

export type ServerCabinetRbacMode = 'enforce';
export type ServerCabinetAccessStatus = 'allowed' | 'denied';

export interface ServerCabinetAccessResult {
  readonly mode: ServerCabinetRbacMode;
  readonly status: ServerCabinetAccessStatus;
  readonly enforced: boolean;
  readonly pathname: string;
  readonly verifiedRole: PlatformRole | null;
  readonly redirectTo: string | null;
  readonly reason: string;
}

const VALID_ROLES: ReadonlySet<string> = new Set<PlatformRole>([
  'operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor',
  'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive',
]);

/** Business cabinet RBAC is mandatory and has no production off/report mode. */
export function serverCabinetRbacMode(): ServerCabinetRbacMode {
  return 'enforce';
}

export function asVerifiedRole(role: string | null | undefined): PlatformRole | null {
  return role && VALID_ROLES.has(role) ? role as PlatformRole : null;
}

export function resolveServerCabinetAccess(input: {
  readonly pathname: string;
  readonly verifiedRole: PlatformRole | null;
}): ServerCabinetAccessResult {
  const { pathname, verifiedRole } = input;
  if (!pathname.startsWith('/platform-v7')) {
    return {
      mode: 'enforce',
      status: 'allowed',
      enforced: false,
      pathname,
      verifiedRole,
      redirectTo: null,
      reason: 'non-platform-v7 path',
    };
  }
  if (!verifiedRole) {
    return {
      mode: 'enforce',
      status: 'denied',
      enforced: true,
      pathname,
      verifiedRole: null,
      redirectTo: '/platform-v7/login',
      reason: 'verified server session required',
    };
  }

  const decision = cabinetAccessDecision(verifiedRole, pathname);
  return {
    mode: 'enforce',
    status: decision.allowed ? 'allowed' : 'denied',
    enforced: true,
    pathname,
    verifiedRole,
    redirectTo: decision.redirectTo,
    reason: decision.reason,
  };
}

export function reportServerCabinetAccess(result: ServerCabinetAccessResult): void {
  if (result.status !== 'denied') return;
  try {
    console.warn(`[pc:v7:cabinet-rbac:deny] ${JSON.stringify({
      pathname: result.pathname,
      verifiedRole: result.verifiedRole,
      reason: result.reason,
      enforced: result.enforced,
    })}`);
  } catch {
    // Logging must never weaken the denial.
  }
}

export function observeServerCabinetAccess(input: {
  readonly pathname: string;
  readonly verifiedRole: PlatformRole | null;
}): ServerCabinetAccessResult {
  const result = resolveServerCabinetAccess(input);
  reportServerCabinetAccess(result);
  return result;
}
