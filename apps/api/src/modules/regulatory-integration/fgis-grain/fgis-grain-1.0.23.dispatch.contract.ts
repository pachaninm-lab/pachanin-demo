import {
  FGIS_GRAIN_ADAPTER_CODE,
  FGIS_GRAIN_API_VERSION,
  getFgisGrainBusinessOperation,
} from './fgis-grain-1.0.23.contract';
import {
  FGIS_GRAIN_1_0_23_MAPPING_VERSION,
  type FgisGrainBusinessOperationCode,
  type FgisGrainTransportOperation,
} from './fgis-grain-1.0.23.generated';

export const FGIS_GRAIN_OUTBOX_EVENT_TYPE =
  'FGIS_GRAIN_OUTBOUND_DISPATCH_REQUESTED' as const;
export const FGIS_GRAIN_DISPATCH_SCHEMA_VERSION =
  'pc-crop.fgis-grain-outbound-dispatch.v1' as const;
export const FGIS_GRAIN_PROVIDER_CONFIG_SCHEMA_VERSION =
  'pc-crop.fgis-grain-provider-config.v1' as const;
export const FGIS_GRAIN_SIGNING_POLICY_VERSION =
  'fgis-zerno-1.0.23-signing-policy.v1' as const;
export const FGIS_GRAIN_OPERATIONAL_STATUS = 'NOT_ATTESTED' as const;

export const FGIS_GRAIN_PROVIDER_ENVIRONMENTS = [
  'SANDBOX',
  'PRE_PRODUCTION',
  'PRODUCTION',
] as const;
export type FgisGrainProviderEnvironment =
  (typeof FGIS_GRAIN_PROVIDER_ENVIRONMENTS)[number];

export const FGIS_GRAIN_PROVIDER_ACTIVATION_STATES = [
  'DISABLED',
  'TEST_APPROVED',
  'PRODUCTION_APPROVED',
] as const;
export type FgisGrainProviderActivationState =
  (typeof FGIS_GRAIN_PROVIDER_ACTIVATION_STATES)[number];

export const FGIS_GRAIN_DISPATCH_ERROR_CODES = [
  'MALFORMED_DISPATCH_PAYLOAD',
  'UNSUPPORTED_DISPATCH_SCHEMA',
  'IDENTITY_MISMATCH',
  'UNSUPPORTED_TRANSPORT_OPERATION',
  'UNSUPPORTED_BUSINESS_OPERATION',
  'BUSINESS_OPERATION_REQUIRED',
  'BUSINESS_OPERATION_FORBIDDEN',
  'INVALID_MESSAGE_ID',
  'INVALID_REFERENCE_MESSAGE_ID',
  'INVALID_MESSAGE_DATA_ID',
  'INVALID_CONTENT_REFERENCE',
  'INVALID_PROVIDER_CONFIG_REFERENCE',
  'INVALID_CONTENT_HASH',
  'INVALID_CONTENT_LENGTH',
  'INVALID_CORRELATION_ID',
  'INVALID_CAUSATION_ID',
  'SIGNING_POLICY_MISMATCH',
  'RAW_XML_OR_SECRET_FIELD_FORBIDDEN',
  'PROVIDER_CONFIG_MALFORMED',
  'PROVIDER_CONFIG_NOT_CONFIGURED',
  'PROVIDER_CONFIG_DISABLED',
  'PRODUCTION_ATTESTATION_REQUIRED',
  'INLINE_ENDPOINT_OR_SECRET_FORBIDDEN',
  'PAYLOAD_NOT_FOUND',
  'PAYLOAD_INTEGRITY_MISMATCH',
  'POLICY_NOT_ATTESTED',
  'CANONICALIZATION_UNAVAILABLE',
  'SIGNING_PROVIDER_UNAVAILABLE',
  'ENVELOPE_ASSEMBLY_UNAVAILABLE',
  'TRANSPORT_UNAVAILABLE',
  'TRANSPORT_REJECTED',
  'TRANSPORT_RESPONSE_UNSUPPORTED',
] as const;
export type FgisGrainDispatchErrorCode =
  (typeof FGIS_GRAIN_DISPATCH_ERROR_CODES)[number];

export class FgisGrainDispatchError extends Error {
  constructor(
    readonly code: FgisGrainDispatchErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(`${code}: ${message}`);
    this.name = 'FgisGrainDispatchError';
  }
}

