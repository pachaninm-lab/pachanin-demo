import { Injectable } from '@nestjs/common';
import {
  FGIS_GRAIN_1_0_23_CATALOG_SHA256,
  FGIS_GRAIN_1_0_23_DOCUMENTATION_ENDPOINT,
  FGIS_GRAIN_1_0_23_MAPPING_VERSION,
  FGIS_GRAIN_1_0_23_PACKAGE_SHA256,
  FGIS_GRAIN_1_0_23_TRANSPORT_OPERATIONS,
  type FgisGrainBusinessFamily,
  type FgisGrainBusinessOperationCode,
} from './fgis-grain-1.0.23.generated';
import {
  FGIS_GRAIN_1_0_23_BUSINESS_OPERATIONS,
  type FgisGrainBusinessOperation,
} from './fgis-grain-1.0.23.operations.generated';

export const FGIS_GRAIN_1_0_23_ADAPTER_CODE = 'FGIS_ZERNO' as const;
export const FGIS_GRAIN_1_0_23_API_VERSION = '1.0.23' as const;
export const FGIS_GRAIN_1_0_23_OPERATIONAL_STATUS = 'NOT_ATTESTED' as const;
export const FGIS_GRAIN_1_0_23_HONEST_STATUS = 'ADAPTER_READY' as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:_.\/-]{2,239}$/u;
const CLIENT_AUTHORITY_FIELDS = new Set([
  'role',
  'tenantId',
  'organizationId',
  'orgId',
  'membershipId',
  'hasJitAuthority',
]);

export type FgisGrain1023EnvelopeDirection = 'REQUEST' | 'RESPONSE';

export type FgisGrain1023SignatureMetadataReference = Readonly<{
  algorithm: string;
  keyReference: string;
  keyVersion: string;
  signatureVersion: string;
  verificationPolicyVersion: string;
}>;

export type FgisGrain1023BusinessEnvelope = Readonly<{
  adapterCode: typeof FGIS_GRAIN_1_0_23_ADAPTER_CODE;
  apiVersion: typeof FGIS_GRAIN_1_0_23_API_VERSION;
  packageSha256: typeof FGIS_GRAIN_1_0_23_PACKAGE_SHA256;
  catalogSha256: typeof FGIS_GRAIN_1_0_23_CATALOG_SHA256;
  mappingVersion: typeof FGIS_GRAIN_1_0_23_MAPPING_VERSION;
  direction: FgisGrain1023EnvelopeDirection;
  operationCode: FgisGrainBusinessOperationCode;
  family: FgisGrainBusinessFamily;
  elementQName: string;
  transportOperation: 'SendRequest' | 'SendResponse';
  messageId: string;
  correlationId: string;
  causationId: string | null;
  contentSha256: string;
  signatureMetadata: FgisGrain1023SignatureMetadataReference | null;
}>;

export type FgisGrain1023AckEnvelope = Readonly<{
  adapterCode: typeof FGIS_GRAIN_1_0_23_ADAPTER_CODE;
  apiVersion: typeof FGIS_GRAIN_1_0_23_API_VERSION;
  catalogSha256: typeof FGIS_GRAIN_1_0_23_CATALOG_SHA256;
  transportOperation: 'Ack';
  messageId: string;
  correlationId: string;
  responseMessageId: string;
}>;

export type FgisGrain1023ContractErrorCode =
  | 'INPUT_INVALID'
  | 'CLIENT_AUTHORITY_FIELD_FORBIDDEN'
  | 'ADAPTER_CODE_MISMATCH'
  | 'API_VERSION_MISMATCH'
  | 'PACKAGE_HASH_MISMATCH'
  | 'CATALOG_HASH_MISMATCH'
  | 'MAPPING_VERSION_MISMATCH'
  | 'OPERATION_UNKNOWN'
  | 'FAMILY_MISMATCH'
  | 'DIRECTION_INVALID'
  | 'QNAME_MISMATCH'
  | 'TRANSPORT_OPERATION_MISMATCH'
  | 'MESSAGE_ID_INVALID'
  | 'REFERENCE_INVALID'
  | 'CONTENT_HASH_INVALID'
  | 'FAULT_QNAME_UNKNOWN'
  | 'PLACEHOLDER_ENDPOINT_FORBIDDEN'
  | 'RUNTIME_ENDPOINT_OUT_OF_SCOPE'
  | 'RUNTIME_ENDPOINT_INVALID';

export class FgisGrain1023ContractError extends Error {
  constructor(
    readonly code: FgisGrain1023ContractErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FgisGrain1023ContractError';
  }
}

