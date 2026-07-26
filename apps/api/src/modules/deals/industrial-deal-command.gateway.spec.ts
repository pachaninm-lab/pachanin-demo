import { ForbiddenException } from '@nestjs/common';
import { Role, type RequestUser } from '../../common/types/request-user';
import { CANONICAL_TEST_DEAL_ID } from './deal-command.policy';
import { IndustrialDealCommandGateway } from './industrial-deal-command.gateway';

const DEAL = {
  id: CANONICAL_TEST_DEAL_ID,
  tenantId: 'tenant-canonical-test',
  sellerOrgId: 'org-canonical-seller',
  buyerOrgId: 'org-canonical-buyer',
  status: 'RESERVE_REQUESTED',
  updatedAt: new Date('2026-07-10T09:00:00.000Z'),
  totalKopecks: 240_000_000,
};

const BUYER: RequestUser = {
  id: 'user-buyer-001',
  email: 'buyer@demo.ru',
  role: Role.BUYER,
  orgId: 'untrusted-token-org',
  tenantId: DEAL.tenantId,
  sessionId: 'session-buyer-001',
};

const SUCCESS_CALLBACK = {
  dealId: CANONICAL_TEST_DEAL_ID,
  eventId: 'bank-event-0001',
  operation: 'RESERVE' as const,
  operationId: `bank-reserve:${CANONICAL_TEST_DEAL_ID}`,
  status: 'SUCCESS' as const,
  bankRef: 'BANK-RESERVE-0001',
  partnerId: 'safe-deals-test',
};

/** Rows shaped like the gateway's select list — nothing the whitelist excludes. */
function outboxRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `obx-${index}`,
    type: 'DEAL_CONFIRMED',
    status: 'SENT',
    retryCount: 0,
    maxRetries: 5,
    createdAt: new Date('2026-07-19T02:00:00.000Z'),
    sentAt: new Date('2026-07-19T02:00:01.000Z'),
    confirmedAt: null,
    failedAt: null,
    deadLetterAt: null,
    nextRetryAt: new Date('2026-07-19T02:00:00.000Z'),
  }));
}

