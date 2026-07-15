import { PrismaClient } from '@prisma/client';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import type { RequestUser } from '../../src/common/types/request-user';
import { PostgresqlDisputeRepository } from '../../src/modules/disputes/postgresql-dispute.repository';
import { SettlementPostgresqlRepository } from '../../src/modules/settlement-engine/settlement-postgresql.repository';

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL;
const APP_URL = process.env.DATABASE_URL;
const describePostgresql = ADMIN_URL && APP_URL ? describe : describe.skip;

const TENANT = 'tenant-dispute-pg';
const FOREIGN_TENANT = 'tenant-dispute-foreign';
const DEAL = 'deal-dispute-pg';
const BUYER_ORG = 'org-dispute-buyer';
const SELLER_ORG = 'org-dispute-seller';
const OPS_ORG = 'org-dispute-ops';
const FOREIGN_ORG = 'org-dispute-foreign';
const BUYER_USER = 'user-dispute-buyer';
const SELLER_USER = 'user-dispute-seller';
const LAB_USER = 'user-dispute-lab';
const ARBITRATOR_USER = 'user-dispute-arbitrator';
const ACCOUNTING_USER = 'user-dispute-accounting';
const FOREIGN_USER = 'user-dispute-foreign';

function actor(id: string, orgId: string, tenantId: string, role: RequestUser['role']): RequestUser {
  return {
    id,
    orgId,
    tenantId,
    role,
    email: `${id}@example.test`,
    sessionId: `session:${id}`,
    mfaVerified: true,
  };
}

const buyer = actor(BUYER_USER, BUYER_ORG, TENANT, 'BUYER');
const lab = actor(LAB_USER, OPS_ORG, TENANT, 'LAB');
const arbitrator = actor(ARBITRATOR_USER, OPS_ORG, TENANT, 'ARBITRATOR');
const accounting = actor(ACCOUNTING_USER, OPS_ORG, TENANT, 'ACCOUNTING');
const foreignBuyer = actor(FOREIGN_USER, FOREIGN_ORG, FOREIGN_TENANT, 'BUYER');

function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected object result');
  }
  return value as Record<string, any>;
}

function responseCode(reason: unknown): string {
  if (!reason || typeof reason !== 'object') return String(reason);
  const response = (reason as { response?: unknown }).response;
  if (response && typeof response === 'object' && 'code' in response) {
    return String((response as { code?: unknown }).code);
  }
  return String((reason as { message?: unknown }).message ?? reason);
}

