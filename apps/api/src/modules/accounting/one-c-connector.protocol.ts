import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Server-side contract for the local/server 1C connector.
 *
 * This is deliberately not a vendor adapter. It defines the protocol our own
 * connector is allowed to speak to the platform. The useful property is not
 * that the connector can do many things; it is that it cannot ask the server
 * for arbitrary SQL, arbitrary code, a database dump or unrestricted records.
 */
export const ONE_C_PROTOCOL_VERSION = '1';

export const OneCCommand = {
  UPSERT_COUNTERPARTY: 'UPSERT_COUNTERPARTY',
  CREATE_SALES_DRAFT: 'CREATE_SALES_DRAFT',
  CREATE_PURCHASE_DRAFT: 'CREATE_PURCHASE_DRAFT',
  CREATE_CORRECTION_DRAFT: 'CREATE_CORRECTION_DRAFT',
  GET_DOCUMENT_STATUS: 'GET_DOCUMENT_STATUS',
  PUSH_PAYMENT_STATUS: 'PUSH_PAYMENT_STATUS',
  GET_REFERENCE_CANDIDATES: 'GET_REFERENCE_CANDIDATES',
} as const;
export type OneCCommand = (typeof OneCCommand)[keyof typeof OneCCommand];

export const ONE_C_COMMANDS = Object.freeze(Object.values(OneCCommand));

export const OneCCompatibilityProfile = {
  BSHP_3: 'BSHP_3',
  KFH: 'KFH',
  BP_3: 'BP_3',
  ERP: 'ERP',
  KA: 'KA',
  UT: 'UT',
  UNKNOWN: 'UNKNOWN',
} as const;
export type OneCCompatibilityProfile =
  (typeof OneCCompatibilityProfile)[keyof typeof OneCCompatibilityProfile];

export const OneCUnsupportedMode = {
  GENERIC_EXPORT_IMPORT: 'GENERIC_EXPORT_IMPORT',
  MANUAL_EXTERNAL: 'MANUAL_EXTERNAL',
} as const;
export type OneCUnsupportedMode =
  (typeof OneCUnsupportedMode)[keyof typeof OneCUnsupportedMode];

export const OneCSyncState = {
  QUEUED: 'QUEUED',
  DELIVERED_TO_CONNECTOR: 'DELIVERED_TO_CONNECTOR',
  CREATED_IN_1C: 'CREATED_IN_1C',
  POSTED: 'POSTED',
  REJECTED: 'REJECTED',
  RECONCILIATION_REQUIRED: 'RECONCILIATION_REQUIRED',
  UNKNOWN: 'UNKNOWN',
} as const;
export type OneCSyncState = (typeof OneCSyncState)[keyof typeof OneCSyncState];

export const OneCPostingMode = {
  CREATE_DRAFT: 'CREATE_DRAFT',
  AUTO_POST: 'AUTO_POST',
} as const;
export type OneCPostingMode =
  (typeof OneCPostingMode)[keyof typeof OneCPostingMode];

export const ONE_C_CONNECTOR_API = Object.freeze({
  pair: 'POST /connector/v1/pair',
  heartbeat: 'POST /connector/v1/heartbeat',
  jobs: 'GET /connector/v1/jobs',
  acknowledgeJob: 'POST /connector/v1/jobs/:id/ack',
  completeJob: 'POST /connector/v1/jobs/:id/result',
  failJob: 'POST /connector/v1/jobs/:id/fail',
  events: 'POST /connector/v1/events',
  mappings: 'POST /connector/v1/mappings',
});

export interface OneCDiscoveryOrganization {
  readonly guid: string;
  readonly inn: string;
  readonly kpp: string | null;
  readonly name: string;
}

export interface OneCSelfDiscovery {
  readonly platformVersion: string;
  readonly configurationName: string;
  readonly configurationVersion: string;
  readonly databaseInstanceId: string;
  readonly organizations: readonly OneCDiscoveryOrganization[];
  readonly capabilities: readonly OneCCommand[];
  readonly connectorVersion: string;
  readonly protocolVersion: string;
}

export const OneCBindingStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
} as const;
export type OneCBindingStatus =
  (typeof OneCBindingStatus)[keyof typeof OneCBindingStatus];

/**
 * One binding means one platform organization to one concrete legal entity in
 * the 1C database. One database may expose many legal entities; that never
 * makes them one authorization scope.
 */
export interface OneCOrganizationBinding {
  readonly platformOrganizationId: string;
  readonly oneCOrganizationGuid: string;
  readonly connectorInstallationId: string;
  readonly connectionId: string;
  readonly capabilityProfile: readonly OneCCommand[];
  readonly compatibilityProfile: OneCCompatibilityProfile;
  readonly status: OneCBindingStatus;
}

