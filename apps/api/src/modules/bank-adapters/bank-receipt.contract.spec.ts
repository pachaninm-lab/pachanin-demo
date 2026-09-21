import { describe, expect, it } from '@jest/globals';
import type { BankReceiptCandidate } from './bank-adapter.port';
import {
  validateBankReceiptCandidate,
  type ExpectedBankOperationEvidence,
} from './bank-receipt.contract';

const expected: ExpectedBankOperationEvidence = {
  providerFamily: 'SBER',
  operationId: 'op-1',
  idempotencyKey: 'idem-1',
  providerOperationId: 'provider-op-1',
  amountMinor: '12500',
  currency: 'RUB',
};

const candidate = (overrides: Partial<BankReceiptCandidate> = {}): BankReceiptCandidate => ({
  providerFamily: 'SBER',
  operationId: 'op-1',
  providerOperationId: 'provider-op-1',
  idempotencyKey: 'idem-1',
  providerEventId: 'event-1',
  externalReceiptId: 'receipt-1',
  authenticationEvidenceRef: 'auth-evidence-1',
  payloadFingerprint: 'sha256:abc',
  amountMinor: '12500',
  currency: 'RUB',
  evidenceState: 'SUCCESS_EVIDENCE',
  rawStatus: 'DONE',
  observedAt: '2026-09-22T00:00:00.000Z',
  canonicalFinality: 'NOT_DECIDED_HERE',
  ...overrides,
});

describe('bank receipt contract', () => {
  it('accepts exact authenticated success evidence only for reconciliation, never as canonical finality', () => {
    expect(validateBankReceiptCandidate(expected, candidate())).toEqual({
      status: 'MATCHED',
      reconciliationState: 'READY_FOR_CANONICAL_RECONCILIATION',
      canonicalFinality: 'NOT_DECIDED_HERE',
      evidenceState: 'SUCCESS_EVIDENCE',
    });
  });

  it('keeps non-final and unknown provider evidence pending reconciliation', () => {
    for (const evidenceState of ['NONFINAL_EVIDENCE', 'UNKNOWN_EVIDENCE'] as const) {
      expect(validateBankReceiptCandidate(expected, candidate({ evidenceState }))).toEqual({
        status: 'PENDING_RECONCILIATION',
        reconciliationState: 'PENDING_RECONCILIATION',
        canonicalFinality: 'NOT_DECIDED_HERE',
        reason: 'NONFINAL_OR_UNKNOWN_PROVIDER_EVIDENCE',
      });
    }
  });

  it.each([
    [{ providerFamily: 'T_BANK' as const }, 'PROVIDER_MISMATCH'],
    [{ operationId: 'op-other' }, 'OPERATION_MISMATCH'],
    [{ idempotencyKey: 'idem-other' }, 'IDEMPOTENCY_MISMATCH'],
    [{ providerOperationId: 'provider-other' }, 'PROVIDER_OPERATION_MISMATCH'],
    [{ amountMinor: '12501' }, 'AMOUNT_MISMATCH'],
    [{ amountMinor: 'not-money' }, 'AMOUNT_MISMATCH'],
    [{ currency: 'USD' }, 'CURRENCY_MISMATCH'],
    [{ currency: '??' }, 'CURRENCY_MISMATCH'],
  ])('fails closed on exact or malformed evidence mismatch', (override, reason) => {
    expect(validateBankReceiptCandidate(expected, candidate(override))).toMatchObject({
      status: 'REJECTED',
      reason,
      canonicalFinality: 'NOT_DECIDED_HERE',
    });
  });

  it('rejects malformed canonical comparison evidence instead of accepting equal invalid values', () => {
    expect(validateBankReceiptCandidate(
      { ...expected, amountMinor: 'invalid' },
      candidate({ amountMinor: 'invalid' }),
    )).toMatchObject({ status: 'REJECTED', reason: 'AMOUNT_MISMATCH' });

    expect(validateBankReceiptCandidate(
      { ...expected, currency: '??' },
      candidate({ currency: '??' }),
    )).toMatchObject({ status: 'REJECTED', reason: 'CURRENCY_MISMATCH' });
  });

  it('requires authentication evidence, payload fingerprint and an external receipt for terminal evidence classes', () => {
    expect(validateBankReceiptCandidate(expected, candidate({ authenticationEvidenceRef: null })))
      .toMatchObject({ status: 'REJECTED', reason: 'AUTHENTICATION_EVIDENCE_MISSING' });
    expect(validateBankReceiptCandidate(expected, candidate({ payloadFingerprint: null })))
      .toMatchObject({ status: 'REJECTED', reason: 'PAYLOAD_FINGERPRINT_MISSING' });
    expect(validateBankReceiptCandidate(expected, candidate({ externalReceiptId: null })))
      .toMatchObject({ status: 'REJECTED', reason: 'EXTERNAL_RECEIPT_MISSING' });
  });

  it('fails closed on provider-event and payload replay evidence supplied by durable inbox history', () => {
    expect(validateBankReceiptCandidate(
      { ...expected, alreadyConsumedProviderEventIds: ['event-1'] },
      candidate(),
    )).toMatchObject({ status: 'REJECTED', reason: 'PROVIDER_EVENT_REPLAY' });
    expect(validateBankReceiptCandidate(
      { ...expected, alreadyConsumedPayloadFingerprints: ['sha256:abc'] },
      candidate(),
    )).toMatchObject({ status: 'REJECTED', reason: 'PAYLOAD_REPLAY' });
  });
});
