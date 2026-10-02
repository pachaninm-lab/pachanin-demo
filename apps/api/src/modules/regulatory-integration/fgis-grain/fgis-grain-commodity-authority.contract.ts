export const FGIS_COMMODITY_OPERATIONAL_STATUS = 'NOT_ATTESTED' as const;

export const FGIS_COMMODITY_CONNECTION_STATUSES = [
  'BOUND',
  'SUSPENDED',
  'REVOKED',
] as const;
export type FgisCommodityConnectionStatus =
  (typeof FGIS_COMMODITY_CONNECTION_STATUSES)[number];

export const FGIS_COMMODITY_SYNC_STATUSES = [
  'REQUESTED',
  'DISPATCHED',
  'WAITING_RESPONSE',
  'PROCESSING',
  'SUCCEEDED',
  'PARTIAL',
  'FAILED',
  'CANCELLED',
] as const;
export type FgisCommoditySyncStatus =
  (typeof FGIS_COMMODITY_SYNC_STATUSES)[number];

export const FGIS_COMMODITY_RESERVATION_STATUSES = [
  'PENDING',
  'ACTIVE',
  'CONVERTED_TO_DEAL',
  'RELEASED',
  'EXPIRED',
  'FROZEN',
  'CANCELLED',
] as const;
export type FgisCommodityReservationStatus =
  (typeof FGIS_COMMODITY_RESERVATION_STATUSES)[number];

export const FGIS_COMMODITY_RECONCILIATION_SEVERITIES = [
  'INFO',
  'WARNING',
  'HIGH',
  'CRITICAL',
] as const;
export type FgisCommodityReconciliationSeverity =
  (typeof FGIS_COMMODITY_RECONCILIATION_SEVERITIES)[number];

export type FgisCommodityCommandMeta = Readonly<{
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type BindFgisCommodityConnectionInput = FgisCommodityCommandMeta &
  Readonly<{
    providerConfigurationId: string;
    expectedVersion: string;
  }>;

export type StartFgisCommoditySyncRunInput = FgisCommodityCommandMeta &
  Readonly<{
    connectionId: string;
    operationCode: 'GET_LIST_LOT' | 'GET_LIST_SDIZ';
    recordsModifiedFrom?: string | null;
    pageCursor?: string | null;
    expectedConnectionVersion: string;
  }>;

export type FgisCommodityPartySnapshotInput = Readonly<{
  externalPartyId: string;
  externalPartyNumber?: string | null;
  externalRecordId?: string | null;
  adapterVersion?: string | null;
  contractVersion?: string | null;
  ownerReference?: string | null;
  agentReference?: string | null;
  repositoryReference?: string | null;
  productCode?: string | null;
  productName?: string | null;
  okpd2Code?: string | null;
  tnvedCode?: string | null;
  targetCode?: string | null;
  purposeCode?: string | null;
  harvestYear?: string | null;
  storagePlace: Readonly<Record<string, unknown>>;
  amountOriginal?: string | null;
  amountAvailable: string;
  sourceUnitCode?: string | null;
  normalizedUnitCode?: string | null;
  unitAuthority: 'UNCONFIRMED' | 'CONTRACT' | 'PROVIDER';
  qualityValues: Readonly<Record<string, unknown>>;
  externalStatus: string;
  sourceRegisteredAt?: string | null;
  sourceUpdatedAt: string;
  organicFlag?: boolean | null;
  quarantineZoneFlag?: boolean | null;
  payloadHash: string;
  criticalHash: string;
  protectedRawReference: string;
}>;

export type AcceptFgisCommodityPartySnapshotInput = FgisCommodityCommandMeta &
  Readonly<{
    connectionId: string;
    syncRunId: string;
    snapshot: FgisCommodityPartySnapshotInput;
    expectedCurrentVersion: string;
  }>;

export type ReserveFgisCommodityVolumeInput = FgisCommodityCommandMeta &
  Readonly<{
    partyCurrentId: string;
    sourceSnapshotId: string;
    volume: string;
    unit: string;
    reason: string;
    expiresAt: string;
    expectedPartyVersion: string;
  }>;

export type TransitionFgisCommodityReservationInput = FgisCommodityCommandMeta &
  Readonly<{
    reservationId: string;
    targetStatus: Exclude<FgisCommodityReservationStatus, 'PENDING'>;
    reason: string;
    dealId?: string | null;
    expectedVersion: string;
  }>;

export type CreateFgisLotPassportInput = FgisCommodityCommandMeta &
  Readonly<{ reservationId: string }>;

export type SealFgisLotPassportInput = FgisCommodityCommandMeta &
  Readonly<{
    passportId: string;
    expectedVersion: string;
  }>;

export type OpenFgisCommodityReconciliationCaseInput = FgisCommodityCommandMeta &
  Readonly<{
    partyCurrentId: string;
    previousSnapshotId?: string | null;
    actualSnapshotId: string;
    reservationId?: string | null;
    lotId?: string | null;
    severity: FgisCommodityReconciliationSeverity;
    reasonCode: string;
    expectedState: Readonly<Record<string, unknown>>;
    actualState: Readonly<Record<string, unknown>>;
    ownerUserId?: string | null;
  }>;

export type FgisCommodityCommandReceipt = Readonly<{
  ok: boolean;
  code?: string;
  correlationId?: string;
  auditId: string;
  outboxId?: string;
  duplicate: boolean;
  [key: string]: unknown;
}>;

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:_.\/-]{0,255}$/;
const NON_NEGATIVE_INTEGER = /^(0|[1-9][0-9]{0,18})$/;
const POSITIVE_DECIMAL_6 = /^(?:0\.(?:0{0,5}[1-9][0-9]{0,5})|[1-9][0-9]{0,19}(?:\.[0-9]{1,6})?)$/;
const NON_NEGATIVE_DECIMAL_6 = /^(?:0|[1-9][0-9]{0,19})(?:\.[0-9]{1,6})?$/;
const SHA256 = /^[a-f0-9]{64}$/;

