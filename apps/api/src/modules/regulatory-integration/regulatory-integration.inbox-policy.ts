import {
  decideRegulatoryReplay,
  type RegulatoryReplayDecision,
} from './regulatory-integration.state-machine';
import type {
  RegulatoryIntegrationState,
} from './regulatory-integration.types';

export interface RegulatoryInboxAuthorityContext {
  readonly tenantId: string;
  readonly organizationId: string;
}

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

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function assertNonEmpty(value: string, field: string): void {
  if (!isNonEmpty(value)) {
    throw new RegulatoryInboxAuthorityError(`${field} is required`);
  }
}

export function assertRegulatoryInboxAuthorityContext(
  context: RegulatoryInboxAuthorityContext,
): void {
  assertNonEmpty(context.tenantId, 'tenantId');
  assertNonEmpty(context.organizationId, 'organizationId');
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

  if (identity.organizationId !== context.organizationId) {
    throw new RegulatoryInboxAuthorityError('organization authority mismatch');
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
