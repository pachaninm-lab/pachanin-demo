import { createHash } from 'node:crypto';
import {
  FGIS_GRAIN_1_0_23_BUSINESS_OPERATION_ROWS,
} from './fgis-grain-1.0.23.operations.generated';

export const FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION =
  'pc-crop.fgis-grain-tenant-read.v1' as const;
export const FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION =
  'pc-crop.fgis-grain-tenant-read-attestation.v1' as const;
export const FGIS_GRAIN_TENANT_READ_OPERATIONAL_STATUS = 'NOT_ATTESTED' as const;

export const FGIS_GRAIN_TENANT_READ_STATES = [
  'ACCESS_REQUIRED',
  'AUTHORIZED_NOT_ATTESTED',
  'READ_ONLY_ATTESTED',
  'SUSPENDED',
  'REVOKED',
] as const;
export type FgisGrainTenantReadState =
  (typeof FGIS_GRAIN_TENANT_READ_STATES)[number];

export const FGIS_GRAIN_READ_OPERATION_CODES = Object.freeze(
  FGIS_GRAIN_1_0_23_BUSINESS_OPERATION_ROWS
    .filter((row) => row[3] === 'READ')
    .map((row) => row[0]),
);
export type FgisGrainReadOperationCode =
  (typeof FGIS_GRAIN_READ_OPERATION_CODES)[number];

const READ_OPERATION_SET = new Set<string>(FGIS_GRAIN_READ_OPERATION_CODES);
const ALL_OPERATION_SET = new Set<string>(
  FGIS_GRAIN_1_0_23_BUSINESS_OPERATION_ROWS.map((row) => row[0]),
);
const SAFE_REFERENCE =
  /^(?:authorization|evidence|object-store|provider-response|config|policy|vault):\/\/[A-Za-z0-9][A-Za-z0-9:_.\/-]{2,500}$/u;
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/u;
const VERSION = /^(?:0|[1-9][0-9]{0,18})$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const SECRET_MARKERS = [
  '-----BEGIN',
  '<Signature',
  '<soap:',
  'password=',
  'token=',
  'secret=',
  'privateKey',
  'certificateBytes',
  'Authorization:',
] as const;

export interface FgisGrainTenantReadAuthorizationInput {
  readonly schemaVersion: typeof FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION;
  readonly configurationId: string;
  readonly configurationVersion: string;
  readonly allowedOperations: readonly FgisGrainReadOperationCode[];
  readonly authorizationReference: string;
  readonly validUntil: string;
  readonly reason: string;
}

export interface FgisGrainTenantReadAttestationInput {
  readonly schemaVersion: typeof FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION;
  readonly authorizationId: string;
  readonly authorizationVersion: string;
  readonly evidenceReference: string;
  readonly validUntil: string;
  readonly justification: string;
}

export interface FgisGrainTenantReadRequestInput {
  readonly schemaVersion: typeof FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION;
  readonly authorizationId: string;
  readonly authorizationVersion: string;
  readonly operationCode: FgisGrainReadOperationCode;
  readonly requestReference: string;
  readonly requestSha256: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
}

export interface FgisGrainTenantReadTransportRequest {
  readonly operationCode: FgisGrainReadOperationCode;
  readonly requestReference: string;
  readonly requestSha256: string;
  readonly correlationId: string;
  readonly configuration: {
    readonly endpointReference: string;
    readonly tlsPolicyReference: string;
    readonly credentialReference: string;
    readonly environment: 'PRE_PRODUCTION' | 'PRODUCTION';
  };
}

export interface FgisGrainTenantReadTransportResult {
  readonly providerRequestId: string;
  readonly responseReference: string;
  readonly responseSha256: string;
  readonly receivedAt: string;
}

export interface FgisGrainTenantReadAuthorizationView {
  readonly id: string;
  readonly configurationId: string;
  readonly configurationVersion: string;
  readonly allowedOperations: readonly FgisGrainReadOperationCode[];
  readonly authorizationReference: string;
  readonly status: FgisGrainTenantReadState;
  readonly validUntil: string;
  readonly attestationEvidenceReference: string | null;
  readonly attestationValidUntil: string | null;
  readonly version: string;
  readonly blockers: readonly string[];
  readonly transportAvailable: boolean;
  readonly operationalStatus: typeof FGIS_GRAIN_TENANT_READ_OPERATIONAL_STATUS;
}

export type FgisGrainTenantReadErrorCode =
  | 'MALFORMED_AUTHORIZATION'
  | 'MALFORMED_ATTESTATION'
  | 'MALFORMED_READ_REQUEST'
  | 'MALFORMED_TRANSPORT_RESULT'
  | 'REFERENCE_INVALID'
  | 'INLINE_SECRET_FORBIDDEN'
  | 'OPERATION_UNKNOWN'
  | 'MUTATION_OPERATION_FORBIDDEN'
  | 'AUTHORIZATION_TTL_INVALID'
  | 'ATTESTATION_TTL_INVALID'
  | 'VERSION_INVALID'
  | 'FINGERPRINT_INVALID';