describePostgresql('Disputes PostgreSQL authority', () => {
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

  afterAll(async () => {
    await Promise.all([admin?.$disconnect(), app?.$disconnect()]);
  });

  it('rolls back the case when atomic settlement hold insertion fails', async () => {
    await admin.$executeRawUnsafe(`
      INSERT INTO settlement.holds (
        id, tenant_id, deal_id, payment_id, amount_minor, status, basis_type,
        basis_id, reason, command_id, idempotency_key, request_fingerprint,
        created_by_user_id, released_by_user_id, released_at
      ) VALUES (
        'forced-dispute-hold-collision', '${TENANT}', '${DEAL}', 'payment-dispute-pg',
        1, 'RELEASED', 'OTHER', 'forced', 'forced collision', 'forced-command',
        'dispute-hold:open:rollback', repeat('a', 64), '${ACCOUNTING_USER}',
        '${ACCOUNTING_USER}', now()
      )
    `);

    await expect(disputes.open({
      dealId: DEAL,
      reason: 'ROLLBACK',
      detail: 'This transaction must roll back completely.',
      claimAmountKopecks: '1000',
      currency: 'RUB',
      idempotencyKey: 'open:rollback',
    }, buyer)).rejects.toBeDefined();

    const [counts] = await admin.$queryRawUnsafe<Array<{ cases: bigint; holds: bigint; active: bigint }>>(`
      SELECT
        (SELECT count(*) FROM dispute.cases WHERE deal_id = '${DEAL}' AND type = 'ROLLBACK') AS cases,
        (SELECT count(*) FROM settlement.holds WHERE basis_type = 'DISPUTE' AND basis_id LIKE 'dispute-%') AS holds,
        (SELECT active_hold_minor FROM settlement.payments WHERE deal_id = '${DEAL}') AS active
    `);
    expect(Number(counts.cases)).toBe(0);
    expect(Number(counts.holds)).toBe(0);
    expect(counts.active).toBe(0n);
    await admin.$executeRawUnsafe(`DELETE FROM settlement.holds WHERE id = 'forced-dispute-hold-collision'`);
  });

  it('executes open, replay, race, evidence, appeal, settlement callback and close', async () => {
    const opened = object(await disputes.open({
      dealId: DEAL,
      reason: 'QUALITY',
      detail: 'Laboratory quality differs from the contractual specification.',
      claimAmountKopecks: '5000000',
      currency: 'RUB',
      idempotencyKey: 'open:quality:1',
    }, buyer));
    const disputeId = String(opened.id);
    expect(opened.status).toBe('OPEN');
    expect(opened.claimAmountKopecks).toBe('5000000');
    expect(opened.settlementHoldId).toBeTruthy();
    expect(opened.version).toBe('2');

    const replay = object(await disputes.open({
      dealId: DEAL,
      reason: 'QUALITY',
      detail: 'Laboratory quality differs from the contractual specification.',
      claimAmountKopecks: '5000000',
      currency: 'RUB',
      idempotencyKey: 'open:quality:1',
    }, buyer));
    expect(replay.duplicate).toBe(true);
    expect(replay.id).toBe(disputeId);

    const restartedApp = new PrismaService();
    await restartedApp.$connect();
    try {
      const restarted = new PostgresqlDisputeRepository(new RlsTransactionService(restartedApp));
      const restartedReplay = object(await restarted.open({
        dealId: DEAL,
        reason: 'QUALITY',
        detail: 'Laboratory quality differs from the contractual specification.',
        claimAmountKopecks: '5000000',
        currency: 'RUB',
        idempotencyKey: 'open:quality:1',
      }, buyer));
      expect(restartedReplay.duplicate).toBe(true);
      expect(restartedReplay.id).toBe(disputeId);
    } finally {
      await restartedApp.$disconnect();
    }

    await expect(disputes.getOne(disputeId, foreignBuyer)).rejects.toBeDefined();

    const triageRace = await Promise.allSettled([
      disputes.triage(disputeId, { expectedVersion: '2', idempotencyKey: 'triage:one' }, arbitrator),
      disputes.triage(disputeId, { expectedVersion: '2', idempotencyKey: 'triage:two' }, arbitrator),
    ]);
    expect(triageRace.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(triageRace.filter((item) => item.status === 'rejected')).toHaveLength(1);
    expect(['DISPUTE_STALE_VERSION', 'DISPUTE_TRIAGE_STATE_INVALID']).toContain(
      responseCode((triageRace.find((item) => item.status === 'rejected') as PromiseRejectedResult).reason),
    );

    const evidence = object(await disputes.addEvidence(disputeId, {
      type: 'LAB',
      description: 'Signed laboratory protocol confirms the deviation.',
      source: 'accredited-laboratory',
      expectedVersion: '3',
      idempotencyKey: 'evidence:lab:1',
    }, lab));
    expect(evidence.version).toBe('4');
    expect(evidence.evidence).toHaveLength(1);
    expect(evidence.evidence[0].trusted).toBe(true);
    expect(evidence.evidence[0].hash).toMatch(/^[0-9a-f]{64}$/);

    const decided = object(await disputes.decide(disputeId, {
      outcome: 'SPLIT',
      sellerSplitPct: 40,
      note: 'Evidence supports a proportional allocation of the disputed amount.',
      expectedVersion: '4',
      idempotencyKey: 'decision:initial',
    }, arbitrator));
    expect(decided.status).toBe('DECISION');
    expect(decided.version).toBe('5');
    expect(decided.moneyInstructions.at(-1).status).toBe('PENDING_APPEAL');

    const appealed = object(await disputes.appeal(disputeId, {
      reason: 'The buyer requests review of the allocation based on the signed protocol.',
      expectedVersion: '5',
      idempotencyKey: 'appeal:buyer:1',
    }, buyer));
    expect(appealed.status).toBe('APPEALED');
    expect(appealed.version).toBe('6');

    const resolved = object(await disputes.resolveAppeal(disputeId, {
      resolution: 'MODIFIED',
      finalOutcome: 'BUYER_WIN',
      note: 'The signed protocol establishes the buyer claim in full.',
      expectedVersion: '6',
      idempotencyKey: 'appeal:resolve:1',
    }, arbitrator));
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.version).toBe('7');
    const instruction = resolved.moneyInstructions.at(-1);
    expect(instruction.action).toBe('REFUND_BUYER');
    expect(instruction.buyerRefundKopecks).toBe('5000000');
    expect(instruction.status).toBe('READY');

    await expect(disputes.close(disputeId, {
      expectedVersion: '7',
      idempotencyKey: 'close:too-early',
    }, arbitrator)).rejects.toMatchObject({
      response: { code: 'DISPUTE_SETTLEMENT_HOLD_NOT_RELEASED' },
    });

    const holdId = String(resolved.settlementHoldId);
    const releasedHold = object(await settlement.releaseHold({
      commandId: 'settlement-command:dispute-hold-release',
      idempotencyKey: 'settlement:dispute-hold-release',
      holdId,
      dealId: DEAL,
      expectedPaymentVersion: '1',
    }, accounting));
    expect(releasedHold.duplicate).toBe(false);

    const refund = object(await settlement.requestOperation({
      commandId: 'settlement-command:dispute-refund',
      idempotencyKey: 'settlement:dispute-refund',
      dealId: DEAL,
      operation: 'REFUND',
      amountKopecks: '5000000',
      partnerId: 'bank-dispute-test',
      expectedPaymentVersion: '2',
      expectedDealVersion: '0',
    }, accounting));
    expect(refund.status).toBe('PENDING');

    const callback = object(await settlement.registerVerifiedCallback({
      dealId: DEAL,
      operationId: String(refund.operationId),
      eventId: 'bank-event:dispute-refund:1',
      operation: 'REFUND',
      status: 'SUCCESS',
      bankRef: 'bank-ref-dispute-refund-1',
      partnerId: 'bank-dispute-test',
      keyId: 'bank-key-dispute-test',
      payloadFingerprint: 'b'.repeat(64),
      payload: { confirmed: true },
    }));
    expect(callback.status).toBe('SUCCESS');

    const bound = object(await disputes.bindOperations(disputeId, {
      instructionId: String(instruction.id),
      buyerOperationId: String(refund.operationId),
      expectedVersion: '7',
      idempotencyKey: 'bind:refund:1',
    }, accounting));
    expect(bound.version).toBe('8');

    const closed = object(await disputes.close(disputeId, {
      expectedVersion: '8',
      idempotencyKey: 'close:final',
    }, arbitrator));
    expect(closed.status).toBe('CLOSED');
    expect(closed.version).toBe('9');
    expect(closed.moneyInstructions.at(-1).status).toBe('EXECUTED');

    const [facts] = await admin.$queryRawUnsafe<Array<Record<string, bigint>>>(`
      SELECT
        (SELECT count(*) FROM dispute.cases WHERE id = '${disputeId}') AS cases,
        (SELECT count(*) FROM settlement.holds WHERE basis_id = '${disputeId}') AS holds,
        (SELECT count(*) FROM dispute.command_receipts WHERE result ->> 'id' = '${disputeId}') AS receipts,
        (SELECT count(*) FROM public."audit_events" WHERE "objectType" = 'dispute' AND "objectId" = '${disputeId}') AS audits,
        (SELECT count(*) FROM public."outbox_entries" WHERE payload ->> 'disputeId' = '${disputeId}') AS outbox
    `);
    expect(Number(facts.cases)).toBe(1);
    expect(Number(facts.holds)).toBe(1);
    expect(Number(facts.receipts)).toBeGreaterThanOrEqual(7);
    expect(Number(facts.audits)).toBeGreaterThanOrEqual(7);
    expect(Number(facts.outbox)).toBeGreaterThanOrEqual(3);
  }, 180_000);
});

