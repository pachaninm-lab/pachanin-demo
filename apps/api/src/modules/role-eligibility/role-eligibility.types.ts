export const ELIGIBILITY_VERDICTS = [
  'ELIGIBLE',
  'REVIEW_REQUIRED',
  'APPARENT_MISMATCH',
  'SOURCE_UNAVAILABLE',
  'STALE',
  'NOT_APPLICABLE',
  'SUPERSEDED',
  'ERROR',
] as const;
export type EligibilityVerdict = typeof ELIGIBILITY_VERDICTS[number];

export const ELIGIBILITY_CHECK_STATUSES = [
  'PENDING',
  'CHECKING',
  ...ELIGIBILITY_VERDICTS,
] as const;
export type EligibilityCheckStatus = typeof ELIGIBILITY_CHECK_STATUSES[number];

export const ELIGIBILITY_SOURCES = ['FNS', 'FGIS_GRAIN', 'CBR', 'ROSACCREDITATION'] as const;
export type EligibilitySource = typeof ELIGIBILITY_SOURCES[number];

export const SOURCE_HEALTH_STATUSES = [
  'HEALTHY',
  'DEGRADED',
  'UNAVAILABLE',
  'STALE',
  'SCHEMA_CHANGED',
] as const;
export type SourceHealthStatus = typeof SOURCE_HEALTH_STATUSES[number];

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type SemanticEligibilityRole =
  | 'FARMER'
  | 'BUYER'
  | 'LOGISTICS'
  | 'ELEVATOR'
  | 'LABORATORY'
  | 'SURVEYOR'
  | 'BANK'
  | 'DRIVER'
  | 'EMPLOYEE';

/**
 * Existing registration maps public workspaces to internal cabinet roles. Role
 * Eligibility deliberately interprets that immutable mapping instead of
 * changing registration to create new role codes.
 */
export const REGISTRATION_ROLE_CONTRACT: Readonly<Record<string, string>> = Object.freeze({
  seller: 'FARMER',
  buyer: 'BUYER',
  logistics: 'LOGISTICIAN',
  driver: 'DRIVER',
  elevator: 'ELEVATOR',
  lab: 'LAB',
  surveyor: 'SURVEYOR',
  bank: 'ACCOUNTING',
  employee: 'GUEST',
});

export const WORKSPACE_ELIGIBILITY_ROLE: Readonly<Record<string, SemanticEligibilityRole>> = Object.freeze({
  seller: 'FARMER',
  buyer: 'BUYER',
  logistics: 'LOGISTICS',
  driver: 'DRIVER',
  elevator: 'ELEVATOR',
  lab: 'LABORATORY',
  surveyor: 'SURVEYOR',
  bank: 'BANK',
  employee: 'EMPLOYEE',
});

export type RoleEligibilityCandidate = {
  applicationId: string;
  applicationVersion: bigint;
  applicationStatus: string;
  organizationId: string;
  tenantId: string;
  requestedWorkspace: string;
  requestedRole: string;
  inn: string;
  ogrn: string | null;
  kpp: string | null;
  legalName: string;
  submittedAt: Date;
};

export type NormalizedOrganizationFacts = {
  identity: {
    exists: boolean;
    active: boolean;
    innMatch: boolean;
    ogrnMatch: boolean | null;
    legalNameMatch?: boolean | null;
  };
  okved?: {
    primary?: string | null;
    additional?: string[];
    dictionaryVersion?: string;
  };
  cbr?: {
    present: boolean;
    active: boolean;
    creditOrganization: boolean;
    licenseValid: boolean;
  };
  fgisGrain?: {
    present: boolean;
    active: boolean;
    elevatorRecord: boolean;
  };
  accreditation?: {
    present: boolean;
    active: boolean;
    accreditedPersonType?: string | null;
    scopeRelevant: boolean;
    validFrom?: string | null;
    validUntil?: string | null;
  };
  logistics?: {
    transportProfile: boolean;
    governmentEvidence: boolean;
  };
  strongContradiction?: boolean;
};

