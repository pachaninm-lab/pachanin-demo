export const REGULATORY_INTEGRATION_ERROR_CODES = [
  'MALFORMED_ENVELOPE',
  'UNSUPPORTED_SCHEMA_VERSION',
  'UNSUPPORTED_MAPPING_VERSION',
  'SIGNATURE_REQUIRED',
  'SIGNATURE_INVALID',
  'KEY_REFERENCE_UNKNOWN',
  'REPLAY_CONFLICT',
  'TENANT_CONTEXT_MISSING',
  'ORGANIZATION_CONTEXT_MISSING',
  'LEASE_CONFLICT',
  'PROCESSING_TIMEOUT',
  'TRANSIENT_PROVIDER_FAILURE',
  'PERMANENT_PROVIDER_FAILURE',
  'INTERNAL_INVARIANT_VIOLATION',
] as const;

export type RegulatoryIntegrationErrorCode =
  (typeof REGULATORY_INTEGRATION_ERROR_CODES)[number];

export type RegulatoryIntegrationErrorCategory =
  | 'CONTRACT'
  | 'SECURITY'
  | 'AUTHORITY'
  | 'CONCURRENCY'
  | 'PROVIDER'
  | 'INTERNAL';

export type RegulatoryIntegrationFailureState =
  | 'RETRY'
  | 'QUARANTINED'
  | 'DEAD';

export interface RegulatoryIntegrationErrorClassification {
  readonly code: RegulatoryIntegrationErrorCode;
  readonly category: RegulatoryIntegrationErrorCategory;
  readonly retryable: boolean;
  readonly failureState: RegulatoryIntegrationFailureState;
  readonly securityRelevant: boolean;
}

const ERROR_CLASSIFICATIONS: Readonly<
  Record<RegulatoryIntegrationErrorCode, Omit<RegulatoryIntegrationErrorClassification, 'code'>>
> = {
  MALFORMED_ENVELOPE: {
    category: 'CONTRACT',
    retryable: false,
    failureState: 'QUARANTINED',
    securityRelevant: false,
  },
  UNSUPPORTED_SCHEMA_VERSION: {
    category: 'CONTRACT',
    retryable: false,
    failureState: 'QUARANTINED',
    securityRelevant: false,
  },
  UNSUPPORTED_MAPPING_VERSION: {
    category: 'CONTRACT',
    retryable: false,
    failureState: 'QUARANTINED',
    securityRelevant: false,
  },
  SIGNATURE_REQUIRED: {
    category: 'SECURITY',
    retryable: false,
    failureState: 'QUARANTINED',
    securityRelevant: true,
  },
  SIGNATURE_INVALID: {
    category: 'SECURITY',
    retryable: false,
    failureState: 'QUARANTINED',
    securityRelevant: true,
  },
  KEY_REFERENCE_UNKNOWN: {
    category: 'SECURITY',
    retryable: false,
    failureState: 'QUARANTINED',
    securityRelevant: true,
  },
  REPLAY_CONFLICT: {
    category: 'SECURITY',
    retryable: false,
    failureState: 'QUARANTINED',
    securityRelevant: true,
  },
  TENANT_CONTEXT_MISSING: {
    category: 'AUTHORITY',
    retryable: false,
    failureState: 'DEAD',
    securityRelevant: true,
  },
  ORGANIZATION_CONTEXT_MISSING: {
    category: 'AUTHORITY',
    retryable: false,
    failureState: 'DEAD',
    securityRelevant: true,
  },
  LEASE_CONFLICT: {
    category: 'CONCURRENCY',
    retryable: true,
    failureState: 'RETRY',
    securityRelevant: false,
  },
  PROCESSING_TIMEOUT: {
    category: 'CONCURRENCY',
    retryable: true,
    failureState: 'RETRY',
    securityRelevant: false,
  },
  TRANSIENT_PROVIDER_FAILURE: {
    category: 'PROVIDER',
    retryable: true,
    failureState: 'RETRY',
    securityRelevant: false,
  },
  PERMANENT_PROVIDER_FAILURE: {
    category: 'PROVIDER',
    retryable: false,
    failureState: 'DEAD',
    securityRelevant: false,
  },
  INTERNAL_INVARIANT_VIOLATION: {
    category: 'INTERNAL',
    retryable: false,
    failureState: 'DEAD',
    securityRelevant: true,
  },
};

export function classifyRegulatoryIntegrationError(
  code: RegulatoryIntegrationErrorCode,
): RegulatoryIntegrationErrorClassification {
  return {
    code,
    ...ERROR_CLASSIFICATIONS[code],
  };
}
