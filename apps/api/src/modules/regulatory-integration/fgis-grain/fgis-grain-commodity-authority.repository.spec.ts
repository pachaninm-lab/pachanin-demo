import { ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role, type RequestUser } from '../../../common/types/request-user';
import { FgisGrainCommodityAuthorityRepository } from './fgis-grain-commodity-authority.repository';

function user(): RequestUser {
  return {
    id: 'seller-1',
    email: 'seller@example.test',
    role: Role.FARMER,
    orgId: 'org-1',
    tenantId: 'tenant-1',
    sessionId: 'session-1',
    membershipId: 'membership-1',
  };
}

function fixture(result: unknown = {
  ok: true,
  reservationId: 'reservation-1',
  auditId: 'audit-1',
  outboxId: 'outbox-1',
  duplicate: false,
}) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ result }]),
  };
  const transactions = {
    withTrustedContext: jest.fn(async (
      actor: RequestUser,
      work: (client: typeof tx, context: Record<string, string>) => Promise<unknown>,
      options: unknown,
    ) => work(tx, {
      userId: actor.id,
      orgId: actor.orgId,
      tenantId: actor.tenantId ?? '',
      role: actor.role,
      sessionId: actor.sessionId ?? '',
      options: String(options),
    })),
  };
  return {
    tx,
    transactions,
    repository: new FgisGrainCommodityAuthorityRepository(transactions as never),
  };
}

const meta = {
  commandId: 'command-1',
  idempotencyKey: 'idem-1',
  correlationId: 'corr-1',
};

describe('FgisGrainCommodityAuthorityRepository', () => {
  it('executes volume reservation only inside a trusted SERIALIZABLE transaction', async () => {
    const { repository, transactions, tx } = fixture();
    const receipt = await repository.reserveVolume(user(), {
      ...meta,
      partyCurrentId: 'party-1',
      sourceSnapshotId: 'snapshot-1',
      volume: '100.000000',
      unit: 'TNE',
      reason: 'Confirmed seller lot draft',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      expectedPartyVersion: '1',
    });

    expect(receipt).toMatchObject({
      ok: true,
      reservationId: 'reservation-1',
      auditId: 'audit-1',
      outboxId: 'outbox-1',
      duplicate: false,
    });
    expect(transactions.withTrustedContext).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'seller-1', tenantId: 'tenant-1', orgId: 'org-1' }),
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxConflictRetries: 5,
      }),
    );
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns a durable denial receipt without converting it into client-selected authority', async () => {
    const { repository } = fixture({
      ok: false,
      code: 'FGIS_RESERVATION_EXCEEDS_AVAILABLE',
      correlationId: 'corr-denied',
      auditId: 'audit-denied',
      duplicate: false,
    });
    await expect(repository.reserveVolume(user(), {
      ...meta,
      partyCurrentId: 'party-1',
      sourceSnapshotId: 'snapshot-1',
      volume: '999.000000',
      unit: 'TNE',
      reason: 'Excess request',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      expectedPartyVersion: '1',
    })).resolves.toMatchObject({
      ok: false,
      code: 'FGIS_RESERVATION_EXCEEDS_AVAILABLE',
      auditId: 'audit-denied',
    });
  });

  it('fails closed when PostgreSQL returns no authoritative audit receipt', async () => {
    const { repository } = fixture({ ok: true, duplicate: false });
    await expect(repository.createLotPassport(user(), {
      ...meta,
      reservationId: 'reservation-1',
    })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('fails closed when PostgreSQL returns an empty result set', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const transactions = {
      withTrustedContext: jest.fn(async (_actor: RequestUser, work: (client: typeof tx) => Promise<unknown>) => work(tx)),
    };
    const repository = new FgisGrainCommodityAuthorityRepository(transactions as never);
    await expect(repository.bindConnection(user(), {
      ...meta,
      providerConfigurationId: 'configuration-1',
      expectedVersion: '0',
    })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
