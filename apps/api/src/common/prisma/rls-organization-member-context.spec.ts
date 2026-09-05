import { Prisma } from '@prisma/client';
import { Role, type RequestUser } from '../types/request-user';
import { PrismaService } from './prisma.service';
import {
  RlsTransactionService,
  deriveOrganizationMemberRlsContext,
  deriveTrustedRlsContext,
} from './rls-transaction.service';

function memberUser(role: RequestUser['role'] = Role.GUEST): RequestUser {
  return {
    id: 'user-accountant',
    orgId: 'org-a',
    tenantId: 'tenant-a',
    sessionId: 'session-a',
    role,
    email: 'accountant@example.test',
  };
}

function fixture(membership: string | null) {
  const queryRaw = jest
    .fn()
    .mockResolvedValueOnce([{ configured: true }])
    .mockResolvedValueOnce([{ membership }]);
  const tx = { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient;
  const transaction = jest.fn(
    async (callback: (client: Prisma.TransactionClient) => Promise<unknown>) => callback(tx),
  );
  const prisma = { $transaction: transaction } as unknown as PrismaService;
  return { queryRaw, transaction, tx, service: new RlsTransactionService(prisma) };
}

describe('organization-member RLS context', () => {
  it('keeps GUEST forbidden in the generic platform context', () => {
    expect(() => deriveTrustedRlsContext(memberUser())).toThrow(
      expect.objectContaining({ code: 'guest_role_forbidden' }),
    );
  });

  it('derives only identity coordinates before the database membership proof', () => {
    expect(deriveOrganizationMemberRlsContext(memberUser())).toMatchObject({
      userId: 'user-accountant',
      orgId: 'org-a',
      tenantId: 'tenant-a',
      sessionId: 'session-a',
      role: Role.GUEST,
    });
  });

  it('runs organization-member work only after PostgreSQL resolves an ACTIVE membership', async () => {
    const test = fixture('membership-a');
    const work = jest.fn(async () => 'allowed');

    await expect(
      test.service.withOrganizationMemberContext(memberUser(), work),
    ).resolves.toBe('allowed');
    expect(test.queryRaw).toHaveBeenCalledTimes(2);
    expect(work).toHaveBeenCalledWith(
      test.tx,
      expect.objectContaining({ orgId: 'org-a', tenantId: 'tenant-a', role: Role.GUEST }),
    );
  });

  it('fails closed before business work if PostgreSQL finds no matching ACTIVE membership', async () => {
    const test = fixture(null);
    const work = jest.fn(async () => 'must-not-run');

    await expect(
      test.service.withOrganizationMemberContext(memberUser(), work),
    ).rejects.toMatchObject({ code: 'organization_membership_required' });
    expect(work).not.toHaveBeenCalled();
  });

  it('rejects an incomplete identity before opening any transaction', async () => {
    const test = fixture('membership-a');
    await expect(
      test.service.withOrganizationMemberContext(
        { ...memberUser(), sessionId: undefined },
        async () => null,
      ),
    ).rejects.toMatchObject({ code: 'session_required' });
    expect(test.transaction).not.toHaveBeenCalled();
  });
});
