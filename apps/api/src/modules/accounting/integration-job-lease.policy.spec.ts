import { TextEncoder } from 'node:util';
import { integrationPayloadHash } from './integration-command.policy';
import {
  IntegrationJobConnectorResult,
  IntegrationJobLeasePolicyError,
  acknowledgeIntegrationJobLease,
  integrationJobLeaseExpiryDisposition,
  issueIntegrationJobLease,
  recordIntegrationJobTerminalResult,
  terminalResultRequiresReconciliation,
  verifyIntegrationJobLease,
  type IntegrationJobLeaseScope,
} from './integration-job-lease.policy';

const now = new Date('2026-08-18T18:00:00Z');
const bytes = (value: string) => new TextEncoder().encode(value);

const envelope = () => ({
  idempotencyKey: 'idem-job-1',
  correlationId: 'corr-job-1',
  organizationId: 'org-a',
  connectionId: 'conn-a',
  externalId: null,
  payloadHash: integrationPayloadHash(bytes('{"documentId":"doc-1"}')),
  revision: 7,
  attempt: 2,
});

const scope = (
  overrides: Partial<IntegrationJobLeaseScope> = {},
): IntegrationJobLeaseScope => ({
  tenantPartition: 'tenant-a',
  providerPartition: 'ONE_C',
  organizationId: 'org-a',
  connectionId: 'conn-a',
  credentialId: 'credential-a',
  ...overrides,
});

