import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import type { RequestUser } from '../../src/common/types/request-user';
import { PostgresqlDisputeRepository } from '../../src/modules/disputes/postgresql-dispute.repository';
import { SettlementPostgresqlRepository } from '../../src/modules/settlement-engine/settlement-postgresql.repository';

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL;
const APP_URL = process.env.DATABASE_URL;
const describePg = ADMIN_URL && APP_URL ? describe : describe.skip;
const T = 'tenant-dispute-pg';
const FT = 'tenant-dispute-foreign';
const DEAL = 'deal-dispute-pg';
const BUYER_ORG = 'org-dispute-buyer';
const SELLER_ORG = 'org-dispute-seller';
const OPS_ORG = 'org-dispute-ops';
const FOREIGN_ORG = 'org-dispute-foreign';

function actor(id: string, orgId: string, tenantId: string, role: RequestUser['role']): RequestUser {
  return { id, orgId, tenantId, role, email: `${id}@test.local`, sessionId: `session:${id}`, mfaVerified: true };
}
const buyer = actor('user-dispute-buyer', BUYER_ORG, T, 'BUYER');
const lab = actor('user-dispute-lab', OPS_ORG, T, 'LAB');
const arbitrator = actor('user-dispute-arbitrator', OPS_ORG, T, 'ARBITRATOR');
const accounting = actor('user-dispute-accounting', OPS_ORG, T, 'ACCOUNTING');
const foreignBuyer = actor('user-dispute-foreign', FOREIGN_ORG, FT, 'BUYER');

function obj(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object');
  return value as Record<string, any>;
}
function code(reason: unknown): string {
  const response = (reason as { response?: any })?.response;
  return String(response?.code ?? (reason as { message?: unknown })?.message ?? reason);
}

