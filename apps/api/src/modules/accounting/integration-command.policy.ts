import { createHash, timingSafeEqual } from 'node:crypto';

export interface IntegrationCommandEnvelope {
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly organizationId: string;
  readonly connectionId: string;
  readonly externalId: string | null;
  readonly payloadHash: string;
  readonly revision: number;
  readonly attempt: number;
}

export const IntegrationFailureClass = {
  TRANSIENT_NETWORK: 'TRANSIENT_NETWORK',
  TRANSIENT_TIMEOUT: 'TRANSIENT_TIMEOUT',
  TRANSIENT_RATE_LIMIT: 'TRANSIENT_RATE_LIMIT',
  TRANSIENT_PROVIDER_5XX: 'TRANSIENT_PROVIDER_5XX',
  BUSINESS_REJECTION: 'BUSINESS_REJECTION',
  AUTHORIZATION_REJECTED: 'AUTHORIZATION_REJECTED',
  PAYLOAD_INVALID: 'PAYLOAD_INVALID',
  PAYLOAD_HASH_MISMATCH: 'PAYLOAD_HASH_MISMATCH',
  STALE_REVISION: 'STALE_REVISION',
  UNKNOWN_RESULT: 'UNKNOWN_RESULT',
  SECURITY_HOLD: 'SECURITY_HOLD',
} as const;
export type IntegrationFailureClass =
  (typeof IntegrationFailureClass)[keyof typeof IntegrationFailureClass];

export const IntegrationRetryDisposition = {
  RETRY_TRANSIENT: 'RETRY_TRANSIENT',
  RECONCILE_BEFORE_RETRY: 'RECONCILE_BEFORE_RETRY',
  DO_NOT_RETRY: 'DO_NOT_RETRY',
  STALE_CONFLICT: 'STALE_CONFLICT',
  SECURITY_REVIEW: 'SECURITY_REVIEW',
} as const;
export type IntegrationRetryDisposition =
  (typeof IntegrationRetryDisposition)[keyof typeof IntegrationRetryDisposition];

export interface IntegrationQueuePartition {
  readonly providerPartition: string;
  readonly tenantPartition: string;
  readonly priorityClass: 'CRITICAL' | 'BUSINESS' | 'BACKGROUND';
}

export class IntegrationCommandPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrationCommandPolicyError';
  }
}

export function validateIntegrationCommandEnvelope(
  envelope: IntegrationCommandEnvelope,
): IntegrationCommandEnvelope {
  nonBlank(envelope.idempotencyKey, 'idempotencyKey');
  nonBlank(envelope.correlationId, 'correlationId');
  nonBlank(envelope.organizationId, 'organizationId');
  nonBlank(envelope.connectionId, 'connectionId');
  if (envelope.externalId !== null) nonBlank(envelope.externalId, 'externalId');

  if (!/^[a-f0-9]{64}$/i.test(envelope.payloadHash)) {
    throw new IntegrationCommandPolicyError('payloadHash must be a SHA-256 hex digest');
  }
  if (!Number.isSafeInteger(envelope.revision) || envelope.revision < 0) {
    throw new IntegrationCommandPolicyError('revision must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(envelope.attempt) || envelope.attempt < 0 || envelope.attempt > 100) {
    throw new IntegrationCommandPolicyError('attempt must be an integer from 0 to 100');
  }

  return Object.freeze({ ...envelope });
}

/**
 * Verify the exact bytes handed to the integration layer. Canonicalization is
 * a caller/domain responsibility; this function deliberately hashes only the
 * bytes it was given so two layers cannot quietly canonicalize differently.
 */
export function integrationPayloadHash(payloadBytes: Uint8Array): string {
  return createHash('sha256').update(payloadBytes).digest('hex');
}

export function verifyIntegrationPayloadHash(
  payloadBytes: Uint8Array,
  expectedHash: string,
): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(integrationPayloadHash(payloadBytes), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Exact failure direction from §§56-57. A business rejection is never blindly
 * retried; an ambiguous result is reconciled first because the provider may
 * have committed the business effect before our connection disappeared.
 */
export function retryDispositionForFailure(
  failure: IntegrationFailureClass,
): IntegrationRetryDisposition {
  switch (failure) {
    case IntegrationFailureClass.TRANSIENT_NETWORK:
    case IntegrationFailureClass.TRANSIENT_TIMEOUT:
    case IntegrationFailureClass.TRANSIENT_RATE_LIMIT:
    case IntegrationFailureClass.TRANSIENT_PROVIDER_5XX:
      return IntegrationRetryDisposition.RETRY_TRANSIENT;
    case IntegrationFailureClass.UNKNOWN_RESULT:
      return IntegrationRetryDisposition.RECONCILE_BEFORE_RETRY;
    case IntegrationFailureClass.STALE_REVISION:
      return IntegrationRetryDisposition.STALE_CONFLICT;
    case IntegrationFailureClass.PAYLOAD_HASH_MISMATCH:
    case IntegrationFailureClass.SECURITY_HOLD:
      return IntegrationRetryDisposition.SECURITY_REVIEW;
    case IntegrationFailureClass.BUSINESS_REJECTION:
    case IntegrationFailureClass.AUTHORIZATION_REJECTED:
    case IntegrationFailureClass.PAYLOAD_INVALID:
      return IntegrationRetryDisposition.DO_NOT_RETRY;
  }
}

export function staleRevisionHttpStatus(
  expectedRevision: number,
  currentRevision: number,
): 200 | 409 {
  if (
    !Number.isSafeInteger(expectedRevision)
    || expectedRevision < 0
    || !Number.isSafeInteger(currentRevision)
    || currentRevision < 0
  ) {
    throw new IntegrationCommandPolicyError('revisions must be non-negative safe integers');
  }
  return expectedRevision === currentRevision ? 200 : 409;
}

/**
 * Bounded exponential backoff with caller-supplied random fraction. The queue
 * runtime owns its RNG and clock; the policy owns the upper/lower bounds.
 */
export function integrationRetryDelayMs(
  attempt: number,
  randomFraction: number,
  baseMs = 1_000,
  capMs = 15 * 60 * 1_000,
): number {
  if (!Number.isInteger(attempt) || attempt < 0 || attempt > 100) {
    throw new IntegrationCommandPolicyError('attempt must be an integer from 0 to 100');
  }
  if (!Number.isFinite(randomFraction) || randomFraction < 0 || randomFraction > 1) {
    throw new IntegrationCommandPolicyError('randomFraction must be between 0 and 1');
  }
  if (!Number.isSafeInteger(baseMs) || baseMs < 1) {
    throw new IntegrationCommandPolicyError('baseMs must be a positive safe integer');
  }
  if (!Number.isSafeInteger(capMs) || capMs < baseMs) {
    throw new IntegrationCommandPolicyError('capMs must be a safe integer >= baseMs');
  }

  const exponent = Math.min(attempt, 30);
  const raw = Math.min(capMs, baseMs * 2 ** exponent);
  // Full jitter: [0, raw], rounded down to an integer scheduler delay.
  return Math.floor(raw * randomFraction);
}

export function validateIntegrationQueuePartition(
  partition: IntegrationQueuePartition,
): IntegrationQueuePartition {
  nonBlank(partition.providerPartition, 'providerPartition');
  nonBlank(partition.tenantPartition, 'tenantPartition');
  if (!['CRITICAL', 'BUSINESS', 'BACKGROUND'].includes(partition.priorityClass)) {
    throw new IntegrationCommandPolicyError('unknown priorityClass');
  }
  return Object.freeze({ ...partition });
}

function nonBlank(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new IntegrationCommandPolicyError(`${field} is required`);
  }
}
