import {
  requiredBankCapability,
  supportsBankCapability,
  type BankCapability,
  type BankCommand,
} from '../../../../../packages/domain-core/src/bank-capability';

export const REAL_BANK_PROVIDER_FAMILIES = [
  'SBER',
  'ALFA_BANK',
  'T_BANK',
] as const;

export type RealBankProviderFamily = (typeof REAL_BANK_PROVIDER_FAMILIES)[number];

export const BANK_PROVIDER_FAMILIES = [
  ...REAL_BANK_PROVIDER_FAMILIES,
  'TEST_DOUBLE_A',
  'TEST_DOUBLE_B',
] as const;

export type BankProviderFamily = (typeof BANK_PROVIDER_FAMILIES)[number];

export type BankTransportAcknowledgement =
  | 'ACCEPTED_NONFINAL'
  | 'QUEUED_NONFINAL'
  | 'PROCESSING_NONFINAL'
  | 'REJECTED'
  | 'UNKNOWN';

export type BankReceiptEvidenceState =
  | 'SUCCESS_EVIDENCE'
  | 'FAILURE_EVIDENCE'
  | 'NONFINAL_EVIDENCE'
  | 'UNKNOWN_EVIDENCE';

export type BankAdapterOperationRequest = Readonly<{
  command: BankCommand;
  operationId: string;
  idempotencyKey: string;
  amountMinor: string;
  currency: string;
  sourceVersion: string;
  beneficiaryReference: string | null;
}>;

export type BankReferenceRequestEnvelope = Readonly<{
  providerFamily: BankProviderFamily;
  capability: BankCapability;
  command: BankCommand;
  operationId: string;
  idempotencyKey: string;
  amountMinor: string;
  currency: string;
  sourceVersion: string;
  beneficiaryReference: string | null;
  contractMode: 'REFERENCE_CONFORMANCE_ONLY';
  liveRequestReady: false;
}>;

export type BankProviderResponse = Readonly<{
  httpStatus: number | null;
  rawStatus: string | null;
  providerOperationId: string | null;
  idempotencyKey: string | null;
  providerEventId: string | null;
  externalReceiptId: string | null;
  authenticationAuthorityRef: string | null;
  authenticationEvidenceRef: string | null;
  payloadFingerprint: string | null;
  observedAt: string;
  operationId: string | null;
  amountMinor: string | null;
  currency: string | null;
}>;

export type BankDispatchMapping = Readonly<{
  providerFamily: BankProviderFamily;
  acknowledgement: BankTransportAcknowledgement;
  providerOperationId: string | null;
  idempotencyKey: string | null;
  rawStatus: string | null;
  observedAt: string;
  canonicalFinality: 'NOT_DECIDED_HERE';
  retryPolicy: 'RECONCILE_BEFORE_RETRY';
}>;

export type BankReceiptCandidate = Readonly<{
  providerFamily: BankProviderFamily;
  operationId: string | null;
  providerOperationId: string | null;
  idempotencyKey: string | null;
  providerEventId: string | null;
  externalReceiptId: string | null;
  authenticationAuthorityRef: string | null;
  authenticationEvidenceRef: string | null;
  payloadFingerprint: string | null;
  amountMinor: string | null;
  currency: string | null;
  evidenceState: BankReceiptEvidenceState;
  rawStatus: string | null;
  observedAt: string;
  canonicalFinality: 'NOT_DECIDED_HERE';
}>;

export interface BankReferenceAdapter {
  readonly providerFamily: BankProviderFamily;
  readonly capabilities: readonly BankCapability[];
  readonly contractMode: 'REFERENCE_CONFORMANCE_ONLY';
  readonly liveTransportImplemented: boolean;

  describeRequest(input: BankAdapterOperationRequest): BankReferenceRequestEnvelope;
  mapDispatchResponse(response: BankProviderResponse): BankDispatchMapping;
  mapReceiptResponse(response: BankProviderResponse): BankReceiptCandidate;
}

function runtimeTrimmedString(value: unknown, errorCode: string): string {
  if (typeof value !== 'string') throw new Error(errorCode);
  return value.trim();
}

function identifier(value: unknown, field: string): string {
  const normalized = runtimeTrimmedString(value, `INVALID_BANK_IDENTIFIER:${field}`);
  if (!normalized || normalized.length > 240 || !/^[A-Za-z0-9:_.-]+$/.test(normalized)) {
    throw new Error(`INVALID_BANK_IDENTIFIER:${field}`);
  }
  return normalized;
}

function runtimeStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function normalizeBankOperationRequest(
  input: BankAdapterOperationRequest,
): BankAdapterOperationRequest {
  const amount = runtimeTrimmedString(input.amountMinor, 'INVALID_BANK_AMOUNT_MINOR');
  if (!/^\d+$/.test(amount) || BigInt(amount) <= 0n) {
    throw new Error('INVALID_BANK_AMOUNT_MINOR');
  }
  const currency = runtimeTrimmedString(input.currency, 'INVALID_BANK_CURRENCY').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error('INVALID_BANK_CURRENCY');
  }
  const sourceVersion = runtimeTrimmedString(input.sourceVersion, 'INVALID_BANK_SOURCE_VERSION');
  if (!sourceVersion || sourceVersion.length > 160) {
    throw new Error('INVALID_BANK_SOURCE_VERSION');
  }
  let beneficiaryReference: string | null = null;
  if (input.beneficiaryReference !== null) {
    beneficiaryReference = runtimeTrimmedString(
      input.beneficiaryReference,
      'INVALID_BANK_BENEFICIARY_REFERENCE',
    ) || null;
  }
  return {
    ...input,
    operationId: identifier(input.operationId, 'operationId'),
    idempotencyKey: identifier(input.idempotencyKey, 'idempotencyKey'),
    amountMinor: amount,
    currency,
    sourceVersion,
    beneficiaryReference,
  };
}

export function normalizeObservedAt(value: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('INVALID_BANK_OBSERVED_AT');
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('INVALID_BANK_OBSERVED_AT');
  return new Date(parsed).toISOString();
}

function isRuntimeHttp2xx(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 200
    && value < 300;
}

export function buildReferenceRequestEnvelope(
  providerFamily: BankProviderFamily,
  supportedCapabilities: readonly BankCapability[],
  input: BankAdapterOperationRequest,
): BankReferenceRequestEnvelope {
  const normalized = normalizeBankOperationRequest(input);
  const capability = requiredBankCapability(normalized.command);
  if (!supportsBankCapability(supportedCapabilities, capability)) {
    throw new Error(`BANK_CAPABILITY_NOT_SUPPORTED:${providerFamily}:${capability}`);
  }
  return {
    providerFamily,
    capability,
    command: normalized.command,
    operationId: normalized.operationId,
    idempotencyKey: normalized.idempotencyKey,
    amountMinor: normalized.amountMinor,
    currency: normalized.currency,
    sourceVersion: normalized.sourceVersion,
    beneficiaryReference: normalized.beneficiaryReference,
    contractMode: 'REFERENCE_CONFORMANCE_ONLY',
    liveRequestReady: false,
  };
}

export function mapReferenceDispatch(
  providerFamily: BankProviderFamily,
  response: BankProviderResponse,
  explicitRejectStatuses: readonly string[] = [],
): BankDispatchMapping {
  const rawStatus = runtimeStringOrNull(response.rawStatus);
  const status = rawStatus?.trim().toUpperCase() ?? null;
  const rejectSet = new Set(explicitRejectStatuses.map((value) => value.trim().toUpperCase()));
  // Provider responses are runtime data. Do not let JavaScript numeric coercion
  // turn malformed values such as string "201" into a transport acknowledgement.
  const is2xx = isRuntimeHttp2xx(response.httpStatus);

  // Keep transport acknowledgement and provider business evidence separate.
  // A 2xx response acknowledges the transport/API call only, even when a body
  // also carries a provider-specific ERROR/DECLINED-like status. That status is
  // interpreted by mapReceiptResponse and canonical reconciliation, never by
  // transport acknowledgement. For non-2xx responses, only an explicitly
  // pinned provider rejection status may classify REJECTED; otherwise the
  // outcome remains UNKNOWN and must be reconciled before retry.
  const acknowledgement: BankTransportAcknowledgement = is2xx
    ? 'ACCEPTED_NONFINAL'
    : status && rejectSet.has(status)
      ? 'REJECTED'
      : 'UNKNOWN';
  return {
    providerFamily,
    acknowledgement,
    providerOperationId: response.providerOperationId,
    idempotencyKey: response.idempotencyKey,
    rawStatus,
    observedAt: normalizeObservedAt(response.observedAt),
    canonicalFinality: 'NOT_DECIDED_HERE',
    retryPolicy: 'RECONCILE_BEFORE_RETRY',
  };
}

export function buildReceiptCandidate(
  providerFamily: BankProviderFamily,
  response: BankProviderResponse,
  evidenceState: BankReceiptEvidenceState,
): BankReceiptCandidate {
  return {
    providerFamily,
    operationId: response.operationId,
    providerOperationId: response.providerOperationId,
    idempotencyKey: response.idempotencyKey,
    providerEventId: response.providerEventId,
    externalReceiptId: response.externalReceiptId,
    authenticationAuthorityRef: response.authenticationAuthorityRef,
    authenticationEvidenceRef: response.authenticationEvidenceRef,
    payloadFingerprint: response.payloadFingerprint,
    amountMinor: response.amountMinor,
    currency: response.currency,
    evidenceState,
    rawStatus: runtimeStringOrNull(response.rawStatus),
    observedAt: normalizeObservedAt(response.observedAt),
    canonicalFinality: 'NOT_DECIDED_HERE',
  };
}
