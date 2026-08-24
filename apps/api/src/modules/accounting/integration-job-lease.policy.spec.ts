import { integrationPayloadHash } from './integration-command.policy';
import {
  IntegrationJobConnectorResult,
  integrationJobLeaseExpiryDisposition,
  issueIntegrationJobLease,
  verifyIntegrationJobLease,
} from './integration-job-lease.policy';

describe('integration job lease policy', () => {
  const now = new Date('2026-08-24T12:00:00Z');
  const envelope = {
    idempotencyKey: 'idem-1', correlationId: 'corr-1', organizationId: 'org-1',
    connectionId: 'binding-1', externalId: null,
    payloadHash: integrationPayloadHash(Buffer.from('{}')), revision: 1, attempt: 1,
  };
  const scope = {
    tenantPartition: 'tenant-1', providerPartition: 'ONE_C', organizationId: 'org-1',
    connectionId: 'binding-1', credentialId: 'credential-1',
  } as const;

  it('returns plaintext once and persists only a salted verifier', () => {
    const issue = issueIntegrationJobLease('job-1', envelope, scope, now, 60_000);
    expect(issue.bearer).toMatch(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/i);
    expect(issue.record.bearerHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(issue.record)).not.toContain(issue.bearer.split('.')[1]);
    expect(verifyIntegrationJobLease(issue.record, issue.bearer, scope, new Date(now.getTime() + 1_000)))
      .toMatchObject({ authorized: true });
  });

  it('rejects cross-scope, guessed and expired leases', () => {
    const issue = issueIntegrationJobLease('job-1', envelope, scope, now, 60_000);
    expect(verifyIntegrationJobLease(issue.record, issue.bearer, { ...scope, organizationId: 'org-2' }, now))
      .toEqual({ authorized: false, reason: 'SCOPE_MISMATCH' });
    expect(verifyIntegrationJobLease(issue.record, `${issue.record.leaseId}.${'x'.repeat(43)}`, scope, now))
      .toEqual({ authorized: false, reason: 'SECRET_MISMATCH' });
    expect(integrationJobLeaseExpiryDisposition(issue.record, new Date(now.getTime() + 60_000)))
      .toBe('RECONCILIATION_REQUIRED');
  });

  it('keeps the terminal vocabulary bounded', () => {
    expect(Object.values(IntegrationJobConnectorResult)).toEqual([
      'REPORTED_SUCCESS', 'BUSINESS_REJECTION', 'UNKNOWN_RESULT',
    ]);
  });
});
