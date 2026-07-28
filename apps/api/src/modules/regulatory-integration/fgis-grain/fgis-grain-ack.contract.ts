import { createHash } from 'node:crypto';
import {
  FGIS_GRAIN_1_0_23_CATALOG_SHA256,
  FGIS_GRAIN_1_0_23_MAPPING_VERSION,
  FGIS_GRAIN_1_0_23_PACKAGE_SHA256,
  type FgisGrainTransportOperation,
} from './fgis-grain-1.0.23.generated';
import {
  FGIS_GRAIN_ADAPTER_CODE,
  FGIS_GRAIN_API_VERSION,
} from './fgis-grain-1.0.23.contract';
import {
  FGIS_GRAIN_DISPATCH_SCHEMA_VERSION,
  FGIS_GRAIN_OUTBOX_EVENT_TYPE,
  FGIS_GRAIN_SIGNING_POLICY_VERSION,
  type FgisGrainOutboundDispatchPayload,
} from './fgis-grain-1.0.23.dispatch.contract';

export const FGIS_GRAIN_ACK_POLICY_SCHEMA =
  'pc-crop.fgis-grain-ack-policy-lock.v1' as const;
export const FGIS_GRAIN_ACK_POLICY_VERSION =
  'fgis-zerno-1.0.23-ack-policy.v1' as const;
export const FGIS_GRAIN_ACK_COMMAND_SCHEMA =
  'pc-crop.fgis-grain-ack-command.v1' as const;
export const FGIS_GRAIN_ACK_RESULT_SCHEMA =
  'pc-crop.fgis-grain-ack-result.v1' as const;
export const FGIS_GRAIN_ACK_EVENT_SCHEMA =
  'pc-crop.fgis-grain-ack-event.v1' as const;
export const FGIS_GRAIN_ACK_OPERATIONAL_STATUS = 'NOT_ATTESTED' as const;

export const FGIS_GRAIN_ACK_STATES = [
  'NOT_REQUIRED',
  'ACK_PENDING',
  'ACK_DISPATCH_REQUESTED',
  'ACK_TRANSPORT_ACCEPTED',
  'RECONCILIATION_REQUIRED',
] as const;
export type FgisGrainAckState = (typeof FGIS_GRAIN_ACK_STATES)[number];

export const FGIS_GRAIN_ACK_DECISIONS = ['REQUIRED', 'NOT_REQUIRED'] as const;
export type FgisGrainAckDecision = (typeof FGIS_GRAIN_ACK_DECISIONS)[number];

export const FGIS_GRAIN_ACK_REASON_CODES = [
  'ACK_REQUIRED_VERIFIED_MESSAGE',
  'ACK_NOT_REQUIRED_ACK_OF_ACK',
  'ACK_NOT_REQUIRED_QUEUE_EMPTY',
  'ACK_NOT_REQUIRED_IGNORED',
  'ACK_NOT_REQUIRED_POLICY',
  'ACK_RECONCILIATION_FINGERPRINT_MISMATCH',
  'ACK_RECONCILIATION_POLICY_MISMATCH',
  'ACK_RECONCILIATION_IDENTITY_MISMATCH',
] as const;
export type FgisGrainAckReasonCode = (typeof FGIS_GRAIN_ACK_REASON_CODES)[number];

