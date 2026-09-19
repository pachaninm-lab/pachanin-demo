import { Role, type RequestUser } from '../../common/types/request-user';
import { StaffRole } from '../staff-access/staff-access.types';
import {
  decideRegulatoryReplay,
  type RegulatoryReplayDecision,
} from './regulatory-integration.state-machine';
import type {
  RegulatoryIntegrationState,
} from './regulatory-integration.types';

export const RegulatoryIntegrationPermission = {
  INBOX_REDRIVE: 'regulatory-integration:inbox:redrive',
} as const;

export type RegulatoryInboxAuthorityContext = Readonly<
  | {
      tenantId: string;
      organizationId: string;
      orgId?: never;
    }
  | {
      tenantId: string;
      orgId: string;
      organizationId?: never;
    }
>;

export interface RegulatoryInboxIdentity {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly provider: string;
  readonly externalEventId: string;
  readonly rawBodySha256: string;
}

export interface RegulatoryInboxLeaseSnapshot {
  readonly state: RegulatoryIntegrationState;
  readonly attempts: number;
  readonly nextAttemptAt: Date | null;
  readonly leaseOwner: string | null;
  readonly leaseExpiresAt: Date | null;
}

export type RegulatoryInboxInsertDecision =
  | 'INSERT'
  | RegulatoryReplayDecision;

export type RegulatoryInboxClaimDecision =
  | 'CLAIM'
  | 'NOT_DUE'
  | 'ACTIVE_LEASE'
  | 'TERMINAL_STATE';

export class RegulatoryInboxAuthorityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegulatoryInboxAuthorityError';
  }
}

const REDRIVE_ACTOR_ROLES = new Set<string>([
  Role.ADMIN,
  Role.COMPLIANCE_OFFICER,
]);

const REDRIVE_STAFF_ROLES = new Set<string>([
  StaffRole.PLATFORM_OWNER,
  StaffRole.PLATFORM_ADMIN,
  StaffRole.OPERATIONS_SUPERVISOR,
  StaffRole.COMPLIANCE_STAFF,
]);

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function assertNonEmpty(value: string, field: string): void {
  if (!isNonEmpty(value)) {
    throw new RegulatoryInboxAuthorityError(`${field} is required`);
  }
}

function authorityOrganizationId(
  context: RegulatoryInboxAuthorityContext,
): string {
  const organizationId = context.organizationId ?? context.orgId;
  assertNonEmpty(organizationId, 'organizationId');
  return organizationId;
}

export function assertRegulatoryInboxAuthorityContext(
  context: RegulatoryInboxAuthorityContext,
): void {
  assertNonEmpty(context.tenantId, 'tenantId');
  authorityOrganizationId(context);
}

export function assertRegulatoryInboxIdentityAuthority(
  context: RegulatoryInboxAuthorityContext,
  identity: RegulatoryInboxIdentity,
): void {
  assertRegulatoryInboxAuthorityContext(context);
  assertNonEmpty(identity.provider, 'provider');
  assertNonEmpty(identity.externalEventId, 'externalEventId');

  if (identity.tenantId !== context.tenantId) {
    throw new RegulatoryInboxAuthorityError('tenant authority mismatch');
  }

  if (identity.organizationId !== authorityOrganizationId(context)) {
    throw new RegulatoryInboxAuthorityError('organization authority mismatch');
  }
}

export function assertRegulatoryInboxRedriveAuthority(
  user: RequestUser | undefined,
  reason: string,
  idempotencyKey: string,
): void {
  if (
    !user?.id?.trim()
    || !user.sessionId?.trim()
    || !user.membershipId?.trim()
    || !user.tenantId?.trim()
    || !user.orgId?.trim()
  ) {
    throw new RegulatoryInboxAuthorityError(
      'trusted identity is required for regulatory inbox redrive',
    );
  }

  if (!REDRIVE_ACTOR_ROLES.has(user.role)) {
    throw new RegulatoryInboxAuthorityError(
      `${RegulatoryIntegrationPermission.INBOX_REDRIVE} permission is required`,
    );
  }

  if (!user.staffRoles?.some((role) => REDRIVE_STAFF_ROLES.has(role))) {
    throw new RegulatoryInboxAuthorityError(
      `${RegulatoryIntegrationPermission.INBOX_REDRIVE} staff authority is required`,
    );
  }

  if (!user.mfaVerified) {
    throw new RegulatoryInboxAuthorityError(
      'recent MFA verification is required for regulatory inbox redrive',
    );
  }

  assertNonEmpty(reason, 'reason');
  if (reason.trim().length < 12) {
    throw new RegulatoryInboxAuthorityError(
      'reason must contain at least 12 characters',
    );
  }

  assertNonEmpty(idempotencyKey, 'idempotencyKey');
  if (idempotencyKey.trim().length > 160) {
    throw new RegulatoryInboxAuthorityError(
      'idempotencyKey must not exceed 160 characters',
    );
  }
}

