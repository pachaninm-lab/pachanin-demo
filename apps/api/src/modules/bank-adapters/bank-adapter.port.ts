import {
  requiredBankCapability,
  type BankCapability,
  type BankCommand,
} from '../../../../../packages/domain-core/src/bank-capability';

export const BANK_PROVIDER_FAMILIES = [
  'SBER',
  'ALFA_BANK',
  'T_BANK',
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
  providerEventId: string | null;
  externalReceiptId: string | null;
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
  rawStatus: string | null;
  observedAt: string;
  canonicalFinality: 'NOT_DECIDED_HERE';
  retryPolicy: 'RECONCILE_BEFORE_RETRY' | 'NO_MUTATION_RECORDED';
}>;

export type BankReceiptCandidate = Readonly<{
  providerFamily: BankProviderFamily;
  operationId: string | null;
  providerOperationId: string | null;
  providerEventId: string | null;
  externalReceiptId: string | null;
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

function identifier(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 240 || !/^[A-Za-z0-9:_.-]+$/.test(normalized)) {
    throw new Error(`INVALID_BANK_IDENTIFIER:${field}`);
  }
  return normalized;
}

export function normalizeBankOperationRequest(
  input: BankAdapterOperationRequest,
): BankAdapterOperationRequest {
  const amount = input.amountMinor.trim();
  if (!/^\d+$/.test(amount) || BigInt(amount) <= 0n) {
    throw new Error('INVALID_BANK_AMOUNT_MINOR');
  }
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error('INVALID_BANK_CURRENCY');
  }
  const sourceVersion = input.sourceVersion.trim();
  if (!sourceVersion || sourceVersion.length > 160) {
    throw new Error('INVALID_BANK_SOURCE_VERSION');
  }
  return {
    ...input,
    operationId: identifier(input.operationId, 'operationId'),
    idempotencyKey: identifier(input.idempotencyKey, 'idempotencyKey'),
    amountMinor: amount,
    currency,
    sourceVersion,
    beneficiaryReference: input.beneficiaryReference?.trim() || null,
  };
}

export function normalizeObservedAt(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('INVALID_BANK_OBSERVED_AT');
  return new Date(parsed).toISOString();
}

export function buildReferenceRequestEnvelope(
  providerFamily: BankProviderFamily,
  input: BankAdapterOperationRequest,
): BankReferenceRequestEnvelope {
  const normalized = normalizeBankOperationRequest(input);
  return {
    providerFamily,
    capability: requiredBankCapability(normalized.command),
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
  const status = response.rawStatus?.trim().toUpperCase() ?? null;
  const rejectSet = new Set(explicitRejectStatuses.map((value) => value.trim().toUpperCase()));
  const acknowledgement: BankTransportAcknowledgement = status && rejectSet.has(status)
    ? 'REJECTED'
    : response.httpStatus !== null && response.httpStatus >= 200 && response.httpStatus < 300
      ? 'ACCEPTED_NONFINAL'
      : response.httpStatus !== null && response.httpStatus >= 400 && response.httpStatus < 500
        ? 'REJECTED'
        : 'UNKNOWN';
  return {
    providerFamily,
    acknowledgement,
    providerOperationId: response.providerOperationId,
    rawStatus: response.rawStatus,
    observedAt: normalizeObservedAt(response.observedAt),
    canonicalFinality: 'NOT_DECIDED_HERE',
    retryPolicy: acknowledgement === 'REJECTED'
      ? 'NO_MUTATION_RECORDED'
      : 'RECONCILE_BEFORE_RETRY',
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
    providerEventId: response.providerEventId,
    externalReceiptId: response.externalReceiptId,
    authenticationEvidenceRef: response.authenticationEvidenceRef,
    payloadFingerprint: response.payloadFingerprint,
    amountMinor: response.amountMinor,
    currency: response.currency,
    evidenceState,
    rawStatus: response.rawStatus,
    observedAt: normalizeObservedAt(response.observedAt),
    canonicalFinality: 'NOT_DECIDED_HERE',
  };
}