export class FgisGrainTenantReadContractError extends Error {
  constructor(
    readonly code: FgisGrainTenantReadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FgisGrainTenantReadContractError';
  }
}

function record(value: unknown, code: FgisGrainTenantReadErrorCode): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new FgisGrainTenantReadContractError(code, 'Expected a plain object');
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  code: FgisGrainTenantReadErrorCode,
): void {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    throw new FgisGrainTenantReadContractError(code, 'Unexpected or missing contract fields');
  }
}

function safeReference(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SAFE_REFERENCE.test(value)) {
    throw new FgisGrainTenantReadContractError('REFERENCE_INVALID', `${field} is not an approved reference`);
  }
  if (SECRET_MARKERS.some((marker) => value.includes(marker)) || value.includes('@')) {
    throw new FgisGrainTenantReadContractError('INLINE_SECRET_FORBIDDEN', `${field} contains secret material`);
  }
  return value;
}

function safeKey(
  value: unknown,
  field: string,
  code: FgisGrainTenantReadErrorCode = 'MALFORMED_READ_REQUEST',
): string {
  if (typeof value !== 'string' || !SAFE_KEY.test(value)) {
    throw new FgisGrainTenantReadContractError(code, `${field} is invalid`);
  }
  return value;
}

function version(value: unknown): string {
  if (typeof value !== 'string' || !VERSION.test(value)) {
    throw new FgisGrainTenantReadContractError('VERSION_INVALID', 'Version is invalid');
  }
  return value;
}

function futureDate(
  value: unknown,
  code: 'AUTHORIZATION_TTL_INVALID' | 'ATTESTATION_TTL_INVALID',
  now: Date,
  maxDays: number,
): string {
  if (typeof value !== 'string') {
    throw new FgisGrainTenantReadContractError(code, 'TTL is invalid');
  }
  const parsed = new Date(value);
  const ttl = parsed.getTime() - now.getTime();
  if (!Number.isFinite(parsed.getTime()) || ttl < 5 * 60_000 || ttl > maxDays * 24 * 60 * 60_000) {
    throw new FgisGrainTenantReadContractError(code, `TTL must be between 5 minutes and ${maxDays} days`);
  }
  return parsed.toISOString();
}

function reason(value: unknown, code: FgisGrainTenantReadErrorCode): string {
  if (typeof value !== 'string' || value.trim().length < 20 || value.trim().length > 2000) {
    throw new FgisGrainTenantReadContractError(code, 'Reason is invalid');
  }
  return value.trim();
}

export function assertFgisGrainReadOperation(value: unknown): FgisGrainReadOperationCode {
  if (typeof value !== 'string' || !ALL_OPERATION_SET.has(value)) {
    throw new FgisGrainTenantReadContractError('OPERATION_UNKNOWN', 'Operation is not in the accepted 1.0.23 catalog');
  }
  if (!READ_OPERATION_SET.has(value)) {
    throw new FgisGrainTenantReadContractError('MUTATION_OPERATION_FORBIDDEN', 'Only catalog-classified READ operations are allowed');
  }
  return value as FgisGrainReadOperationCode;
}

export function assertFgisGrainTenantReadAuthorizationInput(
  value: unknown,
  now = new Date(),
): FgisGrainTenantReadAuthorizationInput {
  const row = record(value, 'MALFORMED_AUTHORIZATION');
  exactKeys(row, [
    'schemaVersion',
    'configurationId',
    'configurationVersion',
    'allowedOperations',
    'authorizationReference',
    'validUntil',
    'reason',
  ], 'MALFORMED_AUTHORIZATION');
  if (row.schemaVersion !== FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION) {
    throw new FgisGrainTenantReadContractError('MALFORMED_AUTHORIZATION', 'Schema version mismatch');
  }
  const configurationId = safeKey(row.configurationId, 'configurationId');
  if (!Array.isArray(row.allowedOperations) || row.allowedOperations.length < 1) {
    throw new FgisGrainTenantReadContractError('MALFORMED_AUTHORIZATION', 'At least one read operation is required');
  }
  const allowedOperations = [...new Set(row.allowedOperations.map(assertFgisGrainReadOperation))].sort();
  if (allowedOperations.length !== row.allowedOperations.length) {
    throw new FgisGrainTenantReadContractError('MALFORMED_AUTHORIZATION', 'Duplicate read operations are forbidden');
  }
  return Object.freeze({
    schemaVersion: FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION,
    configurationId,
    configurationVersion: version(row.configurationVersion),
    allowedOperations,
    authorizationReference: safeReference(row.authorizationReference, 'authorizationReference'),
    validUntil: futureDate(row.validUntil, 'AUTHORIZATION_TTL_INVALID', now, 90),
    reason: reason(row.reason, 'MALFORMED_AUTHORIZATION'),
  });
}

