import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  validateIntegrationCommandEnvelope,
  type IntegrationCommandEnvelope,
} from './integration-command.policy';

export interface IntegrationJobLeaseScope {
  readonly tenantPartition: string;
  readonly providerPartition: string;
  readonly organizationId: string;
  readonly connectionId: string;
  readonly credentialId: string;
}

export const IntegrationJobConnectorResult = {
  REPORTED_SUCCESS: 'REPORTED_SUCCESS',
  BUSINESS_REJECTION: 'BUSINESS_REJECTION',
  UNKNOWN_RESULT: 'UNKNOWN_RESULT',
} as const;
export type IntegrationJobConnectorResult =
  (typeof IntegrationJobConnectorResult)[keyof typeof IntegrationJobConnectorResult];

export interface IntegrationJobLeaseRecord {
  readonly leaseId: string;
  readonly jobId: string;
  readonly scope: IntegrationJobLeaseScope;
  readonly salt: string;
  readonly bearerHash: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly acknowledgedAt: Date | null;
  readonly terminalAt: Date | null;
  readonly terminalResult: IntegrationJobConnectorResult | null;
  readonly terminalCode: string | null;
  readonly externalEvidenceId: string | null;
  readonly revision: number;
  readonly attempt: number;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly payloadHash: string;
}

export interface IntegrationJobLeaseIssue {
  /** Returned once to the machine. Never persist this value. */
  readonly bearer: string;
  /** Safe persistent shape. */
  readonly record: IntegrationJobLeaseRecord;
}

export type IntegrationJobLeaseDenial =
  | 'MALFORMED'
  | 'SCOPE_MISMATCH'
  | 'SECRET_MISMATCH'
  | 'EXPIRED'
  | 'TERMINAL';

export type IntegrationJobLeaseVerification =
  | { readonly authorized: true; readonly leaseId: string }
  | { readonly authorized: false; readonly reason: IntegrationJobLeaseDenial };

export class IntegrationJobLeasePolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrationJobLeasePolicyError';
  }
}

/**
 * Issue one short-lived pull lease for one already-created integration command.
 * The durable repository is responsible for atomically selecting the job and
 * storing this record; this pure function defines what a valid lease is.
 */
export function issueIntegrationJobLease(
  jobId: string,
  envelope: IntegrationCommandEnvelope,
  scope: IntegrationJobLeaseScope,
  now: Date = new Date(),
  ttlMs = 60_000,
): IntegrationJobLeaseIssue {
  nonBlank(jobId, 'jobId');
  validateIntegrationCommandEnvelope(envelope);
  validateScope(scope);
  validDate(now, 'issuedAt');

  if (scope.organizationId !== envelope.organizationId) {
    throw new IntegrationJobLeasePolicyError(
      'lease organization must equal command organization',
    );
  }
  if (scope.connectionId !== envelope.connectionId) {
    throw new IntegrationJobLeasePolicyError(
      'lease connection must equal command connection',
    );
  }
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 15 * 60 * 1_000) {
    throw new IntegrationJobLeasePolicyError(
      'lease TTL must be a safe integer from 1 second to 15 minutes',
    );
  }

  const leaseId = randomUUID();
  const secret = randomBytes(32).toString('base64url');
  const salt = randomBytes(16).toString('hex');
  const issuedAt = new Date(now.getTime());

  return {
    bearer: `${leaseId}.${secret}`,
    record: {
      leaseId,
      jobId,
      scope: freezeScope(scope),
      salt,
      bearerHash: hashSecret(salt, secret),
      issuedAt,
      expiresAt: new Date(issuedAt.getTime() + ttlMs),
      acknowledgedAt: null,
      terminalAt: null,
      terminalResult: null,
      terminalCode: null,
      externalEvidenceId: null,
      revision: envelope.revision,
      attempt: envelope.attempt,
      idempotencyKey: envelope.idempotencyKey,
      correlationId: envelope.correlationId,
      payloadHash: envelope.payloadHash,
    },
  };
}

/**
 * Verify possession against server-owned scope. The bearer itself carries no
 * tenant, organization, connection or provider claim that can be edited by the
 * connector.
 */