export type SourceManifestEntry = {
  source: EligibilitySource;
  generation: string;
  evidenceId: string;
  evidenceHash: string;
  sourcePublishedAt: string;
  parserVersion: string;
};

export type EligibilityPolicyInput = {
  candidate: RoleEligibilityCandidate;
  semanticRole: SemanticEligibilityRole;
  facts: NormalizedOrganizationFacts;
  sourceStates: Partial<Record<EligibilitySource, SourceHealthStatus>>;
  evidenceSources: EligibilitySource[];
};

export type EligibilityPolicyDecision = {
  verdict: EligibilityVerdict;
  reasonCodes: string[];
};

export type RegistryGeneration = {
  id: string;
  source: EligibilitySource;
  generation: string;
  publishedAt: Date;
  downloadedAt: Date;
  contentSha256: string;
  recordCount: bigint;
  parserVersion: string;
  schemaVersion: string;
  status: 'STAGING' | 'VALIDATED' | 'ACTIVE' | 'REJECTED';
  freshUntil: Date;
};

export type NormalizedRegistryRecord = {
  id: string;
  generationId: string;
  source: EligibilitySource;
  sourceRecordId: string;
  subjectInn: string | null;
  subjectOgrn: string | null;
  recordType: string;
  normalizedPayload: Record<string, unknown>;
  sourcePublishedAt: Date;
  validFrom: Date | null;
  validUntil: Date | null;
  payloadSha256: string;
};

export type EligibilityEvidence = {
  id: string;
  checkId: string;
  sourceType: EligibilitySource;
  sourceName: string;
  sourceRecordId: string;
  registryGeneration: string;
  subjectInn: string | null;
  subjectOgrn: string | null;
  evidenceType: string;
  normalizedPayload: Record<string, unknown>;
  sourcePublishedAt: Date;
  sourceCheckedAt: Date;
  validFrom: Date | null;
  validUntil: Date | null;
  freshUntil: Date;
  parserVersion: string;
  payloadSha256: string;
  confidenceClass: 'HIGH' | 'MEDIUM' | 'LOW';
};

export type EligibilityCheck = {
  id: string;
  applicationId: string;
  applicationVersion: bigint;
  applicationStatusAtStart: string;
  organizationId: string;
  tenantId: string;
  inn: string;
  ogrn: string | null;
  kpp: string | null;
  requestedWorkspace: string;
  requestedRole: string;
  status: EligibilityCheckStatus;
  policyVersion: string;
  policyHash: string;
  sourceManifestHash: string | null;
  requestKey: string;
  correlationId: string;
  startedAt: Date | null;
  completedAt: Date | null;
  nextRecheckAt: Date | null;
};

export type SourceHealthSnapshot = {
  source: EligibilitySource;
  status: SourceHealthStatus;
  circuitState: CircuitState;
  activeGeneration: string | null;
  parserVersion: string | null;
  schemaVersion: string | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  checkedAt: Date;
  freshUntil: Date | null;
  consecutiveFailures: number;
  lastErrorCode: string | null;
};

export type RegistryAdapterFetchResult = {
  source: EligibilitySource;
  sourceName: string;
  origin: string;
  publishedAt: Date;
  checkedAt: Date;
  parserVersion: string;
  schemaVersion: string;
  contentSha256: string;
  records: Array<{
    sourceRecordId: string;
    subjectInn: string | null;
    subjectOgrn: string | null;
    recordType: string;
    normalizedPayload: Record<string, unknown>;
    validFrom: Date | null;
    validUntil: Date | null;
  }>;
};

export class EligibilitySourceError extends Error {
  constructor(
    readonly source: EligibilitySource,
    readonly code: string,
    readonly health: Extract<SourceHealthStatus, 'UNAVAILABLE' | 'SCHEMA_CHANGED' | 'DEGRADED'>,
  ) {
    super(`${source}:${code}`);
    this.name = 'EligibilitySourceError';
  }
}
