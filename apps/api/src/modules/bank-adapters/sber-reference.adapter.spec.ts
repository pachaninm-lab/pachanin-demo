import type { BankProviderResponse } from './bank-adapter.port';
import { SberReferenceAdapter } from './sber-reference.adapter';

const response = (rawStatus: string | null, httpStatus = 200) => ({
  httpStatus,
  rawStatus,
  providerOperationId: 'sber-op-1',
  idempotencyKey: 'idem-1',
  providerEventId: 'sber-event-1',
  externalReceiptId: 'sber-receipt-1',
  authenticationAuthorityRef: 'callback-key:v7',
  authenticationEvidenceRef: 'mTLS+signature:evidence-1',
  payloadFingerprint: 'sha256:abc',
  observedAt: '2026-09-22T00:00:00.000Z',
  operationId: 'op-1',
  amountMinor: '10000',
  currency: 'RUB',
});

const malformedResponse = (overrides: Record<string, unknown>): BankProviderResponse => ({
  ...response(null),
  ...overrides,
} as unknown as BankProviderResponse);

describe('Sber reference adapter', () => {
  const adapter = new SberReferenceAdapter();

  it('keeps request mapping reference-only and exact-minor-unit', () => {
    expect(adapter.describeRequest({
      command: 'RELEASE',
      operationId: 'op-1',
      idempotencyKey: 'idem-1',
      amountMinor: '10000',
      currency: 'rub',
      sourceVersion: ' settlement:v9 ',
      beneficiaryReference: 'beneficiary-1',
    })).toMatchObject({
      providerFamily: 'SBER',
      capability: 'SAFE_DEAL_RESERVE_RELEASE',
      amountMinor: '10000',
      currency: 'RUB',
      sourceVersion: 'settlement:v9',
      liveRequestReady: false,
      contractMode: 'REFERENCE_CONFORMANCE_ONLY',
    });
  });

  it('fails closed when called directly for a capability this adapter does not support', () => {
    expect(() => adapter.describeRequest({
      command: 'BILLING',
      operationId: 'op-billing',
      idempotencyKey: 'idem-billing',
      amountMinor: '10000',
      currency: 'RUB',
      sourceVersion: 'settlement:v9',
      beneficiaryReference: null,
    })).toThrow('BANK_CAPABILITY_NOT_SUPPORTED:SBER:BILLING');
  });

  it('treats HTTP 201 as transport acceptance only, never settlement finality', () => {
    expect(adapter.mapDispatchResponse(response(null, 201))).toMatchObject({
      acknowledgement: 'ACCEPTED_NONFINAL',
      canonicalFinality: 'NOT_DECIDED_HERE',
      retryPolicy: 'RECONCILE_BEFORE_RETRY',
    });
  });

  it('does not coerce malformed runtime HTTP status values into transport acceptance', () => {
    for (const httpStatus of ['201', 201.5]) {
      expect(adapter.mapDispatchResponse(malformedResponse({ httpStatus }))).toMatchObject({
        acknowledgement: 'UNKNOWN',
        canonicalFinality: 'NOT_DECIDED_HERE',
        retryPolicy: 'RECONCILE_BEFORE_RETRY',
      });
    }
  });

  it('rejects malformed runtime observation timestamps instead of coercing them', () => {
    expect(() => adapter.mapDispatchResponse(malformedResponse({ observedAt: 0 })))
      .toThrow('INVALID_BANK_OBSERVED_AT');
  });

  it('maps documented CREATED/PENDING/DONE/ERROR into evidence classes without deciding canonical finality', () => {
    expect(adapter.mapReceiptResponse(response('CREATED'))).toMatchObject({ evidenceState: 'NONFINAL_EVIDENCE' });
    expect(adapter.mapReceiptResponse(response('PENDING'))).toMatchObject({ evidenceState: 'NONFINAL_EVIDENCE' });
    expect(adapter.mapReceiptResponse(response('DONE'))).toMatchObject({
      evidenceState: 'SUCCESS_EVIDENCE',
      canonicalFinality: 'NOT_DECIDED_HERE',
    });
    expect(adapter.mapReceiptResponse(response('ERROR'))).toMatchObject({ evidenceState: 'FAILURE_EVIDENCE' });
  });
});
