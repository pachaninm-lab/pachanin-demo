import type {
  RegulatoryAdapterIdentity,
  RegulatoryInboundEnvelope,
  RegulatorySignatureMetadata,
} from '../regulatory-integration.types';
import {
  FGIS_GRAIN_1_0_23_DOCUMENTATION_ENDPOINT,
  FGIS_GRAIN_1_0_23_MAPPING_VERSION,
  FGIS_GRAIN_1_0_23_RESPONSE_CODES,
  FGIS_GRAIN_1_0_23_TRANSPORT_OPERATIONS,
  type FgisGrainBusinessOperationCode,
  type FgisGrainResponseCode,
  type FgisGrainTransportOperation,
} from './fgis-grain-1.0.23.generated';
import {
  FGIS_GRAIN_1_0_23_BUSINESS_FAMILY_ROWS,
  FGIS_GRAIN_1_0_23_BUSINESS_OPERATION_ROWS,
} from './fgis-grain-1.0.23.operations.generated';

export const FGIS_GRAIN_ADAPTER_CODE = 'FGIS_ZERNO' as const;
export const FGIS_GRAIN_API_VERSION = '1.0.23' as const;
export const FGIS_GRAIN_OPERATIONAL_STATUS = 'NOT_ATTESTED' as const;
export const FGIS_GRAIN_CATALOG_STATUS = 'ADAPTER_READY' as const;

export const FGIS_GRAIN_ADAPTER_IDENTITY: RegulatoryAdapterIdentity = {
  adapterCode: FGIS_GRAIN_ADAPTER_CODE,
  adapterVersion: FGIS_GRAIN_API_VERSION,
  mappingVersion: FGIS_GRAIN_1_0_23_MAPPING_VERSION,
  environment: 'SANDBOX',
  capabilities: [
    'INBOUND_EVENTS',
    'SCHEMA_MAPPING',
    'PROVIDER_ACKNOWLEDGEMENT',
  ],
};

export const FGIS_GRAIN_ENVELOPE_POLICY = {
  allowedSchemaVersions: [FGIS_GRAIN_API_VERSION],
  allowedMappingVersions: [FGIS_GRAIN_1_0_23_MAPPING_VERSION],
  requireSignature: true,
} as const;

export interface FgisGrainBusinessOperation {
  readonly code: FgisGrainBusinessOperationCode;
  readonly name: string;
  readonly family: (typeof FGIS_GRAIN_1_0_23_BUSINESS_FAMILY_ROWS)[number][0];
  readonly classification: 'READ' | 'MUTATION';
  readonly namespace: string;
  readonly requestQName: string;
  readonly responseQName: string;
}

export type FgisGrainEnvelopeDirection =
  | 'OUTBOUND_REQUEST'
  | 'INBOUND_RESPONSE'
  | 'INBOUND_FAULT';

export interface FgisGrainContractEnvelopeMetadata {
  readonly adapterCode: typeof FGIS_GRAIN_ADAPTER_CODE;
  readonly apiVersion: typeof FGIS_GRAIN_API_VERSION;
  readonly mappingVersion: typeof FGIS_GRAIN_1_0_23_MAPPING_VERSION;
  readonly direction: FgisGrainEnvelopeDirection;
  readonly transportOperation: FgisGrainTransportOperation;
  readonly businessOperationCode: FgisGrainBusinessOperationCode;
  readonly payloadQName: string;
  readonly messageId: string;
  readonly referenceMessageId: string;
  readonly occurredAt: string;
  readonly rawBodySha256: string;
  readonly signature: RegulatorySignatureMetadata | null;
  readonly responseCode?: FgisGrainResponseCode;
}

