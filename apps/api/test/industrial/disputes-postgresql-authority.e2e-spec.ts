import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import type { RequestUser } from '../../src/common/types/request-user';
import { PostgresqlDisputeRepository } from '../../src/modules/disputes/postgresql-dispute.repository';
import { SettlementPostgresqlRepository } from '../../src/modules/settlement-engine/settlement-postgresql.repository';

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL;
const APP_URL = process.env.DATABASE_URL;
const describePg = ADMIN_URL && APP_URL ? describe : describe.skip;
const TENANT = 'tenant-dispute-pg';
const FOREIGN_TENANT = 'tenant-dispute-foreign';
const DEAL_ID = 'deal-dispute-pg';
const BUYER_ORG = 'org-dispute-buyer';
const SELLER_ORG = 'org-dispute-seller';
const OPS_ORG = 'org-dispute-ops';
const OUTSIDER_ORG = 'org-dispute-outsider';
const FOREIGN_ORG = 'org-dispute-foreign';

function actor(id: string, orgId: string, tenantId: string, role: RequestUser['role']): RequestUser {
  return {
    id,
    orgId,
    tenantId,
    role,
    email: `${id}@test.local`,
    sessionId: `session:${id}`,
    mfaVerified: true,
  };
}

const buyer = actor('user-dispute-buyer', BUYER_ORG, TENANT, 'BUYER');
const seller = actor('user-dispute-seller', SELLER_ORG, TENANT, 'FARMER');
const lab = actor('user-dispute-lab', OPS_ORG, TENANT, 'LAB');
const arbitrator = actor('user-dispute-arbitrator', OPS_ORG, TENANT, 'ARBITRATOR');
const accounting = actor('user-dispute-accounting', OPS_ORG, TENANT, 'ACCOUNTING');
const outsider = actor('user-dispute-outsider', OUTSIDER_ORG, TENANT, 'BUYER');
const foreignBuyer = actor('user-dispute-foreign', FOREIGN_ORG, FOREIGN_TENANT, 'BUYER');

function result(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected object result');
  }
  return value as Record<string, any>;
}

