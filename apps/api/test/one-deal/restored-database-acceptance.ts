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
const REQUIRED_LAB_AUDITS = 10;
const REQUIRED_DEAL_COMMAND_AUDITS = 15;
const REQUIRED_SETTLEMENT_AUDITS = 4;
const REQUIRED_SETTLEMENT_TABLES = 8;

type SettlementPaymentFact = {
  status: string;
  confirmedReserved: bigint;
  pendingReserved: bigint;
  confirmedReleased: bigint;
  pendingReleased: bigint;
  confirmedRefunded: bigint;
  pendingRefunded: bigint;
  activeHold: bigint;
};

type SettlementLedgerFact = {
  entryType: string;
  amountMinor: bigint;
  prevHash: string | null;
  hash: string;
};

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
      const [
        deal,
        visibleParticipants,
        events,
        audits,
        dealCommandAudits,
        settlementAudits,
        labAudits,
        documents,
        publicBankOperations,
        publicLedger,
        settlementPayments,
        settlementTerms,
        settlementBeneficiaries,
        settlementOperations,
        settlementCallbacks,
        settlementLedger,
        migrations,
        publicRlsTables,
        settlementRlsTables,
      ] = await Promise.all([
        tx.deal.findUnique({
          where: { id: CANONICAL_TEST_DEAL_ID },
          select: { id: true, status: true, totalKopecks: true, closedAt: true },
        }),
        tx.dealParticipant.count({ where: { dealId: CANONICAL_TEST_DEAL_ID, status: 'ACTIVE' } }),
        tx.dealEvent.count({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
        tx.auditEvent.count({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
        tx.auditEvent.count({
          where: { dealId: CANONICAL_TEST_DEAL_ID, action: { startsWith: 'deal.command.' } },
        }),
        tx.auditEvent.count({
          where: { dealId: CANONICAL_TEST_DEAL_ID, action: { startsWith: 'settlement.' } },
        }),
        tx.auditEvent.count({
          where: { dealId: CANONICAL_TEST_DEAL_ID, action: { startsWith: 'lab.' } },
        }),
        tx.dealDocument.findMany({
          where: { dealId: CANONICAL_TEST_DEAL_ID, status: 'SIGNED' },
          select: { type: true },
          orderBy: { type: 'asc' },
        }),
        tx.bankOperation.count({ where: { dealId: CANONICAL_TEST_DEAL_ID, status: 'DONE' } }),
        tx.ledgerEntry.count({ where: { dealId: CANONICAL_TEST_DEAL_ID } }),
        tx.$queryRaw<SettlementPaymentFact[]>(Prisma.sql`
          SELECT status,
                 confirmed_reserved_minor AS "confirmedReserved",
                 pending_reserved_minor AS "pendingReserved",
                 confirmed_released_minor AS "confirmedReleased",
                 pending_released_minor AS "pendingReleased",
                 confirmed_refunded_minor AS "confirmedRefunded",
                 pending_refunded_minor AS "pendingRefunded",
                 active_hold_minor AS "activeHold"
          FROM settlement.payments
          WHERE deal_id = ${CANONICAL_TEST_DEAL_ID}
        `),
        tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT count(*)::bigint AS count
          FROM settlement.payment_terms
          WHERE deal_id = ${CANONICAL_TEST_DEAL_ID}
        `),
        tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT count(*)::bigint AS count
          FROM settlement.beneficiaries
          WHERE deal_id = ${CANONICAL_TEST_DEAL_ID}
        `),
        tx.$queryRaw<Array<{ operationType: string; status: string; amountMinor: bigint }>>(Prisma.sql`
          SELECT operation_type AS "operationType", status, amount_minor AS "amountMinor"
          FROM settlement.bank_operations
          WHERE deal_id = ${CANONICAL_TEST_DEAL_ID}
          ORDER BY created_at, id
        `),
        tx.$queryRaw<Array<{ eventId: string; operationId: string; callbackStatus: string }>>(Prisma.sql`
          SELECT event_id AS "eventId", operation_id AS "operationId",
                 callback_status AS "callbackStatus"
          FROM settlement.bank_callbacks
          WHERE deal_id = ${CANONICAL_TEST_DEAL_ID}
          ORDER BY received_at, id
        `),
        tx.$queryRaw<SettlementLedgerFact[]>(Prisma.sql`
          SELECT entry_type AS "entryType", amount_minor AS "amountMinor",
                 prev_hash AS "prevHash", hash
          FROM settlement.ledger_entries
          WHERE deal_id = ${CANONICAL_TEST_DEAL_ID}
          ORDER BY created_at, id
        `),
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
              'deals', 'organizations', 'audit_events', 'ledger_entries',
              'integration_events', 'outbox_entries',
              'deal_workspace_runtime_snapshots',
              'deal_workspace_runtime_transaction_attempts'
            )
        `),
        tx.$queryRaw<Array<{ enabled: bigint; forced: bigint }>>(Prisma.sql`
          SELECT
            COUNT(*) FILTER (WHERE c.relrowsecurity)::bigint AS enabled,
            COUNT(*) FILTER (WHERE c.relforcerowsecurity)::bigint AS forced
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'settlement'
            AND c.relname IN (
              'payment_terms', 'beneficiaries', 'payments', 'holds',
              'bank_operations', 'bank_callbacks', 'ledger_entries',
              'reconciliation_facts'
            )
        `),
      ]);
      return {
        deal,
        visibleParticipants,
        events,
        audits,
        dealCommandAudits,
        settlementAudits,
        labAudits,
        documentTypes: documents.map((document) => document.type),
        publicBankOperations,
        publicLedger,
        settlementPayments,
        settlementTerms: settlementTerms[0]?.count ?? 0n,
        settlementBeneficiaries: settlementBeneficiaries[0]?.count ?? 0n,
        settlementOperations,
        settlementCallbacks,
        settlementLedger,
        migrations: migrations[0],
        publicRlsTables: publicRlsTables[0],
        settlementRlsTables: settlementRlsTables[0],
      };
    });

    if (!restored.deal || restored.deal.status !== 'CLOSED' || !restored.deal.closedAt) {
      throw new Error('Restored canonical deal is not CLOSED.');
    }
    if (restored.visibleParticipants !== 1) {
      throw new Error(`Farmer must see only its own participant row, got ${restored.visibleParticipants}`);
    }
    if (restored.events !== 19) throw new Error(`Expected 19 events, got ${restored.events}`);
    if (restored.dealCommandAudits !== REQUIRED_DEAL_COMMAND_AUDITS) {
      throw new Error(`Expected ${REQUIRED_DEAL_COMMAND_AUDITS} Deal audits, got ${restored.dealCommandAudits}`);
    }
    if (restored.settlementAudits !== REQUIRED_SETTLEMENT_AUDITS) {
      throw new Error(`Expected ${REQUIRED_SETTLEMENT_AUDITS} Settlement audits, got ${restored.settlementAudits}`);
    }
    if (restored.labAudits !== REQUIRED_LAB_AUDITS) {
      throw new Error(`Expected ${REQUIRED_LAB_AUDITS} Labs audits, got ${restored.labAudits}`);
    }
    if (restored.audits !== restored.dealCommandAudits + restored.settlementAudits + restored.labAudits) {
      throw new Error('Restored audit classification is incomplete.');
    }

    const restoredDocumentTypes = [...new Set(restored.documentTypes)].sort();
    const requiredDocumentTypes = [...REQUIRED_SIGNED_DOCUMENT_TYPES].sort();
    if (JSON.stringify(restoredDocumentTypes) !== JSON.stringify(requiredDocumentTypes)) {
      throw new Error(
        `Restored signed document basis mismatch: expected ${requiredDocumentTypes.join(', ')}, got ${restoredDocumentTypes.join(', ') || 'none'}`,
      );
    }
    if (restored.publicBankOperations !== 2 || restored.publicLedger !== 2) {
      throw new Error('Restored public Settlement projections are incomplete.');
    }

    const payment = restored.settlementPayments[0];
    if (!payment || restored.settlementPayments.length !== 1) {
      throw new Error(`Expected one restored Settlement payment, got ${restored.settlementPayments.length}`);
    }
    const dealTotal = BigInt(restored.deal.totalKopecks ?? 0n);
    if (
      payment.status !== 'RELEASED'
      || payment.confirmedReserved !== dealTotal
      || payment.confirmedReleased !== dealTotal
      || payment.pendingReserved !== 0n
      || payment.pendingReleased !== 0n
      || payment.confirmedRefunded !== 0n
      || payment.pendingRefunded !== 0n
      || payment.activeHold !== 0n
    ) {
      throw new Error('Restored Settlement payment counters or status are inconsistent.');
    }
    if (restored.settlementTerms !== 1n || restored.settlementBeneficiaries !== 1n) {
      throw new Error('Restored Settlement terms or beneficiary basis is incomplete.');
    }
    if (
      restored.settlementOperations.length !== 2
      || restored.settlementOperations.some((operation) => operation.status !== 'CONFIRMED')
      || restored.settlementOperations.map((operation) => operation.operationType).join(',') !== 'RESERVE,RELEASE'
      || restored.settlementOperations.some((operation) => operation.amountMinor !== dealTotal)
    ) {
      throw new Error('Restored Settlement bank operations are incomplete or inconsistent.');
    }
    if (
      restored.settlementCallbacks.length !== 2
      || restored.settlementCallbacks.some((callback) => callback.callbackStatus !== 'SUCCESS')
    ) {
      throw new Error('Restored verified callback facts are incomplete.');
    }
    if (
      restored.settlementLedger.length !== 2
      || restored.settlementLedger.map((entry) => entry.entryType).join(',') !== 'RESERVE,RELEASE'
      || restored.settlementLedger.some((entry) => entry.amountMinor !== dealTotal)
      || restored.settlementLedger[0].prevHash !== null
      || restored.settlementLedger[1].prevHash !== restored.settlementLedger[0].hash
    ) {
      throw new Error('Restored Settlement ledger facts or hash chain are invalid.');
    }

    if (Number(restored.migrations?.successful ?? 0n) < 1 || Number(restored.migrations?.failed ?? 1n) !== 0) {
      throw new Error('Restored Prisma migration history contains failed or incomplete migrations.');
    }
    if (
      Number(restored.publicRlsTables?.enabled ?? 0n) !== 8
      || Number(restored.publicRlsTables?.forced ?? 0n) !== 8
    ) {
      throw new Error('Restored public protected tables do not retain ENABLE + FORCE RLS.');
    }
    if (
      Number(restored.settlementRlsTables?.enabled ?? 0n) !== REQUIRED_SETTLEMENT_TABLES
      || Number(restored.settlementRlsTables?.forced ?? 0n) !== REQUIRED_SETTLEMENT_TABLES
    ) {
      throw new Error('Restored Settlement tables do not retain ENABLE + FORCE RLS.');
    }

    const crossTenant = { ...actor, tenantId: 'tenant-restored-attacker', sessionId: 'restored-cross-tenant' };
    const crossTenantCount = await rls.withTrustedContext(crossTenant, (tx) => tx.deal.count({
      where: { id: CANONICAL_TEST_DEAL_ID },
    }));
    if (crossTenantCount !== 0) {
      throw new Error(`Restored deal pool exposed ${crossTenantCount} cross-tenant row(s).`);
    }
    const crossTenantSettlement = await rls.withTrustedContext(crossTenant, (tx) =>
      tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT count(*)::bigint AS count
        FROM settlement.payments
        WHERE deal_id = ${CANONICAL_TEST_DEAL_ID}
      `),
    );
    if ((crossTenantSettlement[0]?.count ?? 0n) !== 0n) {
      throw new Error('Restored Settlement authority exposed a cross-tenant payment row.');
    }

    process.stdout.write(`${JSON.stringify({
      restoredDatabaseAcceptance: 'passed',
      dealId: restored.deal.id,
      status: restored.deal.status,
      visibleParticipants: restored.visibleParticipants,
      events: restored.events,
      audits: restored.audits,
      dealCommandAudits: restored.dealCommandAudits,
      settlementAudits: restored.settlementAudits,
      labAudits: restored.labAudits,
      signedDocumentTypes: restoredDocumentTypes,
      publicBankOperations: restored.publicBankOperations,
      publicLedgerEntries: restored.publicLedger,
      settlementStatus: payment.status,
      settlementOperations: restored.settlementOperations.length,
      settlementCallbacks: restored.settlementCallbacks.length,
      settlementLedgerEntries: restored.settlementLedger.length,
      successfulMigrations: Number(restored.migrations?.successful ?? 0n),
      publicRlsEnabled: Number(restored.publicRlsTables?.enabled ?? 0n),
      publicRlsForced: Number(restored.publicRlsTables?.forced ?? 0n),
      settlementRlsEnabled: Number(restored.settlementRlsTables?.enabled ?? 0n),
      settlementRlsForced: Number(restored.settlementRlsTables?.forced ?? 0n),
      authDealDenied,
      crossTenantCount,
      crossTenantSettlementCount: Number(crossTenantSettlement[0]?.count ?? 0n),
    })}\n`);
  } finally {
    await Promise.all([dealPrisma.onModuleDestroy(), authPrisma.onModuleDestroy()]);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
