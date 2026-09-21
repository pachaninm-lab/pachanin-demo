import { describe, expect, it } from '@jest/globals';
import { TBankReferenceAdapter } from './tbank-reference.adapter';

describe('T-Bank reference adapter', () => {
  const adapter = new TBankReferenceAdapter();

  it('keeps billing and financing as separate explicit capabilities', () => {
    expect(adapter.capabilities).toContain('BILLING');
    expect(adapter.capabilities).toContain('FINANCING_APPLICATION');
    expect(adapter.capabilities).toContain('SAFE_DEAL_RESERVE_RELEASE');
  });

  it('treats HTTP 200/201 only as non-final acknowledgement', () => {
    for (const httpStatus of [200, 201]) {
      expect(adapter.mapDispatchResponse({
        httpStatus,
        rawStatus: null,
        providerOperationId: 'tbank-op-1',
        providerEventId: null,
        externalReceiptId: null,
        authenticationEvidenceRef: null,
        payloadFingerprint: null,
        observedAt: '2026-09-22T00:00:00.000Z',
        operationId: 'op-1',
        amountMinor: '10000',
        currency: 'RUB',
      })).toMatchObject({
        acknowledgement: 'ACCEPTED_NONFINAL',
        canonicalFinality: 'NOT_DECIDED_HERE',
      });
    }
  });

  it('recognizes documented PAYMENT_FAILED only as failure evidence and treats other unpinned statuses as unknown', () => {
    const base = {
      httpStatus: 200,
      providerOperationId: 'tbank-op-1',
      providerEventId: 'event-1',
      externalReceiptId: 'receipt-1',
      authenticationEvidenceRef: 'auth-1',
      payloadFingerprint: 'sha256:abc',
      observedAt: '2026-09-22T00:00:00.000Z',
      operationId: 'op-1',
      amountMinor: '10000',
      currency: 'RUB',
    };
    expect(adapter.mapReceiptResponse({ ...base, rawStatus: 'PAYMENT_FAILED' }))
      .toMatchObject({ evidenceState: 'FAILURE_EVIDENCE' });
    expect(adapter.mapReceiptResponse({ ...base, rawStatus: 'SOME_SUCCESS_LABEL' }))
      .toMatchObject({ evidenceState: 'UNKNOWN_EVIDENCE' });
  });
});
