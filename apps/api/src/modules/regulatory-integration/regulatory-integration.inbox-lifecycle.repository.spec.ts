import type { Prisma } from '@prisma/client';
import { Role, type RequestUser } from '../../common/types/request-user';
import type {
  RlsTransactionService,
  TrustedRlsContext,
} from '../../common/prisma/rls-transaction.service';
import { StaffRole } from '../staff-access/staff-access.types';
import {
  RegulatoryInboxLifecycleError,
  RegulatoryIntegrationInboxLifecycleRepository,
} from './regulatory-integration.inbox-lifecycle.repository';
import type { RegulatoryVerificationResult } from './regulatory-integration.types';

const CONTEXT: TrustedRlsContext = Object.freeze({
  userId: 'user-1',
  orgId: 'org-1',
  tenantId: 'tenant-1',
  role: Role.ADMIN,
  sessionId: 'session-1',
});

const REDRIVE_USER: RequestUser = {
  id: 'user-1',
  orgId: 'org-1',
  tenantId: 'tenant-1',
  role: Role.ADMIN,
  email: 'admin@example.test',
  sessionId: 'session-1',
  membershipId: 'membership-1',
  mfaVerified: true,
  staffRoles: [StaffRole.PLATFORM_ADMIN],
};

const VERIFIED: RegulatoryVerificationResult = {
  verified: true,
  verifiedAt: '2026-07-23T10:00:00.000Z',
  schemaVersion: '1.0.23',
  mappingVersion: '1.0.23',
  signatureKeyReference: 'key-ref',
};

function harness() {
  const tx = {
    $queryRaw: jest.fn(),
  } as unknown as Prisma.TransactionClient;
  const withTrustedContext = jest.fn(
    async <T>(
      _user: unknown,
      work: (
        transaction: Prisma.TransactionClient,
        context: TrustedRlsContext,
      ) => Promise<T>,
    ): Promise<T> => work(tx, CONTEXT),
  );
  const repository = new RegulatoryIntegrationInboxLifecycleRepository({
    withTrustedContext,
  } as unknown as RlsTransactionService);

  return {
    repository,
    withTrustedContext,
    queryRaw: (tx as Prisma.TransactionClient & {
      $queryRaw: jest.Mock;
    }).$queryRaw,
  };
}