function fixture() {
  const tx = {
    dealParticipant: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'participant-buyer-001',
        accessLevel: 'WORK',
        status: 'ACTIVE',
      }),
    },
    organization: {
      findFirst: jest.fn().mockResolvedValue({
        id: DEAL.buyerOrgId,
        tenantId: DEAL.tenantId,
        status: 'VERIFIED',
      }),
    },
    deal: {
      findUnique: jest.fn().mockResolvedValue(DEAL),
    },
    outboxEntry: {
      findMany: jest.fn().mockResolvedValue(outboxRows(3)),
      groupBy: jest.fn().mockResolvedValue([{ status: 'SENT', _count: { _all: 3 } }]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
  const prisma = {
    userOrg: {
      findMany: jest.fn().mockResolvedValue([
        {
          userId: BUYER.id,
          organizationId: DEAL.buyerOrgId,
          role: Role.BUYER,
          isDefault: true,
        },
      ]),
    },
    // Bank-callback scope resolution: the SECURITY DEFINER binding
    // (dealId, operationId) → (tenant, buyer org) replaces hardcoded values.
    $queryRaw: jest.fn().mockResolvedValue([
      { tenantId: DEAL.tenantId, buyerOrgId: DEAL.buyerOrgId },
    ]),
  } as any;
  const rls = {
    withTrustedContext: jest.fn(async (_user: RequestUser, work: (client: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
  } as any;
  const commands = {
    workspace: jest.fn().mockResolvedValue({ ok: true }),
    execute: jest.fn(async (_dealId: string, actionId: string, dto: { commandId: string; idempotencyKey: string }) => ({
      ok: true,
      duplicate: false,
      actionId,
      commandId: dto.commandId,
      idempotencyKey: dto.idempotencyKey,
      eventId: 'event-001',
      auditId: 'audit-001',
      status: actionId === 'confirm_reserve' ? 'RESERVED' : 'AUCTION_COMPLETED',
      updatedAt: '2026-07-10T09:01:00.000Z',
    })),
  } as any;
  return {
    tx,
    prisma,
    rls,
    commands,
    gateway: new IndustrialDealCommandGateway(prisma, rls, commands),
  };
}

describe('IndustrialDealCommandGateway', () => {
  it('derives tenant, organization and role from DB membership plus active DealParticipant', async () => {
    const test = fixture();

    await test.gateway.workspace(CANONICAL_TEST_DEAL_ID, BUYER);

    expect(test.tx.dealParticipant.findFirst).toHaveBeenCalledWith({
      where: {
        dealId: CANONICAL_TEST_DEAL_ID,
        tenantId: DEAL.tenantId,
        organizationId: DEAL.buyerOrgId,
        userId: BUYER.id,
        role: Role.BUYER,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        accessLevel: true,
        status: true,
      },
    });
    expect(test.commands.workspace).toHaveBeenCalledWith(
      CANONICAL_TEST_DEAL_ID,
      expect.objectContaining({
        id: BUYER.id,
        role: Role.BUYER,
        orgId: DEAL.buyerOrgId,
        tenantId: DEAL.tenantId,
      }),
    );
  });

  it('fails closed when the user has no active DealParticipant assignment', async () => {
    const test = fixture();
    test.tx.dealParticipant.findFirst.mockResolvedValueOnce(null);

    await expect(test.gateway.workspace(CANONICAL_TEST_DEAL_ID, BUYER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(test.commands.workspace).not.toHaveBeenCalled();
  });

  it('fails closed when verified session tenant is absent', async () => {
    const test = fixture();
    const withoutTenant = { ...BUYER, tenantId: undefined };

    await expect(test.gateway.workspace(CANONICAL_TEST_DEAL_ID, withoutTenant)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(test.prisma.userOrg.findMany).not.toHaveBeenCalled();
  });

  it('rejects a human request to confirm reserve or release before any command write', async () => {
    const test = fixture();
    const dto = {
      commandId: 'human-bank-confirmation',
      idempotencyKey: 'human-bank-confirmation',
      expectedUpdatedAt: DEAL.updatedAt.toISOString(),
      payload: { bankRef: 'forged-reference' },
    };

    await expect(
      test.gateway.executeUser(CANONICAL_TEST_DEAL_ID, 'confirm_reserve', dto, BUYER),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'BANK_CALLBACK_REQUIRED' }),
    });
    expect(test.prisma.userOrg.findMany).not.toHaveBeenCalled();
    expect(test.commands.execute).not.toHaveBeenCalled();
  });

  it('passes a deterministic full-command fingerprint into the trusted command service', async () => {
    const test = fixture();
    const dto = {
      commandId: 'command-001',
      idempotencyKey: 'client-key-001',
      expectedUpdatedAt: DEAL.updatedAt.toISOString(),
      payload: { amount: 100, nested: { b: 2, a: 1 } },
    };

    await test.gateway.executeUser(
      CANONICAL_TEST_DEAL_ID,
      'place_winning_bid',
      dto,
      BUYER,
    );

    expect(test.commands.execute).toHaveBeenCalledTimes(1);
    const [, , forwardedDto, forwardedUser] = test.commands.execute.mock.calls[0];
    expect(forwardedDto.idempotencyKey).toMatch(/^fp:[a-f0-9]{64}$/);
    expect(forwardedDto.payload).toMatchObject({
      amount: 100,
      nested: { b: 2, a: 1 },
      clientIdempotencyKey: 'client-key-001',
      requestFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(forwardedUser).toMatchObject({
      orgId: DEAL.buyerOrgId,
      tenantId: DEAL.tenantId,
    });
    expect(test.prisma).not.toHaveProperty('outboxEntry');
  });

  it('uses stable verified partner plus event identity for successful money callbacks', async () => {
    const test = fixture();

    await test.gateway.executeBankCallback(SUCCESS_CALLBACK);

    expect(test.rls.withTrustedContext).toHaveBeenCalledWith(
      expect.objectContaining({
        role: Role.BANK_CALLBACK,
        tenantId: DEAL.tenantId,
        orgId: DEAL.buyerOrgId,
      }),
      expect.any(Function),
    );
    expect(test.commands.execute).toHaveBeenCalledWith(
      CANONICAL_TEST_DEAL_ID,
      'confirm_reserve',
      expect.objectContaining({
        commandId: expect.stringMatching(/^bank-callback:safe-deals-test:bank-event-0001:[a-f0-9]{64}$/),
        idempotencyKey: 'bank-callback:safe-deals-test:bank-event-0001',
        payload: expect.objectContaining({
          operationId: `bank-reserve:${CANONICAL_TEST_DEAL_ID}`,
          bankRef: 'BANK-RESERVE-0001',
          partnerId: 'safe-deals-test',
          requestFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
          clientIdempotencyKey: 'bank-callback:safe-deals-test:bank-event-0001',
        }),
      }),
      expect.objectContaining({
        role: Role.BANK_CALLBACK,
        tenantId: DEAL.tenantId,
        orgId: DEAL.buyerOrgId,
      }),
    );
  });

  it('keeps event identity stable after deal version changes and rejects material replay mismatch', async () => {
    const test = fixture();

    const first = await test.gateway.executeBankCallback(SUCCESS_CALLBACK);
    const firstDto = test.commands.execute.mock.calls[0][2];

    test.tx.deal.findUnique.mockResolvedValueOnce({
      ...DEAL,
      status: 'RESERVED',
      updatedAt: new Date('2026-07-10T09:02:00.000Z'),
    });
    test.commands.execute.mockResolvedValueOnce({ ...first, duplicate: true });
    await expect(test.gateway.executeBankCallback(SUCCESS_CALLBACK)).resolves.toMatchObject({
      duplicate: true,
      commandId: firstDto.commandId,
    });
    const repeatedDto = test.commands.execute.mock.calls[1][2];
    expect(repeatedDto.idempotencyKey).toBe(firstDto.idempotencyKey);
    expect(repeatedDto.commandId).toBe(firstDto.commandId);
    expect(repeatedDto.expectedUpdatedAt).not.toBe(firstDto.expectedUpdatedAt);

    test.tx.deal.findUnique.mockResolvedValueOnce({
      ...DEAL,
      status: 'RESERVED',
      updatedAt: new Date('2026-07-10T09:03:00.000Z'),
    });
    test.commands.execute.mockResolvedValueOnce({ ...first, duplicate: true });
    await expect(
      test.gateway.executeBankCallback({
        ...SUCCESS_CALLBACK,
        bankRef: 'BANK-RESERVE-CHANGED',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'BANK_EVENT_REPLAY_MISMATCH' }),
    });
  });

  describe('integrationStatus', () => {
    it('proves membership before reading and reads inside the trusted RLS context', async () => {
      const test = fixture();

      await test.gateway.integrationStatus(CANONICAL_TEST_DEAL_ID, BUYER);

      expect(test.tx.dealParticipant.findFirst).toHaveBeenCalled();
      expect(test.rls.withTrustedContext).toHaveBeenCalledWith(
        expect.objectContaining({
          id: BUYER.id,
          role: Role.BUYER,
          orgId: DEAL.buyerOrgId,
          tenantId: DEAL.tenantId,
        }),
        expect.any(Function),
      );
      expect(test.tx.outboxEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
      );
    });

    it('reads all three queries from one snapshot', async () => {
      // At READ COMMITTED each statement takes its own snapshot, so a worker committing
      // between them can produce a response that lists a PENDING entry while the counts
      // report none. The answer has to be internally consistent to be worth relaying.
      const test = fixture();

      await test.gateway.integrationStatus(CANONICAL_TEST_DEAL_ID, BUYER);

      const call = test.rls.withTrustedContext.mock.calls.at(-1);
      expect(call?.[2]).toMatchObject({ isolationLevel: 'RepeatableRead' });
    });

    it('never reads the payload, the failure text, the lease or the triggering user', async () => {
      const test = fixture();

      await test.gateway.integrationStatus(CANONICAL_TEST_DEAL_ID, BUYER);

      const [{ select }] = test.tx.outboxEntry.findMany.mock.calls[0];
      for (const column of [
        'payload',
        'lastError',
        'leaseOwner',
        'leaseToken',
        'leaseExpiresAt',
        'idempotencyKey',
        'triggeredByUserId',
        'correlationId',
        'runtimeSnapshotId',
      ]) {
        expect(select).not.toHaveProperty(column);
      }
    });

    it('fails closed without an active DealParticipant, before any outbox read', async () => {
      const test = fixture();
      test.tx.dealParticipant.findFirst.mockResolvedValueOnce(null);

      await expect(
        test.gateway.integrationStatus(CANONICAL_TEST_DEAL_ID, BUYER),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(test.tx.outboxEntry.findMany).not.toHaveBeenCalled();
      expect(test.tx.outboxEntry.groupBy).not.toHaveBeenCalled();
    });

    it('bounds the entry list and says so', async () => {
      const test = fixture();
      test.tx.outboxEntry.findMany.mockResolvedValueOnce(outboxRows(101));

      const result = await test.gateway.integrationStatus(CANONICAL_TEST_DEAL_ID, BUYER);

      expect(result.entries).toHaveLength(100);
      expect(result.returnedCount).toBe(100);
      expect(result.truncated).toBe(true);
    });

    it('counts across the whole deal, not the page it returned', async () => {
      // The first version derived both counts from the returned slice. A deal whose dead
      // letters are older than its hundred most recent rows would then report zero of
      // them — a clean answer to the one question worth asking here, and a wrong one.
      const test = fixture();
      test.tx.outboxEntry.findMany.mockResolvedValueOnce(outboxRows(101));
      test.tx.outboxEntry.groupBy.mockResolvedValueOnce([
        { status: 'SENT', _count: { _all: 240 } },
        { status: 'DEAD_LETTER', _count: { _all: 10 } },
      ]);
      test.tx.outboxEntry.count.mockResolvedValueOnce(10);

      const result = await test.gateway.integrationStatus(CANONICAL_TEST_DEAL_ID, BUYER);

      expect(result.countsByStatus).toEqual({ SENT: 240, DEAD_LETTER: 10 });
      expect(result.deadLetterCount).toBe(10);
      expect(result.entries.every((entry) => entry.deadLetterAt === null)).toBe(true);
    });

    it('renders timestamps as ISO strings or null, not Date objects', async () => {
      const test = fixture();

      const result = await test.gateway.integrationStatus(CANONICAL_TEST_DEAL_ID, BUYER);

      expect(result.entries[0]).toMatchObject({
        createdAt: '2026-07-19T02:00:00.000Z',
        sentAt: '2026-07-19T02:00:01.000Z',
        confirmedAt: null,
        deadLetterAt: null,
      });
    });
  });
});