export interface OneCMachineIdentityClaims {
  readonly connectorInstallationId: string;
  readonly connectionId: string;
  readonly platformOrganizationId: string;
  readonly oneCOrganizationGuid: string;
  readonly protocolVersion: string;
}

export interface OneCConnectorJob {
  readonly id: string;
  readonly command: OneCCommand;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly organizationId: string;
  readonly connectionId: string;
  readonly revision: number;
  readonly attempt: number;
}

export interface OneCPairingRecord {
  readonly salt: string;
  readonly codeHash: string;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
}

export interface OneCPairingChallenge {
  /** Returned once to the human who is pairing. Never persist this value. */
  readonly code: string;
  /** Safe to persist: no plaintext pairing code. */
  readonly record: OneCPairingRecord;
}

export interface OneCAutoPostAcceptance {
  readonly connectorInstallationId: string;
  readonly configurationVersion: string;
  readonly acceptedAt: Date;
}

export class OneCProtocolValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OneCProtocolValidationError';
  }
}

const commandPayloadShape: Readonly<
  Record<OneCCommand, { required: readonly string[]; allowed: readonly string[] }>
> = {
  [OneCCommand.UPSERT_COUNTERPARTY]: {
    required: ['counterpartyInn', 'counterpartyName'],
    allowed: ['counterpartyInn', 'counterpartyKpp', 'counterpartyName', 'externalCounterpartyId'],
  },
  [OneCCommand.CREATE_SALES_DRAFT]: {
    required: [
      'documentId',
      'documentVersionId',
      'documentType',
      'documentNumber',
      'payloadHash',
      'counterpartyInn',
      'formatRevision',
    ],
    allowed: [
      'documentId',
      'documentVersionId',
      'documentType',
      'documentNumber',
      'payloadHash',
      'counterpartyInn',
      'formatRevision',
    ],
  },
  [OneCCommand.CREATE_PURCHASE_DRAFT]: {
    required: [
      'documentId',
      'documentVersionId',
      'documentType',
      'documentNumber',
      'payloadHash',
      'counterpartyInn',
      'formatRevision',
    ],
    allowed: [
      'documentId',
      'documentVersionId',
      'documentType',
      'documentNumber',
      'payloadHash',
      'counterpartyInn',
      'formatRevision',
    ],
  },
  [OneCCommand.CREATE_CORRECTION_DRAFT]: {
    required: [
      'documentId',
      'documentVersionId',
      'originalDocumentId',
      'documentType',
      'documentNumber',
      'payloadHash',
      'counterpartyInn',
      'formatRevision',
    ],
    allowed: [
      'documentId',
      'documentVersionId',
      'originalDocumentId',
      'documentType',
      'documentNumber',
      'payloadHash',
      'counterpartyInn',
      'formatRevision',
    ],
  },
  [OneCCommand.GET_DOCUMENT_STATUS]: {
    required: ['documentId'],
    allowed: ['documentId', 'externalDocumentId'],
  },
  [OneCCommand.PUSH_PAYMENT_STATUS]: {
    required: ['dealId', 'paymentId', 'status', 'amountKopecks', 'currency', 'paidAt'],
    allowed: ['dealId', 'paymentId', 'status', 'amountKopecks', 'currency', 'paidAt'],
  },
  [OneCCommand.GET_REFERENCE_CANDIDATES]: {
    required: ['referenceType', 'query'],
    allowed: ['referenceType', 'query', 'limit'],
  },
};

export function isOneCCommand(value: unknown): value is OneCCommand {
  return typeof value === 'string' && (ONE_C_COMMANDS as readonly string[]).includes(value);
}

export function isOneCCompatibilityProfile(
  value: unknown,
): value is OneCCompatibilityProfile {
  return (
    typeof value === 'string'
    && (Object.values(OneCCompatibilityProfile) as readonly string[]).includes(value)
  );
}

/**
 * Validate a self-discovery report without pretending it proves compatibility.
 * A configuration the registry does not know remains UNKNOWN in the binding.
 */
