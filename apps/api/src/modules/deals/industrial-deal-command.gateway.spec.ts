import { ConflictException, ForbiddenException } from '@nestjs/common';
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
  sessionId: 'session-buyer-001',
};

function fixture() {
  const prisma = {
    deal: { findUnique: jest.fn().mockResolvedValue(DEAL) },
    userOrg: {
      findMany: jest.fn().mockResolvedValue([
        {
          userId: BUYER.id,
          organizationId: DEAL.buyerOrgId,
          role: Role.BUYER,
          organization: { id: DEAL.buyerOrgId, tenantId: DEAL.tenantId },
        },
      ]),
    },
    outboxEntry: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
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
    prisma,
    commands,
    gateway: new IndustrialDealCommandGateway(prisma, commands),
  };
}

describe('IndustrialDealCommandGateway', () => {
  it('derives tenant and organization from a current DB membership, not the token org', async () => {
    const test = fixture();

    await test.gateway.workspace(CANONICAL_TEST_DEAL_ID, BUYER);

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

  it('fails closed when the user has no matching role membership in the deal tenant', async () => {
    const test = fixture();
    test.prisma.userOrg.findMany.mockResolvedValueOnce([]);

    await expect(test.gateway.workspace(CANONICAL_TEST_DEAL_ID, BUYER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(test.commands.workspace).not.toHaveBeenCalled();
  });

  it('rejects a human request to confirm reserve or release before any database write', async () => {
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

  it('rejects reuse of one idempotency key for a different material command', () => {
    const test = fixture();
    const resolve = (test.gateway as any).resolveExistingIntent.bind(test.gateway);
    const entry = {
      status: 'CONFIRMED',
      payload: {
        fingerprint: 'fingerprint-original',
        result: { actionId: 'approve_admission', commandId: 'command-original' },
      },
    };

    expect(() => resolve(entry, 'fingerprint-different')).toThrow(ConflictException);
    try {
      resolve(entry, 'fingerprint-different');
    } catch (error: any) {
      expect(error.response).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    }
  });

  it('derives the successful money confirmation actor only from the verified callback path', async () => {
    const test = fixture();
    const execute = jest
      .spyOn(test.gateway as any, 'executeWithStrictIdempotency')
      .mockResolvedValue({ ok: true, status: 'RESERVED' });

    await test.gateway.executeBankCallback({
      dealId: CANONICAL_TEST_DEAL_ID,
      eventId: 'bank-event-0001',
      operation: 'RESERVE',
      status: 'SUCCESS',
      bankRef: 'BANK-RESERVE-0001',
      partnerId: 'safe-deals-test',
    });

    expect(execute).toHaveBeenCalledWith(
      CANONICAL_TEST_DEAL_ID,
      'confirm_reserve',
      expect.objectContaining({
        commandId: 'bank-callback:bank-event-0001',
        idempotencyKey: 'bank-callback:bank-event-0001',
      }),
      expect.objectContaining({
        role: Role.BANK_CALLBACK,
        tenantId: DEAL.tenantId,
        orgId: DEAL.buyerOrgId,
      }),
    );
  });
});
