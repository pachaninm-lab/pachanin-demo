import { PrismaService } from '../../src/common/prisma/prisma.service';
import { PersistentAuthRepository } from '../../src/modules/auth/persistent-auth.repository';
import { CanonicalTestDealSeedService } from '../../src/modules/deals/canonical-test-deal.seed';
import { CANONICAL_TEST_DEAL_ID } from '../../src/modules/deals/deal-command.policy';

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

    const [deal, memberships, credentialStates] = await Promise.all([
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
    ]);

    if (!deal || deal.status !== 'DRAFT' || deal.tenantId !== 'tenant-canonical-test') {
      throw new Error('Canonical deal seed did not produce the expected DRAFT tenant state.');
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
    })}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