function record(raw: unknown, label: string): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError(`${label} must be an object`);
  }
  return raw as Record<string, unknown>;
}

function text(
  value: unknown,
  field: string,
  options: Readonly<{ max?: number; identifier?: boolean }> = {},
): string {
  if (typeof value !== 'string') throw new TypeError(`${field} must be a string`);
  const normalized = value.trim();
  const max = options.max ?? 256;
  if (!normalized || normalized.length > max) {
    throw new RangeError(`${field} must contain 1-${max} characters`);
  }
  if (options.identifier && !IDENTIFIER.test(normalized)) {
    throw new RangeError(`${field} contains unsupported characters`);
  }
  return normalized;
}

function nullableText(value: unknown, field: string, max = 512): string | null {
  if (value === undefined || value === null || value === '') return null;
  return text(value, field, { max });
}

function integerString(value: unknown, field: string): string {
  const normalized = text(value, field, { max: 19 });
  if (!NON_NEGATIVE_INTEGER.test(normalized)) {
    throw new RangeError(`${field} must be a non-negative integer string`);
  }
  return normalized;
}

function decimalString(value: unknown, field: string, positive: boolean): string {
  const normalized = text(value, field, { max: 27 });
  const pattern = positive ? POSITIVE_DECIMAL_6 : NON_NEGATIVE_DECIMAL_6;
  if (!pattern.test(normalized)) {
    throw new RangeError(`${field} must be a decimal string with at most 6 fractional digits`);
  }
  return normalized;
}

function isoDate(value: unknown, field: string): string {
  const normalized = text(value, field, { max: 64 });
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) throw new RangeError(`${field} must be an ISO date`);
  return parsed.toISOString();
}

function sha256(value: unknown, field: string): string {
  const normalized = text(value, field, { max: 64 });
  if (!SHA256.test(normalized)) throw new RangeError(`${field} must be lowercase SHA-256`);
  return normalized;
}

function jsonObject(value: unknown, field: string, maxBytes: number): Readonly<Record<string, unknown>> {
  const result = record(value, field);
  const bytes = Buffer.byteLength(JSON.stringify(result), 'utf8');
  if (bytes > maxBytes) throw new RangeError(`${field} exceeds ${maxBytes} bytes`);
  return Object.freeze({ ...result });
}

function meta(source: Record<string, unknown>): FgisCommodityCommandMeta {
  return {
    commandId: text(source.commandId, 'commandId', { identifier: true }),
    idempotencyKey: text(source.idempotencyKey, 'idempotencyKey', { max: 256 }),
    correlationId: text(source.correlationId, 'correlationId', { max: 128 }),
  };
}

export function assertBindFgisCommodityConnectionInput(
  raw: unknown,
): BindFgisCommodityConnectionInput {
  const source = record(raw, 'bind connection input');
  return {
    ...meta(source),
    providerConfigurationId: text(source.providerConfigurationId, 'providerConfigurationId', {
      identifier: true,
    }),
    expectedVersion: integerString(source.expectedVersion, 'expectedVersion'),
  };
}

