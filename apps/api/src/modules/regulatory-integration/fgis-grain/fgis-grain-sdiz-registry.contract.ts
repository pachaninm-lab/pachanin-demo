import { createHash } from 'node:crypto';
import {
  FGIS_GRAIN_1_0_23_SDIZ_STATUSES,
  type FgisGrainSdizStatus,
} from './fgis-grain-1.0.23.generated';

export const FGIS_GRAIN_SDIZ_PROJECTION_SCHEMA_VERSION =
  'pc-crop.fgis-grain-sdiz-projection.v1' as const;
export const FGIS_GRAIN_SDIZ_APPLICATION_SCHEMA_VERSION =
  'pc-crop.fgis-grain-sdiz-inbox-application.v1' as const;
export const FGIS_GRAIN_SDIZ_OPERATIONAL_STATUS = 'NOT_ATTESTED' as const;
export const FGIS_GRAIN_SDIZ_MAX_BATCH_SIZE = 500 as const;

export interface FgisGrainSdizProjectionInput {
  readonly providerSdizId: string;
  readonly sdizNumber: string | null;
  readonly SDIZNumber: string | null;
  readonly status: FgisGrainSdizStatus;
  readonly lotNumber: string | null;
  readonly createLotNumber: string | null;
  readonly correctedBySDIZNumber: string | null;
  readonly correctedSDIZNumber: string | null;
  readonly extinctionId: string | null;
  readonly extinctionRefusalId: string | null;
  readonly providerOccurredAt: string;
}

export interface FgisGrainSdizApplicationCommand {
  readonly schemaVersion: typeof FGIS_GRAIN_SDIZ_APPLICATION_SCHEMA_VERSION;
  readonly sourceInboxEntryId: string;
  readonly workerId: string;
  readonly rawBodySha256: string;
  readonly messageId: string;
  readonly referenceMessageId: string;
  readonly batchFingerprint: string;
  readonly records: readonly FgisGrainSdizProjectionInput[];
}

export interface ValidatedFgisGrainSdizRecord {
  readonly providerSdizId: string;
  readonly sdizNumber: string;
  readonly status: FgisGrainSdizStatus;
  readonly lotNumber: string | null;
  readonly createLotNumber: string | null;
  readonly correctedBySdizNumber: string | null;
  readonly correctedSdizNumber: string | null;
  readonly extinctionId: string | null;
  readonly extinctionRefusalId: string | null;
  readonly providerOccurredAt: string;
  readonly recordFingerprint: string;
}

export interface ValidatedFgisGrainSdizApplicationCommand {
  readonly schemaVersion: typeof FGIS_GRAIN_SDIZ_APPLICATION_SCHEMA_VERSION;
  readonly sourceInboxEntryId: string;
  readonly workerId: string;
  readonly rawBodySha256: string;
  readonly messageId: string;
  readonly referenceMessageId: string;
  readonly batchFingerprint: string;
  readonly records: readonly ValidatedFgisGrainSdizRecord[];
}

export type FgisGrainSdizContractErrorCode =
  | 'MALFORMED_COMMAND'
  | 'MALFORMED_RECORD'
  | 'BATCH_SIZE_INVALID'
  | 'DUPLICATE_SDIZ_ID'
  | 'SDIZ_IDENTIFIER_INVALID'
  | 'SDIZ_NUMBER_ALIAS_CONFLICT'
  | 'SDIZ_STATUS_UNSUPPORTED'
  | 'PROVIDER_TIME_INVALID'
  | 'MESSAGE_ID_INVALID'
  | 'CONTENT_HASH_INVALID'
  | 'BATCH_FINGERPRINT_MISMATCH';