export const FGIS_GRAIN_ACK_EVENT_TYPES = {
  notRequired: 'FGIS_GRAIN_ACK_NOT_REQUIRED',
  requested: 'FGIS_GRAIN_ACK_REQUESTED',
  transportAccepted: 'FGIS_GRAIN_ACK_TRANSPORT_ACCEPTED',
  reconciliationRequired: 'FGIS_GRAIN_ACK_RECONCILIATION_REQUIRED',
} as const;

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,255}$/u;
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,159}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const DECIMAL_BIGINT = /^(?:0|[1-9][0-9]{0,18})$/u;
const UUID_V1 = /^[\da-f]{8}-[\da-f]{4}-1[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/iu;
const SEPARATOR = '\u001f';

function hash(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join(SEPARATOR), 'utf8').digest('hex');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export interface FgisGrainAckPolicyAuthority {
  readonly schemaVersion: typeof FGIS_GRAIN_ACK_POLICY_SCHEMA;
  readonly policyVersion: typeof FGIS_GRAIN_ACK_POLICY_VERSION;
  readonly packageSha256: typeof FGIS_GRAIN_1_0_23_PACKAGE_SHA256;
  readonly catalogSha256: typeof FGIS_GRAIN_1_0_23_CATALOG_SHA256;
  readonly policyHash: string;
  readonly eligibleInboundTransportOperations: readonly ['SendRequest', 'SendResponse'];
  readonly ineligibleInboundTransportOperations: readonly ['Ack'];
  readonly eligibleResponseCodes: readonly ['success', 'accepted'];
  readonly ineligibleResponseCodes: readonly ['queue-is-empty', 'ignored'];
  readonly operationalStatus: typeof FGIS_GRAIN_ACK_OPERATIONAL_STATUS;
}

export const FGIS_GRAIN_ACK_POLICY: FgisGrainAckPolicyAuthority = Object.freeze({
  schemaVersion: FGIS_GRAIN_ACK_POLICY_SCHEMA,
  policyVersion: FGIS_GRAIN_ACK_POLICY_VERSION,
  packageSha256: FGIS_GRAIN_1_0_23_PACKAGE_SHA256,
  catalogSha256: FGIS_GRAIN_1_0_23_CATALOG_SHA256,
  policyHash: hash([
    FGIS_GRAIN_ACK_POLICY_SCHEMA,
    FGIS_GRAIN_ACK_POLICY_VERSION,
    FGIS_GRAIN_1_0_23_PACKAGE_SHA256,
    FGIS_GRAIN_1_0_23_CATALOG_SHA256,
    'Ack',
    'urn:Ack',
    'SendRequest',
    'SendResponse',
    'Ack',
    'success',
    'accepted',
    'queue-is-empty',
    'ignored',
    'NOT_ATTESTED',
  ]),
  eligibleInboundTransportOperations: ['SendRequest', 'SendResponse'] as const,
  ineligibleInboundTransportOperations: ['Ack'] as const,
  eligibleResponseCodes: ['success', 'accepted'] as const,
  ineligibleResponseCodes: ['queue-is-empty', 'ignored'] as const,
  operationalStatus: FGIS_GRAIN_ACK_OPERATIONAL_STATUS,
});

export interface GenerateFgisGrainAckCommand {
  readonly schemaVersion: typeof FGIS_GRAIN_ACK_COMMAND_SCHEMA;
  readonly inboxEntryId: string;
  readonly expectedInboxVersion: string;
  readonly inboundTransportOperation: FgisGrainTransportOperation;
  readonly inboundMessageId: string;
  readonly inboundReferenceMessageId: string | null;
  readonly inboundResponseCode: 'success' | 'accepted' | 'queue-is-empty' | 'ignored';
  readonly verifiedPayloadFingerprint: string;
  readonly ackEnvelopeReference: string | null;
  readonly ackEnvelopeSha256: string | null;
  readonly ackEnvelopeSizeBytes: number | null;
  readonly ackMessageDataId: string | null;
  readonly providerConfigurationReference: string | null;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly idempotencyKey: string;
  readonly reason: string;
}

export type FgisGrainAckMutation = Readonly<{
  schemaVersion: typeof FGIS_GRAIN_ACK_RESULT_SCHEMA;
  kind: 'CREATED' | 'REPLAY' | 'NOT_REQUIRED' | 'RECONCILIATION_REQUIRED';
  acknowledgementId: string;
  inboxEntryId: string;
  state: FgisGrainAckState;
  decision: FgisGrainAckDecision;
  reasonCode: FgisGrainAckReasonCode;
  commandId: string | null;
  messageId: string | null;
  referenceMessageId: string | null;
  outboxEntryId: string | null;
  exchangeId: string | null;
  auditEventId: string | null;
  eventOutboxEntryId: string | null;
  correlationId: string;
  policyVersion: typeof FGIS_GRAIN_ACK_POLICY_VERSION;
  policyHash: string;
  operationalStatus: typeof FGIS_GRAIN_ACK_OPERATIONAL_STATUS;
}>;

export function normalizeGenerateFgisGrainAckCommand(
  value: unknown,
): GenerateFgisGrainAckCommand {
  const input = asRecord(value);
  if (!input) {
    throw new FgisGrainAckAuthorityError(
      'ACK_COMMAND_INVALID',
      'ack generation command must be an object',
      false,
    );
  }
  const allowed = new Set([
    'schemaVersion',
    'inboxEntryId',
    'expectedInboxVersion',
    'inboundTransportOperation',
    'inboundMessageId',
    'inboundReferenceMessageId',
    'inboundResponseCode',
    'verifiedPayloadFingerprint',
    'ackEnvelopeReference',
    'ackEnvelopeSha256',
    'ackEnvelopeSizeBytes',
    'ackMessageDataId',
    'providerConfigurationReference',
    'correlationId',
    'causationId',
    'idempotencyKey',
    'reason',
  ]);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new FgisGrainAckAuthorityError(
      'ACK_COMMAND_INVALID',
      'ack generation command contains unsupported fields',
      false,
    );
  }
  if (input.schemaVersion !== FGIS_GRAIN_ACK_COMMAND_SCHEMA) {
    throw new FgisGrainAckAuthorityError(
      'ACK_COMMAND_INVALID',
      'unsupported ack generation command schema',
      false,
    );
  }
  const transportOperations = new Set<FgisGrainTransportOperation>([
    'SendRequest',
    'SendResponse',
    'Ack',
  ]);
  const responseCodes = new Set(['success', 'accepted', 'queue-is-empty', 'ignored']);
  if (
    typeof input.inboxEntryId !== 'string'
    || !SAFE_ID.test(input.inboxEntryId)
    || typeof input.expectedInboxVersion !== 'string'
    || !DECIMAL_BIGINT.test(input.expectedInboxVersion)
    || typeof input.inboundTransportOperation !== 'string'
    || !transportOperations.has(input.inboundTransportOperation as FgisGrainTransportOperation)
    || typeof input.inboundMessageId !== 'string'
    || !UUID_V1.test(input.inboundMessageId)
    || (input.inboundReferenceMessageId !== null
      && (typeof input.inboundReferenceMessageId !== 'string'
        || !UUID_V1.test(input.inboundReferenceMessageId)))
    || typeof input.inboundResponseCode !== 'string'
    || !responseCodes.has(input.inboundResponseCode)
    || typeof input.verifiedPayloadFingerprint !== 'string'
    || !SHA256.test(input.verifiedPayloadFingerprint)
    || typeof input.correlationId !== 'string'
    || !SAFE_ID.test(input.correlationId)
    || (input.causationId !== null
      && (typeof input.causationId !== 'string' || !SAFE_ID.test(input.causationId)))
    || typeof input.idempotencyKey !== 'string'
    || !SAFE_KEY.test(input.idempotencyKey)
  ) {
    throw new FgisGrainAckAuthorityError(
      'ACK_COMMAND_INVALID',
      'ack command identity, version or verified fingerprint is invalid',
      false,
    );
  }
  const required = input.inboundTransportOperation !== 'Ack'
    && (input.inboundResponseCode === 'success' || input.inboundResponseCode === 'accepted');
  const nullableStrings = [
    input.ackEnvelopeReference,
    input.ackEnvelopeSha256,
    input.ackMessageDataId,
    input.providerConfigurationReference,
  ];
  if (
    nullableStrings.some((item) => item !== null && typeof item !== 'string')
    || (input.ackEnvelopeSizeBytes !== null
      && (!Number.isSafeInteger(input.ackEnvelopeSizeBytes)
        || (input.ackEnvelopeSizeBytes as number) <= 0))
  ) {
    throw new FgisGrainAckAuthorityError(
      'ACK_COMMAND_INVALID',
      'ack envelope authority is malformed',
      false,
    );
  }
  if (required) {
    if (
      typeof input.ackEnvelopeReference !== 'string'
      || !/^object-store:\/\/[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,500}$/u.test(input.ackEnvelopeReference)
      || typeof input.ackEnvelopeSha256 !== 'string'
      || !SHA256.test(input.ackEnvelopeSha256)
      || typeof input.ackEnvelopeSizeBytes !== 'number'
      || typeof input.ackMessageDataId !== 'string'
      || !/^[A-Za-z_][A-Za-z0-9._-]{0,127}$/u.test(input.ackMessageDataId)
      || typeof input.providerConfigurationReference !== 'string'
      || !/^config:\/\/[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,500}$/u.test(input.providerConfigurationReference)
    ) {
      throw new FgisGrainAckAuthorityError(
        'ACK_ENVELOPE_REQUIRED',
        'eligible inbound message requires immutable ACK envelope authority',
        false,
      );
    }
  } else if (
    input.ackEnvelopeReference !== null
    || input.ackEnvelopeSha256 !== null
    || input.ackEnvelopeSizeBytes !== null
    || input.ackMessageDataId !== null
    || input.providerConfigurationReference !== null
  ) {
    throw new FgisGrainAckAuthorityError(
      'ACK_ENVELOPE_FORBIDDEN',
      'ineligible inbound message must not carry ACK dispatch authority',
      false,
    );
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length < 12 || reason.length > 1000) {
    throw new FgisGrainAckAuthorityError(
      'ACK_COMMAND_INVALID',
      'ack reason must contain 12..1000 characters',
      false,
    );
  }
  return {
    schemaVersion: FGIS_GRAIN_ACK_COMMAND_SCHEMA,
    inboxEntryId: input.inboxEntryId,
    expectedInboxVersion: input.expectedInboxVersion,
    inboundTransportOperation: input.inboundTransportOperation as FgisGrainTransportOperation,
    inboundMessageId: input.inboundMessageId,
    inboundReferenceMessageId: input.inboundReferenceMessageId as string | null,
    inboundResponseCode: input.inboundResponseCode as GenerateFgisGrainAckCommand['inboundResponseCode'],
    verifiedPayloadFingerprint: input.verifiedPayloadFingerprint,
    ackEnvelopeReference: input.ackEnvelopeReference as string | null,
    ackEnvelopeSha256: input.ackEnvelopeSha256 as string | null,
    ackEnvelopeSizeBytes: input.ackEnvelopeSizeBytes as number | null,
    ackMessageDataId: input.ackMessageDataId as string | null,
    providerConfigurationReference: input.providerConfigurationReference as string | null,
    correlationId: input.correlationId,
    causationId: input.causationId as string | null,
    idempotencyKey: input.idempotencyKey,
    reason,
  };
}

