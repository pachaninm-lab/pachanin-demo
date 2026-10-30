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
  authenticationAuthorityRef: 'callback-key:v7',
  amountMinor: '12500',
  currency: 'RUB',
  alreadyConsumedProviderEventIds: [],
  alreadyConsumedPayloadFingerprints: [],
  alreadyConsumedExternalReceiptIds: [],
};

const candidate = (overrides: Partial<BankReceiptCandidate> = {}): BankReceiptCandidate => ({
  providerFamily: 'SBER',
  operationId: 'op-1',
  providerOperationId: 'provider-op-1',
  idempotencyKey: 'idem-1',
  providerEventId: 'event-1',
  externalReceiptId: 'receipt-1',
  authenticationAuthorityRef: 'callback-key:v7',
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

const malformedCandidate = (overrides: Record<string, unknown>): BankReceiptCandidate => ({
  ...candidate(),
  ...overrides,
} as unknown as BankReceiptCandidate);

const malformedExpected = (overrides: Record<string, unknown>): ExpectedBankOperationEvidence => ({
  ...expected,
  ...overrides,
} as unknown as ExpectedBankOperationEvidence);

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
    [{ authenticationAuthorityRef: 'callback-key:old' }, 'AUTHENTICATION_AUTHORITY_MISMATCH'],
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

  it('rejects malformed runtime evidence state, canonical-finality or evidence time claims', () => {
    expect(validateBankReceiptCandidate(
      expected,
      malformedCandidate({ evidenceState: 'DELIVERED' }),
    )).toMatchObject({ status: 'REJECTED', reason: 'INVALID_EVIDENCE_STATE' });

    expect(validateBankReceiptCandidate(
      expected,
      malformedCandidate({ canonicalFinality: 'FINAL' }),
    )).toMatchObject({ status: 'REJECTED', reason: 'INVALID_CANONICAL_FINALITY' });

    expect(validateBankReceiptCandidate(
      expected,
      malformedCandidate({ observedAt: 0 }),
    )).toMatchObject({ status: 'REJECTED', reason: 'INVALID_OBSERVED_AT' });

    expect(validateBankReceiptCandidate(
      expected,
      candidate({ observedAt: 'not-a-date' }),
    )).toMatchObject({ status: 'REJECTED', reason: 'INVALID_OBSERVED_AT' });
  });

  it('turns malformed transport value shapes into controlled rejection instead of runtime exceptions', () => {
    expect(validateBankReceiptCandidate(
      expected,
      malformedCandidate({ amountMinor: 12500 }),
    )).toMatchObject({ status: 'REJECTED', reason: 'AMOUNT_MISMATCH' });

    expect(validateBankReceiptCandidate(
      expected,
      malformedCandidate({ currency: 643 }),
    )).toMatchObject({ status: 'REJECTED', reason: 'CURRENCY_MISMATCH' });

    expect(validateBankReceiptCandidate(
      expected,
      malformedCandidate({ authenticationEvidenceRef: true }),
    )).toMatchObject({ status: 'REJECTED', reason: 'AUTHENTICATION_EVIDENCE_MISSING' });
  });

  it('fails closed on malformed runtime canonical expectations instead of throwing or self-matching invalid values', () => {
    expect(validateBankReceiptCandidate(
      malformedExpected({ providerFamily: 'NOT_A_BANK' }),
      malformedCandidate({ providerFamily: 'NOT_A_BANK' }),
    )).toMatchObject({ status: 'REJECTED', reason: 'INVALID_PROVIDER_FAMILY' });

    expect(validateBankReceiptCandidate(
      malformedExpected({ providerFamily: 'TEST_DOUBLE_A' }),
      malformedCandidate({ providerFamily: 'TEST_DOUBLE_A' }),
    )).toMatchObject({ status: 'REJECTED', reason: 'INVALID_PROVIDER_FAMILY' });

    expect(validateBankReceiptCandidate(
      malformedExpected({ operationId: 42 }),
      malformedCandidate({ operationId: 42 }),
    )).toMatchObject({ status: 'REJECTED', reason: 'OPERATION_MISMATCH' });

    expect(validateBankReceiptCandidate(
      malformedExpected({ idempotencyKey: true }),
      malformedCandidate({ idempotencyKey: true }),
    )).toMatchObject({ status: 'REJECTED', reason: 'IDEMPOTENCY_MISMATCH' });

    expect(validateBankReceiptCandidate(
      malformedExpected({ operationId: ' op-1 ' }),
      malformedCandidate({ operationId: ' op-1 ' }),
    )).toMatchObject({ status: 'REJECTED', reason: 'OPERATION_MISMATCH' });

    expect(validateBankReceiptCandidate(
      malformedExpected({ idempotencyKey: 'idem 1' }),
      malformedCandidate({ idempotencyKey: 'idem 1' }),
    )).toMatchObject({ status: 'REJECTED', reason: 'IDEMPOTENCY_MISMATCH' });

    expect(validateBankReceiptCandidate(
      malformedExpected({ providerOperationId: '' }),
      candidate({ providerOperationId: 'provider-other' }),
    )).toMatchObject({ status: 'REJECTED', reason: 'PROVIDER_OPERATION_MISMATCH' });

    expect(validateBankReceiptCandidate(
      malformedExpected({ providerOperationId: ' provider-op-1 ' }),
      candidate({ providerOperationId: 'provider-op-1' }),
    )).toMatchObject({ status: 'REJECTED', reason: 'PROVIDER_OPERATION_MISMATCH' });

    expect(validateBankReceiptCandidate(
      malformedExpected({ authenticationAuthorityRef: { key: 'v7' } }),
      malformedCandidate({ authenticationAuthorityRef: { key: 'v7' } }),
    )).toMatchObject({ status: 'REJECTED', reason: 'AUTHENTICATION_AUTHORITY_MISMATCH' });
  });

  it('validates provider-operation identity shape even before the expected provider identity is known', () => {
    const withoutKnownProviderOperation = { ...expected, providerOperationId: null };

    expect(validateBankReceiptCandidate(
      withoutKnownProviderOperation,
      malformedCandidate({ providerOperationId: 42 }),
    )).toMatchObject({ status: 'REJECTED', reason: 'PROVIDER_OPERATION_MISMATCH' });

    expect(validateBankReceiptCandidate(
      withoutKnownProviderOperation,
      candidate({ providerOperationId: ' provider-op-1 ' }),
    )).toMatchObject({ status: 'REJECTED', reason: 'PROVIDER_OPERATION_MISMATCH' });

    expect(validateBankReceiptCandidate(
      withoutKnownProviderOperation,
      candidate({ providerOperationId: 'provider-op-new' }),
    )).toMatchObject({
      status: 'MATCHED',
      reconciliationState: 'READY_FOR_CANONICAL_RECONCILIATION',
      canonicalFinality: 'NOT_DECIDED_HERE',
    });
  });

  it('rejects unauthenticated or unfingerprinted evidence even when provider status is non-final/unknown', () => {
    expect(validateBankReceiptCandidate(
      expected,
      candidate({ evidenceState: 'UNKNOWN_EVIDENCE', authenticationEvidenceRef: null }),
    )).toMatchObject({ status: 'REJECTED', reason: 'AUTHENTICATION_EVIDENCE_MISSING' });
    expect(validateBankReceiptCandidate(
      expected,
      candidate({ evidenceState: 'NONFINAL_EVIDENCE', payloadFingerprint: null }),
    )).toMatchObject({ status: 'REJECTED', reason: 'PAYLOAD_FINGERPRINT_MISSING' });
  });

  it('requires authentication evidence, payload fingerprint and an external receipt for terminal evidence classes', () => {
    expect(validateBankReceiptCandidate(expected, candidate({ authenticationEvidenceRef: null })))
      .toMatchObject({ status: 'REJECTED', reason: 'AUTHENTICATION_EVIDENCE_MISSING' });
    expect(validateBankReceiptCandidate(expected, candidate({ payloadFingerprint: null })))
      .toMatchObject({ status: 'REJECTED', reason: 'PAYLOAD_FINGERPRINT_MISSING' });
    expect(validateBankReceiptCandidate(expected, candidate({ externalReceiptId: null })))
      .toMatchObject({ status: 'REJECTED', reason: 'EXTERNAL_RECEIPT_MISSING' });
  });

  it('fails closed when durable replay history is absent instead of treating missing history as empty', () => {
    for (const overrides of [
      { alreadyConsumedProviderEventIds: undefined },
      { alreadyConsumedPayloadFingerprints: undefined },
      { alreadyConsumedExternalReceiptIds: undefined },
    ]) {
      expect(validateBankReceiptCandidate(
        malformedExpected(overrides),
        candidate(),
      )).toMatchObject({ status: 'REJECTED', reason: 'INVALID_CONSUMED_EVIDENCE_HISTORY' });
    }
  });

  it('fails closed on provider-event, payload and external-receipt replay evidence supplied by durable inbox history', () => {
    expect(validateBankReceiptCandidate(
      { ...expected, alreadyConsumedProviderEventIds: ['event-1'] },
      candidate(),
    )).toMatchObject({ status: 'REJECTED', reason: 'PROVIDER_EVENT_REPLAY' });
    expect(validateBankReceiptCandidate(
      { ...expected, alreadyConsumedPayloadFingerprints: ['sha256:abc'] },
      candidate(),
    )).toMatchObject({ status: 'REJECTED', reason: 'PAYLOAD_REPLAY' });
    expect(validateBankReceiptCandidate(
      { ...expected, alreadyConsumedExternalReceiptIds: ['receipt-1'] },
      candidate({ providerEventId: 'event-2', payloadFingerprint: 'sha256:def' }),
    )).toMatchObject({ status: 'REJECTED', reason: 'EXTERNAL_RECEIPT_REPLAY' });
  });

  it('rejects malformed durable replay history instead of ignoring it or throwing', () => {
    for (const overrides of [
      { alreadyConsumedProviderEventIds: 'event-1' },
      { alreadyConsumedPayloadFingerprints: [null] },
      { alreadyConsumedExternalReceiptIds: [''] },
    ]) {
      expect(validateBankReceiptCandidate(
        malformedExpected(overrides),
        candidate(),
      )).toMatchObject({ status: 'REJECTED', reason: 'INVALID_CONSUMED_EVIDENCE_HISTORY' });
    }
  });

  it('cannot evade durable replay checks with transport whitespace around evidence identities', () => {
    expect(validateBankReceiptCandidate(
      { ...expected, alreadyConsumedProviderEventIds: ['event-1'] },
      candidate({ providerEventId: '  event-1  ' }),
    )).toMatchObject({ status: 'REJECTED', reason: 'PROVIDER_EVENT_REPLAY' });
    expect(validateBankReceiptCandidate(
      { ...expected, alreadyConsumedPayloadFingerprints: ['sha256:abc'] },
      candidate({ payloadFingerprint: '  sha256:abc  ' }),
    )).toMatchObject({ status: 'REJECTED', reason: 'PAYLOAD_REPLAY' });
    expect(validateBankReceiptCandidate(
      { ...expected, alreadyConsumedExternalReceiptIds: ['receipt-1'] },
      candidate({
        providerEventId: 'event-2',
        payloadFingerprint: 'sha256:def',
        externalReceiptId: '  receipt-1  ',
      }),
    )).toMatchObject({ status: 'REJECTED', reason: 'EXTERNAL_RECEIPT_REPLAY' });
  });
});
