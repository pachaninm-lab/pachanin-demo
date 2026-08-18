import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  ONE_C_PROTOCOL_VERSION,
  isOneCCommand,
  type OneCCommand,
} from './one-c-connector.protocol';

/**
 * The local/server 1C connector authenticates as a machine, not as the farmer
 * and not as the accountant. The server-side record below is the authority.
 * The bearer secret proves possession only; it carries no self-asserted org or
 * role claims and therefore cannot widen itself by editing a token payload.
 */
export interface OneCMachineCredentialScope {
  readonly connectorInstallationId: string;
  readonly connectionId: string;
  readonly platformOrganizationId: string;
  readonly oneCOrganizationGuid: string;
  readonly protocolVersion: string;
  readonly allowedCommands: readonly OneCCommand[];
}

export interface OneCMachineCredentialRecord {
  readonly credentialId: string;
  readonly salt: string;
  readonly secretHash: string;
  readonly scope: OneCMachineCredentialScope;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly version: number;
}

export interface OneCMachineCredentialIssue {
  /** Returned once. Persistent state must never contain this value. */
  readonly bearer: string;
  /** Safe persistent representation. */
  readonly record: OneCMachineCredentialRecord;
}

export interface OneCMachineCredentialExpectedScope {
  readonly connectorInstallationId: string;
  readonly connectionId: string;
  readonly platformOrganizationId: string;
  readonly oneCOrganizationGuid: string;
  readonly protocolVersion: string;
  readonly command?: OneCCommand;
}

export type OneCMachineCredentialDenial =
  | 'MALFORMED'
  | 'NOT_YET_VALID'
  | 'EXPIRED'
  | 'REVOKED'
  | 'SCOPE_MISMATCH'
  | 'COMMAND_NOT_ALLOWED'
  | 'SECRET_MISMATCH';

export type OneCMachineCredentialVerification =
  | { readonly authorized: true; readonly credentialId: string }
  | { readonly authorized: false; readonly reason: OneCMachineCredentialDenial };

export class OneCMachineCredentialPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OneCMachineCredentialPolicyError';
  }
}

export function issueOneCMachineCredential(
  scope: OneCMachineCredentialScope,
  expiresAt: Date,
  now: Date = new Date(),
): OneCMachineCredentialIssue {
  validateScope(scope);
  validateDate(now, 'issuedAt');
  validateDate(expiresAt, 'expiresAt');
  if (expiresAt.getTime() <= now.getTime()) {
    throw new OneCMachineCredentialPolicyError('expiresAt must be after issuedAt');
  }

  const credentialId = randomUUID();
  const secret = randomBytes(32).toString('base64url');
  const salt = randomBytes(16).toString('hex');

  return {
    bearer: `${credentialId}.${secret}`,
    record: {
      credentialId,
      salt,
      secretHash: secretHash(salt, secret),
      scope: freezeScope(scope),
      issuedAt: new Date(now.getTime()),
      expiresAt: new Date(expiresAt.getTime()),
      revokedAt: null,
      version: 1,
    },
  };
}

/**
 * Verify against server-owned persistent scope. The presented bearer does not
 * contain an organization claim to trust. Revocation is immediate once the
 * repository changes revokedAt because every request must read this record.
 */
export function verifyOneCMachineCredential(
  record: OneCMachineCredentialRecord,
  bearer: string,
  expected: OneCMachineCredentialExpectedScope,
  now: Date = new Date(),
): OneCMachineCredentialVerification {
  if (!isPersistedRecordShapeSafe(record) || !isExpectedScopeShapeSafe(expected)) {
    return deny('MALFORMED');
  }

  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return deny('MALFORMED');
  if (record.revokedAt !== null) return deny('REVOKED');
  if (nowMs < record.issuedAt.getTime()) return deny('NOT_YET_VALID');
  if (nowMs >= record.expiresAt.getTime()) return deny('EXPIRED');

  if (
    expected.connectorInstallationId !== record.scope.connectorInstallationId
    || expected.connectionId !== record.scope.connectionId
    || expected.platformOrganizationId !== record.scope.platformOrganizationId
    || expected.oneCOrganizationGuid !== record.scope.oneCOrganizationGuid
    || expected.protocolVersion !== record.scope.protocolVersion
  ) {
    return deny('SCOPE_MISMATCH');
  }

  if (
    expected.command !== undefined
    && !record.scope.allowedCommands.includes(expected.command)
  ) {
    return deny('COMMAND_NOT_ALLOWED');
  }

  const parsed = parseBearer(bearer);
  if (parsed === null || parsed.credentialId !== record.credentialId) {
    return deny('SECRET_MISMATCH');
  }

  const actual = Buffer.from(secretHash(record.salt, parsed.secret), 'hex');
  const persisted = safeHexBuffer(record.secretHash);
  if (
    persisted === null
    || actual.length !== persisted.length
    || !timingSafeEqual(actual, persisted)
  ) {
    return deny('SECRET_MISMATCH');
  }

  return { authorized: true, credentialId: record.credentialId };
}

