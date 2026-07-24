import { createHash } from 'node:crypto';
import {
  FGIS_GRAIN_1_0_23_MAPPING_VERSION,
  FGIS_GRAIN_1_0_23_SDIZ_STATUSES,
  type FgisGrainSdizStatus,
} from './fgis-grain-1.0.23.generated';

export const FGIS_GRAIN_SDIZ_PROJECTION_COMMAND_SCHEMA =
  'pc-crop.fgis-grain-sdiz-projection-command.v1' as const;
export const FGIS_GRAIN_SDIZ_PROJECTION_BATCH_SCHEMA =
  'pc-crop.fgis-grain-sdiz-projection-batch.v1' as const;
export const FGIS_GRAIN_SDIZ_PROJECTION_EVENT_TYPE =
  'FGIS_GRAIN_SDIZ_PROJECTION_APPLIED' as const;
export const FGIS_GRAIN_SDIZ_CONFLICT_EVENT_TYPE =
  'FGIS_GRAIN_SDIZ_PROJECTION_CONFLICT' as const;
export const FGIS_GRAIN_SDIZ_MAX_BATCH_SIZE = 200;
export const FGIS_GRAIN_SDIZ_MAPPING_VERSION = FGIS_GRAIN_1_0_23_MAPPING_VERSION;

const SHA256 = /^[a-f0-9]{64}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.@/-]{0,254}$/u;
const XML_IDENTIFIER = /^[A-Za-z0-9А-Яа-яЁё][A-Za-z0-9А-Яа-яЁё:_.@/\- ]{0,254}$/u;
const SDIZ_STATUSES = new Set<string>(FGIS_GRAIN_1_0_23_SDIZ_STATUSES);
const RECORD_KEYS = new Set([
  'sdizID',
  'sdizNumber',
  'SDIZNumber',
  'lotNumber',
  'createLotNumber',
  'correctedBySDIZNumber',
  'correctedSDIZNumber',
  'extinctionId',
  'extinctionRefusalId',
  'status',
]);
const COMMAND_KEYS = new Set([
  'schemaVersion',
  'inboxEntryId',
  'workerId',
  'expectedInboxVersion',
  'providerMessageId',
  'providerReferenceMessageId',
  'rawBodySha256',
  'providerOccurredAt',
  'batchFingerprint',
  'records',
  'correlationId',
  'idempotencyKey',
  'reason',
]);

export type FgisGrainSdizProjectionErrorCode =
  | 'MALFORMED_COMMAND'
  | 'MALFORMED_RECORD'
  | 'UNSUPPORTED_STATUS'
  | 'SDIZ_NUMBER_ALIAS_CONFLICT'
  | 'DUPLICATE_SDIZ_ID'
  | 'DUPLICATE_SDIZ_NUMBER'
  | 'BATCH_LIMIT_EXCEEDED'
  | 'BATCH_FINGERPRINT_MISMATCH';

export class FgisGrainSdizProjectionContractError extends Error {
  constructor(
    readonly code: FgisGrainSdizProjectionErrorCode,
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = 'FgisGrainSdizProjectionContractError';
  }
}

export interface FgisGrainSdizRecordInput {
  readonly sdizID: string;
  readonly sdizNumber?: string | null;
  readonly SDIZNumber?: string | null;
  readonly lotNumber?: string | null;
  readonly createLotNumber?: string | null;
  readonly correctedBySDIZNumber?: string | null;
  readonly correctedSDIZNumber?: string | null;
  readonly extinctionId?: string | null;
  readonly extinctionRefusalId?: string | null;
  readonly status: FgisGrainSdizStatus;
}

export interface CanonicalFgisGrainSdizRecord {
  readonly sdizId: string;
  readonly sdizNumber: string;
  readonly lotNumber: string | null;
  readonly createLotNumber: string | null;
  readonly correctedBySdizNumber: string | null;
  readonly correctedSdizNumber: string | null;
  readonly extinctionId: string | null;
  readonly extinctionRefusalId: string | null;
  readonly status: FgisGrainSdizStatus;
  readonly payloadFingerprint: string;
}

export interface ApplyFgisGrainSdizProjectionCommand {
  readonly schemaVersion: typeof FGIS_GRAIN_SDIZ_PROJECTION_COMMAND_SCHEMA;
  readonly inboxEntryId: string;
  readonly workerId: string;
  readonly expectedInboxVersion: string;
  readonly providerMessageId: string;
  readonly providerReferenceMessageId: string | null;
  readonly rawBodySha256: string;
  readonly providerOccurredAt: string;
  readonly batchFingerprint: string;
  readonly records: readonly FgisGrainSdizRecordInput[];
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly reason: string;
}

