import { createHash } from 'node:crypto';
import type {
  FgisGrainOutboundDispatchPayload,
  FgisGrainTransportResult,
} from './fgis-grain-1.0.23.dispatch.contract';

export const FGIS_GRAIN_EXCHANGE_EVENT_SCHEMA =
  'pc-crop.fgis-grain-exchange-event.v1' as const;
export const FGIS_GRAIN_RESPONSE_CORRELATION_COMMAND_SCHEMA =
  'pc-crop.fgis-grain-response-correlation-command.v1' as const;
export const FGIS_GRAIN_OPERATIONAL_STATUS_NOT_ATTESTED = 'NOT_ATTESTED' as const;

export const FGIS_GRAIN_EXCHANGE_STATES = [
  'DISPATCH_PENDING',
  'TRANSPORT_ACCEPTED',
  'RESPONSE_RECEIVED',
  'RECONCILIATION_REQUIRED',
] as const;
export type FgisGrainExchangeState =
  (typeof FGIS_GRAIN_EXCHANGE_STATES)[number];

export const FGIS_GRAIN_EXCHANGE_EVENT_TYPES = {
  transportAccepted: 'FGIS_GRAIN_TRANSPORT_RECEIPT_ACCEPTED',
  responseCorrelated: 'FGIS_GRAIN_VERIFIED_RESPONSE_CORRELATED',
  reconciliationRequired: 'FGIS_GRAIN_RESPONSE_RECONCILIATION_REQUIRED',
} as const;

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,255}$/u;
const SAFE_IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,159}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const DECIMAL_BIGINT = /^(?:0|[1-9][0-9]{0,18})$/u;
const FINGERPRINT_SEPARATOR = '\u001f';

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Cross-runtime canonical fingerprint. PostgreSQL uses the same ordered fields
 * and ASCII unit separator in `fgis_grain_dispatch_payload_fingerprint`.
 */
export function computeFgisGrainDispatchPayloadFingerprint(
  payload: FgisGrainOutboundDispatchPayload,
): string {
  return sha256([
    payload.schemaVersion,
    payload.adapterCode,
    payload.apiVersion,
    payload.mappingVersion,
    payload.signingPolicyVersion,
    payload.tenantId,
    payload.organizationId,
    payload.commandId,
    payload.transportOperation,
    payload.businessOperationCode ?? '',
    payload.messageId,
    payload.referenceMessageId,
    payload.messageDataId,
    payload.unsignedEnvelopeReference,
    payload.unsignedEnvelopeSha256,
    String(payload.unsignedEnvelopeSizeBytes),
    payload.messageDataSha256,
    payload.providerConfigurationReference,
    payload.correlationId,
    payload.causationId ?? '',
  ].join(FINGERPRINT_SEPARATOR));
}

export interface FgisGrainAcceptedTransportReceipt {
  readonly providerMessageId: string | null;
  readonly responseCode: 'success' | 'accepted';
  readonly responseBodySha256: string | null;
  readonly httpStatus: number | null;
  readonly acceptedAt: string;
}

export function normalizeAcceptedTransportReceipt(
  result: FgisGrainTransportResult,
  acceptedAt = new Date(),
): FgisGrainAcceptedTransportReceipt {
  if (
    result.delivered !== true
    || result.faultCode !== null
    || (result.responseCode !== 'success' && result.responseCode !== 'accepted')
    || (result.providerMessageId !== null && !SAFE_ID.test(result.providerMessageId))
    || (result.responseBodySha256 !== null && !SHA256.test(result.responseBodySha256))
    || (result.httpStatus !== null
      && (!Number.isInteger(result.httpStatus)
        || result.httpStatus < 100
        || result.httpStatus > 599))
  ) {
    throw new FgisGrainExchangeAuthorityError(
      'TRANSPORT_RECEIPT_INVALID',
      'accepted transport result is not a valid receipt authority',
      false,
    );
  }
  return {
    providerMessageId: result.providerMessageId,
    responseCode: result.responseCode,
    responseBodySha256: result.responseBodySha256,
    httpStatus: result.httpStatus,
    acceptedAt: acceptedAt.toISOString(),
  };
}

export interface FgisGrainResponseCorrelationCommand {
  readonly schemaVersion: typeof FGIS_GRAIN_RESPONSE_CORRELATION_COMMAND_SCHEMA;
  readonly inboxEntryId: string;
  readonly workerId: string;
  readonly expectedInboxVersion: string;
  readonly providerMessageId: string;
  readonly referenceMessageId: string;
  readonly rawBodySha256: string;
  readonly responseFingerprint: string;
  readonly providerOccurredAt: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly reason: string;
}

