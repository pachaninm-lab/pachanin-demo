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
    // Два SECURITY DEFINER-запроса идут через $queryRaw:
    //  • dealx.participant_tenant → { tenant } (кросс-tenant исполнение);
    //  • bank-callback binding (dealId, operationId) → { tenantId, buyerOrgId }.
    // Один мок покрывает оба, возвращая совокупную форму.
    $queryRaw: jest.fn().mockResolvedValue([
      { tenant: DEAL.tenantId, tenantId: DEAL.tenantId, buyerOrgId: DEAL.buyerOrgId },
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
});