export function assertStartFgisCommoditySyncRunInput(
  raw: unknown,
): StartFgisCommoditySyncRunInput {
  const source = record(raw, 'start sync input');
  const operationCode = text(source.operationCode, 'operationCode', { max: 32 });
  if (operationCode !== 'GET_LIST_LOT' && operationCode !== 'GET_LIST_SDIZ') {
    throw new RangeError('operationCode is not admitted by P0.2-2A');
  }
  return {
    ...meta(source),
    connectionId: text(source.connectionId, 'connectionId', { identifier: true }),
    operationCode,
    recordsModifiedFrom:
      source.recordsModifiedFrom === undefined || source.recordsModifiedFrom === null
        ? null
        : isoDate(source.recordsModifiedFrom, 'recordsModifiedFrom'),
    pageCursor: nullableText(source.pageCursor, 'pageCursor', 2048),
    expectedConnectionVersion: integerString(
      source.expectedConnectionVersion,
      'expectedConnectionVersion',
    ),
  };
}

export function assertAcceptFgisCommodityPartySnapshotInput(
  raw: unknown,
): AcceptFgisCommodityPartySnapshotInput {
  const source = record(raw, 'accept party snapshot input');
  const snapshot = record(source.snapshot, 'snapshot');
  const unitAuthority = text(snapshot.unitAuthority, 'snapshot.unitAuthority', { max: 32 });
  if (!['UNCONFIRMED', 'CONTRACT', 'PROVIDER'].includes(unitAuthority)) {
    throw new RangeError('snapshot.unitAuthority is unsupported');
  }
  const normalizedUnitCode = nullableText(
    snapshot.normalizedUnitCode,
    'snapshot.normalizedUnitCode',
    64,
  );
  if (unitAuthority === 'UNCONFIRMED' && normalizedUnitCode !== null) {
    throw new RangeError('normalized unit cannot be asserted without authority');
  }
  if (unitAuthority !== 'UNCONFIRMED' && normalizedUnitCode === null) {
    throw new RangeError('authoritative unit is required');
  }
  const harvestYear = nullableText(snapshot.harvestYear, 'snapshot.harvestYear', 4);
  if (harvestYear !== null && !/^[0-9]{4}$/.test(harvestYear)) {
    throw new RangeError('snapshot.harvestYear must be four digits');
  }
  const cleanedSnapshot: FgisCommodityPartySnapshotInput = {
    externalPartyId: text(snapshot.externalPartyId, 'snapshot.externalPartyId', {
      identifier: true,
    }),
    externalPartyNumber: nullableText(snapshot.externalPartyNumber, 'snapshot.externalPartyNumber', 256),
    externalRecordId: nullableText(snapshot.externalRecordId, 'snapshot.externalRecordId', 256),
    adapterVersion: nullableText(snapshot.adapterVersion, 'snapshot.adapterVersion', 128),
    contractVersion: nullableText(snapshot.contractVersion, 'snapshot.contractVersion', 64),
    ownerReference: nullableText(snapshot.ownerReference, 'snapshot.ownerReference'),
    agentReference: nullableText(snapshot.agentReference, 'snapshot.agentReference'),
    repositoryReference: nullableText(snapshot.repositoryReference, 'snapshot.repositoryReference'),
    productCode: nullableText(snapshot.productCode, 'snapshot.productCode', 128),
    productName: nullableText(snapshot.productName, 'snapshot.productName', 512),
    okpd2Code: nullableText(snapshot.okpd2Code, 'snapshot.okpd2Code', 128),
    tnvedCode: nullableText(snapshot.tnvedCode, 'snapshot.tnvedCode', 128),
    targetCode: nullableText(snapshot.targetCode, 'snapshot.targetCode', 128),
    purposeCode: nullableText(snapshot.purposeCode, 'snapshot.purposeCode', 128),
    harvestYear,
    storagePlace: jsonObject(snapshot.storagePlace ?? {}, 'snapshot.storagePlace', 16_384),
    amountOriginal:
      snapshot.amountOriginal === undefined || snapshot.amountOriginal === null
        ? null
        : decimalString(snapshot.amountOriginal, 'snapshot.amountOriginal', false),
    amountAvailable: decimalString(snapshot.amountAvailable, 'snapshot.amountAvailable', false),
    sourceUnitCode: nullableText(snapshot.sourceUnitCode, 'snapshot.sourceUnitCode', 64),
    normalizedUnitCode,
    unitAuthority: unitAuthority as FgisCommodityPartySnapshotInput['unitAuthority'],
    qualityValues: jsonObject(snapshot.qualityValues ?? {}, 'snapshot.qualityValues', 65_536),
    externalStatus: text(snapshot.externalStatus, 'snapshot.externalStatus', { max: 64 }),
    sourceRegisteredAt:
      snapshot.sourceRegisteredAt === undefined || snapshot.sourceRegisteredAt === null
        ? null
        : isoDate(snapshot.sourceRegisteredAt, 'snapshot.sourceRegisteredAt'),
    sourceUpdatedAt: isoDate(snapshot.sourceUpdatedAt, 'snapshot.sourceUpdatedAt'),
    organicFlag:
      snapshot.organicFlag === undefined || snapshot.organicFlag === null
        ? null
        : Boolean(snapshot.organicFlag),
    quarantineZoneFlag:
      snapshot.quarantineZoneFlag === undefined || snapshot.quarantineZoneFlag === null
        ? null
        : Boolean(snapshot.quarantineZoneFlag),
    payloadHash: sha256(snapshot.payloadHash, 'snapshot.payloadHash'),
    criticalHash: sha256(snapshot.criticalHash, 'snapshot.criticalHash'),
    protectedRawReference: text(
      snapshot.protectedRawReference,
      'snapshot.protectedRawReference',
      { max: 512 },
    ),
  };
  return {
    ...meta(source),
    connectionId: text(source.connectionId, 'connectionId', { identifier: true }),
    syncRunId: text(source.syncRunId, 'syncRunId', { identifier: true }),
    snapshot: Object.freeze(cleanedSnapshot),
    expectedCurrentVersion: integerString(
      source.expectedCurrentVersion,
      'expectedCurrentVersion',
    ),
  };
}

