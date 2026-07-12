import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { PersistentAuthRepository } from '../../src/modules/auth/persistent-auth.repository';
import { CanonicalTestDealSeedService } from '../../src/modules/deals/canonical-test-deal.seed';
import { CANONICAL_TEST_DEAL_ID } from '../../src/modules/deals/deal-command.policy';

export const AUTHORITY_LOT_ID = 'LOT-RLS-AUTHORITY-001';
export const AUTHORITY_BID_ID = 'BID-RLS-AUTHORITY-001';
export const AUTHORITY_BASIS_EVENT_ID = 'basis-event-rls-authority-001';
export const AUTHORITY_CROSS_TENANT_ORG_ID = 'org-rls-authority-foreign-tenant';

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('One-deal E2E seed is forbidden in production.');
  }
  if (String(process.env.SEED_CANONICAL_TEST_DEAL).toLowerCase() !== 'true') {
    throw new Error('SEED_CANONICAL_TEST_DEAL=true is required for the isolated E2E seed.');
  }

  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const authRepository = new PersistentAuthRepository(prisma);
    const seed = new CanonicalTestDealSeedService(prisma, authRepository);
    await seed.onModuleInit();

    const basisMaterial = {
      dealNumber: 'ТП-RLS-AUTHORITY-001',
      tenantId: 'tenant-canonical-test',
      lotId: AUTHORITY_LOT_ID,
      winnerBidId: AUTHORITY_BID_ID,
      sellerOrgId: 'org-canonical-seller',
      buyerOrgId: 'org-canonical-buyer',
      sellerUserId: 'farmer-e2e',
      buyerUserId: 'buyer-e2e',
      culture: 'Пшеница',
      cropClass: '3 класс',
      region: 'Контролируемый RLS-контур',
      incoterms: 'CPT',
      volumeTons: '100.000000',
      pricePerTon: '18500.000000',
      totalKopecks: '185000000',
      currency: 'RUB',
    };
    const basis = { ...basisMaterial, sourceHash: digest(basisMaterial) };
    await prisma.integrationEvent.upsert({
      where: { id: AUTHORITY_BASIS_EVENT_ID },
      update: {
        dealId: null,
        status: 'CONFIRMED',
        responsePayload: basis as Prisma.InputJsonValue,
      },
      create: {
        id: AUTHORITY_BASIS_EVENT_ID,
        adapterName: 'auction',
        direction: 'INBOUND',
        eventType: 'DEAL_BASIS_READY',
        externalId: `${AUTHORITY_LOT_ID}:${AUTHORITY_BID_ID}`,
        status: 'CONFIRMED',
        responsePayload: basis as Prisma.InputJsonValue,
        idempotencyKey: 'basis-rls-authority-001',
      },
    });
    await prisma.organization.upsert({
      where: { id: AUTHORITY_CROSS_TENANT_ORG_ID },
      update: {
        tenantId: 'tenant-rls-authority-foreign',
        status: 'VERIFIED',
        kycStatus: 'APPROVED',
      },
      create: {
        id: AUTHORITY_CROSS_TENANT_ORG_ID,
        inn: '990000000099',
        name: 'RLS foreign tenant organization',
        tenantId: 'tenant-rls-authority-foreign',
        status: 'VERIFIED',
        kycStatus: 'APPROVED',
      },
    });

    const [deal, memberships, credentialStates, authorityBasis] = await Promise.all([
      prisma.deal.findUnique({ where: { id: CANONICAL_TEST_DEAL_ID } }),
      prisma.userOrg.findMany({
        where: { organization: { tenantId: 'tenant-canonical-test' } },
        include: { user: true, organization: true },
      }),
      prisma.$queryRaw<Array<{ user_id: string }>>`
        SELECT user_id
        FROM auth.credential_states
        WHERE user_id IN (
          SELECT u.id
          FROM public.users u
          JOIN public.user_orgs uo ON uo."userId" = u.id
          JOIN public.organizations o ON o.id = uo."organizationId"
          WHERE o."tenantId" = 'tenant-canonical-test'
        )
      `,
      prisma.integrationEvent.findUnique({ where: { id: AUTHORITY_BASIS_EVENT_ID } }),
    ]);

    if (!deal || deal.status !== 'DRAFT' || deal.tenantId !== 'tenant-canonical-test') {
      throw new Error('Canonical deal seed did not produce the expected DRAFT tenant state.');
    }
    if (!authorityBasis || authorityBasis.status !== 'CONFIRMED' || authorityBasis.dealId !== null) {
      throw new Error('RLS authority deal basis was not seeded as an unconsumed confirmed event.');
    }

    const roles = new Set(memberships.map((item) => item.role));
    if (memberships.length !== 12 || roles.size !== 12 || credentialStates.length !== 12) {
      throw new Error(
        `Expected 12 PostgreSQL memberships, roles and credential states, got ${memberships.length}/${roles.size}/${credentialStates.length}.`,
      );
    }

    const deterministicIds = new Set(memberships.map((item) => item.userId));
    for (const expectedId of [
      'farmer-e2e',
      'buyer-e2e',
      'logistician-e2e',
      'driver-e2e',
      'surveyor-e2e',
      'elevator-e2e',
      'lab-e2e',
      'accounting-e2e',
      'compliance-e2e',
      'arbitrator-e2e',
      'operator-e2e',
      'executive-e2e',
    ]) {
      if (!deterministicIds.has(expectedId)) throw new Error(`Missing deterministic persistent identity ${expectedId}`);
    }

    process.stdout.write(`${JSON.stringify({
      seeded: true,
      identityMode: 'persistent-postgresql',
      dealId: deal.id,
      status: deal.status,
      tenantId: deal.tenantId,
      memberships: memberships.length,
      credentialStates: credentialStates.length,
      roles: [...roles].sort(),
      authorityBasis: {
        eventId: authorityBasis.id,
        lotId: AUTHORITY_LOT_ID,
        winnerBidId: AUTHORITY_BID_ID,
      },
    })}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
