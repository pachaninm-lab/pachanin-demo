export const FGIS_GRAIN_PROVIDER_CONFIG_SCHEMA_VERSION =
  'pc-crop.fgis-grain-provider-configuration.v1' as const;
export const FGIS_GRAIN_PROVIDER_ATTESTATION_SCHEMA_VERSION =
  'pc-crop.fgis-grain-provider-attestation.v1' as const;
export const FGIS_GRAIN_PROVIDER_OPERATIONAL_STATUS = 'NOT_ATTESTED' as const;

export const FGIS_GRAIN_PROVIDER_ENVIRONMENTS = [
  'PRE_PRODUCTION',
  'PRODUCTION',
] as const;
export type FgisGrainProviderEnvironment =
  (typeof FGIS_GRAIN_PROVIDER_ENVIRONMENTS)[number];

export const FGIS_GRAIN_PROVIDER_CONFIGURATION_STATES = [
  'DRAFT',
  'UNDER_REVIEW',
  'TEST_APPROVED',
  'SUSPENDED',
  'REVOKED',
] as const;
export type FgisGrainProviderConfigurationState =
  (typeof FGIS_GRAIN_PROVIDER_CONFIGURATION_STATES)[number];

export const FGIS_GRAIN_ATTESTATION_GATES = [
  'OWNER',
  'SECURITY',
  'LEGAL',
  'OPERATIONS',
] as const;
export type FgisGrainAttestationGate =
  (typeof FGIS_GRAIN_ATTESTATION_GATES)[number];

export const FGIS_GRAIN_ATTESTATION_DECISIONS = [
  'APPROVED',
  'REJECTED',
] as const;
export type FgisGrainAttestationDecision =
  (typeof FGIS_GRAIN_ATTESTATION_DECISIONS)[number];

export interface FgisGrainProviderConfigurationReferences {
  readonly endpointReference: string;
  readonly tlsPolicyReference: string;
  readonly credentialReference: string;
  readonly signingKeyReference: string;
  readonly payloadStoreReference: string;
}

export interface FgisGrainProviderConfigurationDraft
  extends FgisGrainProviderConfigurationReferences {
  readonly schemaVersion: typeof FGIS_GRAIN_PROVIDER_CONFIG_SCHEMA_VERSION;
  readonly adapterCode: 'FGIS_ZERNO';
  readonly apiVersion: '1.0.23';
  readonly mappingVersion: 'fgis-zerno-1.0.23-catalog.v1';
  readonly signingPolicyVersion: 'fgis-zerno-1.0.23-signing-policy.v1';
  readonly environment: FgisGrainProviderEnvironment;
}

export interface FgisGrainProviderAttestationInput {
  readonly schemaVersion: typeof FGIS_GRAIN_PROVIDER_ATTESTATION_SCHEMA_VERSION;
  readonly gate: FgisGrainAttestationGate;
  readonly decision: FgisGrainAttestationDecision;
  readonly justification: string;
  readonly evidenceReference: string;
  readonly validUntil: string;
  readonly configurationVersion: string;
}

export interface FgisGrainAttestationGateView {
  readonly gate: FgisGrainAttestationGate;
  readonly state: 'MISSING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'STALE';
  readonly actorUserId: string | null;
  readonly actorRole: string | null;
  readonly evidenceReference: string | null;
  readonly validUntil: string | null;
  readonly configurationVersion: string | null;
}

export interface FgisGrainProviderConfigurationView {
  readonly id: string;
  readonly adapterCode: 'FGIS_ZERNO';
  readonly apiVersion: '1.0.23';
  readonly mappingVersion: 'fgis-zerno-1.0.23-catalog.v1';
  readonly signingPolicyVersion: 'fgis-zerno-1.0.23-signing-policy.v1';
  readonly environment: FgisGrainProviderEnvironment;
  readonly status: FgisGrainProviderConfigurationState;
  readonly version: string;
  readonly references: FgisGrainProviderConfigurationReferences;
  readonly gates: readonly FgisGrainAttestationGateView[];
  readonly blockers: readonly string[];
  readonly nextAction: string;
  readonly productionActivationAllowed: false;
  readonly operationalStatus: typeof FGIS_GRAIN_PROVIDER_OPERATIONAL_STATUS;
}

export type FgisGrainProviderContractErrorCode =
  | 'MALFORMED_CONFIGURATION'
  | 'UNSUPPORTED_ENVIRONMENT'
  | 'REFERENCE_INVALID'
  | 'INLINE_SECRET_OR_ENDPOINT_FORBIDDEN'
  | 'PRODUCTION_ACTIVATION_FORBIDDEN'
  | 'MALFORMED_ATTESTATION'
  | 'ATTESTATION_TTL_INVALID'
  | 'ATTESTATION_VERSION_INVALID';

export class FgisGrainProviderContractError extends Error {
  constructor(
    readonly code: FgisGrainProviderContractErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FgisGrainProviderContractError';
  }
}

const SHA_OR_REFERENCE =
  /^(?:endpoint|tls|credential|signing-key|object-store|evidence|policy|vault|kms|config):\/\/[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,500}$/u;
const SECRET_MARKERS = [
  '-----BEGIN',
  '<Signature',
  '<soap:',
  'password=',
  'token=',
  'secret=',
  'privateKey',
  'certificateBytes',
] as const;
const VERSION_PATTERN = /^(?:0|[1-9][0-9]{0,18})$/u;

function assertPlainRecord(value: unknown, code: FgisGrainProviderContractErrorCode): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new FgisGrainProviderContractError(code, 'Expected a plain object');
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
  code: FgisGrainProviderContractErrorCode,
): void {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new FgisGrainProviderContractError(code, 'Unexpected or missing contract fields');
  }
}