const OPERATIONS: readonly FgisGrainBusinessOperation[] = Object.freeze(
  FGIS_GRAIN_1_0_23_BUSINESS_OPERATIONS.map((operation) =>
    Object.freeze({ ...operation }),
  ),
);
const OPERATION_BY_CODE = new Map<string, FgisGrainBusinessOperation>(
  OPERATIONS.map((operation) => [operation.code, operation]),
);
const TRANSPORT_BY_NAME = new Map(
  FGIS_GRAIN_1_0_23_TRANSPORT_OPERATIONS.map((operation) => [
    operation.name,
    operation,
  ]),
);
const FAULT_QNAMES = new Set(
  FGIS_GRAIN_1_0_23_TRANSPORT_OPERATIONS.map(
    (operation) => operation.faultQName,
  ),
);

if (OPERATIONS.length !== 57 || OPERATION_BY_CODE.size !== 57) {
  throw new Error('FGIS Grain API 1.0.23 operation catalog is inconsistent.');
}
if (TRANSPORT_BY_NAME.size !== 3) {
  throw new Error('FGIS Grain API 1.0.23 transport catalog is inconsistent.');
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new FgisGrain1023ContractError(
      'INPUT_INVALID',
      'FGIS contract input must be an object.',
    );
  }
  return value as Record<string, unknown>;
}

function enforceExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (CLIENT_AUTHORITY_FIELDS.has(key)) {
      throw new FgisGrain1023ContractError(
        'CLIENT_AUTHORITY_FIELD_FORBIDDEN',
        `${key} is server-derived and forbidden in the FGIS contract.`,
      );
    }
    if (!allowedSet.has(key)) {
      throw new FgisGrain1023ContractError(
        'INPUT_INVALID',
        `Unexpected FGIS contract field: ${key}.`,
      );
    }
  }
}

function requiredString(
  value: Record<string, unknown>,
  key: string,
  maximum = 240,
): string {
  const candidate = value[key];
  if (
    typeof candidate !== 'string'
    || candidate.length === 0
    || candidate.length > maximum
  ) {
    throw new FgisGrain1023ContractError(
      'INPUT_INVALID',
      `${key} must be a non-empty bounded string.`,
    );
  }
  return candidate;
}

function assertUuid(value: string, field: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new FgisGrain1023ContractError(
      'MESSAGE_ID_INVALID',
      `${field} must be a canonical UUID.`,
    );
  }
}

function assertReference(value: string, field: string): void {
  if (!SAFE_REFERENCE_PATTERN.test(value)) {
    throw new FgisGrain1023ContractError(
      'REFERENCE_INVALID',
      `${field} contains an invalid reference.`,
    );
  }
}

function parseSignatureMetadata(
  value: unknown,
): FgisGrain1023SignatureMetadataReference | null {
  if (value === null) return null;
  const source = asRecord(value);
  enforceExactKeys(source, [
    'algorithm',
    'keyReference',
    'keyVersion',
    'signatureVersion',
    'verificationPolicyVersion',
  ]);
  const result = {
    algorithm: requiredString(source, 'algorithm', 80),
    keyReference: requiredString(source, 'keyReference'),
    keyVersion: requiredString(source, 'keyVersion', 80),
    signatureVersion: requiredString(source, 'signatureVersion', 80),
    verificationPolicyVersion: requiredString(
      source,
      'verificationPolicyVersion',
      80,
    ),
  };
  for (const [key, reference] of Object.entries(result)) {
    assertReference(reference, `signatureMetadata.${key}`);
  }
  return Object.freeze(result);
}

export function getFgisGrain1023Operation(
  operationCode: string,
): FgisGrainBusinessOperation {
  const operation = OPERATION_BY_CODE.get(operationCode);
  if (!operation) {
    throw new FgisGrain1023ContractError(
      'OPERATION_UNKNOWN',
      `Unknown FGIS Grain API 1.0.23 operation: ${operationCode}.`,
    );
  }
  return operation;
}

