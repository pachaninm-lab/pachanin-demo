import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { RequestUser, Role } from '../../src/common/types/request-user';
import { CANONICAL_TEST_DEAL_ID } from '../../src/modules/deals/deal-command.policy';

const TENANT_ID = 'tenant-canonical-test';

async function seededUser(prisma: PrismaService, role: Role): Promise<RequestUser> {
  const membership = await prisma.userOrg.findFirst({
    where: { role },
    include: { user: true },
  });
  if (!membership) throw new Error(`Missing seeded membership for ${role}`);
  return {
    id: membership.user.id,
    email: membership.user.email,
    fullName: membership.user.fullName,
    role,
    orgId: membership.organizationId,
    tenantId: TENANT_ID,
    sessionId: `recovery-${role.toLowerCase()}`,
    mfaVerified: true,
  };
}

describe('industrial one-deal recovery matrix', () => {
  let prisma: PrismaService;
  let rls: RlsTransactionService;

  beforeEach(async () => {
    prisma = new PrismaService();
    rls = new RlsTransactionService(prisma);
    await prisma.$connect();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  it('does not leak transaction-local RLS context across pooled connection reuse', async () => {
    const buyer = await seededUser(prisma, Role.BUYER);
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
    const operator = await seededUser(prisma, Role.SUPPORT_MANAGER);
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
    const operator = await seededUser(prisma, Role.SUPPORT_MANAGER);
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

    const operatorAfterRestart = await seededUser(prisma, Role.SUPPORT_MANAGER);
    const after = await rls.withTrustedContext(operatorAfterRestart, async (tx) => ({
      deal: await tx.deal.findUnique({ where: { id: CANONICAL_TEST_DEAL_ID }, select: { id: true, status: true } }),
      eventCount: await tx.dealEvent.count({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
      auditCount: await tx.auditEvent.count({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
      receiptCount: await tx.outboxEntry.count({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
    }));

    expect(after).toEqual(before);
  });
});