export function decideRegulatoryInboxInsert(
  existing: RegulatoryInboxIdentity | null,
  incoming: RegulatoryInboxIdentity,
): RegulatoryInboxInsertDecision {
  if (existing === null) {
    return 'INSERT';
  }

  const sameIdentity = existing.tenantId === incoming.tenantId
    && existing.organizationId === incoming.organizationId
    && existing.provider === incoming.provider
    && existing.externalEventId === incoming.externalEventId;

  if (!sameIdentity) {
    throw new RegulatoryInboxAuthorityError(
      'existing inbox identity does not match incoming identity',
    );
  }

  return decideRegulatoryReplay(
    existing.rawBodySha256,
    incoming.rawBodySha256,
  );
}

function hasActiveLease(
  snapshot: RegulatoryInboxLeaseSnapshot,
  now: Date,
): boolean {
  return snapshot.leaseOwner !== null
    && snapshot.leaseExpiresAt !== null
    && snapshot.leaseExpiresAt.getTime() > now.getTime();
}

export function decideRegulatoryInboxClaim(
  snapshot: RegulatoryInboxLeaseSnapshot,
  now: Date,
): RegulatoryInboxClaimDecision {
  if (snapshot.state === 'PROCESSED'
    || snapshot.state === 'QUARANTINED'
    || snapshot.state === 'DEAD') {
    return 'TERMINAL_STATE';
  }

  if (hasActiveLease(snapshot, now)) {
    return 'ACTIVE_LEASE';
  }

  if (snapshot.state === 'RETRY'
    && snapshot.nextAttemptAt !== null
    && snapshot.nextAttemptAt.getTime() > now.getTime()) {
    return 'NOT_DUE';
  }

  if (snapshot.state === 'VERIFIED'
    || snapshot.state === 'RETRY'
    || snapshot.state === 'PROCESSING') {
    return 'CLAIM';
  }

  return 'NOT_DUE';
}

export function assertRegulatoryInboxLeaseConsistency(
  snapshot: RegulatoryInboxLeaseSnapshot,
): void {
  if (!Number.isInteger(snapshot.attempts) || snapshot.attempts < 0) {
    throw new RegulatoryInboxAuthorityError(
      'attempts must be a non-negative integer',
    );
  }

  const hasLeaseOwner = snapshot.leaseOwner !== null;
  const hasLeaseExpiry = snapshot.leaseExpiresAt !== null;

  if (hasLeaseOwner !== hasLeaseExpiry) {
    throw new RegulatoryInboxAuthorityError(
      'lease owner and expiry must be set or cleared together',
    );
  }

  if (snapshot.state === 'PROCESSING' && !hasLeaseOwner) {
    throw new RegulatoryInboxAuthorityError(
      'processing state requires an active lease identity',
    );
  }

  if (snapshot.state !== 'PROCESSING' && hasLeaseOwner) {
    throw new RegulatoryInboxAuthorityError(
      'only processing state may retain a lease',
    );
  }

  if (snapshot.state === 'RETRY' && snapshot.nextAttemptAt === null) {
    throw new RegulatoryInboxAuthorityError(
      'retry state requires nextAttemptAt',
    );
  }

  if (snapshot.state !== 'RETRY' && snapshot.nextAttemptAt !== null) {
    throw new RegulatoryInboxAuthorityError(
      'nextAttemptAt is only valid for retry state',
    );
  }
}