describe('IntegrationJob pull lease contract', () => {
  it('returns a random bearer once and keeps plaintext out of persistent shape', () => {
    const issued = issueIntegrationJobLease('job-1', envelope(), scope(), now, 60_000);
    const secret = issued.bearer.slice(issued.bearer.indexOf('.') + 1);

    expect(issued.bearer).toMatch(/^[^.]+\.[A-Za-z0-9_-]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(40);
    expect(issued.record.bearerHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(issued.record)).not.toContain(secret);
  });

  it('copies command idempotency/correlation/hash/revision/attempt into the lease authority', () => {
    const issued = issueIntegrationJobLease('job-1', envelope(), scope(), now);
    expect(issued.record).toMatchObject({
      jobId: 'job-1',
      idempotencyKey: 'idem-job-1',
      correlationId: 'corr-job-1',
      revision: 7,
      attempt: 2,
    });
    expect(issued.record.payloadHash).toBe(envelope().payloadHash);
  });

  it('refuses to lease a job to another organization or connection', () => {
    expect(() =>
      issueIntegrationJobLease(
        'job-1',
        envelope(),
        scope({ organizationId: 'org-b' }),
        now,
      ),
    ).toThrow('lease organization must equal command organization');

    expect(() =>
      issueIntegrationJobLease(
        'job-1',
        envelope(),
        scope({ connectionId: 'conn-b' }),
        now,
      ),
    ).toThrow('lease connection must equal command connection');
  });

  it.each([
    ['tenantPartition', { tenantPartition: 'tenant-b' }],
    ['providerPartition', { providerPartition: 'EDO' }],
    ['organizationId', { organizationId: 'org-b' }],
    ['connectionId', { connectionId: 'conn-b' }],
    ['credentialId', { credentialId: 'credential-b' }],
  ] as const)('denies cross-scope bearer use by %s', (_field, override) => {
    const issued = issueIntegrationJobLease('job-1', envelope(), scope(), now);
    expect(
      verifyIntegrationJobLease(
        issued.record,
        issued.bearer,
        scope(override),
        new Date('2026-08-18T18:00:30Z'),
      ),
    ).toEqual({ authorized: false, reason: 'SCOPE_MISMATCH' });
  });

  it('denies a copied or guessed secret', () => {
    const issued = issueIntegrationJobLease('job-1', envelope(), scope(), now);
    const wrong = `${issued.record.leaseId}.${'x'.repeat(43)}`;
    expect(
      verifyIntegrationJobLease(
        issued.record,
        wrong,
        scope(),
        new Date('2026-08-18T18:00:30Z'),
      ),
    ).toEqual({ authorized: false, reason: 'SECRET_MISMATCH' });
  });

  it('denies at the expiry boundary', () => {
    const issued = issueIntegrationJobLease('job-1', envelope(), scope(), now, 60_000);
    expect(
      verifyIntegrationJobLease(
        issued.record,
        issued.bearer,
        scope(),
        new Date('2026-08-18T18:01:00Z'),
      ),
    ).toEqual({ authorized: false, reason: 'EXPIRED' });
  });

  it('ACK is idempotent while a lease is active', () => {
    const issued = issueIntegrationJobLease('job-1', envelope(), scope(), now, 60_000);
    const acknowledged = acknowledgeIntegrationJobLease(
      issued.record,
      new Date('2026-08-18T18:00:10Z'),
    );
    expect(acknowledged.acknowledgedAt).toEqual(
      new Date('2026-08-18T18:00:10Z'),
    );
    expect(
      acknowledgeIntegrationJobLease(
        acknowledged,
        new Date('2026-08-18T18:00:20Z'),
      ),
    ).toBe(acknowledged);
  });

  it('does not accept ACK or result after lease expiry', () => {
    const issued = issueIntegrationJobLease('job-1', envelope(), scope(), now, 60_000);
    expect(() =>
      acknowledgeIntegrationJobLease(
        issued.record,
        new Date('2026-08-18T18:01:00Z'),
      ),
    ).toThrow('expired lease cannot accept acknowledgement or result');

    expect(() =>
      recordIntegrationJobTerminalResult(
        issued.record,
        {
          result: IntegrationJobConnectorResult.BUSINESS_REJECTION,
          code: 'ONE_C_PERIOD_CLOSED',
        },
        new Date('2026-08-18T18:01:00Z'),
      ),
    ).toThrow('expired lease cannot accept acknowledgement or result');
  });

  it('records one terminal connector report only', () => {
    const issued = issueIntegrationJobLease('job-1', envelope(), scope(), now);
    const terminal = recordIntegrationJobTerminalResult(
      issued.record,
      {
        result: IntegrationJobConnectorResult.REPORTED_SUCCESS,
        code: 'ONE_C_DRAFT_CREATED',
        externalEvidenceId: '1c-doc-guid-1',
      },
      new Date('2026-08-18T18:00:20Z'),
    );

    expect(terminal.terminalResult).toBe('REPORTED_SUCCESS');
    expect(terminal.externalEvidenceId).toBe('1c-doc-guid-1');
    expect(() =>
      recordIntegrationJobTerminalResult(
        terminal,
        {
          result: IntegrationJobConnectorResult.BUSINESS_REJECTION,
          code: 'ONE_C_REJECTED',
        },
        new Date('2026-08-18T18:00:30Z'),
      ),
    ).toThrow('lease already has a terminal result');
  });

  it('requires an external evidence identifier for connector-reported success', () => {
    const issued = issueIntegrationJobLease('job-1', envelope(), scope(), now);
    expect(() =>
      recordIntegrationJobTerminalResult(
        issued.record,
        {
          result: IntegrationJobConnectorResult.REPORTED_SUCCESS,
          code: 'ONE_C_DRAFT_CREATED',
        },
        new Date('2026-08-18T18:00:20Z'),
      ),
    ).toThrow('REPORTED_SUCCESS requires an external evidence identifier');
  });

  it('requires bounded machine-safe result codes, not secret-bearing free text', () => {
    const issued = issueIntegrationJobLease('job-1', envelope(), scope(), now);
    expect(() =>
      recordIntegrationJobTerminalResult(
        issued.record,
        {
          result: IntegrationJobConnectorResult.BUSINESS_REJECTION,
          code: 'password=secret value',
        },
        new Date('2026-08-18T18:00:20Z'),
      ),
    ).toThrow('code must be a bounded machine-safe code');
  });

  it('treats an expired delivered lease as reconciliation-required, not auto-requeue', () => {
    const issued = issueIntegrationJobLease('job-1', envelope(), scope(), now, 60_000);
    expect(
      integrationJobLeaseExpiryDisposition(
        issued.record,
        new Date('2026-08-18T18:00:30Z'),
      ),
    ).toBe('ACTIVE');
    expect(
      integrationJobLeaseExpiryDisposition(
        issued.record,
        new Date('2026-08-18T18:01:00Z'),
      ),
    ).toBe('RECONCILIATION_REQUIRED');
  });

  it('keeps UNKNOWN_RESULT explicitly reconciliation-required', () => {
    expect(
      terminalResultRequiresReconciliation(
        IntegrationJobConnectorResult.UNKNOWN_RESULT,
      ),
    ).toBe(true);
    expect(
      terminalResultRequiresReconciliation(
        IntegrationJobConnectorResult.BUSINESS_REJECTION,
      ),
    ).toBe(false);
  });

  it('bounds lease TTL so an abandoned machine lease cannot live indefinitely', () => {
    expect(() =>
      issueIntegrationJobLease('job-1', envelope(), scope(), now, 999),
    ).toThrow(IntegrationJobLeasePolicyError);
    expect(() =>
      issueIntegrationJobLease(
        'job-1',
        envelope(),
        scope(),
        now,
        16 * 60 * 1_000,
      ),
    ).toThrow('lease TTL');
  });
});
