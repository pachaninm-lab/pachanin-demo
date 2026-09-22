import type {
  BankProviderFamily,
  BankReceiptCandidate,
} from './bank-adapter.port';

export type ExpectedBankOperationEvidence = Readonly<{
  providerFamily: BankProviderFamily;
  operationId: string;
  idempotencyKey: string;
  providerOperationId: string | null;
  authenticationAuthorityRef: string;
  amountMinor: string;
  currency: string;
  alreadyConsumedProviderEventIds?: readonly string[];
  alreadyConsumedPayloadFingerprints?: readonly string[];
  alreadyConsumedExternalReceiptIds?: readonly string[];
}>;

export type BankReceiptValidation =
  | Readonly<{
      status: 'MATCHED';
      reconciliationState: 'READY_FOR_CANONICAL_RECONCILIATION';
      canonicalFinality: 'NOT_DECIDED_HERE';
      evidenceState: 'SUCCESS_EVIDENCE' | 'FAILURE_EVIDENCE';
    }>
  | Readonly<{
      status: 'PENDING_RECONCILIATION';
      reconciliationState: 'PENDING_RECONCILIATION';
      canonicalFinality: 'NOT_DECIDED_HERE';
      reason: 'NONFINAL_OR_UNKNOWN_PROVIDER_EVIDENCE';
    }>
  | Readonly<{
      status: 'REJECTED';
      reconciliationState: 'MANUAL_REVIEW_REQUIRED';
      canonicalFinality: 'NOT_DECIDED_HERE';
      reason:
        | 'PROVIDER_MISMATCH'
        | 'OPERATION_MISMATCH'
        | 'IDEMPOTENCY_MISMATCH'
        | 'PROVIDER_OPERATION_MISMATCH'
        | 'AMOUNT_MISMATCH'
        | 'CURRENCY_MISMATCH'
        | 'AUTHENTICATION_AUTHORITY_MISMATCH'
        | 'INVALID_EVIDENCE_STATE'
        | 'INVALID_CANONICAL_FINALITY'
        | 'INVALID_OBSERVED_AT'
        | 'PROVIDER_EVENT_REPLAY'
        | 'PAYLOAD_REPLAY'
        | 'EXTERNAL_RECEIPT_REPLAY'
        | 'AUTHENTICATION_EVIDENCE_MISSING'
        | 'PAYLOAD_FINGERPRINT_MISSING'
        | 'EXTERNAL_RECEIPT_MISSING';
    }>;

function positiveMinorUnits(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return /^\d+$/.test(normalized) && BigInt(normalized) > 0n ? normalized : null;
}

function currencyCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

function evidenceIdentity(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim() || null;
}

function consumedEvidenceIncludes(
  values: readonly string[] | undefined,
  candidate: string | null,
): boolean {
  return candidate !== null
    && values?.some((value) => typeof value === 'string' && value.trim() === candidate) === true;
}

function isReceiptEvidenceState(value: unknown): value is BankReceiptCandidate['evidenceState'] {
  return value === 'SUCCESS_EVIDENCE'
    || value === 'FAILURE_EVIDENCE'
    || value === 'NONFINAL_EVIDENCE'
    || value === 'UNKNOWN_EVIDENCE';
}

function isReceiptObservedAt(value: unknown): value is string {
  return typeof value === 'string'
    && value.trim().length > 0
    && Number.isFinite(Date.parse(value));
}

