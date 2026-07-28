import { createHash } from 'node:crypto';
import {
  FGIS_GRAIN_ADAPTER_CODE,
  FGIS_GRAIN_API_VERSION,
} from './fgis-grain-1.0.23.contract';
import {
  FGIS_GRAIN_DISPATCH_SCHEMA_VERSION,
  FGIS_GRAIN_SIGNING_POLICY_VERSION,
  type FgisGrainOutboundDispatchPayload,
} from './fgis-grain-1.0.23.dispatch.contract';
import { FGIS_GRAIN_1_0_23_MAPPING_VERSION } from './fgis-grain-1.0.23.generated';
import { computeFgisGrainDispatchPayloadFingerprint } from './fgis-grain-exchange.contract';

export const FGIS_GRAIN_ACK_PREPARATION_COMMAND_SCHEMA =
  'pc-crop.fgis-grain-ack-preparation-command.v1' as const;
export const FGIS_GRAIN_ACK_EVENT_SCHEMA =
  'pc-crop.fgis-grain-ack-event.v1' as const;
export const FGIS_GRAIN_ACK_OPERATIONAL_STATUS = 'NOT_ATTESTED' as const;

export const FGIS_GRAIN_ACK_STATES = [
  'ACK_PENDING',
  'ACK_DISPATCHING',
  'ACK_TRANSPORT_ACCEPTED',
  'ACK_RECONCILIATION_REQUIRED',
] as const;
export type FgisGrainAckState = (typeof FGIS_GRAIN_ACK_STATES)[number];

