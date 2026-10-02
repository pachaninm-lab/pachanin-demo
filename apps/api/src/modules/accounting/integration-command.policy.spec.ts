import { TextEncoder } from 'node:util';
import {
  IntegrationCommandPolicyError,
  IntegrationFailureClass,
  IntegrationRetryDisposition,
  integrationPayloadHash,
  integrationRetryDelayMs,
  retryDispositionForFailure,
  staleRevisionHttpStatus,
  validateIntegrationCommandEnvelope,
  validateIntegrationQueuePartition,
  verifyIntegrationPayloadHash,
} from './integration-command.policy';

const bytes = (value: string) => new TextEncoder().encode(value);

describe('integration command contract', () => {
  it('requires the exact idempotency/correlation/org/connection/hash/revision/attempt envelope', () => {
    const payloadHash = integrationPayloadHash(bytes('{"id":"doc-1"}'));
    expect(
      validateIntegrationCommandEnvelope({
        idempotencyKey: 'idem-1',
        correlationId: 'corr-1',
        organizationId: 'org-1',
        connectionId: 'conn-1',
        externalId: null,
        payloadHash,
        revision: 7,
        attempt: 0,
      }),
    ).toMatchObject({
      idempotencyKey: 'idem-1',
      correlationId: 'corr-1',
      organizationId: 'org-1',
      connectionId: 'conn-1',
      revision: 7,
      attempt: 0,
    });
  });

  it('refuses missing identity dimensions and malformed hash', () => {
    expect(() =>
      validateIntegrationCommandEnvelope({
        idempotencyKey: '',
        correlationId: 'corr-1',
        organizationId: 'org-1',
        connectionId: 'conn-1',
        externalId: null,
        payloadHash: 'a'.repeat(64),
        revision: 0,
        attempt: 0,
      }),
    ).toThrow('idempotencyKey is required');

    expect(() =>
      validateIntegrationCommandEnvelope({
        idempotencyKey: 'idem-1',
        correlationId: 'corr-1',
        organizationId: 'org-1',
        connectionId: 'conn-1',
        externalId: null,
        payloadHash: 'not-a-hash',
        revision: 0,
        attempt: 0,
      }),
    ).toThrow('payloadHash must be a SHA-256 hex digest');
  });

  it('hashes exact payload bytes and detects tampering', () => {
    const original = bytes('{"amount":"10000"}');
    const tampered = bytes('{"amount":"90000"}');
    const hash = integrationPayloadHash(original);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyIntegrationPayloadHash(original, hash)).toBe(true);
    expect(verifyIntegrationPayloadHash(tampered, hash)).toBe(false);
  });

  it.each([
    IntegrationFailureClass.TRANSIENT_NETWORK,
    IntegrationFailureClass.TRANSIENT_TIMEOUT,
    IntegrationFailureClass.TRANSIENT_RATE_LIMIT,
    IntegrationFailureClass.TRANSIENT_PROVIDER_5XX,
  ])('automatically retries only classified transient failures: %s', (failure) => {
    expect(retryDispositionForFailure(failure)).toBe(
      IntegrationRetryDisposition.RETRY_TRANSIENT,
    );
  });

  it('never blindly retries a business rejection', () => {
    expect(retryDispositionForFailure(IntegrationFailureClass.BUSINESS_REJECTION)).toBe(
      IntegrationRetryDisposition.DO_NOT_RETRY,
    );
  });

  it('requires reconciliation before retrying an ambiguous external result', () => {
    expect(retryDispositionForFailure(IntegrationFailureClass.UNKNOWN_RESULT)).toBe(
      IntegrationRetryDisposition.RECONCILE_BEFORE_RETRY,
    );
  });

  it('routes payload tamper and security hold to security review, not transport retry', () => {
    expect(
      retryDispositionForFailure(IntegrationFailureClass.PAYLOAD_HASH_MISMATCH),
    ).toBe(IntegrationRetryDisposition.SECURITY_REVIEW);
    expect(retryDispositionForFailure(IntegrationFailureClass.SECURITY_HOLD)).toBe(
      IntegrationRetryDisposition.SECURITY_REVIEW,
    );
  });

  it('maps optimistic revision mismatch to 409 stale conflict semantics', () => {
    expect(staleRevisionHttpStatus(4, 4)).toBe(200);
    expect(staleRevisionHttpStatus(4, 5)).toBe(409);
    expect(retryDispositionForFailure(IntegrationFailureClass.STALE_REVISION)).toBe(
      IntegrationRetryDisposition.STALE_CONFLICT,
    );
  });

  it('refuses invalid revisions and attempts rather than truncating them', () => {
    expect(() => staleRevisionHttpStatus(-1, 0)).toThrow(
      IntegrationCommandPolicyError,
    );
    expect(() =>
      validateIntegrationCommandEnvelope({
        idempotencyKey: 'idem-1',
        correlationId: 'corr-1',
        organizationId: 'org-1',
        connectionId: 'conn-1',
        externalId: null,
        payloadHash: 'a'.repeat(64),
        revision: 1,
        attempt: 101,
      }),
    ).toThrow('attempt must be an integer from 0 to 100');
  });

  it('uses bounded exponential backoff with full jitter', () => {
    expect(integrationRetryDelayMs(0, 0, 1_000, 60_000)).toBe(0);
    expect(integrationRetryDelayMs(0, 1, 1_000, 60_000)).toBe(1_000);
    expect(integrationRetryDelayMs(3, 1, 1_000, 60_000)).toBe(8_000);
    expect(integrationRetryDelayMs(20, 1, 1_000, 60_000)).toBe(60_000);
    expect(integrationRetryDelayMs(3, 0.5, 1_000, 60_000)).toBe(4_000);
  });

  it('refuses invalid jitter input so backoff cannot become negative or unbounded', () => {
    expect(() => integrationRetryDelayMs(0, -0.1)).toThrow('randomFraction');
    expect(() => integrationRetryDelayMs(0, 1.1)).toThrow('randomFraction');
    expect(() => integrationRetryDelayMs(-1, 0.5)).toThrow('attempt');
  });

  it('requires both provider and tenant partitions for future fair queues', () => {
    expect(
      validateIntegrationQueuePartition({
        providerPartition: 'DIADOC',
        tenantPartition: 'tenant-1',
        priorityClass: 'BUSINESS',
      }),
    ).toEqual({
      providerPartition: 'DIADOC',
      tenantPartition: 'tenant-1',
      priorityClass: 'BUSINESS',
    });

    expect(() =>
      validateIntegrationQueuePartition({
        providerPartition: '',
        tenantPartition: 'tenant-1',
        priorityClass: 'BUSINESS',
      }),
    ).toThrow('providerPartition is required');
  });
});