export function assertFgisGrainTenantReadAttestationInput(
  value: unknown,
  now = new Date(),
): FgisGrainTenantReadAttestationInput {
  const row = record(value, 'MALFORMED_ATTESTATION');
  exactKeys(row, [
    'schemaVersion',
    'authorizationId',
    'authorizationVersion',
    'evidenceReference',
    'validUntil',
    'justification',
  ], 'MALFORMED_ATTESTATION');
  if (row.schemaVersion !== FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION) {
    throw new FgisGrainTenantReadContractError('MALFORMED_ATTESTATION', 'Schema version mismatch');
  }
  return Object.freeze({
    schemaVersion: FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
    authorizationId: safeKey(row.authorizationId, 'authorizationId'),
    authorizationVersion: version(row.authorizationVersion),
    evidenceReference: safeReference(row.evidenceReference, 'evidenceReference'),
    validUntil: futureDate(row.validUntil, 'ATTESTATION_TTL_INVALID', now, 30),
    justification: reason(row.justification, 'MALFORMED_ATTESTATION'),
  });
}

export function assertFgisGrainTenantReadRequestInput(
  value: unknown,
): FgisGrainTenantReadRequestInput {
  const row = record(value, 'MALFORMED_READ_REQUEST');
  exactKeys(row, [
    'schemaVersion',
    'authorizationId',
    'authorizationVersion',
    'operationCode',
    'requestReference',
    'requestSha256',
    'correlationId',
    'idempotencyKey',
  ], 'MALFORMED_READ_REQUEST');
  if (row.schemaVersion !== FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION) {
    throw new FgisGrainTenantReadContractError('MALFORMED_READ_REQUEST', 'Schema version mismatch');
  }
  if (typeof row.requestSha256 !== 'string' || !SHA256.test(row.requestSha256)) {
    throw new FgisGrainTenantReadContractError('FINGERPRINT_INVALID', 'Request fingerprint is invalid');
  }
  return Object.freeze({
    schemaVersion: FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION,
    authorizationId: safeKey(row.authorizationId, 'authorizationId'),
    authorizationVersion: version(row.authorizationVersion),
    operationCode: assertFgisGrainReadOperation(row.operationCode),
    requestReference: safeReference(row.requestReference, 'requestReference'),
    requestSha256: row.requestSha256,
    correlationId: safeKey(row.correlationId, 'correlationId'),
    idempotencyKey: safeKey(row.idempotencyKey, 'idempotencyKey'),
  });
}

export function assertFgisGrainTenantReadTransportResult(
  value: unknown,
): FgisGrainTenantReadTransportResult {
  const row = record(value, 'MALFORMED_TRANSPORT_RESULT');
  exactKeys(row, [
    'providerRequestId',
    'responseReference',
    'responseSha256',
    'receivedAt',
  ], 'MALFORMED_TRANSPORT_RESULT');
  const responseReference = safeReference(
    row.responseReference,
    'responseReference',
  );
  if (
    !responseReference.startsWith('provider-response://')
    && !responseReference.startsWith('object-store://')
  ) {
    throw new FgisGrainTenantReadContractError(
      'REFERENCE_INVALID',
      'responseReference is not an approved provider-result reference',
    );
  }
  if (typeof row.responseSha256 !== 'string' || !SHA256.test(row.responseSha256)) {
    throw new FgisGrainTenantReadContractError(
      'FINGERPRINT_INVALID',
      'Response fingerprint is invalid',
    );
  }
  if (typeof row.receivedAt !== 'string') {
    throw new FgisGrainTenantReadContractError(
      'MALFORMED_TRANSPORT_RESULT',
      'receivedAt is invalid',
    );
  }
  const receivedAt = new Date(row.receivedAt);
  if (!Number.isFinite(receivedAt.getTime())) {
    throw new FgisGrainTenantReadContractError(
      'MALFORMED_TRANSPORT_RESULT',
      'receivedAt is invalid',
    );
  }
  return Object.freeze({
    providerRequestId: safeKey(
      row.providerRequestId,
      'providerRequestId',
      'MALFORMED_TRANSPORT_RESULT',
    ),
    responseReference,
    responseSha256: row.responseSha256,
    receivedAt: receivedAt.toISOString(),
  });
}

export function canonicalFgisGrainTenantReadHash(value: unknown): string {
  const canonical = JSON.stringify(value, (_key, item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right)));
    }
    return item;
  });
  return createHash('sha256').update(canonical).digest('hex');
}