function assertReference(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SHA_OR_REFERENCE.test(value)) {
    throw new FgisGrainProviderContractError('REFERENCE_INVALID', `${field} is not an approved reference`);
  }
  const lower = value.toLowerCase();
  if (
    lower.includes('localhost')
    || lower.includes('127.0.0.1')
    || lower.includes('@')
    || SECRET_MARKERS.some((marker) => value.includes(marker))
  ) {
    throw new FgisGrainProviderContractError(
      'INLINE_SECRET_OR_ENDPOINT_FORBIDDEN',
      `${field} contains inline endpoint or secret material`,
    );
  }
  return value;
}

export function assertFgisGrainProviderConfigurationDraft(
  value: unknown,
): FgisGrainProviderConfigurationDraft {
  const record = assertPlainRecord(value, 'MALFORMED_CONFIGURATION');
  assertExactKeys(record, [
    'schemaVersion',
    'adapterCode',
    'apiVersion',
    'mappingVersion',
    'signingPolicyVersion',
    'environment',
    'endpointReference',
    'tlsPolicyReference',
    'credentialReference',
    'signingKeyReference',
    'payloadStoreReference',
  ], 'MALFORMED_CONFIGURATION');
  if (
    record.schemaVersion !== FGIS_GRAIN_PROVIDER_CONFIG_SCHEMA_VERSION
    || record.adapterCode !== 'FGIS_ZERNO'
    || record.apiVersion !== '1.0.23'
    || record.mappingVersion !== 'fgis-zerno-1.0.23-catalog.v1'
    || record.signingPolicyVersion !== 'fgis-zerno-1.0.23-signing-policy.v1'
  ) {
    throw new FgisGrainProviderContractError('MALFORMED_CONFIGURATION', 'Provider authority pin mismatch');
  }
  if (!FGIS_GRAIN_PROVIDER_ENVIRONMENTS.includes(record.environment as FgisGrainProviderEnvironment)) {
    throw new FgisGrainProviderContractError('UNSUPPORTED_ENVIRONMENT', 'Unsupported provider environment');
  }
  return Object.freeze({
    schemaVersion: FGIS_GRAIN_PROVIDER_CONFIG_SCHEMA_VERSION,
    adapterCode: 'FGIS_ZERNO',
    apiVersion: '1.0.23',
    mappingVersion: 'fgis-zerno-1.0.23-catalog.v1',
    signingPolicyVersion: 'fgis-zerno-1.0.23-signing-policy.v1',
    environment: record.environment as FgisGrainProviderEnvironment,
    endpointReference: assertReference(record.endpointReference, 'endpointReference'),
    tlsPolicyReference: assertReference(record.tlsPolicyReference, 'tlsPolicyReference'),
    credentialReference: assertReference(record.credentialReference, 'credentialReference'),
    signingKeyReference: assertReference(record.signingKeyReference, 'signingKeyReference'),
    payloadStoreReference: assertReference(record.payloadStoreReference, 'payloadStoreReference'),
  });
}

export function assertFgisGrainProviderAttestationInput(
  value: unknown,
  now = new Date(),
): FgisGrainProviderAttestationInput {
  const record = assertPlainRecord(value, 'MALFORMED_ATTESTATION');
  assertExactKeys(record, [
    'schemaVersion',
    'gate',
    'decision',
    'justification',
    'evidenceReference',
    'validUntil',
    'configurationVersion',
  ], 'MALFORMED_ATTESTATION');
  if (
    record.schemaVersion !== FGIS_GRAIN_PROVIDER_ATTESTATION_SCHEMA_VERSION
    || !FGIS_GRAIN_ATTESTATION_GATES.includes(record.gate as FgisGrainAttestationGate)
    || !FGIS_GRAIN_ATTESTATION_DECISIONS.includes(record.decision as FgisGrainAttestationDecision)
    || typeof record.justification !== 'string'
    || record.justification.trim().length < 20
    || record.justification.trim().length > 2000
  ) {
    throw new FgisGrainProviderContractError('MALFORMED_ATTESTATION', 'Attestation fields are invalid');
  }
  if (typeof record.configurationVersion !== 'string' || !VERSION_PATTERN.test(record.configurationVersion)) {
    throw new FgisGrainProviderContractError('ATTESTATION_VERSION_INVALID', 'Configuration version is invalid');
  }
  if (typeof record.validUntil !== 'string') {
    throw new FgisGrainProviderContractError('ATTESTATION_TTL_INVALID', 'Attestation TTL is invalid');
  }
  const validUntil = new Date(record.validUntil);
  const ttlMs = validUntil.getTime() - now.getTime();
  if (!Number.isFinite(validUntil.getTime()) || ttlMs < 5 * 60_000 || ttlMs > 30 * 24 * 60 * 60_000) {
    throw new FgisGrainProviderContractError('ATTESTATION_TTL_INVALID', 'Attestation TTL must be between 5 minutes and 30 days');
  }
  return Object.freeze({
    schemaVersion: FGIS_GRAIN_PROVIDER_ATTESTATION_SCHEMA_VERSION,
    gate: record.gate as FgisGrainAttestationGate,
    decision: record.decision as FgisGrainAttestationDecision,
    justification: record.justification.trim(),
    evidenceReference: assertReference(record.evidenceReference, 'evidenceReference'),
    validUntil: validUntil.toISOString(),
    configurationVersion: record.configurationVersion,
  });
}

export function assertTestActivationAllowed(
  environment: FgisGrainProviderEnvironment,
): void {
  if (environment === 'PRODUCTION') {
    throw new FgisGrainProviderContractError(
      'PRODUCTION_ACTIVATION_FORBIDDEN',
      'Production provider activation is outside PC-CROP-08E',
    );
  }
}
