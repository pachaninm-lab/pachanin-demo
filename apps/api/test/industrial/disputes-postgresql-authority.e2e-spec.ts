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

function fulfilled<T>(items: PromiseSettledResult<T>[]): PromiseFulfilledResult<T>[] {
  return items.filter((item): item is PromiseFulfilledResult<T> => item.status === 'fulfilled');
}

function rejected<T>(items: PromiseSettledResult<T>[]): PromiseRejectedResult[] {
  return items.filter((item): item is PromiseRejectedResult => item.status === 'rejected');
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
  }, 90_000);

  beforeEach(async () => {
    await reset(admin);
    await seed(admin);
    await bootstrapVerifiedReserve(settlement);
  }, 90_000);

  afterAll(async () => {
    await Promise.all([admin?.$disconnect(), app?.$disconnect()]);
  });

  it('denies table authority, same-tenant outsiders and cross-tenant actors', async () => {
    const directTableProbe = () => app.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT count(*)::bigint AS count FROM dispute.cases',
    );
    if (APP_URL === ADMIN_URL) {
      const rows = await directTableProbe();
      expect(Number(rows[0]?.count ?? 0n)).toBe(0);
    } else {
      await expect(directTableProbe()).rejects.toBeDefined();
    }

    const opened = result(await disputes.open({
      dealId: DEAL_ID,
      reason: 'ACCESS',
      detail: 'Authoritative access-control proof for a contractual party dispute.',
      currency: 'RUB',
      idempotencyKey: 'open:access:1',
    }, buyer));

    await expect(disputes.getOne(String(opened.id), outsider)).rejects.toBeDefined();
    await expect(disputes.getOne(String(opened.id), foreignBuyer)).rejects.toBeDefined();
    expect(await disputes.list(outsider)).toEqual([]);
    expect(await disputes.list(foreignBuyer)).toEqual([]);
  });

  it('rolls back case, receipt, audit, outbox and hold counter when the claim exceeds available funds', async () => {
    await expect(disputes.open({
      dealId: DEAL_ID,
      reason: 'ROLLBACK',
      detail: 'An over-reserve claim must roll back the complete dispute command.',
      claimAmountKopecks: '10000001',
      currency: 'RUB',
      idempotencyKey: 'open:rollback',
    }, buyer)).rejects.toMatchObject({
      response: { code: 'DISPUTE_HOLD_EXCEEDS_AVAILABLE_FUNDS' },
    });

    const rows = await admin.$queryRawUnsafe<Array<{
      cases: bigint;
      receipts: bigint;
      audits: bigint;
      outbox: bigint;
      active: bigint;
    }>>(`SELECT
      (SELECT count(*) FROM dispute.cases WHERE type='ROLLBACK') AS cases,
      (SELECT count(*) FROM dispute.command_receipts) AS receipts,
      (SELECT count(*) FROM public."audit_events" WHERE "action"='dispute.opened') AS audits,
      (SELECT count(*) FROM public."outbox_entries" WHERE type='DISPUTE_OPENED') AS outbox,
      (SELECT active_hold_minor FROM settlement.payments WHERE deal_id='${DEAL_ID}') AS active
    `);
    expect(Number(rows[0].cases)).toBe(0);
    expect(Number(rows[0].receipts)).toBe(0);
    expect(Number(rows[0].audits)).toBe(0);
    expect(Number(rows[0].outbox)).toBe(0);
    expect(rows[0].active).toBe(0n);
  });

  it('serializes two application instances with one idempotency key into one durable case', async () => {
    const secondApp = new PrismaService();
    await secondApp.$connect();
    try {
      const second = new PostgresqlDisputeRepository(new RlsTransactionService(secondApp));
      const input = {
        dealId: DEAL_ID,
        reason: 'RACE',
        detail: 'Two application instances submit the exact same dispute command.',
        claimAmountKopecks: '1000000',
        currency: 'RUB',
        idempotencyKey: 'open:race:same-key',
      };

      const outcomes = (await Promise.all([
        disputes.open(input, buyer),
        second.open(input, buyer),
      ])).map(result);

      expect(new Set(outcomes.map((item) => item.id)).size).toBe(1);
      expect(outcomes.filter((item) => item.duplicate === false)).toHaveLength(1);
      expect(outcomes.filter((item) => item.duplicate === true)).toHaveLength(1);

      const disputeId = String(outcomes[0].id);
      const facts = await admin.$queryRawUnsafe<Array<{
        cases: bigint;
        holds: bigint;
        receipts: bigint;
        active: bigint;
      }>>(`SELECT
        (SELECT count(*) FROM dispute.cases WHERE id='${disputeId}') AS cases,
        (SELECT count(*) FROM settlement.holds WHERE basis_id='${disputeId}') AS holds,
        (SELECT count(*) FROM dispute.command_receipts
          WHERE command_type='OPEN' AND result->>'id'='${disputeId}') AS receipts,
        (SELECT active_hold_minor FROM settlement.payments WHERE deal_id='${DEAL_ID}') AS active
      `);
      expect(Number(facts[0].cases)).toBe(1);
      expect(Number(facts[0].holds)).toBe(1);
      expect(Number(facts[0].receipts)).toBe(1);
      expect(facts[0].active).toBe(1_000_000n);

      expect(result(await second.open(input, buyer))).toMatchObject({
        id: disputeId,
        duplicate: true,
      });
    } finally {
      await secondApp.$disconnect();
    }
  }, 90_000);

  it('survives races/restart and closes only after verified refund confirmation', async () => {
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

    const triageRace = await Promise.allSettled([
      disputes.triage(disputeId, { expectedVersion: '2', idempotencyKey: 'triage:1' }, arbitrator),
      disputes.triage(disputeId, { expectedVersion: '2', idempotencyKey: 'triage:2' }, arbitrator),
    ]);
    expect(fulfilled(triageRace)).toHaveLength(1);
    expect(rejected(triageRace)).toHaveLength(1);
    expect(['DISPUTE_STALE_VERSION', 'DISPUTE_TRIAGE_STATE_INVALID']).toContain(
      errorCode(rejected(triageRace)[0].reason),
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
    expect(firstEvidence.evidence[0].prevHash).toBeNull();

    const secondEvidence = result(await disputes.addEvidence(disputeId, {
      type: 'PHOTO',
      description: 'Buyer photograph records the sealed sample at acceptance.',
      source: 'buyer-mobile',
      expectedVersion: '4',
      idempotencyKey: 'evidence:buyer:2',
    }, buyer));
    expect(secondEvidence.version).toBe('5');
    expect(secondEvidence.evidence).toHaveLength(2);
    expect(secondEvidence.evidence[1]).toMatchObject({
      type: 'PHOTO',
      trusted: false,
      prevHash: firstHash,
    });
    expect(secondEvidence.evidence[1].hash).toMatch(/^[0-9a-f]{64}$/);
    expect(secondEvidence.evidence[1].hash).not.toBe(firstHash);

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
    expect(fulfilled(decisionRace)).toHaveLength(1);
    expect(rejected(decisionRace)).toHaveLength(1);
    const decision = result(fulfilled(decisionRace)[0].value);
    expect(decision).toMatchObject({ status: 'DECISION', version: '6' });
    expect(decision.moneyInstructions).toHaveLength(1);

    const appealRace = await Promise.allSettled([
      disputes.appeal(disputeId, {
        reason: 'Buyer requests full review using the signed accredited laboratory protocol.',
        expectedVersion: '6',
        idempotencyKey: 'appeal:buyer:1',
      }, buyer),
      disputes.appeal(disputeId, {
        reason: 'Buyer requests full review using the signed accredited laboratory protocol.',
        expectedVersion: '6',
        idempotencyKey: 'appeal:buyer:2',
      }, buyer),
    ]);
    expect(fulfilled(appealRace)).toHaveLength(1);
    expect(rejected(appealRace)).toHaveLength(1);
    expect(result(fulfilled(appealRace)[0].value)).toMatchObject({
      status: 'APPEALED',
      version: '7',
    });

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

    const beforeRelease = result(await settlement.worksheet(DEAL_ID, accounting));
    const paymentBeforeRelease = result(beforeRelease.payment);
    await settlement.releaseHold({
      commandId: 'settlement-command:release-dispute-hold',
      idempotencyKey: 'settlement:release-dispute-hold',
      holdId: String(resolved.settlementHoldId),
      dealId: DEAL_ID,
      expectedPaymentVersion: String(paymentBeforeRelease.version),
    }, accounting);

    const afterRelease = result(await settlement.worksheet(DEAL_ID, accounting));
    const paymentAfterRelease = result(afterRelease.payment);
    const refund = result(await settlement.requestOperation({
      commandId: 'settlement-command:dispute-refund',
      idempotencyKey: 'settlement:dispute-refund',
      dealId: DEAL_ID,
      operation: 'REFUND',
      amountKopecks: '5000000',
      partnerId: 'bank-dispute-test',
      expectedPaymentVersion: String(paymentAfterRelease.version),
      expectedDealVersion: String(afterRelease.dealVersion),
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
      (SELECT count(*) FROM dispute.evidence WHERE dispute_id='${disputeId}') AS evidence,
      (SELECT count(*) FROM dispute.appeals WHERE dispute_id='${disputeId}') AS appeals,
      (SELECT count(*) FROM dispute.money_instructions WHERE dispute_id='${disputeId}' AND status='EXECUTED') AS executed,
      (SELECT count(*) FROM public."audit_events" WHERE "objectType"='dispute' AND "objectId"='${disputeId}') AS audits,
      (SELECT count(*) FROM public."outbox_entries" WHERE payload->>'disputeId'='${disputeId}') AS outbox
    `);
    expect(Number(facts[0].cases)).toBe(1);
    expect(Number(facts[0].holds)).toBe(1);
    expect(Number(facts[0].evidence)).toBe(2);
    expect(Number(facts[0].appeals)).toBe(1);
    expect(Number(facts[0].executed)).toBe(1);
    expect(Number(facts[0].audits)).toBeGreaterThanOrEqual(9);
    expect(Number(facts[0].outbox)).toBeGreaterThanOrEqual(3);
  }, 180_000);
});

async function bootstrapVerifiedReserve(settlement: SettlementPostgresqlRepository) {
  await settlement.configureTerms({
    commandId: 'settlement-command:configure-dispute-terms',
    idempotencyKey: 'settlement:configure-dispute-terms',
    dealId: DEAL_ID,
    reserveAmountKopecks: '10000000',
    currency: 'RUB',
    releaseBasis: { contractSigned: true },
    beneficiaries: [{
      organizationId: SELLER_ORG,
      role: 'SELLER',
      allocationKopecks: '10000000',
      priority: 1,
      destinationRef: 'seller-account:dispute-test',
    }],
  }, accounting);

  const reserve = result(await settlement.requestOperation({
    commandId: 'settlement-command:reserve-dispute-funds',
    idempotencyKey: 'settlement:reserve-dispute-funds',
    dealId: DEAL_ID,
    operation: 'RESERVE',
    amountKopecks: '10000000',
    partnerId: 'bank-dispute-test',
    expectedDealVersion: '0',
  }, accounting));

  const callback = result(await settlement.registerVerifiedCallback({
    dealId: DEAL_ID,
    operationId: String(reserve.operationId),
    eventId: 'bank-event:dispute-reserve:1',
    operation: 'RESERVE',
    status: 'SUCCESS',
    bankRef: 'bank-ref-dispute-reserve-1',
    partnerId: 'bank-dispute-test',
    keyId: 'bank-key-dispute-test',
    payloadFingerprint: 'a'.repeat(64),
    payload: { confirmed: true },
  }));
  expect(callback.status).toBe('SUCCESS');
}

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
      status: 'CONTRACT_SIGNED',
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
}