describePg('Disputes PostgreSQL authority', () => {
  let admin: PrismaClient;
  let app: PrismaService;
  let disputes: PostgresqlDisputeRepository;
  let settlement: SettlementPostgresqlRepository;

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL! } } });
    app = new PrismaService();
    await Promise.all([admin.$connect(), app.$connect()]);
    const rls = new RlsTransactionService(app);
    disputes = new PostgresqlDisputeRepository(rls);
    settlement = new SettlementPostgresqlRepository(app, rls);
    await reset(admin);
    await seed(admin);
  }, 90_000);

  afterAll(async () => Promise.all([admin?.$disconnect(), app?.$disconnect()]));

  it('rolls back the case when the atomic hold cannot be persisted', async () => {
    await admin.$executeRawUnsafe(`
      INSERT INTO settlement.holds (
        id, tenant_id, deal_id, payment_id, amount_minor, status, basis_type,
        basis_id, reason, command_id, idempotency_key, request_fingerprint,
        created_by_user_id, released_by_user_id, released_at
      ) VALUES (
        'forced-dispute-collision', '${T}', '${DEAL}', 'payment-dispute-pg', 1,
        'RELEASED', 'OTHER', 'forced', 'forced collision', 'forced-command',
        'dispute-hold:open:rollback', repeat('a',64), '${accounting.id}',
        '${accounting.id}', now()
      )
    `);
    await expect(disputes.open({
      dealId: DEAL, reason: 'ROLLBACK', detail: 'Atomic hold collision must roll back the case.',
      claimAmountKopecks: '1000', currency: 'RUB', idempotencyKey: 'open:rollback',
    }, buyer)).rejects.toBeDefined();
    const rows = await admin.$queryRawUnsafe<Array<{ cases: bigint; active: bigint }>>(`
      SELECT
        (SELECT count(*) FROM dispute.cases WHERE type='ROLLBACK') AS cases,
        (SELECT active_hold_minor FROM settlement.payments WHERE deal_id='${DEAL}') AS active
    `);
    expect(Number(rows[0].cases)).toBe(0);
    expect(rows[0].active).toBe(0n);
  });

  it('survives replay and races, then closes only after a verified refund callback', async () => {
    const input = {
      dealId: DEAL, reason: 'QUALITY',
      detail: 'Signed laboratory protocol confirms a contractual quality deviation.',
      claimAmountKopecks: '5000000', currency: 'RUB', idempotencyKey: 'open:quality:1',
    };
    const opened = obj(await disputes.open(input, buyer));
    const id = String(opened.id);
    expect(opened).toMatchObject({ status: 'OPEN', version: '2', claimAmountKopecks: '5000000' });

    const replay = obj(await disputes.open(input, buyer));
    expect(replay).toMatchObject({ id, duplicate: true });
    const restartedApp = new PrismaService();
    await restartedApp.$connect();
    try {
      const restarted = new PostgresqlDisputeRepository(new RlsTransactionService(restartedApp));
      expect(obj(await restarted.open(input, buyer))).toMatchObject({ id, duplicate: true });
    } finally {
      await restartedApp.$disconnect();
    }
    await expect(disputes.getOne(id, foreignBuyer)).rejects.toBeDefined();

    const race = await Promise.allSettled([
      disputes.triage(id, { expectedVersion: '2', idempotencyKey: 'triage:1' }, arbitrator),
      disputes.triage(id, { expectedVersion: '2', idempotencyKey: 'triage:2' }, arbitrator),
    ]);
    expect(race.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(race.filter((item) => item.status === 'rejected')).toHaveLength(1);
    expect(['DISPUTE_STALE_VERSION', 'DISPUTE_TRIAGE_STATE_INVALID']).toContain(
      code((race.find((item) => item.status === 'rejected') as PromiseRejectedResult).reason),
    );

    const evidence = obj(await disputes.addEvidence(id, {
      type: 'LAB', description: 'Accredited signed protocol confirms the deviation.',
      source: 'accredited-laboratory', expectedVersion: '3', idempotencyKey: 'evidence:1',
    }, lab));
    expect(evidence.version).toBe('4');
    expect(evidence.evidence[0]).toMatchObject({ trusted: true, type: 'LAB' });
    expect(evidence.evidence[0].hash).toMatch(/^[0-9a-f]{64}$/);

    const decision = obj(await disputes.decide(id, {
      outcome: 'SPLIT', sellerSplitPct: 40,
      note: 'Evidence supports proportional allocation pending the appeal window.',
      expectedVersion: '4', idempotencyKey: 'decision:1',
    }, arbitrator));
    expect(decision).toMatchObject({ status: 'DECISION', version: '5' });

    const appealed = obj(await disputes.appeal(id, {
      reason: 'Buyer requests full review using the signed accredited protocol.',
      expectedVersion: '5', idempotencyKey: 'appeal:1',
    }, buyer));
    expect(appealed).toMatchObject({ status: 'APPEALED', version: '6' });

    const resolved = obj(await disputes.resolveAppeal(id, {
      resolution: 'MODIFIED', finalOutcome: 'BUYER_WIN',
      note: 'The accredited protocol proves the buyer claim in full.',
      expectedVersion: '6', idempotencyKey: 'appeal:resolve:1',
    }, arbitrator));
    expect(resolved).toMatchObject({ status: 'RESOLVED', version: '7' });
    const instruction = resolved.moneyInstructions.at(-1);
    expect(instruction).toMatchObject({ action: 'REFUND_BUYER', buyerRefundKopecks: '5000000', status: 'READY' });

    await expect(disputes.close(id, {
      expectedVersion: '7', idempotencyKey: 'close:early',
    }, arbitrator)).rejects.toMatchObject({ response: { code: 'DISPUTE_SETTLEMENT_HOLD_NOT_RELEASED' } });

    await settlement.releaseHold({
      commandId: 'settlement-command:release-dispute-hold',
      idempotencyKey: 'settlement:release-dispute-hold',
      holdId: String(resolved.settlementHoldId), dealId: DEAL, expectedPaymentVersion: '1',
    }, accounting);
    const refund = obj(await settlement.requestOperation({
      commandId: 'settlement-command:dispute-refund',
      idempotencyKey: 'settlement:dispute-refund', dealId: DEAL,
      operation: 'REFUND', amountKopecks: '5000000', partnerId: 'bank-dispute-test',
      expectedPaymentVersion: '2',
    }, accounting));
    const callback = obj(await settlement.registerVerifiedCallback({
      dealId: DEAL, operationId: String(refund.operationId),
      eventId: 'bank-event:dispute-refund:1', operation: 'REFUND', status: 'SUCCESS',
      bankRef: 'bank-ref-dispute-refund-1', partnerId: 'bank-dispute-test',
      keyId: 'bank-key-dispute-test', payloadFingerprint: 'b'.repeat(64),
      payload: { confirmed: true },
    }));
    expect(callback.status).toBe('SUCCESS');

    const bound = obj(await disputes.bindOperations(id, {
      instructionId: String(instruction.id), buyerOperationId: String(refund.operationId),
      expectedVersion: '7', idempotencyKey: 'bind:refund:1',
    }, accounting));
    expect(bound.version).toBe('8');
    const closed = obj(await disputes.close(id, {
      expectedVersion: '8', idempotencyKey: 'close:final',
    }, arbitrator));
    expect(closed).toMatchObject({ status: 'CLOSED', version: '9' });
    expect(closed.moneyInstructions.at(-1).status).toBe('EXECUTED');

    const facts = await admin.$queryRawUnsafe<Array<Record<string, bigint>>>(`
      SELECT
        (SELECT count(*) FROM dispute.cases WHERE id='${id}') AS cases,
        (SELECT count(*) FROM settlement.holds WHERE basis_id='${id}') AS holds,
        (SELECT count(*) FROM public."audit_events" WHERE "objectType"='dispute' AND "objectId"='${id}') AS audits,
        (SELECT count(*) FROM public."outbox_entries" WHERE payload->>'disputeId'='${id}') AS outbox
    `);
    expect(Number(facts[0].cases)).toBe(1);
    expect(Number(facts[0].holds)).toBe(1);
    expect(Number(facts[0].audits)).toBeGreaterThanOrEqual(7);
    expect(Number(facts[0].outbox)).toBeGreaterThanOrEqual(3);
  }, 180_000);
});

