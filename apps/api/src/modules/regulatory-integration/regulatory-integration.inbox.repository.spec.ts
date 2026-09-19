import type { Prisma } from '@prisma/client';
import type {
  RlsTransactionService,
  TrustedRlsContext,
} from '../../common/prisma/rls-transaction.service';
import {
  RegulatoryInboxRepositoryError,
  RegulatoryIntegrationInboxRepository,
  type RegulatoryInboxReceiveCommand,
} from './regulatory-integration.inbox.repository';

const TRUSTED_CONTEXT: TrustedRlsContext = Object.freeze({
  userId: 'user-1',
  orgId: 'org-1',
  tenantId: 'tenant-1',
  role: 'OPERATOR',
  sessionId: 'session-1',
});

function command(
  rawBodySha256 = 'a'.repeat(64),
): RegulatoryInboxReceiveCommand {
  return {
    adapterIdentity: {
      adapterCode: 'fgis-grain',
      adapterVersion: '1.0.0',
      mappingVersion: '1.0.23',
      environment: 'PRE_PRODUCTION',
      capabilities: [
        'INBOUND_EVENTS',
        'SIGNATURE_VERIFICATION',
        'SCHEMA_MAPPING',
        'PROVIDER_ACKNOWLEDGEMENT',
      ],
    },
    envelope: {
      provider: 'fgis-grain',
      externalEventId: 'external-event-1',
      schemaVersion: '1.0.23',
      mappingVersion: '1.0.23',
      occurredAt: '2026-07-23T08:00:00.000Z',
      rawBodySha256,
      signature: {
        algorithm: 'GOST-2012',
        keyReference: 'key-ref',
        keyVersion: '7',
        signatureVersion: '1',
        verificationPolicyVersion: '2026-07',
      },
      correlationId: 'correlation-1',
      causationId: null,
    },
    evidenceReference: 'evidence://regulatory/event-1',
    verificationResult: {
      verified: true,
      verifiedAt: '2026-07-23T08:00:01.000Z',
      schemaVersion: '1.0.23',
      mappingVersion: '1.0.23',
      signatureKeyReference: 'key-ref',
    },
  };
}

function harness() {
  const tx = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  } as unknown as Prisma.TransactionClient;
  const withTrustedContext = jest.fn(
    async <T>(
      _user: unknown,
      work: (
        transaction: Prisma.TransactionClient,
        context: TrustedRlsContext,
      ) => Promise<T>,
    ): Promise<T> => work(tx, TRUSTED_CONTEXT),
  );
  const transactions = {
    withTrustedContext,
  } as unknown as RlsTransactionService;

  return {
    tx: tx as Prisma.TransactionClient & {
      $queryRaw: jest.Mock;
      $executeRaw: jest.Mock;
    },
    withTrustedContext,
    repository: new RegulatoryIntegrationInboxRepository(transactions),
  };
}

describe('RegulatoryIntegrationInboxRepository', () => {
  it('returns ACK eligibility only after a durable insert transaction resolves', async () => {
    const { repository, tx, withTrustedContext } = harness();
    tx.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'inbox-1',
        rawBodySha256: 'a'.repeat(64),
        receivedAt: new Date('2026-07-23T08:00:02.000Z'),
      }]);

    await expect(repository.receive(undefined, command())).resolves.toEqual({
      kind: 'INSERTED',
      entryId: 'inbox-1',
      rawBodySha256: 'a'.repeat(64),
      receivedAt: new Date('2026-07-23T08:00:02.000Z'),
      providerAcknowledgementEligible: true,
    });
    expect(withTrustedContext).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('returns the original receipt for the same durable identity and hash', async () => {
    const { repository, tx } = harness();
    tx.$queryRaw.mockResolvedValueOnce([{
      id: 'inbox-1',
      rawBodySha256: 'a'.repeat(64),
      receivedAt: new Date('2026-07-23T08:00:02.000Z'),
    }]);

    await expect(repository.receive(undefined, command())).resolves.toMatchObject({
      kind: 'REPLAY',
      entryId: 'inbox-1',
      providerAcknowledgementEligible: true,
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('persists a security conflict and withholds ACK for a different hash', async () => {
    const { repository, tx } = harness();
    tx.$queryRaw
      .mockResolvedValueOnce([{
        id: 'inbox-1',
        rawBodySha256: 'a'.repeat(64),
        receivedAt: new Date('2026-07-23T08:00:02.000Z'),
      }])
      .mockResolvedValueOnce([{ id: 'conflict-1' }]);

    await expect(
      repository.receive(undefined, command('b'.repeat(64))),
    ).resolves.toEqual({
      kind: 'CONFLICT',
      entryId: 'inbox-1',
      conflictId: 'conflict-1',
      rawBodySha256: 'b'.repeat(64),
      providerAcknowledgementEligible: false,
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('claims only through the trusted transaction and returns lease identity', async () => {
    const { repository, tx, withTrustedContext } = harness();
    tx.$queryRaw.mockResolvedValueOnce([{
      id: 'inbox-1',
      provider: 'fgis-grain',
      externalEventId: 'external-event-1',
      schemaVersion: '1.0.23',
      mappingVersion: '1.0.23',
      rawBodySha256: 'a'.repeat(64),
      evidenceReference: 'evidence://regulatory/event-1',
      attempts: 1,
      correlationId: 'correlation-1',
      causationId: null,
      leaseOwner: 'worker-1',
      leaseExpiresAt: new Date('2026-07-23T08:01:00.000Z'),
    }]);

    await expect(
      repository.claimBatch(undefined, 'worker-1', 10, 60),
    ).resolves.toHaveLength(1);
    expect(withTrustedContext).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid payload identity before opening a transaction', async () => {
    const { repository, withTrustedContext } = harness();

    await expect(
      repository.receive(undefined, command('not-a-sha256')),
    ).rejects.toBeInstanceOf(RegulatoryInboxRepositoryError);
    expect(withTrustedContext).not.toHaveBeenCalled();
  });

  it('fails closed when a worker no longer owns the processing lease', async () => {
    const { repository, tx } = harness();
    tx.$executeRaw.mockResolvedValueOnce(0);

    await expect(
      repository.complete(undefined, 'worker-1', 'inbox-1', false),
    ).rejects.toThrow('inbox lease lost');
  });

  it('rejects invalid claim bounds without touching PostgreSQL', async () => {
    const { repository, withTrustedContext } = harness();

    await expect(
      repository.claimBatch(undefined, 'worker-1', 0, 60),
    ).rejects.toThrow('limit must be an integer between 1 and 500');
    expect(withTrustedContext).not.toHaveBeenCalled();
  });
});