export interface FgisGrainOutboundEnvelopeMetadata {
  readonly adapterIdentity: typeof FGIS_GRAIN_ADAPTER_IDENTITY;
  readonly schemaVersion: typeof FGIS_GRAIN_API_VERSION;
  readonly mappingVersion: typeof FGIS_GRAIN_1_0_23_MAPPING_VERSION;
  readonly transportOperation: 'SendRequest';
  readonly businessOperationCode: FgisGrainBusinessOperationCode;
  readonly payloadQName: string;
  readonly messageId: string;
  readonly correlationId: string;
  readonly rawBodySha256: string;
  readonly signature: RegulatorySignatureMetadata;
}

export const FGIS_GRAIN_ENVELOPE_ERROR_CODES = [
  'IDENTITY_MISMATCH',
  'UNSUPPORTED_OPERATION',
  'TRANSPORT_OPERATION_MISMATCH',
  'PAYLOAD_QNAME_MISMATCH',
  'FAULT_QNAME_MISMATCH',
  'MESSAGE_ID_INVALID',
  'REFERENCE_MESSAGE_ID_INVALID',
  'OCCURRED_AT_INVALID',
  'CONTENT_HASH_INVALID',
  'SIGNATURE_REFERENCE_REQUIRED',
  'SIGNATURE_REFERENCE_INVALID',
  'RESPONSE_CODE_REQUIRED',
  'RESPONSE_CODE_FORBIDDEN',
  'RESPONSE_CODE_UNSUPPORTED',
] as const;

export type FgisGrainEnvelopeErrorCode =
  (typeof FGIS_GRAIN_ENVELOPE_ERROR_CODES)[number];

export type FgisGrainEnvelopeValidationResult =
  | {
      readonly valid: true;
      readonly operation: FgisGrainBusinessOperation;
    }
  | {
      readonly valid: false;
      readonly errorCode: FgisGrainEnvelopeErrorCode;
    };

export type FgisGrainRuntimeEndpointValidationResult =
  | { readonly valid: true; readonly normalizedUrl: string }
  | {
      readonly valid: false;
      readonly errorCode:
        | 'ENDPOINT_REQUIRED'
        | 'ENDPOINT_HTTPS_REQUIRED'
        | 'ENDPOINT_PLACEHOLDER_FORBIDDEN'
        | 'ENDPOINT_CREDENTIALS_FORBIDDEN'
        | 'ENDPOINT_FRAGMENT_FORBIDDEN';
    };