/**
 * Pure helper for the future repository. The database transaction remains the
 * authority for concurrent revocation/rotation; this function only defines the
 * new immutable value that should be written.
 */
export function revokedOneCMachineCredential(
  record: OneCMachineCredentialRecord,
  now: Date = new Date(),
): OneCMachineCredentialRecord {
  if (!isPersistedRecordShapeSafe(record)) {
    throw new OneCMachineCredentialPolicyError('credential record is malformed');
  }
  validateDate(now, 'revokedAt');
  if (now.getTime() < record.issuedAt.getTime()) {
    throw new OneCMachineCredentialPolicyError('revokedAt cannot precede issuedAt');
  }
  if (record.revokedAt !== null) return record;

  return {
    ...record,
    revokedAt: new Date(now.getTime()),
    version: record.version + 1,
  };
}

function validateScope(scope: OneCMachineCredentialScope): void {
  nonBlank(scope.connectorInstallationId, 'connectorInstallationId');
  nonBlank(scope.connectionId, 'connectionId');
  nonBlank(scope.platformOrganizationId, 'platformOrganizationId');
  nonBlank(scope.oneCOrganizationGuid, 'oneCOrganizationGuid');
  if (scope.protocolVersion !== ONE_C_PROTOCOL_VERSION) {
    throw new OneCMachineCredentialPolicyError(
      `protocolVersion must be ${ONE_C_PROTOCOL_VERSION}`,
    );
  }

  const unique = new Set<string>();
  for (const command of scope.allowedCommands) {
    if (!isOneCCommand(command)) {
      throw new OneCMachineCredentialPolicyError(
        `unsupported allowed command: ${String(command)}`,
      );
    }
    if (unique.has(command)) {
      throw new OneCMachineCredentialPolicyError(
        `duplicate allowed command: ${command}`,
      );
    }
    unique.add(command);
  }
}

function isPersistedRecordShapeSafe(record: OneCMachineCredentialRecord): boolean {
  try {
    nonBlank(record.credentialId, 'credentialId');
    nonBlank(record.salt, 'salt');
    validateScope(record.scope);
    validateDate(record.issuedAt, 'issuedAt');
    validateDate(record.expiresAt, 'expiresAt');
    if (record.revokedAt !== null) validateDate(record.revokedAt, 'revokedAt');
    if (!Number.isInteger(record.version) || record.version < 1) return false;
    if (record.expiresAt.getTime() <= record.issuedAt.getTime()) return false;
    if (safeHexBuffer(record.secretHash) === null) return false;
    return true;
  } catch {
    return false;
  }
}

function isExpectedScopeShapeSafe(
  expected: OneCMachineCredentialExpectedScope,
): boolean {
  try {
    nonBlank(expected.connectorInstallationId, 'connectorInstallationId');
    nonBlank(expected.connectionId, 'connectionId');
    nonBlank(expected.platformOrganizationId, 'platformOrganizationId');
    nonBlank(expected.oneCOrganizationGuid, 'oneCOrganizationGuid');
    if (expected.protocolVersion !== ONE_C_PROTOCOL_VERSION) return false;
    if (expected.command !== undefined && !isOneCCommand(expected.command)) return false;
    return true;
  } catch {
    return false;
  }
}

function parseBearer(
  bearer: string,
): { readonly credentialId: string; readonly secret: string } | null {
  if (typeof bearer !== 'string') return null;
  const separator = bearer.indexOf('.');
  if (separator <= 0 || separator !== bearer.lastIndexOf('.')) return null;

  const credentialId = bearer.slice(0, separator);
  const secret = bearer.slice(separator + 1);
  if (credentialId.trim() === '' || secret.length < 32) return null;
  return { credentialId, secret };
}

function freezeScope(scope: OneCMachineCredentialScope): OneCMachineCredentialScope {
  return Object.freeze({
    connectorInstallationId: scope.connectorInstallationId,
    connectionId: scope.connectionId,
    platformOrganizationId: scope.platformOrganizationId,
    oneCOrganizationGuid: scope.oneCOrganizationGuid,
    protocolVersion: scope.protocolVersion,
    allowedCommands: Object.freeze([...scope.allowedCommands]),
  });
}

function secretHash(salt: string, secret: string): string {
  return createHash('sha256').update(`${salt}.${secret}`, 'utf8').digest('hex');
}

function safeHexBuffer(value: string): Buffer | null {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) return null;
  return Buffer.from(value, 'hex');
}

function deny(reason: OneCMachineCredentialDenial): OneCMachineCredentialVerification {
  return { authorized: false, reason };
}

function nonBlank(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new OneCMachineCredentialPolicyError(`${field} is required`);
  }
}

function validateDate(value: Date, field: string): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new OneCMachineCredentialPolicyError(`${field} must be a valid date`);
  }
}