export const FGIS_GRAIN_ACK_EVENT_TYPES = {
  authorityCreated: 'FGIS_GRAIN_RESPONSE_ACK_AUTHORITY_CREATED',
  transportAccepted: 'FGIS_GRAIN_RESPONSE_ACK_TRANSPORT_ACCEPTED',
  replaySuppressed: 'FGIS_GRAIN_RESPONSE_ACK_REPLAY_SUPPRESSED',
  reconciliationRequired: 'FGIS_GRAIN_RESPONSE_ACK_RECONCILIATION_REQUIRED',
} as const;

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,255}$/u;
const SAFE_IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,159}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const DECIMAL_BIGINT = /^(?:0|[1-9][0-9]{0,18})$/u;
const UUID_V1 =
  /^[\da-f]{8}-[\da-f]{4}-1[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/iu;
const XML_ID = /^[A-Za-z_][A-Za-z0-9._-]{0,127}$/u;
const CONTENT_REFERENCE =
  /^object-store:\/\/[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,500}$/u;
const CONFIG_REFERENCE =
  /^config:\/\/[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,500}$/u;
const FINGERPRINT_SEPARATOR = '\u001f';

export interface FgisGrainAckPreparationCommand {
  readonly schemaVersion: typeof FGIS_GRAIN_ACK_PREPARATION_COMMAND_SCHEMA;
  readonly exchangeId: string;
  readonly responseInboxEntryId: string;
  readonly expectedExchangeVersion: string;
  readonly expectedInboxVersion: string;
  readonly commandId: string;
  readonly ackMessageId: string;
  readonly referenceMessageId: string;
  readonly messageDataId: string;
  readonly unsignedEnvelopeReference: string;
  readonly unsignedEnvelopeSha256: string;
  readonly unsignedEnvelopeSizeBytes: number;
  readonly messageDataSha256: string;
  readonly sourceResponseFingerprint: string;
  readonly providerConfigurationReference: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly idempotencyKey: string;
  readonly reason: string;
}

export type FgisGrainAckAuthorityMutation = Readonly<{
  schemaVersion: typeof FGIS_GRAIN_ACK_EVENT_SCHEMA;
  kind: 'CREATED' | 'REPLAY' | 'RECONCILIATION_REQUIRED';
  acknowledgementId: string | null;
  exchangeId: string;
  responseInboxEntryId: string;
  outboxEntryId: string | null;
  auditEventId: string | null;
  correlationId: string;
  reasonCode: string | null;
  operationalStatus: typeof FGIS_GRAIN_ACK_OPERATIONAL_STATUS;
}>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function fail(message: string): never {
  throw new FgisGrainAckAuthorityError(
    'ACK_PREPARATION_COMMAND_INVALID',
    message,
    false,
  );
}

export function normalizeFgisGrainAckPreparationCommand(
  value: unknown,
): FgisGrainAckPreparationCommand {
  const input = asRecord(value);
  if (!input) {
    return fail('ACK preparation command must be an object');
  }
  const allowed = new Set([
    'schemaVersion',
    'exchangeId',
    'responseInboxEntryId',
    'expectedExchangeVersion',
    'expectedInboxVersion',
    'commandId',
    'ackMessageId',
    'referenceMessageId',
    'messageDataId',
    'unsignedEnvelopeReference',
    'unsignedEnvelopeSha256',
    'unsignedEnvelopeSizeBytes',
    'messageDataSha256',
    'sourceResponseFingerprint',
    'providerConfigurationReference',
    'correlationId',
    'causationId',
    'idempotencyKey',
    'reason',
  ]);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    return fail('ACK preparation command contains unsupported fields');
  }
  if (input.schemaVersion !== FGIS_GRAIN_ACK_PREPARATION_COMMAND_SCHEMA) {
    return fail('unsupported ACK preparation command schema');
  }
  for (const field of [
    'exchangeId',
    'responseInboxEntryId',
    'commandId',
    'correlationId',
    'causationId',
  ] as const) {
    if (typeof input[field] !== 'string' || !SAFE_ID.test(input[field])) {
      return fail(`${field} is not a governed identifier`);
    }
  }
  if (
    typeof input.expectedExchangeVersion !== 'string'
    || !DECIMAL_BIGINT.test(input.expectedExchangeVersion)
    || typeof input.expectedInboxVersion !== 'string'
    || !DECIMAL_BIGINT.test(input.expectedInboxVersion)
  ) {
    return fail('ACK preparation optimistic versions are invalid');
  }
  if (
    typeof input.ackMessageId !== 'string'
    || !UUID_V1.test(input.ackMessageId)
    || typeof input.referenceMessageId !== 'string'
    || !UUID_V1.test(input.referenceMessageId)
  ) {
    return fail('ACK message identifiers must be canonical UUIDv1 values');
  }
  if (typeof input.messageDataId !== 'string' || !XML_ID.test(input.messageDataId)) {
    return fail('ACK MessageData XML identifier is invalid');
  }
  if (
    typeof input.unsignedEnvelopeReference !== 'string'
    || !CONTENT_REFERENCE.test(input.unsignedEnvelopeReference)
    || typeof input.providerConfigurationReference !== 'string'
    || !CONFIG_REFERENCE.test(input.providerConfigurationReference)
  ) {
    return fail('ACK payload/configuration references are invalid');
  }
  for (const field of [
    'unsignedEnvelopeSha256',
    'messageDataSha256',
    'sourceResponseFingerprint',
  ] as const) {
    if (typeof input[field] !== 'string' || !SHA256.test(input[field])) {
      return fail(`${field} is not canonical SHA-256`);
    }
  }
  if (
    !Number.isInteger(input.unsignedEnvelopeSizeBytes)
    || Number(input.unsignedEnvelopeSizeBytes) < 1
    || Number(input.unsignedEnvelopeSizeBytes) > 2 * 1024 * 1024
  ) {
    return fail('ACK unsigned envelope size is outside governed limits');
  }
  if (
    typeof input.idempotencyKey !== 'string'
    || !SAFE_IDEMPOTENCY_KEY.test(input.idempotencyKey)
  ) {
    return fail('ACK idempotency key is invalid');
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length < 12 || reason.length > 1000) {
    return fail('ACK authority reason must contain 12..1000 characters');
  }
  return {
    schemaVersion: FGIS_GRAIN_ACK_PREPARATION_COMMAND_SCHEMA,
    exchangeId: input.exchangeId as string,
    responseInboxEntryId: input.responseInboxEntryId as string,
    expectedExchangeVersion: input.expectedExchangeVersion as string,
    expectedInboxVersion: input.expectedInboxVersion as string,
    commandId: input.commandId as string,
    ackMessageId: input.ackMessageId as string,
    referenceMessageId: input.referenceMessageId as string,
    messageDataId: input.messageDataId as string,
    unsignedEnvelopeReference: input.unsignedEnvelopeReference as string,
    unsignedEnvelopeSha256: input.unsignedEnvelopeSha256 as string,
    unsignedEnvelopeSizeBytes: input.unsignedEnvelopeSizeBytes as number,
    messageDataSha256: input.messageDataSha256 as string,
    sourceResponseFingerprint: input.sourceResponseFingerprint as string,
    providerConfigurationReference: input.providerConfigurationReference as string,
    correlationId: input.correlationId as string,
    causationId: input.causationId as string,
    idempotencyKey: input.idempotencyKey as string,
    reason,
  };
}

