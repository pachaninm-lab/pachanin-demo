import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { AuthPrismaService } from '../../src/modules/auth/auth-prisma.service';
import { AuthService } from '../../src/modules/auth/auth.service';
import { PersistentAuthRepository } from '../../src/modules/auth/persistent-auth.repository';
import { CANONICAL_TEST_DEAL_ID } from '../../src/modules/deals/deal-command.policy';

const PASSWORD = 'demo1234';
const REQUIRED_SIGNED_DOCUMENT_TYPES = [
  'CONTRACT',
  'TTN',
  'WEIGHING_ACT',
  'LAB_PROTOCOL',
  'ACCEPTANCE_ACT',
] as const;

async function main(): Promise<void> {
  if (String(process.env.DB_PRINCIPAL_BOUNDARY_ENFORCED).toLowerCase() !== 'true') {
    throw new Error('DB_PRINCIPAL_BOUNDARY_ENFORCED=true is required for restored database acceptance.');
  }

  const dealPrisma = new PrismaService();
  const authPrisma = new AuthPrismaService();
  const auth = new AuthService(new PersistentAuthRepository(authPrisma));
  await Promise.all([dealPrisma.onModuleInit(), authPrisma.onModuleInit()]);

  try {
    let authDealDenied = false;
    try {
      await authPrisma.$queryRaw(Prisma.sql`SELECT id FROM public.deals LIMIT 1`);
    } catch (error) {
      const candidate = error as { code?: string; meta?: { code?: string }; message?: string };
      authDealDenied = candidate.code === 'P2010'
        || candidate.meta?.code === '42501'
        || /permission denied/i.test(String(candidate.message ?? ''));
    }
    if (!authDealDenied) throw new Error('Restored auth principal unexpectedly accessed public.deals.');

    const login = await auth.login({ email: 'farmer@demo.ru', password: PASSWORD }) as any;
    if (login.mfaRequired || !login.accessToken || !login.refreshToken) {
      throw new Error('Persistent login failed after database restore.');
    }
    const actor = await auth.verifyAccessToken(login.accessToken);
    const rls = new RlsTransactionService(dealPrisma);

    const restored = await rls.withTrustedContext(actor, async (tx) => {
      const [deal, visibleParticipants, events, audits, documents, bankOperations, ledger, migrations, rlsTables] = await Promise.all([
        tx.deal.findUnique({
          where: { id: CANONICAL_TEST_DEAL_ID },
          select: { id: true, status: true, totalKopecks: true, closedAt: true },
        }),
        tx.dealParticipant.count({ where: { dealId: CANONICAL_TEST_DEAL_ID, status: 'ACTIVE' } }),
        tx.dealEvent.count({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
        tx.auditEvent.count({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
        tx.dealDocument.findMany({
          where: { dealId: CANONICAL_TEST_DEAL_ID, status: 'SIGNED' },
          select: { type: true },
          orderBy: { type: 'asc' },
        }),
        tx.bankOperation.count({ where: { dealId: CANONICAL_TEST_DEAL_ID, status: 'DONE' } }),
        tx.ledgerEntry.count({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
        tx.$queryRaw<Array<{ successful: bigint; failed: bigint }>>(Prisma.sql`
          SELECT
            COUNT(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::bigint AS successful,
            COUNT(*) FILTER (WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL)::bigint AS failed
          FROM public._prisma_migrations
        `),
        tx.$queryRaw<Array<{ enabled: bigint; forced: bigint }>>(Prisma.sql`
          SELECT
            COUNT(*) FILTER (WHERE c.relrowsecurity)::bigint AS enabled,
            COUNT(*) FILTER (WHERE c.relforcerowsecurity)::bigint AS forced
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relname IN (
              'deals',
              'organizations',
              'audit_events',
              'ledger_entries',
              'integration_events',
              'outbox_entries',
              'deal_workspace_runtime_snapshots',
              'deal_workspace_runtime_transaction_attempts'
            )
        `),
      ]);
      return {
        deal,
        visibleParticipants,
        events,
        audits,
        documentTypes: documents.map((document) => document.type),
        bankOperations,
        ledger,
        migrations: migrations[0],
        rlsTables: rlsTables[0],
      };
    });

    if (!restored.deal || restored.deal.status !== 'CLOSED' || !restored.deal.closedAt) {
      throw new Error('Restored canonical deal is not CLOSED.');
    }
    if (restored.visibleParticipants !== 1) {
      throw new Error(`Farmer must see only its own participant row, got ${restored.visibleParticipants}`);
    }
    if (restored.events !== 19) throw new Error(`Expected 19 events, got ${restored.events}`);
    if (restored.audits !== 19) throw new Error(`Expected 19 audits, got ${restored.audits}`);

    const restoredDocumentTypes = [...new Set(restored.documentTypes)].sort();
    const requiredDocumentTypes = [...REQUIRED_SIGNED_DOCUMENT_TYPES].sort();
    if (JSON.stringify(restoredDocumentTypes) !== JSON.stringify(requiredDocumentTypes)) {
      throw new Error(
        `Restored signed document basis mismatch: expected ${requiredDocumentTypes.join(', ')}, got ${restoredDocumentTypes.join(', ') || 'none'}`,
      );
    }

    if (restored.bankOperations !== 2) throw new Error(`Expected 2 bank operations, got ${restored.bankOperations}`);
    if (restored.ledger !== 2) throw new Error(`Expected 2 ledger entries, got ${restored.ledger}`);
    if (Number(restored.migrations?.successful ?? 0n) < 1 || Number(restored.migrations?.failed ?? 1n) !== 0) {
      throw new Error('Restored Prisma migration history contains failed or incomplete migrations.');
    }
    if (Number(restored.rlsTables?.enabled ?? 0n) !== 8 || Number(restored.rlsTables?.forced ?? 0n) !== 8) {
      throw new Error('Restored protected tables do not retain ENABLE + FORCE RLS.');
    }

    const crossTenant = { ...actor, tenantId: 'tenant-restored-attacker', sessionId: 'restored-cross-tenant' };
    const crossTenantCount = await rls.withTrustedContext(crossTenant, (tx) => tx.deal.count({
      where: { id: CANONICAL_TEST_DEAL_ID },
    }));
    if (crossTenantCount !== 0) {
      throw new Error(`Restored deal pool exposed ${crossTenantCount} cross-tenant row(s).`);
    }

    process.stdout.write(`${JSON.stringify({
      restoredDatabaseAcceptance: 'passed',
      dealId: restored.deal.id,
      status: restored.deal.status,
      visibleParticipants: restored.visibleParticipants,
      events: restored.events,
      audits: restored.audits,
      signedDocumentTypes: restoredDocumentTypes,
      bankOperations: restored.bankOperations,
      ledgerEntries: restored.ledger,
      successfulMigrations: Number(restored.migrations?.successful ?? 0n),
      rlsEnabled: Number(restored.rlsTables?.enabled ?? 0n),
      rlsForced: Number(restored.rlsTables?.forced ?? 0n),
      authDealDenied,
      crossTenantCount,
    })}\n`);
  } finally {
    await Promise.all([dealPrisma.onModuleDestroy(), authPrisma.onModuleDestroy()]);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