export function buildFgisGrainAckDispatchPayload(input: {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly commandId: string;
  readonly messageId: string;
  readonly referenceMessageId: string;
  readonly envelopeReference: string;
  readonly envelopeSha256: string;
  readonly envelopeSizeBytes: number;
  readonly messageDataId: string;
  readonly providerConfigurationReference: string;
  readonly correlationId: string;
  readonly causationId: string | null;
}): FgisGrainOutboundDispatchPayload {
  return {
    schemaVersion: FGIS_GRAIN_DISPATCH_SCHEMA_VERSION,
    adapterCode: FGIS_GRAIN_ADAPTER_CODE,
    apiVersion: FGIS_GRAIN_API_VERSION,
    mappingVersion: FGIS_GRAIN_1_0_23_MAPPING_VERSION,
    signingPolicyVersion: FGIS_GRAIN_SIGNING_POLICY_VERSION,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    commandId: input.commandId,
    transportOperation: 'Ack',
    businessOperationCode: null,
    messageId: input.messageId,
    referenceMessageId: input.referenceMessageId,
    messageDataId: input.messageDataId,
    unsignedEnvelopeReference: input.envelopeReference,
    unsignedEnvelopeSha256: input.envelopeSha256,
    unsignedEnvelopeSizeBytes: input.envelopeSizeBytes,
    messageDataSha256: input.envelopeSha256,
    providerConfigurationReference: input.providerConfigurationReference,
    correlationId: input.correlationId,
    causationId: input.causationId,
  };
}

export const FGIS_GRAIN_ACK_OUTBOX_EVENT_TYPE = FGIS_GRAIN_OUTBOX_EVENT_TYPE;

export type FgisGrainAckAuthorityErrorCode =
  | 'ACK_COMMAND_INVALID'
  | 'ACK_ENVELOPE_REQUIRED'
  | 'ACK_ENVELOPE_FORBIDDEN'
  | 'ACK_MUTATION_FORBIDDEN'
  | 'ACK_INBOX_AUTHORITY_MISSING'
  | 'ACK_INBOX_AUTHORITY_INVALID'
  | 'ACK_REPLAY_MISMATCH'
  | 'ACK_RECONCILIATION_REQUIRED'
  | 'ACK_DATABASE_RESULT_INVALID'
  | 'ACK_PERSISTENCE_FAILED';

export class FgisGrainAckAuthorityError extends Error {
  constructor(
    readonly code: FgisGrainAckAuthorityErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(`${code}: ${message}`);
    this.name = 'FgisGrainAckAuthorityError';
  }
}