export function toFgisGrainAckDispatchPayload(
  command: FgisGrainAckPreparationCommand,
  tenantId: string,
  organizationId: string,
): FgisGrainOutboundDispatchPayload {
  if (!SAFE_ID.test(tenantId) || !SAFE_ID.test(organizationId)) {
    throw new FgisGrainAckAuthorityError(
      'ACK_SERVER_CONTEXT_INVALID',
      'server-derived tenant or organization context is invalid',
      false,
    );
  }
  return {
    schemaVersion: FGIS_GRAIN_DISPATCH_SCHEMA_VERSION,
    adapterCode: FGIS_GRAIN_ADAPTER_CODE,
    apiVersion: FGIS_GRAIN_API_VERSION,
    mappingVersion: FGIS_GRAIN_1_0_23_MAPPING_VERSION,
    signingPolicyVersion: FGIS_GRAIN_SIGNING_POLICY_VERSION,
    tenantId,
    organizationId,
    commandId: command.commandId,
    transportOperation: 'Ack',
    businessOperationCode: null,
    messageId: command.ackMessageId,
    referenceMessageId: command.referenceMessageId,
    messageDataId: command.messageDataId,
    unsignedEnvelopeReference: command.unsignedEnvelopeReference,
    unsignedEnvelopeSha256: command.unsignedEnvelopeSha256,
    unsignedEnvelopeSizeBytes: command.unsignedEnvelopeSizeBytes,
    messageDataSha256: command.messageDataSha256,
    providerConfigurationReference: command.providerConfigurationReference,
    correlationId: command.correlationId,
    causationId: command.causationId,
  };
}

export function computeFgisGrainAckAuthorityFingerprint(
  command: FgisGrainAckPreparationCommand,
  payload: FgisGrainOutboundDispatchPayload,
): string {
  if (payload.transportOperation !== 'Ack' || payload.businessOperationCode !== null) {
    throw new FgisGrainAckAuthorityError(
      'ACK_DISPATCH_PAYLOAD_INVALID',
      'ACK authority fingerprint requires an Ack dispatch payload',
      false,
    );
  }
  return createHash('sha256')
    .update([
      FGIS_GRAIN_ACK_EVENT_SCHEMA,
      command.exchangeId,
      command.responseInboxEntryId,
      command.expectedExchangeVersion,
      command.expectedInboxVersion,
      command.sourceResponseFingerprint,
      computeFgisGrainDispatchPayloadFingerprint(payload),
      command.idempotencyKey,
      command.reason,
    ].join(FINGERPRINT_SEPARATOR), 'utf8')
    .digest('hex');
}

export type FgisGrainAckAuthorityErrorCode =
  | 'ACK_PREPARATION_COMMAND_INVALID'
  | 'ACK_SERVER_CONTEXT_INVALID'
  | 'ACK_SOURCE_AUTHORITY_MISSING'
  | 'ACK_SOURCE_AUTHORITY_MISMATCH'
  | 'ACK_DISPATCH_PAYLOAD_INVALID'
  | 'ACK_MUTATION_FORBIDDEN'
  | 'ACK_LEASE_OR_VERSION_INVALID'
  | 'ACK_RECONCILIATION_REQUIRED'
  | 'ACK_DATABASE_RESULT_INVALID';

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
