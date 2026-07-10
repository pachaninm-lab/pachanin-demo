import { PrismaService } from '../../src/common/prisma/prisma.service';
import { AuthService } from '../../src/modules/auth/auth.service';
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
    const auth = new AuthService(authRepository);
    const seed = new CanonicalTestDealSeedService(prisma, auth);
    await seed.onModuleInit();

    const [deal, memberships] = await Promise.all([
      prisma.deal.findUnique({ where: { id: CANONICAL_TEST_DEAL_ID } }),
      prisma.userOrg.findMany({
        where: { organization: { tenantId: 'tenant-canonical-test' } },
        include: { user: true, organization: true },
      }),
    ]);

    if (!deal || deal.status !== 'DRAFT' || deal.tenantId !== 'tenant-canonical-test') {
      throw new Error('Canonical deal seed did not produce the expected DRAFT tenant state.');
    }

    const roles = new Set(memberships.map((item) => item.role));
    if (memberships.length !== 12 || roles.size !== 12) {
      throw new Error(`Expected 12 canonical memberships and roles, got ${memberships.length}/${roles.size}.`);
    }

    process.stdout.write(`${JSON.stringify({
      seeded: true,
      dealId: deal.id,
      status: deal.status,
      tenantId: deal.tenantId,
      memberships: memberships.length,
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
