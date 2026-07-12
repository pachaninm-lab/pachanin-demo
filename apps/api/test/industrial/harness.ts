import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { DealCommandService } from '../../src/modules/deals/deal-command.service';
import { IndustrialDealCommandGateway } from '../../src/modules/deals/industrial-deal-command.gateway';
import { Role, type RequestUser } from '../../src/common/types/request-user';

/**
 * Industrial transaction-core test harness.
 *
 * Provisions arbitrary (non-canonical) deals with real PostgreSQL rows —
 * organizations, users, memberships, DealParticipant assignments — and builds
 * fully independent service "instances" (separate Prisma connections) so tests
 * can prove multi-instance and restart behaviour, not just single-process flow.
 */

export const INDUSTRIAL_TENANT = 'tenant-industrial-e2e';

export interface DealFixture {
  dealId: string;
  sellerOrgId: string;
  buyerOrgId: string;
  totalKopecks: bigint;
  users: Record<string, RequestUser>;
}

export interface ServiceInstance {
  prisma: PrismaService;
  rls: RlsTransactionService;
  commands: DealCommandService;
  gateway: IndustrialDealCommandGateway;
}

/** A separate PrismaService per instance = a separate connection pool, like a separate API pod. */
export async function createInstance(): Promise<ServiceInstance> {
  const prisma = new PrismaService();
  await prisma.$connect();
  const rls = new RlsTransactionService(prisma);
  const commands = new DealCommandService(rls);
  const gateway = new IndustrialDealCommandGateway(prisma, rls, commands);
  return { prisma, rls, commands, gateway };
}

export async function destroyInstance(instance: ServiceInstance): Promise<void> {
  await instance.prisma.$disconnect();
}

const ROLE_SET: ReadonlyArray<{ role: Role; key: string }> = [
  { role: Role.COMPLIANCE_OFFICER, key: 'compliance' },
  { role: Role.FARMER, key: 'farmer' },
  { role: Role.BUYER, key: 'buyer' },
  { role: Role.LOGISTICIAN, key: 'logistician' },
  { role: Role.DRIVER, key: 'driver' },
  { role: Role.ELEVATOR, key: 'elevator' },
  { role: Role.SURVEYOR, key: 'surveyor' },
  { role: Role.LAB, key: 'lab' },
  { role: Role.ACCOUNTING, key: 'accounting' },
  { role: Role.SUPPORT_MANAGER, key: 'operator' },
];

function accessFor(role: Role): 'READ' | 'WORK' | 'APPROVE' {
  if (role === Role.EXECUTIVE) return 'READ';
  if (role === Role.COMPLIANCE_OFFICER || role === Role.SUPPORT_MANAGER) return 'APPROVE';
  return 'WORK';
}

/**
 * Provision one arbitrary deal with a full participant set inside the
 * industrial test tenant. Every id is namespaced by `slug`, so a suite can
 * provision any number of parallel deals.
 */