export function verifyIntegrationJobLease(
  record: IntegrationJobLeaseRecord,
  bearer: string,
  expectedScope: IntegrationJobLeaseScope,
  now: Date = new Date(),
): IntegrationJobLeaseVerification {
  if (!recordShapeIsSafe(record) || !scopeShapeIsSafe(expectedScope)) {
    return deny('MALFORMED');
  }
  if (!Number.isFinite(now.getTime())) return deny('MALFORMED');
  if (record.terminalAt !== null) return deny('TERMINAL');
  if (now.getTime() >= record.expiresAt.getTime()) return deny('EXPIRED');

  if (!sameScope(record.scope, expectedScope)) return deny('SCOPE_MISMATCH');

  const parsed = parseBearer(bearer);
  if (parsed === null || parsed.leaseId !== record.leaseId) {
    return deny('SECRET_MISMATCH');
  }

  const expected = safeHashBuffer(record.bearerHash);
  if (expected === null) return deny('MALFORMED');
  const actual = Buffer.from(hashSecret(record.salt, parsed.secret), 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return deny('SECRET_MISMATCH');
  }

  return { authorized: true, leaseId: record.leaseId };
}

/**
 * ACK is idempotent while the lease is valid. It is operational evidence that
 * the connector accepted ownership, not a second authorization source.
 */
export function acknowledgeIntegrationJobLease(
  record: IntegrationJobLeaseRecord,
  now: Date = new Date(),
): IntegrationJobLeaseRecord {
  requireMutableValidLease(record, now);
  if (record.acknowledgedAt !== null) return record;
  return Object.freeze({ ...record, acknowledgedAt: new Date(now.getTime()) });
}

/**
 * One lease accepts one terminal connector report. A connector-reported success
 * is deliberately named REPORTED_SUCCESS: it is not Connection Center live
 * evidence and cannot by itself promote a provider to CONFIRMED_LIVE.
 */
export function recordIntegrationJobTerminalResult(
  record: IntegrationJobLeaseRecord,
  input: {
    readonly result: IntegrationJobConnectorResult;
    readonly code: string;
    readonly externalEvidenceId?: string | null;
  },
  now: Date = new Date(),
): IntegrationJobLeaseRecord {
  requireMutableValidLease(record, now);
  if (!isConnectorResult(input.result)) {
    throw new IntegrationJobLeasePolicyError('unknown connector result');
  }
  safeCode(input.code, 'code');

  const externalEvidenceId = input.externalEvidenceId ?? null;
  if (externalEvidenceId !== null) nonBlank(externalEvidenceId, 'externalEvidenceId');
  if (
    input.result === IntegrationJobConnectorResult.REPORTED_SUCCESS
    && externalEvidenceId === null
  ) {
    throw new IntegrationJobLeasePolicyError(
      'REPORTED_SUCCESS requires an external evidence identifier',
    );
  }

  return Object.freeze({
    ...record,
    terminalAt: new Date(now.getTime()),
    terminalResult: input.result,
    terminalCode: input.code,
    externalEvidenceId,
  });
}

/**
 * A lease that expires after delivery is ambiguous. The machine may have
 * committed the business effect and lost the result response. Therefore expiry
 * is not an automatic requeue signal; reconciliation comes first.
 */
export function integrationJobLeaseExpiryDisposition(
  record: IntegrationJobLeaseRecord,
  now: Date = new Date(),
): 'ACTIVE' | 'TERMINAL' | 'RECONCILIATION_REQUIRED' {
  if (!recordShapeIsSafe(record) || !Number.isFinite(now.getTime())) {
    throw new IntegrationJobLeasePolicyError('lease record or current time is malformed');
  }
  if (record.terminalAt !== null) return 'TERMINAL';
  if (now.getTime() < record.expiresAt.getTime()) return 'ACTIVE';
  return 'RECONCILIATION_REQUIRED';
}

export function terminalResultRequiresReconciliation(
  result: IntegrationJobConnectorResult,
): boolean {
  if (!isConnectorResult(result)) {
    throw new IntegrationJobLeasePolicyError('unknown connector result');
  }
  return result === IntegrationJobConnectorResult.UNKNOWN_RESULT;
}

function requireMutableValidLease(
  record: IntegrationJobLeaseRecord,
  now: Date,
): void {
  if (!recordShapeIsSafe(record)) {
    throw new IntegrationJobLeasePolicyError('lease record is malformed');
  }
  validDate(now, 'now');
  if (record.terminalAt !== null) {
    throw new IntegrationJobLeasePolicyError('lease already has a terminal result');
  }
  if (now.getTime() >= record.expiresAt.getTime()) {
    throw new IntegrationJobLeasePolicyError(
      'expired lease cannot accept acknowledgement or result',
    );
  }
}