export function assertReserveFgisCommodityVolumeInput(
  raw: unknown,
): ReserveFgisCommodityVolumeInput {
  const source = record(raw, 'reserve volume input');
  const expiresAt = isoDate(source.expiresAt, 'expiresAt');
  if (new Date(expiresAt).getTime() <= Date.now()) throw new RangeError('expiresAt must be future');
  return {
    ...meta(source),
    partyCurrentId: text(source.partyCurrentId, 'partyCurrentId', { identifier: true }),
    sourceSnapshotId: text(source.sourceSnapshotId, 'sourceSnapshotId', { identifier: true }),
    volume: decimalString(source.volume, 'volume', true),
    unit: text(source.unit, 'unit', { max: 64 }),
    reason: text(source.reason, 'reason', { max: 1000 }),
    expiresAt,
    expectedPartyVersion: integerString(source.expectedPartyVersion, 'expectedPartyVersion'),
  };
}

export function assertTransitionFgisCommodityReservationInput(
  raw: unknown,
): TransitionFgisCommodityReservationInput {
  const source = record(raw, 'transition reservation input');
  const targetStatus = text(source.targetStatus, 'targetStatus', { max: 32 });
  if (!FGIS_COMMODITY_RESERVATION_STATUSES.includes(targetStatus as FgisCommodityReservationStatus)
      || targetStatus === 'PENDING') {
    throw new RangeError('targetStatus is unsupported');
  }
  return {
    ...meta(source),
    reservationId: text(source.reservationId, 'reservationId', { identifier: true }),
    targetStatus: targetStatus as TransitionFgisCommodityReservationInput['targetStatus'],
    reason: text(source.reason, 'reason', { max: 1000 }),
    dealId: nullableText(source.dealId, 'dealId', 256),
    expectedVersion: integerString(source.expectedVersion, 'expectedVersion'),
  };
}

export function assertCreateFgisLotPassportInput(raw: unknown): CreateFgisLotPassportInput {
  const source = record(raw, 'create passport input');
  return {
    ...meta(source),
    reservationId: text(source.reservationId, 'reservationId', { identifier: true }),
  };
}

export function assertSealFgisLotPassportInput(raw: unknown): SealFgisLotPassportInput {
  const source = record(raw, 'seal passport input');
  return {
    ...meta(source),
    passportId: text(source.passportId, 'passportId', { identifier: true }),
    expectedVersion: integerString(source.expectedVersion, 'expectedVersion'),
  };
}

export function assertOpenFgisCommodityReconciliationCaseInput(
  raw: unknown,
): OpenFgisCommodityReconciliationCaseInput {
  const source = record(raw, 'open reconciliation input');
  const severity = text(source.severity, 'severity', { max: 16 });
  if (!FGIS_COMMODITY_RECONCILIATION_SEVERITIES.includes(
    severity as FgisCommodityReconciliationSeverity,
  )) {
    throw new RangeError('severity is unsupported');
  }
  return {
    ...meta(source),
    partyCurrentId: text(source.partyCurrentId, 'partyCurrentId', { identifier: true }),
    previousSnapshotId: nullableText(source.previousSnapshotId, 'previousSnapshotId', 256),
    actualSnapshotId: text(source.actualSnapshotId, 'actualSnapshotId', { identifier: true }),
    reservationId: nullableText(source.reservationId, 'reservationId', 256),
    lotId: nullableText(source.lotId, 'lotId', 256),
    severity: severity as FgisCommodityReconciliationSeverity,
    reasonCode: text(source.reasonCode, 'reasonCode', { max: 128 }),
    expectedState: jsonObject(source.expectedState, 'expectedState', 131_072),
    actualState: jsonObject(source.actualState, 'actualState', 131_072),
    ownerUserId: nullableText(source.ownerUserId, 'ownerUserId', 256),
  };
}