export class FgisGrainSdizContractError extends Error {
  constructor(
    readonly code: FgisGrainSdizContractErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FgisGrainSdizContractError';
  }
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.@/-]{0,239}$/u;
const SAFE_PROVIDER_IDENTIFIER = /^[\p{L}\p{N}][\p{L}\p{N} ._:/()-]{0,255}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const UUID_V1 = /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const COMMAND_KEYS = [
  'schemaVersion',
  'sourceInboxEntryId',
  'workerId',
  'rawBodySha256',
  'messageId',
  'referenceMessageId',
  'batchFingerprint',
  'records',
] as const;
const RECORD_KEYS = [
  'providerSdizId',
  'sdizNumber',
  'SDIZNumber',
  'status',
  'lotNumber',
  'createLotNumber',
  'correctedBySDIZNumber',
  'correctedSDIZNumber',
  'extinctionId',
  'extinctionRefusalId',
  'providerOccurredAt',
] as const;

function plainRecord(
  value: unknown,
  code: FgisGrainSdizContractErrorCode,
): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new FgisGrainSdizContractError(code, 'Expected a plain object');
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  code: FgisGrainSdizContractErrorCode,
): void {
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  if (
    actual.length !== keys.length
    || actual.some((key, index) => key !== keys[index])
  ) {
    throw new FgisGrainSdizContractError(code, 'Unexpected or missing fields');
  }
}

function nonEmptyIdentifier(
  value: unknown,
  field: string,
): string {
  if (typeof value !== 'string' || !SAFE_PROVIDER_IDENTIFIER.test(value.trim())) {
    throw new FgisGrainSdizContractError(
      'SDIZ_IDENTIFIER_INVALID',
      `${field} is invalid`,
    );
  }
  return value.trim();
}

