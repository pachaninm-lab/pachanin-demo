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
  } as any;
  const rls = {
    withTrustedContext: jest.fn(async (_user: RequestUser, work: (client: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
  } as any;
  const commands = {
    workspace: jest.fn().mockResolvedValue({ ok: true }),
    execute: jest.fn().mockResolvedValue({
      ok: true,
      actionId: 'place_winning_bid',
      commandId: 'command-001',
    }),
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

  it('derives successful money confirmation only from the verified callback actor', async () => {
    const test = fixture();

    await test.gateway.executeBankCallback({
      dealId: CANONICAL_TEST_DEAL_ID,
      eventId: 'bank-event-0001',
      operation: 'RESERVE',
      operationId: `bank-reserve:${CANONICAL_TEST_DEAL_ID}`,
      status: 'SUCCESS',
      bankRef: 'BANK-RESERVE-0001',
      partnerId: 'safe-deals-test',
    });

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
        commandId: 'bank-callback:bank-event-0001',
        idempotencyKey: expect.stringMatching(/^fp:[a-f0-9]{64}$/),
        payload: expect.objectContaining({
          operationId: `bank-reserve:${CANONICAL_TEST_DEAL_ID}`,
          bankRef: 'BANK-RESERVE-0001',
          requestFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
      expect.objectContaining({
        role: Role.BANK_CALLBACK,
        tenantId: DEAL.tenantId,
        orgId: DEAL.buyerOrgId,
      }),
    );
  });
});