export interface FgisGrainProviderConfiguration {
  readonly schemaVersion: typeof FGIS_GRAIN_PROVIDER_CONFIG_SCHEMA_VERSION;
  readonly adapterCode: typeof FGIS_GRAIN_ADAPTER_CODE;
  readonly apiVersion: typeof FGIS_GRAIN_API_VERSION;
  readonly mappingVersion: typeof FGIS_GRAIN_1_0_23_MAPPING_VERSION;
  readonly signingPolicyVersion: typeof FGIS_GRAIN_SIGNING_POLICY_VERSION;
  readonly environment: FgisGrainProviderEnvironment;
  readonly activationState: FgisGrainProviderActivationState;
  readonly endpointReference: string;
  readonly tlsPolicyReference: string;
  readonly credentialReference: string;
  readonly signingKeyReference: string;
  readonly payloadStoreReference: string;
  readonly productionAttestationReference: string | null;
}

export interface FgisGrainOutboundDispatchPayload {
  readonly schemaVersion: typeof FGIS_GRAIN_DISPATCH_SCHEMA_VERSION;
  readonly adapterCode: typeof FGIS_GRAIN_ADAPTER_CODE;
  readonly apiVersion: typeof FGIS_GRAIN_API_VERSION;
  readonly mappingVersion: typeof FGIS_GRAIN_1_0_23_MAPPING_VERSION;
  readonly signingPolicyVersion: typeof FGIS_GRAIN_SIGNING_POLICY_VERSION;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly commandId: string;
  readonly transportOperation: FgisGrainTransportOperation;
  readonly businessOperationCode: FgisGrainBusinessOperationCode | null;
  readonly messageId: string;
  readonly referenceMessageId: string;
  readonly messageDataId: string;
  readonly unsignedEnvelopeReference: string;
  readonly unsignedEnvelopeSha256: string;
  readonly unsignedEnvelopeSizeBytes: number;
  readonly messageDataSha256: string;
  readonly providerConfigurationReference: string;
  readonly correlationId: string;
  readonly causationId: string | null;
}

export type FgisGrainDispatchValidationResult =
  | {
      readonly valid: true;
      readonly payload: FgisGrainOutboundDispatchPayload;
    }
  | {
      readonly valid: false;
      readonly errorCode: FgisGrainDispatchErrorCode;
    };

export type FgisGrainProviderConfigurationValidationResult =
  | {
      readonly valid: true;
      readonly configuration: FgisGrainProviderConfiguration;
    }
  | {
      readonly valid: false;
      readonly errorCode: FgisGrainDispatchErrorCode;
    };

export interface FgisGrainStoredXmlObject {
  readonly objectReference: string;
  readonly bytes: Uint8Array;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly mediaType: 'application/xml';
  readonly immutable: true;
  readonly encryptedAtRest: true;
}

export interface FgisGrainCanonicalizationRequest {
  readonly sourceObjectReference: string;
  readonly messageDataBytes: Uint8Array;
  readonly messageDataSha256: string;
  readonly signingPolicyVersion: typeof FGIS_GRAIN_SIGNING_POLICY_VERSION;
}

export interface FgisGrainCanonicalizationResult {
  readonly canonicalizedObjectReference: string;
  readonly canonicalizedSha256: string;
  readonly canonicalizedSizeBytes: number;
  readonly canonicalizationAlgorithm: string;
  readonly transformAlgorithm: string;
  readonly policyVersion: typeof FGIS_GRAIN_SIGNING_POLICY_VERSION;
}

export interface FgisGrainSigningRequest {
  readonly canonicalizedObjectReference: string;
  readonly canonicalizedSha256: string;
  readonly signingKeyReference: string;
  readonly credentialReference: string;
  readonly signingPolicyVersion: typeof FGIS_GRAIN_SIGNING_POLICY_VERSION;
}

export interface FgisGrainSigningResult {
  readonly signatureObjectReference: string;
  readonly signatureSha256: string;
  readonly signatureSizeBytes: number;
  readonly signatureAlgorithm: string;
  readonly digestAlgorithm: string;
  readonly signerCertificateReference: string;
  readonly signingPolicyVersion: typeof FGIS_GRAIN_SIGNING_POLICY_VERSION;
}

export interface FgisGrainAssemblyRequest {
  readonly unsignedEnvelopeReference: string;
  readonly unsignedEnvelopeSha256: string;
  readonly signatureObjectReference: string;
  readonly signatureSha256: string;
  readonly signatureInsertionStartByteOffset: number;
  readonly signatureInsertionEndByteOffset: number;
}

