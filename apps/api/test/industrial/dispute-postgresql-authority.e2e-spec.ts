import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { DisputeCommandService } from '../../src/modules/disputes/dispute-command.service';
import { DisputeQueryService } from '../../src/modules/disputes/dispute-query.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL;
const APP_URL = process.env.DATABASE_URL;
const TENANT = 'tenant-dispute-atomic';
const FOREIGN_TENANT = 'tenant-dispute-foreign';
const BUYER_ORG = 'org-dispute-buyer';
const SELLER_ORG = 'org-dispute-seller';
const SERVICE_ORG = 'org-dispute-service';
const FOREIGN_ORG = 'org-dispute-foreign';

const buyer = actor('user-dispute-buyer', BUYER_ORG, TENANT, Role.BUYER);
const seller = actor('user-dispute-seller', SELLER_ORG, TENANT, Role.FARMER);
const operator = actor('user-dispute-operator', SERVICE_ORG, TENANT, Role.SUPPORT_MANAGER);
const arbitrator = actor('user-dispute-arbitrator', SERVICE_ORG, TENANT, Role.ARBITRATOR);
const foreignBuyer = actor('user-dispute-foreign', FOREIGN_ORG, FOREIGN_TENANT, Role.BUYER);

function actor(id: string, orgId: string, tenantId: string, role: RequestUser['role']): RequestUser {
  return {
    id,
    orgId,
    tenantId,
    role,
    email: `${id}@industrial.invalid`,
    sessionId: `session:${id}`,
    mfaVerified: true,
  };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object');
  return value as Record<string, unknown>;
}

function responseCode(reason: unknown): string {
  if (!reason || typeof reason !== 'object') return String(reason);
  const response = (reason as { response?: unknown }).response;
  if (response && typeof response === 'object' && 'code' in response) {
    return String((response as { code?: unknown }).code);
  }
  return String((reason as { message?: unknown }).message ?? reason);
}

const describeDisputeAuthority = ADMIN_URL && APP_URL ? describe : describe.skip;

jest.setTimeout(180_000);