export function assertFgisGrain1023BusinessEnvelope(
  input: unknown,
): FgisGrain1023BusinessEnvelope {
  const source = asRecord(input);
  enforceExactKeys(source, [
    'adapterCode',
    'apiVersion',
    'packageSha256',
    'catalogSha256',
    'mappingVersion',
    'direction',
    'operationCode',
    'family',
    'elementQName',
    'transportOperation',
    'messageId',
    'correlationId',
    'causationId',
    'contentSha256',
    'signatureMetadata',
  ]);
  if (source.adapterCode !== FGIS_GRAIN_1_0_23_ADAPTER_CODE) {
    throw new FgisGrain1023ContractError(
      'ADAPTER_CODE_MISMATCH',
      'FGIS adapter code mismatch.',
    );
  }
  if (source.apiVersion !== FGIS_GRAIN_1_0_23_API_VERSION) {
    throw new FgisGrain1023ContractError(
      'API_VERSION_MISMATCH',
      'FGIS API version mismatch.',
    );
  }
  if (source.packageSha256 !== FGIS_GRAIN_1_0_23_PACKAGE_SHA256) {
    throw new FgisGrain1023ContractError(
      'PACKAGE_HASH_MISMATCH',
      'FGIS official package hash mismatch.',
    );
  }
  if (source.catalogSha256 !== FGIS_GRAIN_1_0_23_CATALOG_SHA256) {
    throw new FgisGrain1023ContractError(
      'CATALOG_HASH_MISMATCH',
      'FGIS operation catalog hash mismatch.',
    );
  }
  if (source.mappingVersion !== FGIS_GRAIN_1_0_23_MAPPING_VERSION) {
    throw new FgisGrain1023ContractError(
      'MAPPING_VERSION_MISMATCH',
      'FGIS mapping version mismatch.',
    );
  }
  const direction = requiredString(source, 'direction', 16);
  if (direction !== 'REQUEST' && direction !== 'RESPONSE') {
    throw new FgisGrain1023ContractError(
      'DIRECTION_INVALID',
      'Direction must be REQUEST or RESPONSE.',
    );
  }
  const operation = getFgisGrain1023Operation(
    requiredString(source, 'operationCode', 96),
  );
  if (source.family !== operation.family) {
    throw new FgisGrain1023ContractError(
      'FAMILY_MISMATCH',
      'FGIS operation family mismatch.',
    );
  }
  const expectedQName = direction === 'REQUEST'
    ? operation.requestQName
    : operation.responseQName;
  const elementQName = requiredString(source, 'elementQName', 500);
  if (elementQName !== expectedQName) {
    throw new FgisGrain1023ContractError(
      'QNAME_MISMATCH',
      'FGIS element QName mismatch.',
    );
  }
  const expectedTransport = direction === 'REQUEST'
    ? 'SendRequest'
    : 'SendResponse';
  if (
    source.transportOperation !== expectedTransport
    || !TRANSPORT_BY_NAME.has(expectedTransport)
  ) {
    throw new FgisGrain1023ContractError(
      'TRANSPORT_OPERATION_MISMATCH',
      'FGIS transport operation mismatch.',
    );
  }
  const messageId = requiredString(source, 'messageId', 64);
  assertUuid(messageId, 'messageId');
  const correlationId = requiredString(source, 'correlationId');
  assertReference(correlationId, 'correlationId');
  const causationId = source.causationId === null
    ? null
    : requiredString(source, 'causationId');
  if (causationId !== null) assertReference(causationId, 'causationId');
  const contentSha256 = requiredString(source, 'contentSha256', 64);
  if (!SHA256_PATTERN.test(contentSha256)) {
    throw new FgisGrain1023ContractError(
      'CONTENT_HASH_INVALID',
      'contentSha256 must be a lowercase SHA-256 digest.',
    );
  }
  return Object.freeze({
    adapterCode: FGIS_GRAIN_1_0_23_ADAPTER_CODE,
    apiVersion: FGIS_GRAIN_1_0_23_API_VERSION,
    packageSha256: FGIS_GRAIN_1_0_23_PACKAGE_SHA256,
    catalogSha256: FGIS_GRAIN_1_0_23_CATALOG_SHA256,
    mappingVersion: FGIS_GRAIN_1_0_23_MAPPING_VERSION,
    direction,
    operationCode: operation.code,
    family: operation.family,
    elementQName,
    transportOperation: expectedTransport,
    messageId,
    correlationId,
    causationId,
    contentSha256,
    signatureMetadata: parseSignatureMetadata(source.signatureMetadata),
  });
}