function errorCode(reason: unknown): string {
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

  afterAll(async () => {
    await Promise.all([admin?.$disconnect(), app?.$disconnect()]);
  });

  it('rolls back case, audit, outbox and hold counter when hold persistence fails', async () => {
    await admin.$executeRawUnsafe(`INSERT INTO settlement.holds (
      id, tenant_id, deal_id, payment_id, amount_minor, status, basis_type,
      basis_id, reason, command_id, idempotency_key, request_fingerprint,
      created_by_user_id, released_by_user_id, released_at
    ) VALUES (
      'forced-dispute-collision', '${TENANT}', '${DEAL_ID}', 'payment-dispute-pg', 1,
      'RELEASED', 'OTHER', 'forced', 'forced collision', 'forced-command',
      'dispute-hold:open:rollback', repeat('a',64), '${accounting.id}',
      '${accounting.id}', now()
    )`);

    await expect(disputes.open({
      dealId: DEAL_ID,
      reason: 'ROLLBACK',
      detail: 'Atomic hold collision must roll back the complete dispute command.',
      claimAmountKopecks: '1000',
      currency: 'RUB',
      idempotencyKey: 'open:rollback',
    }, buyer)).rejects.toBeDefined();

    const rows = await admin.$queryRawUnsafe<Array<{
      cases: bigint;
      audits: bigint;
      outbox: bigint;
      active: bigint;
    }>>(`SELECT
      (SELECT count(*) FROM dispute.cases WHERE type='ROLLBACK') AS cases,
      (SELECT count(*) FROM public."audit_events" WHERE "action"='dispute.opened' AND "objectId" LIKE 'dispute-%') AS audits,
      (SELECT count(*) FROM public."outbox_entries" WHERE type='DISPUTE_OPENED' AND payload->>'type'='ROLLBACK') AS outbox,
      (SELECT active_hold_minor FROM settlement.payments WHERE deal_id='${DEAL_ID}') AS active
    `);
    expect(Number(rows[0].cases)).toBe(0);
    expect(Number(rows[0].audits)).toBe(0);
    expect(Number(rows[0].outbox)).toBe(0);
    expect(rows[0].active).toBe(0n);
  });

  it('survives replay/races/restart and closes only after verified refund confirmation', async () => {
    const openInput = {
      dealId: DEAL_ID,
      reason: 'QUALITY',
      detail: 'Signed laboratory protocol confirms a contractual quality deviation.',
      claimAmountKopecks: '5000000',
      currency: 'RUB',
      idempotencyKey: 'open:quality:1',
    };

    const opened = result(await disputes.open(openInput, buyer));
    const disputeId = String(opened.id);
    expect(opened).toMatchObject({
      status: 'OPEN',
      version: '2',
      claimAmountKopecks: '5000000',
    });
    expect(opened.settlementHoldId).toBeTruthy();

    expect(result(await disputes.open(openInput, buyer))).toMatchObject({
      id: disputeId,
      duplicate: true,
    });

    const restartedApp = new PrismaService();
    await restartedApp.$connect();
    try {
      const restarted = new PostgresqlDisputeRepository(new RlsTransactionService(restartedApp));
      expect(result(await restarted.open(openInput, buyer))).toMatchObject({
        id: disputeId,
        duplicate: true,
      });
    } finally {
      await restartedApp.$disconnect();
    }

    await expect(disputes.getOne(disputeId, outsider)).rejects.toBeDefined();
    await expect(disputes.getOne(disputeId, foreignBuyer)).rejects.toBeDefined();

    const triageRace = await Promise.allSettled([
      disputes.triage(disputeId, { expectedVersion: '2', idempotencyKey: 'triage:1' }, arbitrator),
      disputes.triage(disputeId, { expectedVersion: '2', idempotencyKey: 'triage:2' }, arbitrator),
    ]);
    expect(triageRace.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    const triageRejected = triageRace.find((item) => item.status === 'rejected') as PromiseRejectedResult;
    expect(['DISPUTE_STALE_VERSION', 'DISPUTE_TRIAGE_STATE_INVALID']).toContain(
      errorCode(triageRejected.reason),
    );

    const firstEvidence = result(await disputes.addEvidence(disputeId, {
      type: 'LAB',
      description: 'Accredited signed protocol confirms the deviation.',
      source: 'accredited-laboratory',
      expectedVersion: '3',
      idempotencyKey: 'evidence:lab:1',
    }, lab));
    expect(firstEvidence.version).toBe('4');
    expect(firstEvidence.evidence[0]).toMatchObject({ type: 'LAB', trusted: true });
    const firstHash = String(firstEvidence.evidence[0].hash);
    expect(firstHash).toMatch(/^[0-9a-f]{64}$/);

    const secondEvidence = result(await disputes.addEvidence(disputeId, {
      type: 'PHOTO',
      description: 'Buyer photograph records the sealed sample at acceptance.',
      source: 'buyer-mobile',
      expectedVersion: '4',
      idempotencyKey: 'evidence:buyer:2',
    }, buyer));
    expect(secondEvidence.version).toBe('5');
    expect(secondEvidence.evidence).toHaveLength(2);
    expect(secondEvidence.evidence[1]).toMatchObject({ type: 'PHOTO', trusted: false, prevHash: firstHash });
    expect(secondEvidence.evidence[1].hash).toMatch(/^[0-9a-f]{64}$/);

    const decisionRace = await Promise.allSettled([
      disputes.decide(disputeId, {
        outcome: 'SPLIT',
        sellerSplitPct: 40,
        note: 'Evidence supports proportional allocation pending the appeal window.',
        expectedVersion: '5',
        idempotencyKey: 'decision:1',
      }, arbitrator),
      disputes.decide(disputeId, {
        outcome: 'BUYER_WIN',
        note: 'Concurrent decision must not create a second authority result.',
        expectedVersion: '5',
        idempotencyKey: 'decision:2',
      }, arbitrator),
    ]);
    expect(decisionRace.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(decisionRace.filter((item) => item.status === 'rejected')).toHaveLength(1);
    const decision = result((decisionRace.find((item) => item.status === 'fulfilled') as PromiseFulfilledResult<unknown>).value);
    expect(decision).toMatchObject({ status: 'DECISION', version: '6' });
    expect(decision.moneyInstructions).toHaveLength(1);

    expect(result(await disputes.appeal(disputeId, {
      reason: 'Buyer requests full review using the signed accredited laboratory protocol.',
      expectedVersion: '6',
      idempotencyKey: 'appeal:buyer:1',
    }, buyer))).toMatchObject({ status: 'APPEALED', version: '7' });

    const resolved = result(await disputes.resolveAppeal(disputeId, {
      resolution: 'MODIFIED',
      finalOutcome: 'BUYER_WIN',
      note: 'The accredited protocol establishes the buyer claim in full.',
      expectedVersion: '7',
      idempotencyKey: 'appeal:resolve:1',
    }, arbitrator));
    expect(resolved).toMatchObject({ status: 'RESOLVED', version: '8' });
    const instruction = resolved.moneyInstructions.at(-1);
    expect(instruction).toMatchObject({
      action: 'REFUND_BUYER',
      buyerRefundKopecks: '5000000',
      status: 'READY',
    });

    await expect(disputes.close(disputeId, {
      expectedVersion: '8',
      idempotencyKey: 'close:too-early',
    }, arbitrator)).rejects.toMatchObject({
      response: { code: 'DISPUTE_SETTLEMENT_HOLD_NOT_RELEASED' },
    });

    await settlement.releaseHold({
      commandId: 'settlement-command:release-dispute-hold',
      idempotencyKey: 'settlement:release-dispute-hold',
      holdId: String(resolved.settlementHoldId),
      dealId: DEAL_ID,
      expectedPaymentVersion: '1',
    }, accounting);

    const refund = result(await settlement.requestOperation({
      commandId: 'settlement-command:dispute-refund',
      idempotencyKey: 'settlement:dispute-refund',
      dealId: DEAL_ID,
      operation: 'REFUND',
      amountKopecks: '5000000',
      partnerId: 'bank-dispute-test',
      expectedPaymentVersion: '2',
    }, accounting));

    const callback = result(await settlement.registerVerifiedCallback({
      dealId: DEAL_ID,
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

    const bound = result(await disputes.bindOperations(disputeId, {
      instructionId: String(instruction.id),
      buyerOperationId: String(refund.operationId),
      expectedVersion: '8',
      idempotencyKey: 'bind:refund:1',
    }, accounting));
    expect(bound.version).toBe('9');

    const closed = result(await disputes.close(disputeId, {
      expectedVersion: '9',
      idempotencyKey: 'close:final',
    }, arbitrator));
    expect(closed).toMatchObject({ status: 'CLOSED', version: '10' });
    expect(closed.moneyInstructions.at(-1).status).toBe('EXECUTED');

    const facts = await admin.$queryRawUnsafe<Array<Record<string, bigint>>>(`SELECT
      (SELECT count(*) FROM dispute.cases WHERE id='${disputeId}') AS cases,
      (SELECT count(*) FROM settlement.holds WHERE basis_id='${disputeId}') AS holds,
      (SELECT count(*) FROM dispute.money_instructions WHERE dispute_id='${disputeId}' AND status='EXECUTED') AS executed,
      (SELECT count(*) FROM public."audit_events" WHERE "objectType"='dispute' AND "objectId"='${disputeId}') AS audits,
      (SELECT count(*) FROM public."outbox_entries" WHERE payload->>'disputeId'='${disputeId}') AS outbox
    `);
    expect(Number(facts[0].cases)).toBe(1);
    expect(Number(facts[0].holds)).toBe(1);
    expect(Number(facts[0].executed)).toBe(1);
    expect(Number(facts[0].audits)).toBeGreaterThanOrEqual(8);
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
    [BUYER_ORG, '7800000101', 'Dispute Buyer', TENANT],
    [SELLER_ORG, '7800000102', 'Dispute Seller', TENANT],
    [OPS_ORG, '7800000103', 'Dispute Operations', TENANT],
    [OUTSIDER_ORG, '7800000104', 'Dispute Outsider', TENANT],
    [FOREIGN_ORG, '7800000105', 'Foreign Buyer', FOREIGN_TENANT],
  ]) {
    await admin.organization.create({
      data: {
        id,
        inn,
        name,
        tenantId,
        status: 'VERIFIED',
        kycStatus: 'APPROVED',
        amlStatus: 'CLEAR',
        sanctionHit: false,
        verifiedAt: new Date(),
      },
    });
  }

  for (const current of [buyer, seller, lab, arbitrator, accounting, outsider, foreignBuyer]) {
    await admin.user.create({
      data: {
        id: current.id,
        email: current.email,
        passwordHash: 'unused',
        fullName: current.id,
        status: 'ACTIVE',
      },
    });
    await admin.userOrg.create({
      data: {
        id: `membership:${current.id}`,
        userId: current.id,
        organizationId: current.orgId,
        role: current.role,
        isDefault: true,
      },
    });
  }

  await admin.deal.create({
    data: {
      id: DEAL_ID,
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

  for (const current of [buyer, seller, lab, accounting]) {
    await admin.dealParticipant.create({
      data: {
        id: `participant:${current.id}`,
        dealId: DEAL_ID,
        tenantId: TENANT,
        organizationId: current.orgId,
        userId: current.id,
        role: current.role,
        accessLevel: 'APPROVE',
        status: 'ACTIVE',
      },
    });
  }

  await admin.payment.create({
    data: {
      id: `payment:${DEAL_ID}`,
      dealId: DEAL_ID,
      status: 'RESERVED',
      amountKopecks: 10_000_000n,
      callbackState: 'CONFIRMED',
    },
  });

  await admin.$executeRawUnsafe(`INSERT INTO settlement.payment_terms (
    id, tenant_id, deal_id, version, currency, reserve_amount_minor,
    release_basis, status, command_id, idempotency_key, request_fingerprint,
    created_by_user_id, created_by_org_id
  ) VALUES (
    'terms-dispute-pg', '${TENANT}', '${DEAL_ID}', 1, 'RUB', 10000000,
    '{}'::jsonb, 'ISSUED', 'seed-terms', 'seed-terms-dispute-pg', repeat('1',64),
    '${accounting.id}', '${OPS_ORG}'
  )`);

  await admin.$executeRawUnsafe(`INSERT INTO settlement.payments (
    id, tenant_id, deal_id, payment_terms_id, status, currency,
    confirmed_reserved_minor, version
  ) VALUES (
    'payment-dispute-pg', '${TENANT}', '${DEAL_ID}', 'terms-dispute-pg',
    'RESERVED', 'RUB', 10000000, 0
  )`);
}