describeDisputeAuthority('IR-10.5 PostgreSQL dispute authority', () => {
  let admin: PrismaClient;
  let appA: PrismaService;
  let appB: PrismaService;
  let commandsA: DisputeCommandService;
  let commandsB: DisputeCommandService;
  let queriesA: DisputeQueryService;

  beforeAll(async () => {
    if (!ADMIN_URL || !APP_URL) throw new Error('TEST_ADMIN_DATABASE_URL and DATABASE_URL are required');
    admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
    appA = new PrismaService();
    appB = new PrismaService();
    await Promise.all([admin.$connect(), appA.$connect(), appB.$connect()]);
    commandsA = new DisputeCommandService(new RlsTransactionService(appA));
    commandsB = new DisputeCommandService(new RlsTransactionService(appB));
    queriesA = new DisputeQueryService(new RlsTransactionService(appA));
    await reset(admin);
    await seedActors(admin);
  });

  afterAll(async () => {
    await reset(admin);
    await Promise.all([admin?.$disconnect(), appA?.$disconnect(), appB?.$disconnect()]);
  });

  it('allows exactly one conflicting terminal decision, survives restart/replay and compensates a granted appeal', async () => {
    const dealId = 'deal-dispute-race';
    await seedDeal(admin, dealId, 100_000_000n, 100_000_000n);

    const opened = object(await commandsA.open({
      dealId,
      type: 'QUALITY',
      description: 'Independent laboratory result differs from contract basis',
      claimAmountKopecks: '50000000',
      severity: 'HIGH',
      idempotencyKey: 'open:race',
    }, buyer));
    const caseId = String(opened.id);
    expect(opened.status).toBe('OPEN');

    await commandsA.triage(caseId, 'triage:race', operator);
    await commandsA.assignArbitrator(caseId, 'assign:race', arbitrator);

    const race = await Promise.allSettled([
      commandsA.resolve(caseId, {
        outcome: 'BUYER_WINS',
        reason: 'Buyer evidence prevails',
        idempotencyKey: 'resolve:buyer',
      }, arbitrator),
      commandsB.resolve(caseId, {
        outcome: 'SELLER_WINS',
        reason: 'Seller evidence prevails',
        idempotencyKey: 'resolve:seller',
      }, arbitrator),
    ]);
    const fulfilled = race.filter((item): item is PromiseFulfilledResult<Record<string, unknown>> => item.status === 'fulfilled');
    const rejected = race.filter((item): item is PromiseRejectedResult => item.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(responseCode(rejected[0].reason)).toBe('DISPUTE_INVALID_STATE');

    const winner = object(fulfilled[0].value);
    const winnerOutcome = String(winner.outcome) as 'BUYER_WINS' | 'SELLER_WINS';
    const winnerKey = winnerOutcome === 'BUYER_WINS' ? 'resolve:buyer' : 'resolve:seller';
    const winnerReason = winnerOutcome === 'BUYER_WINS' ? 'Buyer evidence prevails' : 'Seller evidence prevails';

    const counts = await authorityCounts(admin, caseId);
    expect(counts.resolveReceipts).toBe(1);
    expect(counts.resolutionAudits).toBe(1);
    expect(counts.settlementEvents).toBe(1);
    expect(counts.holds).toBe(1);
    expect(counts.ledgerLinks).toBe(2); // hold + one terminal allocation

    await appB.$disconnect();
    appB = new PrismaService();
    await appB.$connect();
    commandsB = new DisputeCommandService(new RlsTransactionService(appB));
    const replay = object(await commandsB.resolve(caseId, {
      outcome: winnerOutcome,
      reason: winnerReason,
      idempotencyKey: winnerKey,
    }, arbitrator));
    expect(replay.duplicate).toBe(true);
    expect((await authorityCounts(admin, caseId)).ledgerLinks).toBe(2);

    await expect(commandsB.resolve(caseId, {
      outcome: winnerOutcome === 'BUYER_WINS' ? 'SELLER_WINS' : 'BUYER_WINS',
      reason: winnerReason,
      idempotencyKey: winnerKey,
    }, arbitrator)).rejects.toMatchObject({
      response: { code: 'DISPUTE_IDEMPOTENCY_PAYLOAD_MISMATCH' },
    });

    const appellant = winnerOutcome === 'BUYER_WINS' ? seller : buyer;
    const requestedOutcome = winnerOutcome === 'BUYER_WINS' ? 'SELLER_WINS' : 'BUYER_WINS';
    const appealed = object(await commandsA.openAppeal(caseId, {
      requestedOutcome,
      reason: 'Material evidence requires appellate review',
      idempotencyKey: 'appeal:race',
    }, appellant));
    expect(appealed.status).toBe('APPEALED');

    const final = object(await commandsB.resolveAppeal(caseId, {
      granted: true,
      finalOutcome: requestedOutcome,
      note: 'Appeal granted on verified evidence',
      idempotencyKey: 'appeal-resolve:race',
    }, arbitrator));
    expect(final.status).toBe('FINAL');
    expect(final.outcome).toBe(requestedOutcome);
    expect((final.appeals as Array<Record<string, unknown>>)[0].status).toBe('GRANTED');

    const finalCounts = await authorityCounts(admin, caseId);
    expect(finalCounts.ledgerLinks).toBe(4); // hold + original + compensating reversal + final allocation
    expect(finalCounts.finalSettlementEvents).toBe(1);
    expect(finalCounts.openAppeals).toBe(0);
  });

  it('rolls back case, hold, audit, outbox and receipt when escrow balance is insufficient', async () => {
    const dealId = 'deal-dispute-insufficient';
    await seedDeal(admin, dealId, 100_000_000n, 10_000_000n);

    await expect(commandsA.open({
      dealId,
      type: 'WEIGHT',
      description: 'Claim intentionally exceeds the funded escrow balance',
      claimAmountKopecks: '50000000',
      severity: 'HIGH',
      idempotencyKey: 'open:insufficient',
    }, buyer)).rejects.toMatchObject({ response: { code: 'DISPUTE_INSUFFICIENT_LEDGER_BALANCE' } });

    const state = await dealAuthorityCounts(admin, dealId);
    expect(state.cases).toBe(0);
    expect(state.holds).toBe(0);
    expect(state.disputeLedgerLinks).toBe(0);
    expect(state.disputeAudits).toBe(0);
    expect(state.disputeOutbox).toBe(0);
    expect(state.receipts).toBe(0);
    expect(state.ledgerEntries).toBe(1); // only the fixture reserve remains
  });

  it('rolls the complete command back when outbox persistence fails', async () => {
    const dealId = 'deal-dispute-injected-failure';
    await seedDeal(admin, dealId, 100_000_000n, 100_000_000n);
    await installOutboxFailure(admin, dealId);
    try {
      await expect(commandsA.open({
        dealId,
        type: 'DOCUMENTS',
        description: 'Injected outbox failure must roll back the full command',
        claimAmountKopecks: '25000000',
        severity: 'MEDIUM',
        idempotencyKey: 'open:rollback',
      }, buyer)).rejects.toBeDefined();
    } finally {
      await removeOutboxFailure(admin);
    }

    const state = await dealAuthorityCounts(admin, dealId);
    expect(state.cases).toBe(0);
    expect(state.holds).toBe(0);
    expect(state.disputeLedgerLinks).toBe(0);
    expect(state.disputeAudits).toBe(0);
    expect(state.disputeOutbox).toBe(0);
    expect(state.receipts).toBe(0);
    expect(state.ledgerEntries).toBe(1);
  });

  it('enforces FORCE-RLS visibility and denies direct application writes', async () => {
    const visible = await queriesA.list(buyer);
    expect(visible.some((item) => item.dealId === 'deal-dispute-race')).toBe(true);

    const foreignQueries = new DisputeQueryService(new RlsTransactionService(appA));
    const hidden = await foreignQueries.list(foreignBuyer);
    expect(hidden).toHaveLength(0);

    const rls = new RlsTransactionService(appA);
    await expect(rls.withTrustedContext(buyer, (tx) => tx.$executeRawUnsafe(
      `INSERT INTO dispute.cases (id, tenant_id, deal_id, case_type, description, initiator_org_id, respondent_org_id) VALUES ('forged-dispute', '${TENANT}', 'deal-dispute-race', 'FORGED', 'forged', '${BUYER_ORG}', '${SELLER_ORG}')`,
    ))).rejects.toThrow(/permission denied|row-level security/i);
  });
});

async function seedActors(admin: PrismaClient): Promise<void> {
  for (const [orgId, tenantId, inn] of [
    [BUYER_ORG, TENANT, '7711111101'],
    [SELLER_ORG, TENANT, '7711111102'],
    [SERVICE_ORG, TENANT, '7711111103'],
    [FOREIGN_ORG, FOREIGN_TENANT, '7711111104'],
  ] as const) {
    await admin.organization.create({
      data: {
        id: orgId,
        inn,
        name: orgId,
        tenantId,
        status: 'VERIFIED',
        kycStatus: 'APPROVED',
        amlStatus: 'CLEAR',
        verifiedAt: new Date(),
      },
    });
  }
  for (const user of [buyer, seller, operator, arbitrator, foreignBuyer]) {
    await admin.user.create({
      data: { id: user.id, email: user.email, passwordHash: 'industrial-test-only', fullName: user.id, status: 'ACTIVE' },
    });
    await admin.userOrg.create({
      data: { userId: user.id, organizationId: user.orgId, role: user.role, isDefault: true },
    });
  }
}

async function seedDeal(admin: PrismaClient, dealId: string, total: bigint, funded: bigint): Promise<void> {
  await admin.deal.create({
    data: {
      id: dealId,
      dealNumber: `DISPUTE-${dealId}`,
      tenantId: TENANT,
      status: 'ACCEPTED',
      sellerOrgId: SELLER_ORG,
      buyerOrgId: BUYER_ORG,
      totalKopecks: total,
      currency: 'RUB',
    },
  });
  for (const user of [buyer, seller, operator, arbitrator]) {
    await admin.dealParticipant.create({
      data: {
        id: `participant:${dealId}:${user.id}`,
        dealId,
        tenantId: TENANT,
        organizationId: user.orgId,
        userId: user.id,
        role: user.role,
        accessLevel: user.role === Role.ARBITRATOR || user.role === Role.SUPPORT_MANAGER ? 'APPROVE' : 'WORK',
        status: 'ACTIVE',
      },
    });
  }
  await admin.ledgerEntry.create({
    data: {
      id: `ledger:reserve:${dealId}`,
      dealId,
      entryType: 'RESERVE',
      debitAccount: `buyer:${BUYER_ORG}`,
      creditAccount: `escrow:${dealId}`,
      amountKopecks: funded,
      currency: 'RUB',
      reference: `reserve:${dealId}`,
      idempotencyKey: `reserve:${dealId}`,
      description: 'Controlled funded escrow fixture',
      createdByUserId: operator.id,
    },
  });
}

async function authorityCounts(admin: PrismaClient, caseId: string) {
  const rows = await admin.$queryRawUnsafe<Array<Record<string, bigint>>>(`
    SELECT
      (SELECT count(*) FROM dispute.command_receipts WHERE command_type='RESOLVE_CASE' AND result->>'id'=$1)::bigint AS "resolveReceipts",
      (SELECT count(*) FROM public.audit_events WHERE action='dispute:resolved' AND "disputeId"=$1)::bigint AS "resolutionAudits",
      (SELECT count(*) FROM public.outbox_entries WHERE type='DISPUTE_SETTLEMENT_BASIS_READY' AND payload->>'disputeId'=$1)::bigint AS "settlementEvents",
      (SELECT count(*) FROM dispute.holds WHERE case_id=$1)::bigint AS holds,
      (SELECT count(*) FROM dispute.ledger_links WHERE case_id=$1)::bigint AS "ledgerLinks",
      (SELECT count(*) FROM public.outbox_entries WHERE type='DISPUTE_FINAL_SETTLEMENT_BASIS_READY' AND payload->>'disputeId'=$1)::bigint AS "finalSettlementEvents",
      (SELECT count(*) FROM dispute.appeals WHERE case_id=$1 AND status='OPEN')::bigint AS "openAppeals"
  `, caseId);
  return Object.fromEntries(Object.entries(rows[0]).map(([key, value]) => [key, Number(value)])) as Record<keyof typeof rows[0], number>;
}

async function dealAuthorityCounts(admin: PrismaClient, dealId: string) {
  const rows = await admin.$queryRawUnsafe<Array<Record<string, bigint>>>(`
    SELECT
      (SELECT count(*) FROM dispute.cases WHERE deal_id=$1)::bigint AS cases,
      (SELECT count(*) FROM dispute.holds h JOIN dispute.cases c ON c.id=h.case_id WHERE c.deal_id=$1)::bigint AS holds,
      (SELECT count(*) FROM dispute.ledger_links l JOIN dispute.cases c ON c.id=l.case_id WHERE c.deal_id=$1)::bigint AS "disputeLedgerLinks",
      (SELECT count(*) FROM public.audit_events WHERE "dealId"=$1 AND action LIKE 'dispute:%')::bigint AS "disputeAudits",
      (SELECT count(*) FROM public.outbox_entries WHERE "dealId"=$1 AND type LIKE 'DISPUTE_%')::bigint AS "disputeOutbox",
      (SELECT count(*) FROM dispute.command_receipts r WHERE r.result->>'dealId'=$1)::bigint AS receipts,
      (SELECT count(*) FROM public.ledger_entries WHERE "dealId"=$1)::bigint AS "ledgerEntries"
  `, dealId);
  return Object.fromEntries(Object.entries(rows[0]).map(([key, value]) => [key, Number(value)])) as Record<keyof typeof rows[0], number>;
}

async function installOutboxFailure(admin: PrismaClient, dealId: string): Promise<void> {
  await admin.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION public.fail_dispute_outbox_test()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.type='DISPUTE_OPENED' AND NEW."dealId"='${dealId}' THEN
        RAISE EXCEPTION 'INJECTED_DISPUTE_OUTBOX_FAILURE';
      END IF;
      RETURN NEW;
    END $$;
    DROP TRIGGER IF EXISTS fail_dispute_outbox_test ON public.outbox_entries;
    CREATE TRIGGER fail_dispute_outbox_test BEFORE INSERT ON public.outbox_entries
    FOR EACH ROW EXECUTE FUNCTION public.fail_dispute_outbox_test();
  `);
}

async function removeOutboxFailure(admin: PrismaClient): Promise<void> {
  await admin.$executeRawUnsafe(`
    DROP TRIGGER IF EXISTS fail_dispute_outbox_test ON public.outbox_entries;
    DROP FUNCTION IF EXISTS public.fail_dispute_outbox_test();
  `);
}

async function reset(admin: PrismaClient): Promise<void> {
  await removeOutboxFailure(admin).catch(() => undefined);
  await admin.$executeRawUnsafe(`SET session_replication_role = replica`);
  try {
    await admin.$executeRawUnsafe(`DELETE FROM dispute.command_receipts WHERE tenant_id IN ('${TENANT}','${FOREIGN_TENANT}')`);
    await admin.$executeRawUnsafe(`DELETE FROM dispute.ledger_links WHERE tenant_id IN ('${TENANT}','${FOREIGN_TENANT}')`);
    await admin.$executeRawUnsafe(`DELETE FROM dispute.appeals WHERE tenant_id IN ('${TENANT}','${FOREIGN_TENANT}')`);
    await admin.$executeRawUnsafe(`DELETE FROM dispute.evidence WHERE tenant_id IN ('${TENANT}','${FOREIGN_TENANT}')`);
    await admin.$executeRawUnsafe(`DELETE FROM dispute.holds WHERE tenant_id IN ('${TENANT}','${FOREIGN_TENANT}')`);
    await admin.$executeRawUnsafe(`DELETE FROM dispute.cases WHERE tenant_id IN ('${TENANT}','${FOREIGN_TENANT}')`);
    await admin.$executeRawUnsafe(`DELETE FROM public.outbox_entries WHERE "dealId" LIKE 'deal-dispute-%'`);
    await admin.$executeRawUnsafe(`DELETE FROM public.audit_events WHERE "dealId" LIKE 'deal-dispute-%' OR "tenantId" IN ('${TENANT}','${FOREIGN_TENANT}')`);
    await admin.$executeRawUnsafe(`DELETE FROM public.ledger_entries WHERE "dealId" LIKE 'deal-dispute-%'`);
    await admin.$executeRawUnsafe(`DELETE FROM public.deal_participants WHERE "tenantId" IN ('${TENANT}','${FOREIGN_TENANT}')`);
    await admin.$executeRawUnsafe(`DELETE FROM public.deals WHERE "tenantId" IN ('${TENANT}','${FOREIGN_TENANT}')`);
    await admin.$executeRawUnsafe(`DELETE FROM public.user_orgs WHERE "organizationId" IN ('${BUYER_ORG}','${SELLER_ORG}','${SERVICE_ORG}','${FOREIGN_ORG}')`);
    await admin.$executeRawUnsafe(`DELETE FROM public.users WHERE id LIKE 'user-dispute-%'`);
    await admin.$executeRawUnsafe(`DELETE FROM public.organizations WHERE id IN ('${BUYER_ORG}','${SELLER_ORG}','${SERVICE_ORG}','${FOREIGN_ORG}')`);
  } finally {
    await admin.$executeRawUnsafe(`SET session_replication_role = DEFAULT`);
  }
}