export function assertFgisGrain1023AckEnvelope(
  input: unknown,
): FgisGrain1023AckEnvelope {
  const source = asRecord(input);
  enforceExactKeys(source, [
    'adapterCode',
    'apiVersion',
    'catalogSha256',
    'transportOperation',
    'messageId',
    'correlationId',
    'responseMessageId',
  ]);
  if (source.adapterCode !== FGIS_GRAIN_1_0_23_ADAPTER_CODE) {
    throw new FgisGrain1023ContractError('ADAPTER_CODE_MISMATCH', 'FGIS adapter code mismatch.');
  }
  if (source.apiVersion !== FGIS_GRAIN_1_0_23_API_VERSION) {
    throw new FgisGrain1023ContractError('API_VERSION_MISMATCH', 'FGIS API version mismatch.');
  }
  if (source.catalogSha256 !== FGIS_GRAIN_1_0_23_CATALOG_SHA256) {
    throw new FgisGrain1023ContractError('CATALOG_HASH_MISMATCH', 'FGIS catalog hash mismatch.');
  }
  if (source.transportOperation !== 'Ack' || !TRANSPORT_BY_NAME.has('Ack')) {
    throw new FgisGrain1023ContractError(
      'TRANSPORT_OPERATION_MISMATCH',
      'Acknowledgement requires Ack.',
    );
  }
  const messageId = requiredString(source, 'messageId', 64);
  const responseMessageId = requiredString(source, 'responseMessageId', 64);
  assertUuid(messageId, 'messageId');
  assertUuid(responseMessageId, 'responseMessageId');
  const correlationId = requiredString(source, 'correlationId');
  assertReference(correlationId, 'correlationId');
  return Object.freeze({
    adapterCode: FGIS_GRAIN_1_0_23_ADAPTER_CODE,
    apiVersion: FGIS_GRAIN_1_0_23_API_VERSION,
    catalogSha256: FGIS_GRAIN_1_0_23_CATALOG_SHA256,
    transportOperation: 'Ack',
    messageId,
    correlationId,
    responseMessageId,
  });
}

export function assertFgisGrain1023FaultQName(value: string): string {
  if (!FAULT_QNAMES.has(value)) {
    throw new FgisGrain1023ContractError(
      'FAULT_QNAME_UNKNOWN',
      'Unknown FGIS Grain API 1.0.23 fault QName.',
    );
  }
  return value;
}

/** PC-CROP-08B accepts no runtime endpoint. */
export function assertFgisGrain1023RuntimeEndpointCandidate(
  value: unknown,
): never {
  if (typeof value !== 'string' || !value.trim()) {
    throw new FgisGrain1023ContractError(
      'RUNTIME_ENDPOINT_INVALID',
      'Runtime endpoint candidate must be a non-empty URL.',
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new FgisGrain1023ContractError(
      'RUNTIME_ENDPOINT_INVALID',
      'Runtime endpoint candidate is invalid.',
    );
  }
  if (
    parsed.hostname === 'localhost'
    || parsed.hostname === '127.0.0.1'
    || parsed.hostname === '::1'
    || value === FGIS_GRAIN_1_0_23_DOCUMENTATION_ENDPOINT.url
  ) {
    throw new FgisGrain1023ContractError(
      'PLACEHOLDER_ENDPOINT_FORBIDDEN',
      'The WSDL localhost endpoint is documentation only.',
    );
  }
  throw new FgisGrain1023ContractError(
    'RUNTIME_ENDPOINT_OUT_OF_SCOPE',
    'Runtime endpoint configuration is outside PC-CROP-08B.',
  );
}

@Injectable()
export class FgisGrain1023ContractCatalog {
  readonly adapterCode = FGIS_GRAIN_1_0_23_ADAPTER_CODE;
  readonly apiVersion = FGIS_GRAIN_1_0_23_API_VERSION;
  readonly packageSha256 = FGIS_GRAIN_1_0_23_PACKAGE_SHA256;
  readonly catalogSha256 = FGIS_GRAIN_1_0_23_CATALOG_SHA256;
  readonly mappingVersion = FGIS_GRAIN_1_0_23_MAPPING_VERSION;
  readonly operationalStatus = FGIS_GRAIN_1_0_23_OPERATIONAL_STATUS;
  readonly honestStatus = FGIS_GRAIN_1_0_23_HONEST_STATUS;
  readonly liveConnection = false as const;
  readonly credentialsPresent = false as const;
  readonly runtimeEndpointAllowed = false as const;

  listOperations(): readonly FgisGrainBusinessOperation[] {
    return OPERATIONS;
  }

  getOperation(code: string): FgisGrainBusinessOperation {
    return getFgisGrain1023Operation(code);
  }

  assertBusinessEnvelope(input: unknown): FgisGrain1023BusinessEnvelope {
    return assertFgisGrain1023BusinessEnvelope(input);
  }

  assertAckEnvelope(input: unknown): FgisGrain1023AckEnvelope {
    return assertFgisGrain1023AckEnvelope(input);
  }
}