async function reset(admin: PrismaClient) {
  await admin.$executeRawUnsafe(`TRUNCATE TABLE
    dispute.command_receipts, dispute.money_instructions, dispute.appeals,
    dispute.evidence, dispute.participants, dispute.cases,
    settlement.reconciliation_facts, settlement.ledger_entries, settlement.bank_callbacks,
    settlement.bank_operations, settlement.holds, settlement.payments,
    settlement.beneficiaries, settlement.payment_terms,
    public."outbox_entries", public."audit_events", public."deal_events",
    public."payments", public."bank_operations", public."ledger_entries",
    public."deal_participants", public."deals", public."user_orgs",
    public."users", public."organizations" RESTART IDENTITY CASCADE`);
}

async function seed(admin: PrismaClient) {
  for (const [id, inn, name, tenantId] of [
    [BUYER_ORG, '7800000101', 'Dispute Buyer', T],
    [SELLER_ORG, '7800000102', 'Dispute Seller', T],
    [OPS_ORG, '7800000103', 'Dispute Operations', T],
    [FOREIGN_ORG, '7800000104', 'Foreign Buyer', FT],
  ]) {
    await admin.organization.create({ data: {
      id, inn, name, tenantId, status: 'VERIFIED', kycStatus: 'APPROVED',
      amlStatus: 'CLEAR', sanctionHit: false, verifiedAt: new Date(),
    } });
  }
  for (const [id, org, role] of [
    [buyer.id, BUYER_ORG, 'BUYER'], ['user-dispute-seller', SELLER_ORG, 'FARMER'],
    [lab.id, OPS_ORG, 'LAB'], [arbitrator.id, OPS_ORG, 'ARBITRATOR'],
    [accounting.id, OPS_ORG, 'ACCOUNTING'], [foreignBuyer.id, FOREIGN_ORG, 'BUYER'],
  ]) {
    await admin.user.create({ data: { id, email: `${id}@test.local`, passwordHash: 'unused', fullName: id, status: 'ACTIVE' } });
    await admin.userOrg.create({ data: { id: `membership:${id}`, userId: id, organizationId: org, role, isDefault: true } });
  }
  await admin.deal.create({ data: {
    id: DEAL, dealNumber: 'DISPUTE-PG-001', status: 'RESERVED', tenantId: T,
    sellerOrgId: SELLER_ORG, buyerOrgId: BUYER_ORG,
    totalKopecks: 10_000_000n, currency: 'RUB', version: 0n,
  } });
  for (const [userId, organizationId, role] of [
    [buyer.id, BUYER_ORG, 'BUYER'], ['user-dispute-seller', SELLER_ORG, 'FARMER'], [lab.id, OPS_ORG, 'LAB'],
  ]) {
    await admin.dealParticipant.create({ data: {
      id: `participant:${userId}`, dealId: DEAL, tenantId: T, organizationId,
      userId, role, accessLevel: 'APPROVE', status: 'ACTIVE',
    } });
  }
  await admin.payment.create({ data: {
    id: `payment:${DEAL}`, dealId: DEAL, status: 'RESERVED',
    amountKopecks: 10_000_000n, callbackState: 'CONFIRMED',
  } });
  await admin.$executeRawUnsafe(`INSERT INTO settlement.payment_terms (
    id, tenant_id, deal_id, version, currency, reserve_amount_minor,
    release_basis, status, command_id, idempotency_key, request_fingerprint,
    created_by_user_id, created_by_org_id
  ) VALUES (
    'terms-dispute-pg', '${T}', '${DEAL}', 1, 'RUB', 10000000,
    '{}'::jsonb, 'ACTIVE', 'seed-terms', 'seed-terms-dispute-pg', repeat('1',64),
    '${accounting.id}', '${OPS_ORG}'
  )`);
  await admin.$executeRawUnsafe(`INSERT INTO settlement.payments (
    id, tenant_id, deal_id, payment_terms_id, status, currency,
    confirmed_reserved_minor, version
  ) VALUES ('payment-dispute-pg', '${T}', '${DEAL}', 'terms-dispute-pg', 'RESERVED', 'RUB', 10000000, 0)`);
}