export function validateOneCDiscovery(discovery: OneCSelfDiscovery): void {
  nonBlank(discovery.platformVersion, 'platformVersion');
  nonBlank(discovery.configurationName, 'configurationName');
  nonBlank(discovery.configurationVersion, 'configurationVersion');
  nonBlank(discovery.databaseInstanceId, 'databaseInstanceId');
  nonBlank(discovery.connectorVersion, 'connectorVersion');

  if (discovery.protocolVersion !== ONE_C_PROTOCOL_VERSION) {
    throw new OneCProtocolValidationError(
      `protocolVersion must be ${ONE_C_PROTOCOL_VERSION}`,
    );
  }
  if (discovery.organizations.length === 0) {
    throw new OneCProtocolValidationError('organizations must contain at least one legal entity');
  }

  const guids = new Set<string>();
  for (const organization of discovery.organizations) {
    nonBlank(organization.guid, 'organizations[].guid');
    nonBlank(organization.inn, 'organizations[].inn');
    nonBlank(organization.name, 'organizations[].name');
    if (guids.has(organization.guid)) {
      throw new OneCProtocolValidationError('organization GUIDs must be unique inside discovery');
    }
    guids.add(organization.guid);
  }

  const capabilities = new Set<string>();
  for (const capability of discovery.capabilities) {
    if (!isOneCCommand(capability)) {
      throw new OneCProtocolValidationError(`unsupported connector capability: ${String(capability)}`);
    }
    if (capabilities.has(capability)) {
      throw new OneCProtocolValidationError(`duplicate connector capability: ${capability}`);
    }
    capabilities.add(capability);
  }
}

/**
 * The binding is the authorization boundary between one platform organization
 * and one legal entity in a potentially multi-organization 1C database.
 */
export function validateOneCBinding(
  binding: OneCOrganizationBinding,
  discovery: OneCSelfDiscovery,
): void {
  validateOneCDiscovery(discovery);
  nonBlank(binding.platformOrganizationId, 'platformOrganizationId');
  nonBlank(binding.oneCOrganizationGuid, 'oneCOrganizationGuid');
  nonBlank(binding.connectorInstallationId, 'connectorInstallationId');
  nonBlank(binding.connectionId, 'connectionId');

  if (!isOneCCompatibilityProfile(binding.compatibilityProfile)) {
    throw new OneCProtocolValidationError('unknown compatibility profile');
  }

  const discovered = discovery.organizations.some(
    (organization) => organization.guid === binding.oneCOrganizationGuid,
  );
  if (!discovered) {
    throw new OneCProtocolValidationError('bound 1C organization GUID was not discovered');
  }

  const discoveredCapabilities = new Set(discovery.capabilities);
  for (const command of binding.capabilityProfile) {
    if (!isOneCCommand(command)) {
      throw new OneCProtocolValidationError(`unsupported binding capability: ${String(command)}`);
    }
    if (!discoveredCapabilities.has(command)) {
      throw new OneCProtocolValidationError(
        `binding capability was not advertised by connector: ${command}`,
      );
    }
  }
}

/**
 * Validate one queued job. Unknown keys are refused, not ignored: silently
 * accepting `sql`, `code` or `dump` alongside a valid command would turn a
 * typed protocol back into an arbitrary remote-execution channel.
 */
export function validateOneCJob(job: OneCConnectorJob): void {
  nonBlank(job.id, 'id');
  nonBlank(job.idempotencyKey, 'idempotencyKey');
  nonBlank(job.correlationId, 'correlationId');
  nonBlank(job.organizationId, 'organizationId');
  nonBlank(job.connectionId, 'connectionId');

  if (!isOneCCommand(job.command)) {
    throw new OneCProtocolValidationError(`unsupported command: ${String(job.command)}`);
  }
  if (!Number.isInteger(job.revision) || job.revision < 0) {
    throw new OneCProtocolValidationError('revision must be a non-negative integer');
  }
  if (!Number.isInteger(job.attempt) || job.attempt < 0) {
    throw new OneCProtocolValidationError('attempt must be a non-negative integer');
  }

  const shape = commandPayloadShape[job.command];
  const keys = Object.keys(job.payload);
  for (const key of keys) {
    if (!shape.allowed.includes(key)) {
      throw new OneCProtocolValidationError(
        `payload field is not allowed for ${job.command}: ${key}`,
      );
    }
  }
  for (const key of shape.required) {
    if (!(key in job.payload)) {
      throw new OneCProtocolValidationError(
        `payload field is required for ${job.command}: ${key}`,
      );
    }
    requireScalar(job.payload[key], key);
  }

  if (job.command === OneCCommand.PUSH_PAYMENT_STATUS) {
    const amount = job.payload.amountKopecks;
    if (typeof amount !== 'string' || /^-?\d+$/.test(amount) === false) {
      throw new OneCProtocolValidationError('amountKopecks must be a whole number string');
    }
  }

  if (job.command === OneCCommand.GET_REFERENCE_CANDIDATES && 'limit' in job.payload) {
    const limit = job.payload.limit;
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new OneCProtocolValidationError('limit must be an integer from 1 to 100');
    }
  }
}