export function validateBankReceiptCandidate(
  expected: ExpectedBankOperationEvidence,
  candidate: BankReceiptCandidate,
): BankReceiptValidation {
  if (candidate.providerFamily !== expected.providerFamily) {
    return rejected('PROVIDER_MISMATCH');
  }
  if (!expected.operationId.trim() || candidate.operationId !== expected.operationId) {
    return rejected('OPERATION_MISMATCH');
  }
  if (!expected.idempotencyKey.trim() || candidate.idempotencyKey !== expected.idempotencyKey) {
    return rejected('IDEMPOTENCY_MISMATCH');
  }
  if (
    expected.providerOperationId
    && candidate.providerOperationId !== expected.providerOperationId
  ) {
    return rejected('PROVIDER_OPERATION_MISMATCH');
  }

  const expectedAmount = positiveMinorUnits(expected.amountMinor);
  const candidateAmount = positiveMinorUnits(candidate.amountMinor);
  if (!expectedAmount || !candidateAmount || candidateAmount !== expectedAmount) {
    return rejected('AMOUNT_MISMATCH');
  }

  const expectedCurrency = currencyCode(expected.currency);
  const candidateCurrency = currencyCode(candidate.currency);
  if (!expectedCurrency || !candidateCurrency || candidateCurrency !== expectedCurrency) {
    return rejected('CURRENCY_MISMATCH');
  }

  if (
    !expected.authenticationAuthorityRef.trim()
    || candidate.authenticationAuthorityRef !== expected.authenticationAuthorityRef
  ) {
    return rejected('AUTHENTICATION_AUTHORITY_MISMATCH');
  }

  // TypeScript unions disappear at runtime. A malformed/future adapter must not
  // be able to turn an arbitrary evidence state into terminal matched evidence
  // simply by carrying an external receipt ID.
  if (!isReceiptEvidenceState(candidate.evidenceState)) {
    return rejected('INVALID_EVIDENCE_STATE');
  }
  if (candidate.canonicalFinality !== 'NOT_DECIDED_HERE') {
    return rejected('INVALID_CANONICAL_FINALITY');
  }
  if (!isReceiptObservedAt(candidate.observedAt)) {
    return rejected('INVALID_OBSERVED_AT');
  }

  const providerEventId = evidenceIdentity(candidate.providerEventId);
  const payloadFingerprint = evidenceIdentity(candidate.payloadFingerprint);
  const externalReceiptId = evidenceIdentity(candidate.externalReceiptId);

  // Compare canonical evidence identities, not raw transport padding. Otherwise a
  // replayed callback could evade durable-history checks by changing only leading
  // or trailing whitespace around an already consumed identifier/fingerprint.
  if (consumedEvidenceIncludes(expected.alreadyConsumedProviderEventIds, providerEventId)) {
    return rejected('PROVIDER_EVENT_REPLAY');
  }
  if (consumedEvidenceIncludes(expected.alreadyConsumedPayloadFingerprints, payloadFingerprint)) {
    return rejected('PAYLOAD_REPLAY');
  }
  if (consumedEvidenceIncludes(expected.alreadyConsumedExternalReceiptIds, externalReceiptId)) {
    return rejected('EXTERNAL_RECEIPT_REPLAY');
  }

  // Even non-final/unknown provider facts must come from an authenticated,
  // fingerprinted transport before they are allowed to influence reconciliation.
  // They may remain pending, but untrusted bytes are rejected rather than queued
  // as if they were provider evidence.
  if (!evidenceIdentity(candidate.authenticationEvidenceRef)) {
    return rejected('AUTHENTICATION_EVIDENCE_MISSING');
  }
  if (!payloadFingerprint) {
    return rejected('PAYLOAD_FINGERPRINT_MISSING');
  }

  if (
    candidate.evidenceState === 'NONFINAL_EVIDENCE'
    || candidate.evidenceState === 'UNKNOWN_EVIDENCE'
  ) {
    return {
      status: 'PENDING_RECONCILIATION',
      reconciliationState: 'PENDING_RECONCILIATION',
      canonicalFinality: 'NOT_DECIDED_HERE',
      reason: 'NONFINAL_OR_UNKNOWN_PROVIDER_EVIDENCE',
    };
  }

  if (!externalReceiptId) {
    return rejected('EXTERNAL_RECEIPT_MISSING');
  }

  return {
    status: 'MATCHED',
    reconciliationState: 'READY_FOR_CANONICAL_RECONCILIATION',
    canonicalFinality: 'NOT_DECIDED_HERE',
    evidenceState: candidate.evidenceState,
  };
}

function rejected(reason: Extract<BankReceiptValidation, { status: 'REJECTED' }>['reason']): BankReceiptValidation {
  return {
    status: 'REJECTED',
    reconciliationState: 'MANUAL_REVIEW_REQUIRED',
    canonicalFinality: 'NOT_DECIDED_HERE',
    reason,
  };
}