export interface FgisGrainAssemblyResult {
  readonly signedEnvelopeReference: string;
  readonly signedEnvelopeSha256: string;
  readonly signedEnvelopeSizeBytes: number;
  readonly signatureReferenceUri: string;
}

export interface FgisGrainTransportRequest {
  readonly adapterCode: typeof FGIS_GRAIN_ADAPTER_CODE;
  readonly environment: FgisGrainProviderEnvironment;
  readonly endpointReference: string;
  readonly tlsPolicyReference: string;
  readonly credentialReference: string;
  readonly signedEnvelopeReference: string;
  readonly signedEnvelopeSha256: string;
  readonly signedEnvelopeSizeBytes: number;
  readonly transportOperation: FgisGrainTransportOperation;
  readonly messageId: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
}

export type FgisGrainTransportResponseCode =
  | 'success'
  | 'accepted'
  | 'queue-is-empty'
  | 'ignored';

export interface FgisGrainTransportResult {
  readonly delivered: boolean;
  readonly responseCode: FgisGrainTransportResponseCode | null;
  readonly providerMessageId: string | null;
  readonly responseBodySha256: string | null;
  readonly httpStatus: number | null;
  readonly durationMs: number;
  readonly faultCode: string | null;
  readonly retryable: boolean;
}

export abstract class FgisGrainProviderConfigurationPort {
  abstract resolve(reference: string): Promise<unknown>;
}

export abstract class FgisGrainImmutablePayloadStorePort {
  abstract load(reference: string): Promise<FgisGrainStoredXmlObject>;
}

export abstract class FgisGrainCanonicalizationPort {
  abstract canonicalize(
    request: FgisGrainCanonicalizationRequest,
  ): Promise<FgisGrainCanonicalizationResult>;
}

export abstract class FgisGrainSigningProviderPort {
  abstract sign(request: FgisGrainSigningRequest): Promise<FgisGrainSigningResult>;
}

export abstract class FgisGrainSignedEnvelopeAssemblerPort {
  abstract assemble(request: FgisGrainAssemblyRequest): Promise<FgisGrainAssemblyResult>;
}

