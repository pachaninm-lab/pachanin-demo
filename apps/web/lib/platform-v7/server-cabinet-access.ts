import { canRoleAccessCabinet } from '@/lib/platform-v7/cabinet-access-policy';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

/**
 * Phase 4B — server-side cabinet enforcement, REPORT-ONLY scaffold.
 *
 * This module lets the server *observe* whether a request to a platform-v7 cabinet
 * would be denied for the request's verified session role — WITHOUT blocking or
 * redirecting anyone. It is the first, reversible step of the Phase 4 design
 * (docs/platform-v7/audit/PHASE_4_SERVER_SIDE_ROLE_ENFORCEMENT_DESIGN.md).
 *
 * Hard rules (do not break in this phase):
 *  - Report-only: never redirects, never blocks, never throws into the request path.
 *  - The role MUST come from a trusted server session boundary supplied by the caller.
 *    URL path, query string, the writable `pc-role` cookie and client guards are NOT
 *    sources of security and are never read here.
 *  - Off by default: with the flag unset, this is a no-op.
 *  - There is no block-mode in this scaffold. Even if the flag were set to anything
 *    other than `report`, nothing blocks — there is no enforcing code path.
 */

export const PLATFORM_V7_SERVER_CABINET_RBAC_FLAG = 'PLATFORM_V7_SERVER_CABINET_RBAC';

export type ServerCabinetRbacMode = 'off' | 'report';
export type ServerCabinetAccessStatus = 'allowed' | 'would-deny' | 'unknown';

export interface ServerCabinetAccessResult {
  /** Resolved mode for this evaluation. */
  readonly mode: ServerCabinetRbacMode;
  /** allowed | would-deny | unknown. `unknown` = no verified session to attribute. */
  readonly status: ServerCabinetAccessStatus;
  /** Always false in this phase — report-only, never enforces. */
  readonly enforced: false;
  readonly pathname: string;
  /** The role from the trusted session boundary, or null when unverified. */
  readonly verifiedRole: PlatformRole | null;
  readonly reason: string;
}

const VALID_ROLES: ReadonlySet<string> = new Set<PlatformRole>([
  'operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor',
  'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive',
]);

/** Reads the flag. Only the exact value `report` activates report-mode; all else is off. */
export function serverCabinetRbacMode(env: NodeJS.ProcessEnv = process.env): ServerCabinetRbacMode {
  return env[PLATFORM_V7_SERVER_CABINET_RBAC_FLAG] === 'report' ? 'report' : 'off';
}

/** Narrows an arbitrary session role string to a known PlatformRole, else null. */
export function asVerifiedRole(role: string | null | undefined): PlatformRole | null {
  return role && VALID_ROLES.has(role) ? (role as PlatformRole) : null;
}

/**
 * Pure decision. Computes whether `verifiedRole` could open `pathname` — never blocks.
 * `verifiedRole` must already come from a trusted session boundary (see asVerifiedRole).
 */
export function resolveServerCabinetAccess(input: {
  readonly pathname: string;
  readonly verifiedRole: PlatformRole | null;
  readonly mode?: ServerCabinetRbacMode;
}): ServerCabinetAccessResult {
  const mode = input.mode ?? serverCabinetRbacMode();
  const pathname = input.pathname;
  const verifiedRole = input.verifiedRole;

  if (mode === 'off') {
    return { mode, status: 'unknown', enforced: false, pathname, verifiedRole, reason: 'flag off — no evaluation' };
  }
  if (!pathname.startsWith('/platform-v7')) {
    return { mode, status: 'allowed', enforced: false, pathname, verifiedRole, reason: 'non-platform-v7 path' };
  }
  if (!verifiedRole) {
    // No trusted identity to attribute this request to. Report-only: do not block.
    return { mode, status: 'unknown', enforced: false, pathname, verifiedRole, reason: 'no verified session role' };
  }
  const allowed = canRoleAccessCabinet(verifiedRole, pathname);
  return {
    mode,
    status: allowed ? 'allowed' : 'would-deny',
    enforced: false,
    pathname,
    verifiedRole,
    reason: allowed
      ? `role «${verifiedRole}» may open this cabinet`
      : `role «${verifiedRole}» would be denied this cabinet (report-only — not blocked)`,
  };
}

/**
 * Emits a structured diagnostic for an actionable signal (a would-be-deny) in report
 * mode. Never throws; allowed/unknown produce no event to keep the signal focused.
 */
export function reportServerCabinetAccess(result: ServerCabinetAccessResult): void {
  if (result.mode !== 'report' || result.status !== 'would-deny') return;
  try {
    // Structured, greppable, server-side only. Replace with the audit sink in 4C+.
    // eslint-disable-next-line no-console
    console.warn(
      `[pc:v7:cabinet-rbac:report] would-deny ${JSON.stringify({
        pathname: result.pathname,
        verifiedRole: result.verifiedRole,
        reason: result.reason,
        enforced: result.enforced,
      })}`,
    );
  } catch {
    // A report must never affect the request.
  }
}

/**
 * Convenience for the web route layer: resolve + report in one call, fully guarded.
 * `verifiedRole` MUST already come from a verified JWT (see verified-session.ts) —
 * never from URL/query/pc-role/client guards. Returns the result (callers ignore it
 * today) and never throws.
 */
export function observeServerCabinetAccess(input: {
  readonly pathname: string;
  readonly verifiedRole: PlatformRole | null;
}): ServerCabinetAccessResult {
  const result = resolveServerCabinetAccess({
    pathname: input.pathname,
    verifiedRole: input.verifiedRole,
  });
  reportServerCabinetAccess(result);
  return result;
}