export async function provisionDeal(
  prisma: PrismaService,
  slug: string,
  totalKopecks: bigint,
): Promise<DealFixture> {
  const dealId = `DEAL-E2E-${slug}`;
  const sellerOrgId = `org-e2e-${slug}-seller`;
  const buyerOrgId = `org-e2e-${slug}-buyer`;
  const serviceOrgId = `org-e2e-${slug}-services`;
  const passwordHash = bcrypt.hashSync('industrial-e2e', 4);

  const orgFor = (role: Role): string => {
    if (role === Role.FARMER) return sellerOrgId;
    if (role === Role.BUYER || role === Role.ACCOUNTING) return buyerOrgId;
    return serviceOrgId;
  };

  await prisma.$transaction(async (tx) => {
    let innSuffix = 0;
    for (const orgId of [sellerOrgId, buyerOrgId, serviceOrgId]) {
      innSuffix += 1;
      // Deterministic, collision-free synthetic INN derived from the slug hash.
      const innDigits = BigInt(`0x${createHash('sha256').update(slug).digest('hex').slice(0, 10)}`)
        .toString()
        .padStart(8, '0')
        .slice(0, 8);
      await tx.organization.upsert({
        where: { id: orgId },
        update: { tenantId: INDUSTRIAL_TENANT, status: 'VERIFIED' },
        create: {
          id: orgId,
          inn: `77${innDigits}${innSuffix}`,
          name: orgId,
          tenantId: INDUSTRIAL_TENANT,
          status: 'VERIFIED',
          kycStatus: 'APPROVED',
        },
      });
    }

    await tx.deal.upsert({
      where: { id: dealId },
      update: {
        status: 'DRAFT',
        tenantId: INDUSTRIAL_TENANT,
        totalKopecks,
        version: 0,
        closedAt: null,
      },
      create: {
        id: dealId,
        dealNumber: `ТП-E2E-${slug}`,
        status: 'DRAFT',
        tenantId: INDUSTRIAL_TENANT,
        sellerOrgId,
        buyerOrgId,
        totalKopecks,
        currency: 'RUB',
        culture: 'Пшеница',
        region: 'Тестовый регион',
      },
    });

    for (const { role, key } of ROLE_SET) {
      const userId = `user-e2e-${slug}-${key}`;
      const orgId = orgFor(role);
      await tx.user.upsert({
        where: { id: userId },
        update: { status: 'ACTIVE', deletedAt: null },
        create: {
          id: userId,
          email: `${key}-${slug}@industrial-e2e.invalid`,
          passwordHash,
          fullName: `E2E ${key} ${slug}`,
          status: 'ACTIVE',
        },
      });
      await tx.userOrg.upsert({
        where: { userId_organizationId: { userId, organizationId: orgId } },
        update: { role, isDefault: true },
        create: { userId, organizationId: orgId, role, isDefault: true },
      });
      await tx.dealParticipant.upsert({
        where: { dealId_userId_role: { dealId, userId, role } },
        update: {
          tenantId: INDUSTRIAL_TENANT,
          organizationId: orgId,
          accessLevel: accessFor(role),
          status: 'ACTIVE',
          revokedAt: null,
        },
        create: {
          id: `participant:${dealId}:${key}`,
          dealId,
          tenantId: INDUSTRIAL_TENANT,
          organizationId: orgId,
          userId,
          role,
          accessLevel: accessFor(role),
          status: 'ACTIVE',
        },
      });
    }
  });

  const users: Record<string, RequestUser> = {};
  for (const { role, key } of ROLE_SET) {
    users[key] = {
      id: `user-e2e-${slug}-${key}`,
      email: `${key}-${slug}@industrial-e2e.invalid`,
      fullName: `E2E ${key} ${slug}`,
      role,
      orgId: orgFor(role),
      tenantId: INDUSTRIAL_TENANT,
      sessionId: `session-e2e-${slug}-${key}`,
      mfaVerified: true,
    };
  }

  return { dealId, sellerOrgId, buyerOrgId, totalKopecks, users };
}

/** Remove every row belonging to the industrial e2e tenant so runs are repeatable. */
export async function cleanTenant(prisma: PrismaService): Promise<void> {
  // Append-only tables must be truncated via session_replication_role to
  // bypass the industrial append-only triggers — allowed for test cleanup only.
  await prisma.$executeRawUnsafe(`SET session_replication_role = replica`);
  try {
    const dealIds = (
      await prisma.deal.findMany({ where: { tenantId: INDUSTRIAL_TENANT }, select: { id: true } })
    ).map((deal) => deal.id);
    if (dealIds.length > 0) {
      const inList = dealIds.map((id) => `'${id}'`).join(',');
      for (const statement of [
        `DELETE FROM "ledger_entries" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "deal_events" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "audit_events" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "outbox_entries" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "bank_operations" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "payments" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "lab_tests" WHERE "sampleId" IN (SELECT id FROM "lab_samples" WHERE "dealId" IN (${inList}))`,
        `DELETE FROM "lab_samples" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "acceptance_records" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "checkpoints" WHERE "shipmentId" IN (SELECT id FROM "shipments" WHERE "dealId" IN (${inList}))`,
        `DELETE FROM "shipments" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "deal_documents" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "deal_participants" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "deals" WHERE "id" IN (${inList})`,
      ]) {
        await prisma.$executeRawUnsafe(statement);
      }
    }
    await prisma.$executeRawUnsafe(
      `DELETE FROM "user_orgs" WHERE "organizationId" IN (SELECT id FROM "organizations" WHERE "tenantId" = '${INDUSTRIAL_TENANT}')`,
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM "users" WHERE "id" LIKE 'user-e2e-%'`,
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM "organizations" WHERE "tenantId" = '${INDUSTRIAL_TENANT}'`,
    );
  } finally {
    await prisma.$executeRawUnsafe(`SET session_replication_role = DEFAULT`);
  }
}