function recordShapeIsSafe(record: IntegrationJobLeaseRecord): boolean {
  try {
    nonBlank(record.leaseId, 'leaseId');
    nonBlank(record.jobId, 'jobId');
    validateScope(record.scope);
    nonBlank(record.salt, 'salt');
    if (safeHashBuffer(record.bearerHash) === null) return false;
    validDate(record.issuedAt, 'issuedAt');
    validDate(record.expiresAt, 'expiresAt');
    if (record.expiresAt.getTime() <= record.issuedAt.getTime()) return false;
    if (record.acknowledgedAt !== null) validDate(record.acknowledgedAt, 'acknowledgedAt');
    if (record.terminalAt !== null) validDate(record.terminalAt, 'terminalAt');
    if ((record.terminalAt === null) !== (record.terminalResult === null)) return false;
    if ((record.terminalAt === null) !== (record.terminalCode === null)) return false;
    if (record.terminalResult !== null && !isConnectorResult(record.terminalResult)) return false;
    if (record.terminalCode !== null) safeCode(record.terminalCode, 'terminalCode');
    if (record.externalEvidenceId !== null) nonBlank(record.externalEvidenceId, 'externalEvidenceId');
    if (!Number.isSafeInteger(record.revision) || record.revision < 0) return false;
    if (!Number.isSafeInteger(record.attempt) || record.attempt < 0 || record.attempt > 100) return false;
    nonBlank(record.idempotencyKey, 'idempotencyKey');
    nonBlank(record.correlationId, 'correlationId');
    if (!/^[a-f0-9]{64}$/i.test(record.payloadHash)) return false;
    return true;
  } catch {
    return false;
  }
}

function validateScope(scope: IntegrationJobLeaseScope): void {
  nonBlank(scope.tenantPartition, 'tenantPartition');
  nonBlank(scope.providerPartition, 'providerPartition');
  nonBlank(scope.organizationId, 'organizationId');
  nonBlank(scope.connectionId, 'connectionId');
  nonBlank(scope.credentialId, 'credentialId');
}

function scopeShapeIsSafe(scope: IntegrationJobLeaseScope): boolean {
  try {
    validateScope(scope);
    return true;
  } catch {
    return false;
  }
}

function sameScope(a: IntegrationJobLeaseScope, b: IntegrationJobLeaseScope): boolean {
  return (
    a.tenantPartition === b.tenantPartition
    && a.providerPartition === b.providerPartition
    && a.organizationId === b.organizationId
    && a.connectionId === b.connectionId
    && a.credentialId === b.credentialId
  );
}

function freezeScope(scope: IntegrationJobLeaseScope): IntegrationJobLeaseScope {
  return Object.freeze({ ...scope });
}

function parseBearer(bearer: string): { readonly leaseId: string; readonly secret: string } | null {
  if (typeof bearer !== 'string') return null;
  const separator = bearer.indexOf('.');
  if (separator <= 0 || separator !== bearer.lastIndexOf('.')) return null;
  const leaseId = bearer.slice(0, separator);
  const secret = bearer.slice(separator + 1);
  if (leaseId.trim() === '' || secret.length < 32) return null;
  return { leaseId, secret };
}

function hashSecret(salt: string, secret: string): string {
  return createHash('sha256').update(`${salt}.${secret}`, 'utf8').digest('hex');
}

function safeHashBuffer(value: string): Buffer | null {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) return null;
  return Buffer.from(value, 'hex');
}

function isConnectorResult(value: unknown): value is IntegrationJobConnectorResult {
  return (
    typeof value === 'string'
    && (Object.values(IntegrationJobConnectorResult) as readonly string[]).includes(value)
  );
}

function safeCode(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Z0-9][A-Z0-9_.:-]{0,95}$/.test(value)) {
    throw new IntegrationJobLeasePolicyError(`${field} must be a bounded machine-safe code`);
  }
}

function nonBlank(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new IntegrationJobLeasePolicyError(`${field} is required`);
  }
}

function validDate(value: Date, field: string): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new IntegrationJobLeasePolicyError(`${field} must be a valid date`);
  }
}

function deny(reason: IntegrationJobLeaseDenial): IntegrationJobLeaseVerification {
  return { authorized: false, reason };
}