/**
 * Create a high-entropy, one-time pairing secret. Only the hash belongs in the
 * database. Atomic consume is a repository concern and intentionally does not
 * live in this pure protocol module.
 */
export function createOneCPairingChallenge(
  now: Date = new Date(),
  ttlMs = 10 * 60 * 1000,
): OneCPairingChallenge {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > 60 * 60 * 1000) {
    throw new OneCProtocolValidationError('pairing TTL must be between 1 ms and 1 hour');
  }
  const code = randomBytes(24).toString('base64url');
  const salt = randomBytes(16).toString('hex');
  return {
    code,
    record: {
      salt,
      codeHash: pairingHash(salt, code),
      expiresAt: new Date(now.getTime() + ttlMs),
      consumedAt: null,
    },
  };
}

export function verifyOneCPairingCode(
  record: OneCPairingRecord,
  code: string,
  now: Date = new Date(),
): boolean {
  if (record.consumedAt !== null || now.getTime() >= record.expiresAt.getTime()) {
    return false;
  }
  if (typeof code !== 'string' || code.length < 16) return false;

  const actual = Buffer.from(pairingHash(record.salt, code), 'hex');
  const expected = Buffer.from(record.codeHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * CREATE_DRAFT is the default and the fallback. AUTO_POST becomes effective
 * only when separate server-side acceptance evidence exists for this exact
 * installation/configuration. The connector cannot opt itself in.
 */
export function effectiveOneCPostingMode(
  requested: OneCPostingMode,
  installationId: string,
  configurationVersion: string,
  acceptance: OneCAutoPostAcceptance | null,
): OneCPostingMode {
  if (requested !== OneCPostingMode.AUTO_POST || acceptance === null) {
    return OneCPostingMode.CREATE_DRAFT;
  }
  if (
    acceptance.connectorInstallationId !== installationId
    || acceptance.configurationVersion !== configurationVersion
  ) {
    return OneCPostingMode.CREATE_DRAFT;
  }
  return OneCPostingMode.AUTO_POST;
}

/**
 * Whether the state transition is legal. UNKNOWN cannot jump to QUEUED: a
 * timeout may have happened after 1C committed, so blind retry can duplicate a
 * business effect. It must pass through reconciliation first.
 */
export function canTransitionOneCSyncState(
  from: OneCSyncState,
  to: OneCSyncState,
): boolean {
  if (from === to) return true;

  const allowed: Readonly<Record<OneCSyncState, readonly OneCSyncState[]>> = {
    [OneCSyncState.QUEUED]: [OneCSyncState.DELIVERED_TO_CONNECTOR],
    [OneCSyncState.DELIVERED_TO_CONNECTOR]: [
      OneCSyncState.CREATED_IN_1C,
      OneCSyncState.REJECTED,
      OneCSyncState.RECONCILIATION_REQUIRED,
      OneCSyncState.UNKNOWN,
    ],
    [OneCSyncState.CREATED_IN_1C]: [
      OneCSyncState.POSTED,
      OneCSyncState.REJECTED,
      OneCSyncState.RECONCILIATION_REQUIRED,
      OneCSyncState.UNKNOWN,
    ],
    [OneCSyncState.UNKNOWN]: [OneCSyncState.RECONCILIATION_REQUIRED],
    [OneCSyncState.RECONCILIATION_REQUIRED]: [
      OneCSyncState.QUEUED,
      OneCSyncState.CREATED_IN_1C,
      OneCSyncState.POSTED,
      OneCSyncState.REJECTED,
    ],
    [OneCSyncState.POSTED]: [],
    [OneCSyncState.REJECTED]: [],
  };
  return allowed[from].includes(to);
}

export function oneCFailureState(
  failure: 'TIMEOUT' | 'NETWORK' | 'BUSINESS_REJECTION' | 'AMBIGUOUS_RESULT',
): OneCSyncState {
  if (failure === 'BUSINESS_REJECTION') return OneCSyncState.REJECTED;
  return OneCSyncState.UNKNOWN;
}

function pairingHash(salt: string, code: string): string {
  return createHash('sha256').update(`${salt}.${code}`, 'utf8').digest('hex');
}

function nonBlank(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new OneCProtocolValidationError(`${field} is required`);
  }
}

function requireScalar(value: unknown, field: string): void {
  if (
    value === null
    || (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')
  ) {
    throw new OneCProtocolValidationError(`${field} must be a scalar value`);
  }
  if (typeof value === 'string' && value.trim() === '') {
    throw new OneCProtocolValidationError(`${field} must not be blank`);
  }
}
