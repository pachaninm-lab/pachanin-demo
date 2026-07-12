import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { StoragePrismaService } from '../../src/common/prisma/storage-prisma.service';
import { AuthPrismaService } from '../../src/modules/auth/auth-prisma.service';

async function main(): Promise<void> {
  if (String(process.env.DB_PRINCIPAL_BOUNDARY_ENFORCED).toLowerCase() !== 'true') {
    throw new Error('DB_PRINCIPAL_BOUNDARY_ENFORCED=true is required for runtime principal proof.');
  }

  const dealPrisma = new PrismaService();
  const authPrisma = new AuthPrismaService();
  const storagePrisma = new StoragePrismaService();
  await Promise.all([
    dealPrisma.onModuleInit(),
    authPrisma.onModuleInit(),
    storagePrisma.onModuleInit(),
  ]);

  try {
    const [dealIdentity, authIdentity, storageIdentity] = await Promise.all([
      dealPrisma.$queryRaw<Array<{ current_user: string }>>(Prisma.sql`SELECT current_user`),
      authPrisma.$queryRaw<Array<{ current_user: string }>>(Prisma.sql`SELECT current_user`),
      storagePrisma.$queryRaw<Array<{ current_user: string }>>(Prisma.sql`SELECT current_user`),
    ]);
    if (dealIdentity[0]?.current_user !== 'one_deal_app') {
      throw new Error(`Deal runtime connected as ${dealIdentity[0]?.current_user ?? 'unknown'}`);
    }
    if (authIdentity[0]?.current_user !== 'one_deal_auth') {
      throw new Error(`Auth runtime connected as ${authIdentity[0]?.current_user ?? 'unknown'}`);
    }
    if (storageIdentity[0]?.current_user !== 'one_deal_storage') {
      throw new Error(`Storage runtime connected as ${storageIdentity[0]?.current_user ?? 'unknown'}`);
    }

    let authDealDenied = false;
    try {
      await authPrisma.$queryRaw(Prisma.sql`SELECT id FROM public.deals LIMIT 1`);
    } catch (error) {
      const candidate = error as { code?: string; meta?: { code?: string }; message?: string };
      authDealDenied = candidate.code === 'P2010'
        || candidate.meta?.code === '42501'
        || /permission denied/i.test(String(candidate.message ?? ''));
    }
    if (!authDealDenied) {
      throw new Error('Auth runtime unexpectedly read public.deals.');
    }

    const crossTenantCount = await dealPrisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT set_config('app.current_user_id', 'buyer-e2e', true)`);
      await tx.$executeRaw(Prisma.sql`SELECT set_config('app.current_org_id', 'org-canonical-buyer', true)`);
      await tx.$executeRaw(Prisma.sql`SELECT set_config('app.current_tenant_id', 'tenant-other', true)`);
      await tx.$executeRaw(Prisma.sql`SELECT set_config('app.current_role', 'BUYER', true)`);
      await tx.$executeRaw(Prisma.sql`SELECT set_config('app.current_session_id', 'runtime-principal-proof', true)`);
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM public.deals
        WHERE id = 'DEAL-INDUSTRIAL-001'
      `);
      return Number(rows[0]?.count ?? 0n);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (crossTenantCount !== 0) {
      throw new Error(`Deal runtime exposed ${crossTenantCount} cross-tenant row(s).`);
    }

    process.stdout.write(`${JSON.stringify({
      runtimePrincipalBoundary: 'passed',
      dealPrincipal: dealIdentity[0].current_user,
      authPrincipal: authIdentity[0].current_user,
      storagePrincipal: storageIdentity[0].current_user,
      authDealDenied,
      crossTenantCount,
    })}\n`);
  } finally {
    await Promise.all([
      dealPrisma.onModuleDestroy(),
      authPrisma.onModuleDestroy(),
      storagePrisma.onModuleDestroy(),
    ]);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
