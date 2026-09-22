import {
  REAL_BANK_PROVIDER_FAMILIES,
  type BankReceiptCandidate,
  type RealBankProviderFamily,
} from './bank-adapter.port';

export type ExpectedBankOperationEvidence = Readonly<{
  providerFamily: RealBankProviderFamily;
  operationId: string;
  idempotencyKey: string;
  providerOperationId: string | null;
  authenticationAuthorityRef: string;
  amountMinor: string;
  currency: string;
  alreadyConsumedProviderEventIds: readonly string[];
  alreadyConsumedPayloadFingerprints: readonly string[];
  alreadyConsumedExternalReceiptIds: readonly string[];
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
        | 'INVALID_PROVIDER_FAMILY'
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
        | 'INVALID_CONSUMED_EVIDENCE_HISTORY'
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

function canonicalInternalIdentity(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized
    && normalized === value
    && normalized.length <= 240
    && /^[A-Za-z0-9:_.-]+$/.test(normalized)
    ? normalized
    : null;
}

function expectedProviderOperationIdentity(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized && normalized === value && normalized.length <= 240
    ? normalized
    : undefined;
}

function isBankProviderFamily(value: unknown): value is RealBankProviderFamily {
  return typeof value === 'string'
    && (REAL_BANK_PROVIDER_FAMILIES as readonly string[]).includes(value);
}

function isRuntimeConsumedEvidenceHistory(
  values: unknown,
): values is readonly string[] {
  return Array.isArray(values)
    && values.every((value) => typeof value === 'string' && value.trim().length > 0);
}

function consumedEvidenceIncludes(
  values: unknown,
  candidate: string | null,
): boolean {
  return candidate !== null
    && Array.isArray(values)
    && values.some((value) => typeof value === 'string' && value.trim() === candidate);
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
  if (!isBankProviderFamily(expected.providerFamily) || !isBankProviderFamily(candidate.providerFamily)) {
    return rejected('INVALID_PROVIDER_FAMILY');
  }
  if (candidate.providerFamily !== expected.providerFamily) {
    return rejected('PROVIDER_MISMATCH');
  }
  const expectedOperationId = canonicalInternalIdentity(expected.operationId);
  const candidateOperationId = canonicalInternalIdentity(candidate.operationId);
  if (!expectedOperationId || candidateOperationId !== expectedOperationId) {
    return rejected('OPERATION_MISMATCH');
  }

  const expectedIdempotencyKey = canonicalInternalIdentity(expected.idempotencyKey);
  const candidateIdempotencyKey = canonicalInternalIdentity(candidate.idempotencyKey);
  if (!expectedIdempotencyKey || candidateIdempotencyKey !== expectedIdempotencyKey) {
    return rejected('IDEMPOTENCY_MISMATCH');
  }

  // null means the provider operation identity is genuinely not yet known.
  // Empty/malformed server-held or provider-returned values must not be treated
  // as equivalent to null, because that would silently disable correlation.
  const expectedProviderOperationId = expectedProviderOperationIdentity(expected.providerOperationId);
  const candidateProviderOperationId = expectedProviderOperationIdentity(candidate.providerOperationId);
  if (
    expectedProviderOperationId === undefined
    || candidateProviderOperationId === undefined
    || (expectedProviderOperationId !== null
      && candidateProviderOperationId !== expectedProviderOperationId)
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
    typeof expected.authenticationAuthorityRef !== 'string'
    || !expected.authenticationAuthorityRef.trim()
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

  // Replay protection is a required durable input, not an optional hint. If the
  // caller cannot supply all consumed-evidence sets, receipt matching must fail
  // closed rather than silently accepting evidence with unknown replay history.
  if (
    !isRuntimeConsumedEvidenceHistory(expected.alreadyConsumedProviderEventIds)
    || !isRuntimeConsumedEvidenceHistory(expected.alreadyConsumedPayloadFingerprints)
    || !isRuntimeConsumedEvidenceHistory(expected.alreadyConsumedExternalReceiptIds)
  ) {
    return rejected('INVALID_CONSUMED_EVIDENCE_HISTORY');
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