async function reset(admin: PrismaClient) {
  await admin.$executeRawUnsafe(`
    TRUNCATE TABLE
      dispute.command_receipts,
      dispute.money_instructions,
      dispute.appeals,
      dispute.evidence,
      dispute.participants,
      dispute.cases,
      settlement.reconciliation_facts,
      settlement.ledger_entries,
      settlement.bank_callbacks,
      settlement.bank_operations,
      settlement.holds,
      settlement.payments,
      settlement.beneficiaries,
      settlement.payment_terms,
      public."outbox_entries",
      public."audit_events",
      public."deal_events",
      public."payments",
      public."bank_operations",
      public."ledger_entries",
      public."deal_participants",
      public."deals",
      public."user_orgs",
      public."users",
      public."organizations"
    RESTART IDENTITY CASCADE
  `);
}

async function seed(admin: PrismaClient) {
  const organizations = [
    [BUYER_ORG, '7800000101', 'Dispute Buyer', TENANT],
    [SELLER_ORG, '7800000102', 'Dispute Seller', TENANT],
    [OPS_ORG, '7800000103', 'Dispute Operations', TENANT],
    [FOREIGN_ORG, '7800000104', 'Foreign Dispute Buyer', FOREIGN_TENANT],
  ];
  for (const [id, inn, name, tenantId] of organizations) {
    await admin.organization.create({
      data: {
        id, inn, name, tenantId, status: 'VERIFIED', kycStatus: 'APPROVED',
        amlStatus: 'CLEAR', sanctionHit: false, verifiedAt: new Date(),
      },
    });
  }

  const users = [
    [BUYER_USER, BUYER_ORG, 'BUYER'],
    [SELLER_USER, SELLER_ORG, 'FARMER'],
    [LAB_USER, OPS_ORG, 'LAB'],
    [ARBITRATOR_USER, OPS_ORG, 'ARBITRATOR'],
    [ACCOUNTING_USER, OPS_ORG, 'ACCOUNTING'],
    [FOREIGN_USER, FOREIGN_ORG, 'BUYER'],
  ];
  for (const [id, organizationId, role] of users) {
    await admin.user.create({
      data: { id, email: `${id}@example.test`, passwordHash: 'not-used', fullName: id, status: 'ACTIVE' },
    });
    await admin.userOrg.create({
      data: { id: `membership:${id}`, userId: id, organizationId, role, isDefault: true },
    });
  }

  await admin.deal.create({
    data: {
      id: DEAL,
      dealNumber: 'DISPUTE-PG-001',
      status: 'RESERVED',
      tenantId: TENANT,
      sellerOrgId: SELLER_ORG,
      buyerOrgId: BUYER_ORG,
      totalKopecks: 10_000_000n,
      currency: 'RUB',
      version: 0n,
    },
  });

  const participants = [
    [BUYER_USER, BUYER_ORG, 'BUYER'],
    [SELLER_USER, SELLER_ORG, 'FARMER'],
    [LAB_USER, OPS_ORG, 'LAB'],
  ];
  for (const [userId, organizationId, role] of participants) {
    await admin.dealParticipant.create({
      data: {
        id: `participant:${userId}`,
        dealId: DEAL,
        tenantId: TENANT,
        organizationId,
        userId,
        role,
        accessLevel: 'APPROVE',
        status: 'ACTIVE',
      },
    });
  }

  await admin.$executeRawUnsafe(`
    INSERT INTO settlement.payment_terms (
      id, tenant_id, deal_id, version, currency, reserve_amount_minor,
      release_basis, status, command_id, idempotency_key, request_fingerprint,
      created_by_user_id, created_by_org_id
    ) VALUES (
      'terms-dispute-pg', '${TENANT}', '${DEAL}', 1, 'RUB', 10000000,
      '{}'::jsonb, 'ACTIVE', 'seed-terms', 'seed-terms-dispute-pg', repeat('1', 64),
      '${ACCOUNTING_USER}', '${OPS_ORG}'
    );
    INSERT INTO settlement.payments (
      id, tenant_id, deal_id, payment_terms_id, status, currency,
      confirmed_reserved_minor, version
    ) VALUES (
      'payment-dispute-pg', '${TENANT}', '${DEAL}', 'terms-dispute-pg',
      'RESERVED', 'RUB', 10000000, 0
    );
  `);
}