export type FgisGrainResponseCorrelationMutation = Readonly<{
  schemaVersion: typeof FGIS_GRAIN_EXCHANGE_EVENT_SCHEMA;
  kind: 'CORRELATED' | 'REPLAY' | 'RECONCILIATION_REQUIRED';
  exchangeId: string | null;
  inboxEntryId: string;
  auditEventId: string | null;
  outboxEntryId: string | null;
  correlationId: string;
  reasonCode: string | null;
  operationalStatus: typeof FGIS_GRAIN_OPERATIONAL_STATUS_NOT_ATTESTED;
}>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function normalizeFgisGrainResponseCorrelationCommand(
  value: unknown,
): FgisGrainResponseCorrelationCommand {
  const input = asRecord(value);
  if (!input) {
    throw new FgisGrainExchangeAuthorityError(
      'CORRELATION_COMMAND_INVALID',
      'response correlation command must be an object',
      false,
    );
  }
  const allowed = new Set([
    'schemaVersion',
    'inboxEntryId',
    'workerId',
    'expectedInboxVersion',
    'providerMessageId',
    'referenceMessageId',
    'rawBodySha256',
    'responseFingerprint',
    'providerOccurredAt',
    'correlationId',
    'idempotencyKey',
    'reason',
  ]);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new FgisGrainExchangeAuthorityError(
      'CORRELATION_COMMAND_INVALID',
      'response correlation command contains unsupported fields',
      false,
    );
  }
  if (input.schemaVersion !== FGIS_GRAIN_RESPONSE_CORRELATION_COMMAND_SCHEMA) {
    throw new FgisGrainExchangeAuthorityError(
      'CORRELATION_COMMAND_INVALID',
      'unsupported response correlation command schema',
      false,
    );
  }
  const ids = [
    input.inboxEntryId,
    input.workerId,
    input.providerMessageId,
    input.referenceMessageId,
    input.correlationId,
  ];
  if (ids.some((item) => typeof item !== 'string' || !SAFE_ID.test(item))) {
    throw new FgisGrainExchangeAuthorityError(
      'CORRELATION_COMMAND_INVALID',
      'response correlation command contains an invalid identifier',
      false,
    );
  }
  if (
    typeof input.idempotencyKey !== 'string'
    || !SAFE_IDEMPOTENCY_KEY.test(input.idempotencyKey)
    || typeof input.expectedInboxVersion !== 'string'
    || !DECIMAL_BIGINT.test(input.expectedInboxVersion)
    || typeof input.rawBodySha256 !== 'string'
    || !SHA256.test(input.rawBodySha256)
    || typeof input.responseFingerprint !== 'string'
    || !SHA256.test(input.responseFingerprint)
  ) {
    throw new FgisGrainExchangeAuthorityError(
      'CORRELATION_COMMAND_INVALID',
      'response correlation version, idempotency or hash authority is invalid',
      false,
    );
  }
  const occurredAt = typeof input.providerOccurredAt === 'string'
    ? new Date(input.providerOccurredAt)
    : new Date(Number.NaN);
  if (
    Number.isNaN(occurredAt.getTime())
    || occurredAt.toISOString() !== input.providerOccurredAt
  ) {
    throw new FgisGrainExchangeAuthorityError(
      'CORRELATION_COMMAND_INVALID',
      'providerOccurredAt must be a canonical ISO-8601 instant',
      false,
    );
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length < 12 || reason.length > 1000) {
    throw new FgisGrainExchangeAuthorityError(
      'CORRELATION_COMMAND_INVALID',
      'correlation reason must contain 12..1000 characters',
      false,
    );
  }
  return {
    schemaVersion: FGIS_GRAIN_RESPONSE_CORRELATION_COMMAND_SCHEMA,
    inboxEntryId: input.inboxEntryId as string,
    workerId: input.workerId as string,
    expectedInboxVersion: input.expectedInboxVersion as string,
    providerMessageId: input.providerMessageId as string,
    referenceMessageId: input.referenceMessageId as string,
    rawBodySha256: input.rawBodySha256 as string,
    responseFingerprint: input.responseFingerprint as string,
    providerOccurredAt: input.providerOccurredAt as string,
    correlationId: input.correlationId as string,
    idempotencyKey: input.idempotencyKey as string,
    reason,
  };
}

export type FgisGrainExchangeAuthorityErrorCode =
  | 'CORRELATION_COMMAND_INVALID'
  | 'MUTATION_FORBIDDEN'
  | 'EXCHANGE_AUTHORITY_MISSING'
  | 'EXCHANGE_AUTHORITY_MISMATCH'
  | 'OUTBOX_LEASE_INVALID'
  | 'TRANSPORT_RECEIPT_INVALID'
  | 'TRANSPORT_RECEIPT_PERSISTENCE_FAILED'
  | 'RECONCILIATION_REQUIRED'
  | 'DATABASE_RESULT_INVALID';

export class FgisGrainExchangeAuthorityError extends Error {
  constructor(
    readonly code: FgisGrainExchangeAuthorityErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(`${code}: ${message}`);
    this.name = 'FgisGrainExchangeAuthorityError';
  }
}