describe('RegulatoryIntegrationInboxLifecycleRepository', () => {
  it('persists a successful verification as VERIFIED', async () => {
    const { repository, queryRaw } = harness();
    queryRaw.mockResolvedValueOnce([{
      id: 'inbox-1',
      state: 'VERIFIED',
      verificationResult: VERIFIED,
    }]);

    await expect(
      repository.recordVerification(undefined, 'inbox-1', VERIFIED),
    ).resolves.toEqual({ kind: 'APPLIED', entryId: 'inbox-1' });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns deterministic replay for the same verification result', async () => {
    const { repository, queryRaw } = harness();
    queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'inbox-1',
        state: 'VERIFIED',
        verificationResult: {
          signatureKeyReference: 'key-ref',
          mappingVersion: '1.0.23',
          verifiedAt: '2026-07-23T10:00:00.000Z',
          verified: true,
          schemaVersion: '1.0.23',
        },
      }]);

    await expect(
      repository.recordVerification(undefined, 'inbox-1', VERIFIED),
    ).resolves.toEqual({ kind: 'REPLAY', entryId: 'inbox-1' });
  });

  it('quarantines a failed signature verification', async () => {
    const { repository, queryRaw } = harness();
    const failed: RegulatoryVerificationResult = {
      verified: false,
      verifiedAt: '2026-07-23T10:00:00.000Z',
      errorCode: 'SIGNATURE_INVALID',
    };
    queryRaw.mockResolvedValueOnce([{
      id: 'inbox-1',
      state: 'QUARANTINED',
      verificationResult: failed,
    }]);

    await expect(
      repository.recordVerification(undefined, 'inbox-1', failed),
    ).resolves.toEqual({ kind: 'APPLIED', entryId: 'inbox-1' });
  });

  it('records provider ACK exactly once', async () => {
    const { repository, queryRaw } = harness();
    queryRaw
      .mockResolvedValueOnce([{
        id: 'inbox-1',
        providerAcknowledgedAt: null,
      }])
      .mockResolvedValueOnce([{
        id: 'inbox-1',
        providerAcknowledgedAt: new Date('2026-07-23T10:00:01.000Z'),
      }]);

    await expect(
      repository.markProviderAcknowledged(undefined, 'inbox-1'),
    ).resolves.toEqual({ kind: 'APPLIED', entryId: 'inbox-1' });
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it('returns replay when provider ACK already exists', async () => {
    const { repository, queryRaw } = harness();
    queryRaw.mockResolvedValueOnce([{
      id: 'inbox-1',
      providerAcknowledgedAt: new Date('2026-07-23T10:00:01.000Z'),
    }]);

    await expect(
      repository.markProviderAcknowledged(undefined, 'inbox-1'),
    ).resolves.toEqual({ kind: 'REPLAY', entryId: 'inbox-1' });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('persists governed redrive, immutable audit and canonical outbox atomically', async () => {
    const { repository, queryRaw } = harness();
    queryRaw
      .mockResolvedValueOnce([{ locked: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'inbox-1',
        state: 'DEAD',
        attempts: 5,
        version: 7n,
      }])
      .mockResolvedValueOnce([{ hash: 'a'.repeat(64) }])
      .mockImplementationOnce(async (query: Prisma.Sql) => [{
        id: query.values[0],
      }])
      .mockImplementationOnce(async (query: Prisma.Sql) => [{
        id: query.values[0],
      }])
      .mockResolvedValueOnce([{ id: 'inbox-1' }]);

    await expect(repository.redrive(REDRIVE_USER, {
      entryId: 'inbox-1',
      reason: 'Повторная обработка после устранения ошибки подписи',
      idempotencyKey: 'redrive-command-1',
      correlationId: 'correlation-1',
    })).resolves.toEqual(expect.objectContaining({
      kind: 'APPLIED',
      entryId: 'inbox-1',
      correlationId: 'correlation-1',
      outboxEntryId: expect.any(String),
      auditEventId: expect.any(String),
    }));
    expect(queryRaw).toHaveBeenCalledTimes(7);
  });

  it('returns deterministic replay without mutating the inbox again', async () => {
    const { repository, queryRaw } = harness();
    queryRaw
      .mockResolvedValueOnce([{ locked: null }])
      .mockResolvedValueOnce([{
        id: 'outbox-1',
        payload: {
          inboxEntryId: 'inbox-1',
          tenantId: 'tenant-1',
          organizationId: 'org-1',
        },
        correlationId: 'correlation-1',
      }])
      .mockResolvedValueOnce([{
        id: 'audit-1',
        reason: 'Повторная обработка после устранения ошибки подписи',
        objectId: 'inbox-1',
      }]);

    await expect(repository.redrive(REDRIVE_USER, {
      entryId: 'inbox-1',
      reason: 'Повторная обработка после устранения ошибки подписи',
      idempotencyKey: 'redrive-command-1',
      correlationId: 'correlation-retry',
    })).resolves.toEqual({
      kind: 'REPLAY',
      entryId: 'inbox-1',
      outboxEntryId: 'outbox-1',
      auditEventId: 'audit-1',
      correlationId: 'correlation-1',
    });
    expect(queryRaw).toHaveBeenCalledTimes(3);
  });

  it('fails closed when a redrive key is rebound to another inbox identity', async () => {
    const { repository, queryRaw } = harness();
    queryRaw
      .mockResolvedValueOnce([{ locked: null }])
      .mockResolvedValueOnce([{
        id: 'outbox-1',
        payload: {
          inboxEntryId: 'inbox-2',
          tenantId: 'tenant-1',
          organizationId: 'org-1',
        },
        correlationId: 'correlation-1',
      }]);

    await expect(repository.redrive(REDRIVE_USER, {
      entryId: 'inbox-1',
      reason: 'Повторная обработка после устранения ошибки подписи',
      idempotencyKey: 'redrive-command-1',
      correlationId: 'correlation-1',
    })).rejects.toThrow('already bound to another inbox identity');
  });

  it('rejects redrive from a non-terminal inbox state', async () => {
    const { repository, queryRaw } = harness();
    queryRaw
      .mockResolvedValueOnce([{ locked: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'inbox-1',
        state: 'PROCESSED',
        attempts: 1,
        version: 3n,
      }]);

    await expect(repository.redrive(REDRIVE_USER, {
      entryId: 'inbox-1',
      reason: 'Повторная обработка после устранения ошибки подписи',
      idempotencyKey: 'redrive-command-1',
      correlationId: 'correlation-1',
    })).rejects.toThrow('cannot be redriven from state PROCESSED');
  });

  it('rejects redrive before PostgreSQL when staff authority is absent', async () => {
    const { repository, withTrustedContext } = harness();

    await expect(repository.redrive({
      ...REDRIVE_USER,
      staffRoles: [],
    }, {
      entryId: 'inbox-1',
      reason: 'Повторная обработка после устранения ошибки подписи',
      idempotencyKey: 'redrive-command-1',
      correlationId: 'correlation-1',
    })).rejects.toThrow('staff authority is required');
    expect(withTrustedContext).not.toHaveBeenCalled();
  });

  it('fails closed when the row is outside the trusted scope', async () => {
    const { repository, queryRaw } = harness();
    queryRaw.mockResolvedValueOnce([]);

    await expect(
      repository.markProviderAcknowledged(undefined, 'inbox-1'),
    ).rejects.toBeInstanceOf(RegulatoryInboxLifecycleError);
  });

  it('rejects malformed verification timestamps before PostgreSQL', async () => {
    const { repository, withTrustedContext } = harness();
    const malformed: RegulatoryVerificationResult = {
      verified: false,
      verifiedAt: 'not-a-date',
      errorCode: 'SIGNATURE_INVALID',
    };

    await expect(
      repository.recordVerification(undefined, 'inbox-1', malformed),
    ).rejects.toThrow('valid verifiedAt timestamp');
    expect(withTrustedContext).not.toHaveBeenCalled();
  });
});
