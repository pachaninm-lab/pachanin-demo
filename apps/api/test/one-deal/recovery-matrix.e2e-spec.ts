import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { RequestUser, Role } from '../../src/common/types/request-user';
import { AuthPrismaService } from '../../src/modules/auth/auth-prisma.service';
import { CANONICAL_TEST_DEAL_ID } from '../../src/modules/deals/deal-command.policy';

const TENANT_ID = 'tenant-canonical-test';
const SEEDED_USER_ID_BY_ROLE: Partial<Record<Role, string>> = {
  [Role.BUYER]: 'buyer-e2e',
  [Role.SUPPORT_MANAGER]: 'operator-e2e',
};

async function seededUser(authPrisma: AuthPrismaService, role: Role): Promise<RequestUser> {
  const userId = SEEDED_USER_ID_BY_ROLE[role];
  if (!userId) throw new Error(`No seeded identity is registered for ${role}`);

  const memberships = await authPrisma.$queryRaw<Array<{ membership_id: string }>>`
    SELECT membership_id
    FROM auth.resolve_login_default_membership(${userId})
  `;
  const membershipId = memberships[0]?.membership_id;
  if (!membershipId) throw new Error(`Missing default seeded membership for ${role}`);

  const rows = await authPrisma.$queryRaw<Array<{
    user_id: string;
    email: string;
    full_name: string;
    membership_id: string;
    organization_id: string;
    tenant_id: string;
    role: string;
  }>>`
    SELECT
      user_id,
      email,
      full_name,
      membership_id,
      organization_id,
      tenant_id,
      role
    FROM auth.resolve_login_context_by_membership(${userId}, ${membershipId})
  `;
  const identity = rows[0];
  if (
    !identity
    || identity.membership_id !== membershipId
    || identity.tenant_id !== TENANT_ID
    || identity.role !== String(role)
  ) {
    throw new Error(`Missing seeded membership for ${role}`);
  }
  return {
    id: identity.user_id,
    email: identity.email,
    fullName: identity.full_name,
    role,
    orgId: identity.organization_id,
    tenantId: identity.tenant_id,
    membershipId: identity.membership_id,
    sessionId: `recovery-${role.toLowerCase()}`,
    mfaVerified: true,
  };
}

describe('industrial one-deal recovery matrix', () => {
  let prisma: PrismaService;
  let authPrisma: AuthPrismaService;
  let rls: RlsTransactionService;

  beforeEach(async () => {
    prisma = new PrismaService();
    authPrisma = new AuthPrismaService();
    rls = new RlsTransactionService(prisma);
    await Promise.all([prisma.$connect(), authPrisma.onModuleInit()]);
  });

  afterEach(async () => {
    await Promise.all([prisma.$disconnect(), authPrisma.onModuleDestroy()]);
  });

  it('does not leak transaction-local RLS context across pooled connection reuse', async () => {
    const buyer = await seededUser(authPrisma, Role.BUYER);
    const visible = await rls.withTrustedContext(buyer, (tx) =>
      tx.deal.findMany({ where: { id: CANONICAL_TEST_DEAL_ID }, select: { id: true } }),
    );
    expect(visible).toEqual([{ id: CANONICAL_TEST_DEAL_ID }]);

    const wrongTenant = {
      ...buyer,
      tenantId: 'tenant-isolation-proof',
      sessionId: 'recovery-wrong-tenant',
    };
    const hidden = await rls.withTrustedContext(wrongTenant, (tx) =>
      tx.deal.findMany({ where: { id: CANONICAL_TEST_DEAL_ID }, select: { id: true } }),
    );
    expect(hidden).toEqual([]);

    const visibleAgain = await rls.withTrustedContext(buyer, (tx) =>
      tx.deal.findMany({ where: { id: CANONICAL_TEST_DEAL_ID }, select: { id: true } }),
    );
    expect(visibleAgain).toEqual([{ id: CANONICAL_TEST_DEAL_ID }]);
  });

  it('rolls back event, audit and outbox atomically after a forced failure', async () => {
    const operator = await seededUser(authPrisma, Role.SUPPORT_MANAGER);
    const marker = `rollback-proof-${Date.now()}`;

    await expect(
      rls.withTrustedContext(operator, async (tx) => {
        await tx.dealEvent.create({
          data: {
            id: `${marker}-event`,
            dealId: CANONICAL_TEST_DEAL_ID,
            eventType: 'RECOVERY_ROLLBACK_PROOF',
            actorId: operator.id,
            actorRole: operator.role,
            tenantId: TENANT_ID,
            payload: { marker },
            hash: marker,
          },
        });
        await tx.auditEvent.create({
          data: {
            id: `${marker}-audit`,
            action: 'deal.recovery.rollback_proof',
            actorUserId: operator.id,
            actorRole: operator.role,
            tenantId: TENANT_ID,
            orgId: operator.orgId,
            dealId: CANONICAL_TEST_DEAL_ID,
            outcome: 'SUCCESS',
            correlationId: marker,
            hash: marker,
          },
        });
        await tx.outboxEntry.create({
          data: {
            type: 'deal.recovery.rollback_proof',
            dealId: CANONICAL_TEST_DEAL_ID,
            payload: { marker },
            idempotencyKey: marker,
            correlationId: marker,
          },
        });
        throw new Error('forced transaction rollback');
      }),
    ).rejects.toThrow('forced transaction rollback');

    const persisted = await rls.withTrustedContext(operator, async (tx) => {
      const [events, audits, outbox] = await Promise.all([
        tx.dealEvent.count({ where: { id: `${marker}-event` } }),
        tx.auditEvent.count({ where: { id: `${marker}-audit` } }),
        tx.outboxEntry.count({ where: { idempotencyKey: marker } }),
      ]);
      return { events, audits, outbox };
    });
    expect(persisted).toEqual({ events: 0, audits: 0, outbox: 0 });
  });

  it('preserves durable deal, receipt and audit state across Prisma client restart', async () => {
    const operator = await seededUser(authPrisma, Role.SUPPORT_MANAGER);
    const before = await rls.withTrustedContext(operator, async (tx) => ({
      deal: await tx.deal.findUnique({ where: { id: CANONICAL_TEST_DEAL_ID }, select: { id: true, status: true } }),
      eventCount: await tx.dealEvent.count({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
      auditCount: await tx.auditEvent.count({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
      receiptCount: await tx.outboxEntry.count({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
    }));

    await prisma.$disconnect();
    prisma = new PrismaService();
    rls = new RlsTransactionService(prisma);
    await prisma.$connect();

    const operatorAfterRestart = await seededUser(authPrisma, Role.SUPPORT_MANAGER);
    const after = await rls.withTrustedContext(operatorAfterRestart, async (tx) => ({
      deal: await tx.deal.findUnique({ where: { id: CANONICAL_TEST_DEAL_ID }, select: { id: true, status: true } }),
      eventCount: await tx.dealEvent.count({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
      auditCount: await tx.auditEvent.count({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
      receiptCount: await tx.outboxEntry.count({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
    }));

    expect(after).toEqual(before);
  });
});