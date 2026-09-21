import {
  mapReferenceDispatch,
  type BankProviderResponse,
} from './bank-adapter.port';

const response = (
  httpStatus: number | null,
  rawStatus: string | null = null,
): BankProviderResponse => ({
  httpStatus,
  rawStatus,
  providerOperationId: 'provider-op-1',
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
});

describe('provider-neutral bank dispatch truth', () => {
  it.each([400, 401, 403, 408, 409, 422, 429, 500, 503])(
    'keeps HTTP %s UNKNOWN without pinned provider business evidence',
    (httpStatus) => {
      expect(mapReferenceDispatch('ALFA_BANK', response(httpStatus))).toMatchObject({
        acknowledgement: 'UNKNOWN',
        canonicalFinality: 'NOT_DECIDED_HERE',
        retryPolicy: 'RECONCILE_BEFORE_RETRY',
      });
    },
  );

  it('uses an explicitly pinned provider rejection status as business evidence', () => {
    expect(mapReferenceDispatch(
      'SBER',
      response(200, 'ERROR'),
      ['REJECTED', 'DECLINED', 'FAILED', 'ERROR'],
    )).toMatchObject({
      acknowledgement: 'REJECTED',
      canonicalFinality: 'NOT_DECIDED_HERE',
      retryPolicy: 'RECONCILE_BEFORE_RETRY',
    });
  });

  it.each([200, 201, 202, 204])(
    'keeps HTTP %s as non-final transport acceptance',
    (httpStatus) => {
      expect(mapReferenceDispatch('T_BANK', response(httpStatus))).toMatchObject({
        acknowledgement: 'ACCEPTED_NONFINAL',
        canonicalFinality: 'NOT_DECIDED_HERE',
        retryPolicy: 'RECONCILE_BEFORE_RETRY',
      });
    },
  );
});
