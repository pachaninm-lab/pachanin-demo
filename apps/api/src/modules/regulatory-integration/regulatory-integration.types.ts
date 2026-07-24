import type { RegulatoryIntegrationErrorCode } from './regulatory-integration.errors';

export const REGULATORY_INTEGRATION_STATES = [
  'RECEIVED',
  'VERIFIED',
  'PROCESSING',
  'PROCESSED',
  'RETRY',
  'QUARANTINED',
  'DEAD',
] as const;

export type RegulatoryIntegrationState =
  (typeof REGULATORY_INTEGRATION_STATES)[number];

export const REGULATORY_ADAPTER_CAPABILITIES = [
  'INBOUND_EVENTS',
  'SIGNATURE_VERIFICATION',
  'SCHEMA_MAPPING',
  'PROVIDER_ACKNOWLEDGEMENT',
] as const;

export type RegulatoryAdapterCapability =
  (typeof REGULATORY_ADAPTER_CAPABILITIES)[number];

export type RegulatoryAdapterEnvironment =
  | 'PRODUCTION'
  | 'PRE_PRODUCTION'
  | 'SANDBOX';

export interface RegulatoryAdapterIdentity {
  readonly adapterCode: string;
  readonly adapterVersion: string;
  readonly mappingVersion: string;
  readonly environment: RegulatoryAdapterEnvironment;
  readonly capabilities: readonly RegulatoryAdapterCapability[];
}

export interface RegulatorySignatureMetadata {
  readonly algorithm: string;
  readonly keyReference: string;
  readonly keyVersion: string;
  readonly signatureVersion: string;
  readonly verificationPolicyVersion: string;
}

export interface RegulatoryInboundEnvelope {
  readonly provider: string;
  readonly externalEventId: string;
  readonly schemaVersion: string;
  readonly mappingVersion: string;
  readonly occurredAt: string;
  readonly rawBodySha256: string;
  readonly signature: RegulatorySignatureMetadata | null;
  readonly correlationId: string;
  readonly causationId: string | null;
}

export type RegulatoryVerificationResult =
  | {
      readonly verified: true;
      readonly verifiedAt: string;
      readonly schemaVersion: string;
      readonly mappingVersion: string;
      readonly signatureKeyReference: string | null;
      readonly errorCode?: never;
    }
  | {
      readonly verified: false;
      readonly verifiedAt: string;
      readonly errorCode: RegulatoryIntegrationErrorCode;
      readonly schemaVersion?: never;
      readonly mappingVersion?: never;
      readonly signatureKeyReference?: never;
    };

export type ProviderAcknowledgementState =
  | 'NOT_ELIGIBLE'
  | 'ELIGIBLE_AFTER_DURABLE_COMMIT'
  | 'ACKNOWLEDGED';

export type BusinessAcceptanceState =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED';

export interface RegulatoryProcessingOutcome {
  readonly providerAcknowledgement: ProviderAcknowledgementState;
  readonly businessAcceptance: BusinessAcceptanceState;
  readonly linkedDomainOperationId: string | null;
}

export interface RegulatoryEnvelopePolicy {
  readonly allowedSchemaVersions: readonly string[];
  readonly allowedMappingVersions: readonly string[];
  readonly requireSignature: boolean;
}

export type RegulatoryEnvelopeValidationResult =
  | { readonly valid: true }
  | {
      readonly valid: false;
      readonly errorCode:
        | 'MALFORMED_ENVELOPE'
        | 'UNSUPPORTED_SCHEMA_VERSION'
        | 'UNSUPPORTED_MAPPING_VERSION'
        | 'SIGNATURE_REQUIRED';
    };

const SHA_256_PATTERN = /^[a-f0-9]{64}$/u;

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function hasValidSignatureMetadata(
  signature: RegulatorySignatureMetadata,
): boolean {
  return isNonEmpty(signature.algorithm)
    && isNonEmpty(signature.keyReference)
    && isNonEmpty(signature.keyVersion)
    && isNonEmpty(signature.signatureVersion)
    && isNonEmpty(signature.verificationPolicyVersion);
}

export function validateRegulatoryInboundEnvelope(
  envelope: RegulatoryInboundEnvelope,
  policy: RegulatoryEnvelopePolicy,
): RegulatoryEnvelopeValidationResult {
  const malformed = !isNonEmpty(envelope.provider)
    || !isNonEmpty(envelope.externalEventId)
    || !isNonEmpty(envelope.schemaVersion)
    || !isNonEmpty(envelope.mappingVersion)
    || !isNonEmpty(envelope.correlationId)
    || Number.isNaN(Date.parse(envelope.occurredAt))
    || !SHA_256_PATTERN.test(envelope.rawBodySha256)
    || (envelope.signature !== null && !hasValidSignatureMetadata(envelope.signature));

  if (malformed) {
    return { valid: false, errorCode: 'MALFORMED_ENVELOPE' };
  }

  if (!policy.allowedSchemaVersions.includes(envelope.schemaVersion)) {
    return { valid: false, errorCode: 'UNSUPPORTED_SCHEMA_VERSION' };
  }

  if (!policy.allowedMappingVersions.includes(envelope.mappingVersion)) {
    return { valid: false, errorCode: 'UNSUPPORTED_MAPPING_VERSION' };
  }

  if (policy.requireSignature && envelope.signature === null) {
    return { valid: false, errorCode: 'SIGNATURE_REQUIRED' };
  }

  return { valid: true };
}
