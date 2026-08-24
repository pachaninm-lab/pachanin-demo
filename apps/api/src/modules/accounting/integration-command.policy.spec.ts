import {
  IntegrationFailureClass,
  IntegrationRetryDisposition,
  integrationPayloadHash,
  integrationRetryDelayMs,
  retryDispositionForFailure,
  validateIntegrationCommandEnvelope,
  verifyIntegrationPayloadHash,
} from './integration-command.policy';

describe('integration command policy', () => {
  const bytes = Buffer.from('{"documentId":"doc-1"}', 'utf8');

  it('binds exact scope, idempotency, revision, attempt and payload hash', () => {
    expect(validateIntegrationCommandEnvelope({
      idempotencyKey: 'idem-1', correlationId: 'corr-1', organizationId: 'org-1',
      connectionId: 'connection-1', externalId: null,
      payloadHash: integrationPayloadHash(bytes), revision: 7, attempt: 2,
    })).toMatchObject({ revision: 7, attempt: 2 });
    expect(verifyIntegrationPayloadHash(bytes, integrationPayloadHash(bytes))).toBe(true);
    expect(verifyIntegrationPayloadHash(Buffer.from('tampered'), integrationPayloadHash(bytes))).toBe(false);
  });

  it('requires reconciliation for unknown effect and never blindly retries rejection', () => {
    expect(retryDispositionForFailure(IntegrationFailureClass.UNKNOWN_RESULT))
      .toBe(IntegrationRetryDisposition.RECONCILE_BEFORE_RETRY);
    expect(retryDispositionForFailure(IntegrationFailureClass.BUSINESS_REJECTION))
      .toBe(IntegrationRetryDisposition.DO_NOT_RETRY);
  });

  it('bounds full-jitter exponential retry delay', () => {
    expect(integrationRetryDelayMs(3, 0.5, 1_000, 60_000)).toBe(4_000);
    expect(integrationRetryDelayMs(20, 1, 1_000, 60_000)).toBe(60_000);
    expect(() => integrationRetryDelayMs(1, 1.1)).toThrow('randomFraction');
  });
});
