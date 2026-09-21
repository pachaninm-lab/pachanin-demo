import type {
  BankProviderFamily,
  BankReceiptCandidate,
} from './bank-adapter.port';

export type ExpectedBankOperationEvidence = Readonly<{
  providerFamily: BankProviderFamily;
  operationId: string;
  providerOperationId: string | null;
  amountMinor: string;
  currency: string;
  alreadyConsumedProviderEventIds?: readonly string[];
  alreadyConsumedPayloadFingerprints?: readonly string[];
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
        | 'PROVIDER_OPERATION_MISMATCH'
        | 'AMOUNT_MISMATCH'
        | 'CURRENCY_MISMATCH'
        | 'PROVIDER_EVENT_REPLAY'
        | 'PAYLOAD_REPLAY'
        | 'AUTHENTICATION_EVIDENCE_MISSING'
        | 'PAYLOAD_FINGERPRINT_MISSING'
        | 'EXTERNAL_RECEIPT_MISSING';
    }>;

function positiveMinorUnits(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  return /^\d+$/.test(normalized) && BigInt(normalized) > 0n ? normalized : null;
}

function currencyCode(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
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
    candidate.providerEventId
    && expected.alreadyConsumedProviderEventIds?.includes(candidate.providerEventId)
  ) {
    return rejected('PROVIDER_EVENT_REPLAY');
  }
  if (
    candidate.payloadFingerprint
    && expected.alreadyConsumedPayloadFingerprints?.includes(candidate.payloadFingerprint)
  ) {
    return rejected('PAYLOAD_REPLAY');
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

  if (!candidate.authenticationEvidenceRef?.trim()) {
    return rejected('AUTHENTICATION_EVIDENCE_MISSING');
  }
  if (!candidate.payloadFingerprint?.trim()) {
    return rejected('PAYLOAD_FINGERPRINT_MISSING');
  }
  if (!candidate.externalReceiptId?.trim()) {
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
