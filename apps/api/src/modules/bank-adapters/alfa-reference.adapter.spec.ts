import { AlfaReferenceAdapter } from './alfa-reference.adapter';

describe('Alfa reference adapter', () => {
  const adapter = new AlfaReferenceAdapter();

  it('keeps public-spec conformance separate from live activation', () => {
    expect(adapter.liveTransportImplemented).toBe(false);
    expect(adapter.contractMode).toBe('REFERENCE_CONFORMANCE_ONLY');
    expect(adapter.capabilities).toContain('SAFE_DEAL_RESERVE_RELEASE');
    expect(adapter.capabilities).toContain('STATUS_READ');
  });

  it('does not invent an Alfa status vocabulary without a pinned exact contract', () => {
    const receipt = adapter.mapReceiptResponse({
      httpStatus: 200,
      rawStatus: 'SUCCESS',
      providerOperationId: 'alfa-op-1',
      idempotencyKey: 'idem-1',
      providerEventId: 'event-1',
      externalReceiptId: 'receipt-1',
      authenticationAuthorityRef: 'callback-key:v7',
      authenticationEvidenceRef: 'auth-1',
      payloadFingerprint: 'sha256:abc',
      observedAt: '2026-09-22T00:00:00.000Z',
      operationId: 'op-1',
      amountMinor: '10000',
      currency: 'RUB',
    });
    expect(receipt).toMatchObject({
      evidenceState: 'UNKNOWN_EVIDENCE',
      canonicalFinality: 'NOT_DECIDED_HERE',
    });
  });

  it('treats a 2xx response only as non-final transport acknowledgement', () => {
    expect(adapter.mapDispatchResponse({
      httpStatus: 202,
      rawStatus: null,
      providerOperationId: 'alfa-op-1',
      idempotencyKey: 'idem-1',
      providerEventId: null,
      externalReceiptId: null,
      authenticationAuthorityRef: 'callback-key:v7',
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
  });

  it('does not turn unpinned transport failures into business rejection', () => {
    for (const httpStatus of [400, 401, 403, 408, 409, 422, 429, 500, 503]) {
      expect(adapter.mapDispatchResponse({
        httpStatus,
        rawStatus: null,
        providerOperationId: null,
        idempotencyKey: 'idem-1',
        providerEventId: null,
        externalReceiptId: null,
        authenticationAuthorityRef: 'callback-key:v7',
        authenticationEvidenceRef: null,
        payloadFingerprint: null,
        observedAt: '2026-09-22T00:00:00.000Z',
        operationId: 'op-1',
        amountMinor: '10000',
        currency: 'RUB',
      })).toMatchObject({
        acknowledgement: 'UNKNOWN',
        canonicalFinality: 'NOT_DECIDED_HERE',
        retryPolicy: 'RECONCILE_BEFORE_RETRY',
      });
    }
  });
});