function optionalIdentifier(
  value: unknown,
  field: string,
): string | null {
  if (value === null) return null;
  return nonEmptyIdentifier(value, field);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

function sha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function validateRecord(value: unknown): ValidatedFgisGrainSdizRecord {
  const record = plainRecord(value, 'MALFORMED_RECORD');
  exactKeys(record, RECORD_KEYS, 'MALFORMED_RECORD');
  const providerSdizId = nonEmptyIdentifier(
    record.providerSdizId,
    'providerSdizId',
  );
  const lowerNumber = optionalIdentifier(record.sdizNumber, 'sdizNumber');
  const upperNumber = optionalIdentifier(record.SDIZNumber, 'SDIZNumber');
  if (lowerNumber === null && upperNumber === null) {
    throw new FgisGrainSdizContractError(
      'SDIZ_IDENTIFIER_INVALID',
      'At least one SDIZ number alias is required',
    );
  }
  if (
    lowerNumber !== null
    && upperNumber !== null
    && lowerNumber !== upperNumber
  ) {
    throw new FgisGrainSdizContractError(
      'SDIZ_NUMBER_ALIAS_CONFLICT',
      'sdizNumber and SDIZNumber disagree',
    );
  }
  if (
    typeof record.status !== 'string'
    || !FGIS_GRAIN_1_0_23_SDIZ_STATUSES.includes(
      record.status as FgisGrainSdizStatus,
    )
  ) {
    throw new FgisGrainSdizContractError(
      'SDIZ_STATUS_UNSUPPORTED',
      'Unsupported SDIZ status',
    );
  }
  if (
    typeof record.providerOccurredAt !== 'string'
    || !UTC_INSTANT.test(record.providerOccurredAt)
    || Number.isNaN(Date.parse(record.providerOccurredAt))
  ) {
    throw new FgisGrainSdizContractError(
      'PROVIDER_TIME_INVALID',
      'providerOccurredAt must be an exact UTC instant',
    );
  }
  const normalized = {
    providerSdizId,
    sdizNumber: lowerNumber ?? upperNumber as string,
    status: record.status as FgisGrainSdizStatus,
    lotNumber: optionalIdentifier(record.lotNumber, 'lotNumber'),
    createLotNumber: optionalIdentifier(record.createLotNumber, 'createLotNumber'),
    correctedBySdizNumber: optionalIdentifier(
      record.correctedBySDIZNumber,
      'correctedBySDIZNumber',
    ),
    correctedSdizNumber: optionalIdentifier(
      record.correctedSDIZNumber,
      'correctedSDIZNumber',
    ),
    extinctionId: optionalIdentifier(record.extinctionId, 'extinctionId'),
    extinctionRefusalId: optionalIdentifier(
      record.extinctionRefusalId,
      'extinctionRefusalId',
    ),
    providerOccurredAt: new Date(record.providerOccurredAt).toISOString(),
  };
  return Object.freeze({
    ...normalized,
    recordFingerprint: sha256(normalized),
  });
}

export function computeFgisGrainSdizBatchFingerprint(
  records: readonly ValidatedFgisGrainSdizRecord[],
): string {
  return sha256(
    records.map((record) => ({
      providerSdizId: record.providerSdizId,
      recordFingerprint: record.recordFingerprint,
    })),
  );
}

export function assertFgisGrainSdizApplicationCommand(
  value: unknown,
): ValidatedFgisGrainSdizApplicationCommand {
  const command = plainRecord(value, 'MALFORMED_COMMAND');
  exactKeys(command, COMMAND_KEYS, 'MALFORMED_COMMAND');
  if (command.schemaVersion !== FGIS_GRAIN_SDIZ_APPLICATION_SCHEMA_VERSION) {
    throw new FgisGrainSdizContractError(
      'MALFORMED_COMMAND',
      'Application schema version mismatch',
    );
  }
  if (
    typeof command.sourceInboxEntryId !== 'string'
    || !SAFE_ID.test(command.sourceInboxEntryId)
    || typeof command.workerId !== 'string'
    || !SAFE_ID.test(command.workerId)
  ) {
    throw new FgisGrainSdizContractError(
      'MALFORMED_COMMAND',
      'Inbox or worker authority identifier is invalid',
    );
  }
  if (
    typeof command.rawBodySha256 !== 'string'
    || !SHA256.test(command.rawBodySha256)
    || typeof command.batchFingerprint !== 'string'
    || !SHA256.test(command.batchFingerprint)
  ) {
    throw new FgisGrainSdizContractError(
      'CONTENT_HASH_INVALID',
      'Content hash is invalid',
    );
  }
  if (
    typeof command.messageId !== 'string'
    || !UUID_V1.test(command.messageId)
    || typeof command.referenceMessageId !== 'string'
    || !UUID_V1.test(command.referenceMessageId)
  ) {
    throw new FgisGrainSdizContractError(
      'MESSAGE_ID_INVALID',
      'FGIS message identifiers must be UUID v1',
    );
  }
  if (
    !Array.isArray(command.records)
    || command.records.length < 1
    || command.records.length > FGIS_GRAIN_SDIZ_MAX_BATCH_SIZE
  ) {
    throw new FgisGrainSdizContractError(
      'BATCH_SIZE_INVALID',
      `SDIZ batch must contain 1..${FGIS_GRAIN_SDIZ_MAX_BATCH_SIZE} records`,
    );
  }
  const records = command.records
    .map(validateRecord)
    .sort((left, right) =>
      left.providerSdizId.localeCompare(right.providerSdizId, 'en'),
    );
  if (new Set(records.map((record) => record.providerSdizId)).size !== records.length) {
    throw new FgisGrainSdizContractError(
      'DUPLICATE_SDIZ_ID',
      'Duplicate providerSdizId in one batch',
    );
  }
  const batchFingerprint = computeFgisGrainSdizBatchFingerprint(records);
  if (batchFingerprint !== command.batchFingerprint) {
    throw new FgisGrainSdizContractError(
      'BATCH_FINGERPRINT_MISMATCH',
      'Batch fingerprint does not match normalized SDIZ records',
    );
  }
  return Object.freeze({
    schemaVersion: FGIS_GRAIN_SDIZ_APPLICATION_SCHEMA_VERSION,
    sourceInboxEntryId: command.sourceInboxEntryId,
    workerId: command.workerId,
    rawBodySha256: command.rawBodySha256,
    messageId: command.messageId.toLowerCase(),
    referenceMessageId: command.referenceMessageId.toLowerCase(),
    batchFingerprint,
    records: Object.freeze(records),
  });
}
