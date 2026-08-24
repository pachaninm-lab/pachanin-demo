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

export class IntegrationCommandPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrationCommandPolicyError';
  }
}

export function validateIntegrationCommandEnvelope(
  envelope: IntegrationCommandEnvelope,
): IntegrationCommandEnvelope {
  boundedIdentifier(envelope.idempotencyKey, 'idempotencyKey');
  boundedIdentifier(envelope.correlationId, 'correlationId');
  boundedIdentifier(envelope.organizationId, 'organizationId');
  boundedIdentifier(envelope.connectionId, 'connectionId');
  if (envelope.externalId !== null) boundedIdentifier(envelope.externalId, 'externalId');
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
  return Math.floor(Math.min(capMs, baseMs * 2 ** Math.min(attempt, 30)) * randomFraction);
}

function boundedIdentifier(value: unknown, field: string): asserts value is string {
  if (
    typeof value !== 'string'
    || value.trim() === ''
    || value.length > 240
    || !/^[A-Za-z0-9:_.@-]+$/.test(value)
  ) {
    throw new IntegrationCommandPolicyError(`${field} is required and must be machine-safe`);
  }
}