const SHA_256_PATTERN = /^[a-f0-9]{64}$/u;
const UUID_V1_PATTERN = /^[\da-f]{8}-[\da-f]{4}-1[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u;
const UTC_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const FAMILY_NAMESPACE_BY_CODE = new Map(
  FGIS_GRAIN_1_0_23_BUSINESS_FAMILY_ROWS.map(
    ([code, namespace]) => [code, namespace] as const,
  ),
);
export const FGIS_GRAIN_BUSINESS_OPERATIONS: readonly FgisGrainBusinessOperation[] =
  FGIS_GRAIN_1_0_23_BUSINESS_OPERATION_ROWS.map(([
    code,
    name,
    family,
    classification,
    requestLocalName,
    responseLocalName,
  ]) => {
    const namespace = FAMILY_NAMESPACE_BY_CODE.get(family);
    if (!namespace) {
      throw new Error(`FGIS_GRAIN_FAMILY_NAMESPACE_MISSING:${family}`);
    }
    return {
      code,
      name,
      family,
      classification,
      namespace,
      requestQName: `{${namespace}}${requestLocalName}`,
      responseQName: `{${namespace}}${responseLocalName}`,
    };
  });
const OPERATION_BY_CODE = new Map<string, FgisGrainBusinessOperation>(
  FGIS_GRAIN_BUSINESS_OPERATIONS.map(
    (operation) => [operation.code, operation] as const,
  ),
);
const RESPONSE_CODE_SET = new Set<string>(FGIS_GRAIN_1_0_23_RESPONSE_CODES);
const TRANSPORT_OPERATION_BY_NAME = new Map(
  FGIS_GRAIN_1_0_23_TRANSPORT_OPERATIONS.map(
    (operation) => [operation.name, operation] as const,
  ),
);

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function validSignatureReference(
  signature: RegulatorySignatureMetadata | null,
): signature is RegulatorySignatureMetadata {
  return signature !== null
    && nonEmpty(signature.algorithm)
    && nonEmpty(signature.keyReference)
    && nonEmpty(signature.keyVersion)
    && nonEmpty(signature.signatureVersion)
    && nonEmpty(signature.verificationPolicyVersion)
    && signature.algorithm.length <= 100
    && signature.keyReference.length <= 500
    && signature.keyVersion.length <= 100
    && signature.signatureVersion.length <= 100
    && signature.verificationPolicyVersion.length <= 100;
}

export function getFgisGrainBusinessOperation(
  code: string,
): FgisGrainBusinessOperation | null {
  return OPERATION_BY_CODE.get(code) ?? null;
}

export function validateFgisGrainContractEnvelope(
  envelope: FgisGrainContractEnvelopeMetadata,
): FgisGrainEnvelopeValidationResult {
  if (
    envelope.adapterCode !== FGIS_GRAIN_ADAPTER_CODE
    || envelope.apiVersion !== FGIS_GRAIN_API_VERSION
    || envelope.mappingVersion !== FGIS_GRAIN_1_0_23_MAPPING_VERSION
  ) {
    return { valid: false, errorCode: 'IDENTITY_MISMATCH' };
  }

  const operation = getFgisGrainBusinessOperation(envelope.businessOperationCode);
  if (!operation) {
    return { valid: false, errorCode: 'UNSUPPORTED_OPERATION' };
  }
  const transport = TRANSPORT_OPERATION_BY_NAME.get(envelope.transportOperation);
  if (!transport) {
    return { valid: false, errorCode: 'TRANSPORT_OPERATION_MISMATCH' };
  }

  const outbound = envelope.direction === 'OUTBOUND_REQUEST';
  const fault = envelope.direction === 'INBOUND_FAULT';
  if (!fault) {
    const expectedTransport = outbound ? 'SendRequest' : 'SendResponse';
    if (envelope.transportOperation !== expectedTransport) {
      return { valid: false, errorCode: 'TRANSPORT_OPERATION_MISMATCH' };
    }
    const expectedQName = outbound
      ? operation.requestQName
      : operation.responseQName;
    if (envelope.payloadQName !== expectedQName) {
      return { valid: false, errorCode: 'PAYLOAD_QNAME_MISMATCH' };
    }
  } else if (envelope.payloadQName !== transport.faultQName) {
    return { valid: false, errorCode: 'FAULT_QNAME_MISMATCH' };
  }

  if (!UUID_V1_PATTERN.test(envelope.messageId)) {
    return { valid: false, errorCode: 'MESSAGE_ID_INVALID' };
  }
  if (!UUID_V1_PATTERN.test(envelope.referenceMessageId)) {
    return { valid: false, errorCode: 'REFERENCE_MESSAGE_ID_INVALID' };
  }
  if (
    !UTC_INSTANT_PATTERN.test(envelope.occurredAt)
    || Number.isNaN(Date.parse(envelope.occurredAt))
  ) {
    return { valid: false, errorCode: 'OCCURRED_AT_INVALID' };
  }
  if (!SHA_256_PATTERN.test(envelope.rawBodySha256)) {
    return { valid: false, errorCode: 'CONTENT_HASH_INVALID' };
  }
  if (envelope.signature === null) {
    return { valid: false, errorCode: 'SIGNATURE_REFERENCE_REQUIRED' };
  }
  if (!validSignatureReference(envelope.signature)) {
    return { valid: false, errorCode: 'SIGNATURE_REFERENCE_INVALID' };
  }

  if ((outbound || fault) && envelope.responseCode !== undefined) {
    return { valid: false, errorCode: 'RESPONSE_CODE_FORBIDDEN' };
  }
  if (!outbound && !fault && envelope.responseCode === undefined) {
    return { valid: false, errorCode: 'RESPONSE_CODE_REQUIRED' };
  }
  if (
    !outbound
    && !fault
    && envelope.responseCode !== undefined
    && !RESPONSE_CODE_SET.has(envelope.responseCode)
  ) {
    return { valid: false, errorCode: 'RESPONSE_CODE_UNSUPPORTED' };
  }

  return { valid: true, operation };
}

export function toRegulatoryInboundEnvelope(
  envelope: FgisGrainContractEnvelopeMetadata,
): RegulatoryInboundEnvelope {
  const validation = validateFgisGrainContractEnvelope(envelope);
  if (!validation.valid) {
    throw new Error(`FGIS_GRAIN_${validation.errorCode}`);
  }
  if (!['INBOUND_RESPONSE', 'INBOUND_FAULT'].includes(envelope.direction)) {
    throw new Error('FGIS_GRAIN_INBOUND_DIRECTION_REQUIRED');
  }
  return {
    provider: FGIS_GRAIN_ADAPTER_CODE,
    externalEventId: envelope.messageId,
    schemaVersion: FGIS_GRAIN_API_VERSION,
    mappingVersion: FGIS_GRAIN_1_0_23_MAPPING_VERSION,
    occurredAt: envelope.occurredAt,
    rawBodySha256: envelope.rawBodySha256,
    signature: envelope.signature,
    correlationId: envelope.referenceMessageId,
    causationId: envelope.referenceMessageId,
  };
}

export function toFgisGrainOutboundEnvelopeMetadata(
  envelope: FgisGrainContractEnvelopeMetadata,
): FgisGrainOutboundEnvelopeMetadata {
  const validation = validateFgisGrainContractEnvelope(envelope);
  if (!validation.valid) {
    throw new Error(`FGIS_GRAIN_${validation.errorCode}`);
  }
  if (envelope.direction !== 'OUTBOUND_REQUEST') {
    throw new Error('FGIS_GRAIN_OUTBOUND_DIRECTION_REQUIRED');
  }
  if (envelope.signature === null) {
    throw new Error('FGIS_GRAIN_SIGNATURE_REFERENCE_REQUIRED');
  }
  return {
    adapterIdentity: FGIS_GRAIN_ADAPTER_IDENTITY,
    schemaVersion: FGIS_GRAIN_API_VERSION,
    mappingVersion: FGIS_GRAIN_1_0_23_MAPPING_VERSION,
    transportOperation: 'SendRequest',
    businessOperationCode: envelope.businessOperationCode,
    payloadQName: validation.operation.requestQName,
    messageId: envelope.messageId,
    correlationId: envelope.referenceMessageId,
    rawBodySha256: envelope.rawBodySha256,
    signature: envelope.signature,
  };
}

export function validateFgisGrainRuntimeEndpoint(
  value: string,
): FgisGrainRuntimeEndpointValidationResult {
  const candidate = value.trim();
  if (!candidate) return { valid: false, errorCode: 'ENDPOINT_REQUIRED' };
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { valid: false, errorCode: 'ENDPOINT_HTTPS_REQUIRED' };
  }
  if (parsed.protocol !== 'https:') {
    return { valid: false, errorCode: 'ENDPOINT_HTTPS_REQUIRED' };
  }
  if (parsed.username || parsed.password) {
    return { valid: false, errorCode: 'ENDPOINT_CREDENTIALS_FORBIDDEN' };
  }
  if (parsed.hash) {
    return { valid: false, errorCode: 'ENDPOINT_FRAGMENT_FORBIDDEN' };
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost'
    || host === '127.0.0.1'
    || host === '::1'
    || candidate === FGIS_GRAIN_1_0_23_DOCUMENTATION_ENDPOINT.url
  ) {
    return { valid: false, errorCode: 'ENDPOINT_PLACEHOLDER_FORBIDDEN' };
  }
  return { valid: true, normalizedUrl: parsed.toString() };
}
