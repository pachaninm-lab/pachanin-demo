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
  /** Returned once to the connector. Never persist this value. */
  readonly bearer: string;
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

/** Pure contract helper; PostgreSQL performs atomic durable lease selection. */
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
    throw new IntegrationJobLeasePolicyError('lease organization must equal command organization');
  }
  if (scope.connectionId !== envelope.connectionId) {
    throw new IntegrationJobLeasePolicyError('lease connection must equal command connection');
  }
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 15 * 60 * 1_000) {
    throw new IntegrationJobLeasePolicyError(
      'lease TTL must be a safe integer from 1 second to 15 minutes',
    );
  }
  const leaseId = randomUUID();
  const secret = randomBytes(32).toString('base64url');
  const salt = randomBytes(16).toString('hex');
  return {
    bearer: `${leaseId}.${secret}`,
    record: {
      leaseId,
      jobId,
      scope: Object.freeze({ ...scope }),
      salt,
      bearerHash: hashSecret(salt, secret),
      issuedAt: new Date(now.getTime()),
      expiresAt: new Date(now.getTime() + ttlMs),
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

export function verifyIntegrationJobLease(
  record: IntegrationJobLeaseRecord,
  bearer: string,
  expectedScope: IntegrationJobLeaseScope,
  now: Date = new Date(),
  allowTerminalReplay = false,
): IntegrationJobLeaseVerification {
  if (!recordShapeIsSafe(record) || !scopeShapeIsSafe(expectedScope)) return deny('MALFORMED');
  if (!Number.isFinite(now.getTime())) return deny('MALFORMED');
  if (record.terminalAt !== null && !allowTerminalReplay) return deny('TERMINAL');
  if (record.terminalAt === null && now.getTime() >= record.expiresAt.getTime()) return deny('EXPIRED');
  if (!sameScope(record.scope, expectedScope)) return deny('SCOPE_MISMATCH');
  const parsed = parseBearer(bearer);
  if (parsed === null || parsed.leaseId !== record.leaseId) return deny('SECRET_MISMATCH');
  const expected = safeHashBuffer(record.bearerHash);
  if (expected === null) return deny('MALFORMED');
  const actual = Buffer.from(hashSecret(record.salt, parsed.secret), 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return deny('SECRET_MISMATCH');
  }
  return { authorized: true, leaseId: record.leaseId };
}

export function integrationJobLeaseExpiryDisposition(
  record: IntegrationJobLeaseRecord,
  now: Date = new Date(),
): 'ACTIVE' | 'TERMINAL' | 'RECONCILIATION_REQUIRED' {
  if (!recordShapeIsSafe(record) || !Number.isFinite(now.getTime())) {
    throw new IntegrationJobLeasePolicyError('lease record or current time is malformed');
  }
  if (record.terminalAt !== null) return 'TERMINAL';
  return now.getTime() < record.expiresAt.getTime()
    ? 'ACTIVE'
    : 'RECONCILIATION_REQUIRED';
}

function recordShapeIsSafe(record: IntegrationJobLeaseRecord): boolean {
  try {
    nonBlank(record.leaseId, 'leaseId');
    nonBlank(record.jobId, 'jobId');
    validateScope(record.scope);
    if (!/^[a-f0-9]{32}$/.test(record.salt) || safeHashBuffer(record.bearerHash) === null) return false;
    validDate(record.issuedAt, 'issuedAt');
    validDate(record.expiresAt, 'expiresAt');
    if (record.expiresAt.getTime() <= record.issuedAt.getTime()) return false;
    if (record.acknowledgedAt !== null) validDate(record.acknowledgedAt, 'acknowledgedAt');
    if (record.terminalAt !== null) validDate(record.terminalAt, 'terminalAt');
    if ((record.terminalAt === null) !== (record.terminalResult === null)) return false;
    if ((record.terminalAt === null) !== (record.terminalCode === null)) return false;
    if (
      record.terminalResult !== null
      && !(Object.values(IntegrationJobConnectorResult) as readonly string[]).includes(record.terminalResult)
    ) return false;
    if (!Number.isSafeInteger(record.revision) || record.revision < 0) return false;
    if (!Number.isSafeInteger(record.attempt) || record.attempt < 0 || record.attempt > 100) return false;
    nonBlank(record.idempotencyKey, 'idempotencyKey');
    nonBlank(record.correlationId, 'correlationId');
    return /^[a-f0-9]{64}$/i.test(record.payloadHash);
  } catch {
    return false;
  }
}

function validateScope(scope: IntegrationJobLeaseScope): void {
  nonBlank(scope.tenantPartition, 'tenantPartition');
  if (scope.providerPartition !== 'ONE_C') {
    throw new IntegrationJobLeasePolicyError('providerPartition must be ONE_C');
  }
  nonBlank(scope.organizationId, 'organizationId');
  nonBlank(scope.connectionId, 'connectionId');
  nonBlank(scope.credentialId, 'credentialId');
}

function scopeShapeIsSafe(scope: IntegrationJobLeaseScope): boolean {
  try { validateScope(scope); return true; } catch { return false; }
}

function sameScope(a: IntegrationJobLeaseScope, b: IntegrationJobLeaseScope): boolean {
  return a.tenantPartition === b.tenantPartition
    && a.providerPartition === b.providerPartition
    && a.organizationId === b.organizationId
    && a.connectionId === b.connectionId
    && a.credentialId === b.credentialId;
}

function parseBearer(bearer: string): { leaseId: string; secret: string } | null {
  if (typeof bearer !== 'string') return null;
  const match = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/i.exec(bearer);
  return match ? { leaseId: match[1], secret: match[2] } : null;
}

function hashSecret(salt: string, secret: string): string {
  return createHash('sha256').update(`${salt}.${secret}`, 'utf8').digest('hex');
}

function safeHashBuffer(value: string): Buffer | null {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : null;
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