export interface CanonicalFgisGrainSdizProjectionCommand
  extends Omit<ApplyFgisGrainSdizProjectionCommand, 'records'> {
  readonly records: readonly CanonicalFgisGrainSdizRecord[];
}

export type FgisGrainSdizProjectionMutation = Readonly<{
  kind: 'APPLIED' | 'REPLAY' | 'QUARANTINED';
  inboxEntryId: string;
  projectionBatchId: string | null;
  auditEventId: string;
  outboxEntryId: string;
  correlationId: string;
  recordCount: number;
  conflictCode: string | null;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function requiredString(value: unknown, name: string, pattern = XML_IDENTIFIER): string {
  if (typeof value !== 'string') {
    throw new FgisGrainSdizProjectionContractError('MALFORMED_RECORD', `${name} must be a string`);
  }
  const normalized = value.trim();
  if (!pattern.test(normalized)) {
    throw new FgisGrainSdizProjectionContractError('MALFORMED_RECORD', `${name} is invalid`);
  }
  return normalized;
}

function optionalString(value: unknown, name: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requiredString(value, name);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256Canonical(value: unknown): string {
  return createHash('sha256').update(stableJson(value), 'utf8').digest('hex');
}

export function normalizeFgisGrainSdizRecord(value: unknown): CanonicalFgisGrainSdizRecord {
  if (!isRecord(value) || !hasExactKeys(value, RECORD_KEYS)) {
    throw new FgisGrainSdizProjectionContractError('MALFORMED_RECORD', 'record contains unsupported fields');
  }
  const sdizId = requiredString(value.sdizID, 'sdizID', SAFE_ID);
  const lowerNumber = optionalString(value.sdizNumber, 'sdizNumber');
  const upperNumber = optionalString(value.SDIZNumber, 'SDIZNumber');
  if (lowerNumber && upperNumber && lowerNumber !== upperNumber) {
    throw new FgisGrainSdizProjectionContractError(
      'SDIZ_NUMBER_ALIAS_CONFLICT',
      'sdizNumber and SDIZNumber disagree',
    );
  }
  const sdizNumber = lowerNumber ?? upperNumber;
  if (!sdizNumber) {
    throw new FgisGrainSdizProjectionContractError('MALFORMED_RECORD', 'SDIZ number is required');
  }
  if (typeof value.status !== 'string' || !SDIZ_STATUSES.has(value.status)) {
    throw new FgisGrainSdizProjectionContractError('UNSUPPORTED_STATUS', 'official SDIZ status is required');
  }
  const canonical = {
    sdizId,
    sdizNumber,
    lotNumber: optionalString(value.lotNumber, 'lotNumber'),
    createLotNumber: optionalString(value.createLotNumber, 'createLotNumber'),
    correctedBySdizNumber: optionalString(value.correctedBySDIZNumber, 'correctedBySDIZNumber'),
    correctedSdizNumber: optionalString(value.correctedSDIZNumber, 'correctedSDIZNumber'),
    extinctionId: optionalString(value.extinctionId, 'extinctionId'),
    extinctionRefusalId: optionalString(value.extinctionRefusalId, 'extinctionRefusalId'),
    status: value.status as FgisGrainSdizStatus,
  };
  return Object.freeze({ ...canonical, payloadFingerprint: sha256Canonical(canonical) });
}

export function computeFgisGrainSdizBatchFingerprint(input: Readonly<{
  providerMessageId: string;
  providerReferenceMessageId: string | null;
  rawBodySha256: string;
  providerOccurredAt: string;
  records: readonly CanonicalFgisGrainSdizRecord[];
}>): string {
  return sha256Canonical({
    schemaVersion: FGIS_GRAIN_SDIZ_PROJECTION_BATCH_SCHEMA,
    providerMessageId: input.providerMessageId,
    providerReferenceMessageId: input.providerReferenceMessageId,
    rawBodySha256: input.rawBodySha256,
    providerOccurredAt: input.providerOccurredAt,
    records: input.records,
  });
}

export function normalizeFgisGrainSdizProjectionCommand(
  value: unknown,
): CanonicalFgisGrainSdizProjectionCommand {
  if (!isRecord(value) || !hasExactKeys(value, COMMAND_KEYS)) {
    throw new FgisGrainSdizProjectionContractError('MALFORMED_COMMAND', 'command contains unsupported fields');
  }
  if (value.schemaVersion !== FGIS_GRAIN_SDIZ_PROJECTION_COMMAND_SCHEMA) {
    throw new FgisGrainSdizProjectionContractError('MALFORMED_COMMAND', 'unsupported command schema');
  }
  if (!Array.isArray(value.records) || value.records.length < 1) {
    throw new FgisGrainSdizProjectionContractError('MALFORMED_COMMAND', 'records must be a non-empty array');
  }
  if (value.records.length > FGIS_GRAIN_SDIZ_MAX_BATCH_SIZE) {
    throw new FgisGrainSdizProjectionContractError('BATCH_LIMIT_EXCEEDED', 'SDIZ batch exceeds the limit');
  }
  const records = value.records
    .map(normalizeFgisGrainSdizRecord)
    .sort((left, right) => left.sdizId.localeCompare(right.sdizId) || left.sdizNumber.localeCompare(right.sdizNumber));
  const ids = new Set<string>();
  const numbers = new Set<string>();
  for (const record of records) {
    if (ids.has(record.sdizId)) {
      throw new FgisGrainSdizProjectionContractError('DUPLICATE_SDIZ_ID', record.sdizId);
    }
    if (numbers.has(record.sdizNumber)) {
      throw new FgisGrainSdizProjectionContractError('DUPLICATE_SDIZ_NUMBER', record.sdizNumber);
    }
    ids.add(record.sdizId);
    numbers.add(record.sdizNumber);
  }
  const inboxEntryId = requiredString(value.inboxEntryId, 'inboxEntryId', SAFE_ID);
  const workerId = requiredString(value.workerId, 'workerId', SAFE_ID);
  const providerMessageId = requiredString(value.providerMessageId, 'providerMessageId', SAFE_ID);
  const providerReferenceMessageId = value.providerReferenceMessageId === null
    ? null
    : requiredString(value.providerReferenceMessageId, 'providerReferenceMessageId', SAFE_ID);
  const correlationId = requiredString(value.correlationId, 'correlationId', SAFE_ID);
  const idempotencyKey = requiredString(value.idempotencyKey, 'idempotencyKey', SAFE_ID);
  if (typeof value.expectedInboxVersion !== 'string' || !/^\d+$/u.test(value.expectedInboxVersion)) {
    throw new FgisGrainSdizProjectionContractError('MALFORMED_COMMAND', 'expectedInboxVersion is invalid');
  }
  if (typeof value.rawBodySha256 !== 'string' || !SHA256.test(value.rawBodySha256)) {
    throw new FgisGrainSdizProjectionContractError('MALFORMED_COMMAND', 'rawBodySha256 is invalid');
  }
  if (typeof value.providerOccurredAt !== 'string' || Number.isNaN(Date.parse(value.providerOccurredAt))) {
    throw new FgisGrainSdizProjectionContractError('MALFORMED_COMMAND', 'providerOccurredAt is invalid');
  }
  if (typeof value.reason !== 'string' || value.reason.trim().length < 12 || value.reason.trim().length > 1000) {
    throw new FgisGrainSdizProjectionContractError('MALFORMED_COMMAND', 'reason must contain 12..1000 characters');
  }
  const computed = computeFgisGrainSdizBatchFingerprint({
    providerMessageId,
    providerReferenceMessageId,
    rawBodySha256: value.rawBodySha256,
    providerOccurredAt: new Date(value.providerOccurredAt).toISOString(),
    records,
  });
  if (value.batchFingerprint !== computed) {
    throw new FgisGrainSdizProjectionContractError('BATCH_FINGERPRINT_MISMATCH', 'batch fingerprint mismatch');
  }
  return Object.freeze({
    schemaVersion: FGIS_GRAIN_SDIZ_PROJECTION_COMMAND_SCHEMA,
    inboxEntryId,
    workerId,
    expectedInboxVersion: value.expectedInboxVersion,
    providerMessageId,
    providerReferenceMessageId,
    rawBodySha256: value.rawBodySha256,
    providerOccurredAt: new Date(value.providerOccurredAt).toISOString(),
    batchFingerprint: computed,
    records: Object.freeze(records),
    correlationId,
    idempotencyKey,
    reason: value.reason.trim(),
  });
}