export abstract class FgisGrainSoapTransportPort {
  abstract send(request: FgisGrainTransportRequest): Promise<FgisGrainTransportResult>;
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const UUID_V1_PATTERN =
  /^[\da-f]{8}-[\da-f]{4}-1[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/iu;
const XML_ID_PATTERN = /^[A-Za-z_][A-Za-z0-9._-]{0,127}$/u;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,255}$/u;
const REFERENCE_PATTERN =
  /^(?:config|vault|kms|object-store|policy|tls|credential|signing-key):\/\/[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,500}$/u;
const CONTENT_REFERENCE_PATTERN =
  /^object-store:\/\/[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,500}$/u;
const CONFIG_REFERENCE_PATTERN =
  /^config:\/\/[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,500}$/u;
const ALLOWED_PAYLOAD_KEYS = new Set<keyof FgisGrainOutboundDispatchPayload>([
  'schemaVersion',
  'adapterCode',
  'apiVersion',
  'mappingVersion',
  'signingPolicyVersion',
  'tenantId',
  'organizationId',
  'commandId',
  'transportOperation',
  'businessOperationCode',
  'messageId',
  'referenceMessageId',
  'messageDataId',
  'unsignedEnvelopeReference',
  'unsignedEnvelopeSha256',
  'unsignedEnvelopeSizeBytes',
  'messageDataSha256',
  'providerConfigurationReference',
  'correlationId',
  'causationId',
]);
const ALLOWED_CONFIGURATION_KEYS = new Set<keyof FgisGrainProviderConfiguration>([
  'schemaVersion',
  'adapterCode',
  'apiVersion',
  'mappingVersion',
  'signingPolicyVersion',
  'environment',
  'activationState',
  'endpointReference',
  'tlsPolicyReference',
  'credentialReference',
  'signingKeyReference',
  'payloadStoreReference',
  'productionAttestationReference',
]);
const TRANSPORT_OPERATIONS = new Set<FgisGrainTransportOperation>([
  'SendRequest',
  'SendResponse',
  'Ack',
]);
const PROVIDER_ENVIRONMENTS = new Set<string>(FGIS_GRAIN_PROVIDER_ENVIRONMENTS);
const PROVIDER_ACTIVATION_STATES = new Set<string>(FGIS_GRAIN_PROVIDER_ACTIVATION_STATES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID_PATTERN.test(value);
}

function isReference(value: unknown): value is string {
  return typeof value === 'string'
    && REFERENCE_PATTERN.test(value)
    && !/localhost|127\.0\.0\.1|::1/iu.test(value);
}

function isNullableReference(value: unknown): value is string | null {
  return value === null || isReference(value);
}

function hasForbiddenAuthorityOrSecretKey(value: Record<string, unknown>): boolean {
  return Object.keys(value).some((key) =>
    /(?:^|_)(?:role|privateKey|certificateBytes|credentialBytes|password|token|secret|rawXml|xml|signatureBytes|signedEnvelopeBytes)(?:$|_)/iu
      .test(key),
  );
}

export function validateFgisGrainOutboundDispatchPayload(
  value: unknown,
): FgisGrainDispatchValidationResult {
  if (!isRecord(value)) {
    return { valid: false, errorCode: 'MALFORMED_DISPATCH_PAYLOAD' };
  }
  if (
    !hasExactKeys(value, ALLOWED_PAYLOAD_KEYS)
    || hasForbiddenAuthorityOrSecretKey(value)
  ) {
    return { valid: false, errorCode: 'RAW_XML_OR_SECRET_FIELD_FORBIDDEN' };
  }
  if (value.schemaVersion !== FGIS_GRAIN_DISPATCH_SCHEMA_VERSION) {
    return { valid: false, errorCode: 'UNSUPPORTED_DISPATCH_SCHEMA' };
  }
  if (
    value.adapterCode !== FGIS_GRAIN_ADAPTER_CODE
    || value.apiVersion !== FGIS_GRAIN_API_VERSION
    || value.mappingVersion !== FGIS_GRAIN_1_0_23_MAPPING_VERSION
  ) {
    return { valid: false, errorCode: 'IDENTITY_MISMATCH' };
  }
  if (value.signingPolicyVersion !== FGIS_GRAIN_SIGNING_POLICY_VERSION) {
    return { valid: false, errorCode: 'SIGNING_POLICY_MISMATCH' };
  }
  if (
    typeof value.transportOperation !== 'string'
    || !TRANSPORT_OPERATIONS.has(value.transportOperation as FgisGrainTransportOperation)
  ) {
    return { valid: false, errorCode: 'UNSUPPORTED_TRANSPORT_OPERATION' };
  }
  const transportOperation = value.transportOperation as FgisGrainTransportOperation;
  const businessOperationCode = value.businessOperationCode;
  if (transportOperation === 'Ack' && businessOperationCode !== null) {
    return { valid: false, errorCode: 'BUSINESS_OPERATION_FORBIDDEN' };
  }
  if (transportOperation !== 'Ack' && typeof businessOperationCode !== 'string') {
    return { valid: false, errorCode: 'BUSINESS_OPERATION_REQUIRED' };
  }
  if (
    typeof businessOperationCode === 'string'
    && !getFgisGrainBusinessOperation(businessOperationCode)
  ) {
    return { valid: false, errorCode: 'UNSUPPORTED_BUSINESS_OPERATION' };
  }
  if (!UUID_V1_PATTERN.test(String(value.messageId ?? ''))) {
    return { valid: false, errorCode: 'INVALID_MESSAGE_ID' };
  }
  if (!UUID_V1_PATTERN.test(String(value.referenceMessageId ?? ''))) {
    return { valid: false, errorCode: 'INVALID_REFERENCE_MESSAGE_ID' };
  }
  if (!XML_ID_PATTERN.test(String(value.messageDataId ?? ''))) {
    return { valid: false, errorCode: 'INVALID_MESSAGE_DATA_ID' };
  }
  if (
    typeof value.unsignedEnvelopeReference !== 'string'
    || !CONTENT_REFERENCE_PATTERN.test(value.unsignedEnvelopeReference)
  ) {
    return { valid: false, errorCode: 'INVALID_CONTENT_REFERENCE' };
  }
  if (
    typeof value.providerConfigurationReference !== 'string'
    || !CONFIG_REFERENCE_PATTERN.test(value.providerConfigurationReference)
  ) {
    return { valid: false, errorCode: 'INVALID_PROVIDER_CONFIG_REFERENCE' };
  }
  if (
    typeof value.unsignedEnvelopeSha256 !== 'string'
    || !SHA256_PATTERN.test(value.unsignedEnvelopeSha256)
    || typeof value.messageDataSha256 !== 'string'
    || !SHA256_PATTERN.test(value.messageDataSha256)
  ) {
    return { valid: false, errorCode: 'INVALID_CONTENT_HASH' };
  }
  if (
    !Number.isInteger(value.unsignedEnvelopeSizeBytes)
    || Number(value.unsignedEnvelopeSizeBytes) < 1
    || Number(value.unsignedEnvelopeSizeBytes) > 2 * 1024 * 1024
  ) {
    return { valid: false, errorCode: 'INVALID_CONTENT_LENGTH' };
  }
  if (!isSafeId(value.tenantId) || !isSafeId(value.organizationId) || !isSafeId(value.commandId)) {
    return { valid: false, errorCode: 'MALFORMED_DISPATCH_PAYLOAD' };
  }
  if (!isSafeId(value.correlationId)) {
    return { valid: false, errorCode: 'INVALID_CORRELATION_ID' };
  }
  if (value.causationId !== null && !isSafeId(value.causationId)) {
    return { valid: false, errorCode: 'INVALID_CAUSATION_ID' };
  }
  return {
    valid: true,
    payload: value as unknown as FgisGrainOutboundDispatchPayload,
  };
}

export function validateFgisGrainProviderConfiguration(
  value: unknown,
): FgisGrainProviderConfigurationValidationResult {
  if (!isRecord(value) || !hasExactKeys(value, ALLOWED_CONFIGURATION_KEYS)) {
    return { valid: false, errorCode: 'PROVIDER_CONFIG_MALFORMED' };
  }
  if (hasForbiddenAuthorityOrSecretKey(value)) {
    return { valid: false, errorCode: 'INLINE_ENDPOINT_OR_SECRET_FORBIDDEN' };
  }
  if (
    value.schemaVersion !== FGIS_GRAIN_PROVIDER_CONFIG_SCHEMA_VERSION
    || value.adapterCode !== FGIS_GRAIN_ADAPTER_CODE
    || value.apiVersion !== FGIS_GRAIN_API_VERSION
    || value.mappingVersion !== FGIS_GRAIN_1_0_23_MAPPING_VERSION
    || value.signingPolicyVersion !== FGIS_GRAIN_SIGNING_POLICY_VERSION
  ) {
    return { valid: false, errorCode: 'IDENTITY_MISMATCH' };
  }
  if (
    typeof value.environment !== 'string'
    || !PROVIDER_ENVIRONMENTS.has(value.environment)
    || typeof value.activationState !== 'string'
    || !PROVIDER_ACTIVATION_STATES.has(value.activationState)
  ) {
    return { valid: false, errorCode: 'PROVIDER_CONFIG_MALFORMED' };
  }
  for (const field of [
    'endpointReference',
    'tlsPolicyReference',
    'credentialReference',
    'signingKeyReference',
    'payloadStoreReference',
  ] as const) {
    if (!isReference(value[field])) {
      return { valid: false, errorCode: 'INLINE_ENDPOINT_OR_SECRET_FORBIDDEN' };
    }
  }
  if (!isNullableReference(value.productionAttestationReference)) {
    return { valid: false, errorCode: 'PRODUCTION_ATTESTATION_REQUIRED' };
  }
  if (value.activationState === 'DISABLED') {
    return { valid: false, errorCode: 'PROVIDER_CONFIG_DISABLED' };
  }
  if (
    value.environment === 'PRODUCTION'
    && (
      value.activationState !== 'PRODUCTION_APPROVED'
      || value.productionAttestationReference === null
      || !String(value.productionAttestationReference).startsWith('policy://')
    )
  ) {
    return { valid: false, errorCode: 'PRODUCTION_ATTESTATION_REQUIRED' };
  }
  if (
    value.environment !== 'PRODUCTION'
    && value.activationState === 'PRODUCTION_APPROVED'
  ) {
    return { valid: false, errorCode: 'PROVIDER_CONFIG_MALFORMED' };
  }
  return {
    valid: true,
    configuration: value as unknown as FgisGrainProviderConfiguration,
  };
}

export function assertFgisGrainDispatchPayload(
  value: unknown,
): FgisGrainOutboundDispatchPayload {
  const validation = validateFgisGrainOutboundDispatchPayload(value);
  if (validation.valid === false) {
    throw new FgisGrainDispatchError(
      validation.errorCode,
      'Outbound dispatch payload failed governed validation',
      false,
    );
  }
  return validation.payload;
}

export function assertFgisGrainProviderConfiguration(
  value: unknown,
): FgisGrainProviderConfiguration {
  const validation = validateFgisGrainProviderConfiguration(value);
  if (validation.valid === false) {
    throw new FgisGrainDispatchError(
      validation.errorCode,
      'Provider configuration failed governed validation',
      false,
    );
  }
  return validation.configuration;
}
