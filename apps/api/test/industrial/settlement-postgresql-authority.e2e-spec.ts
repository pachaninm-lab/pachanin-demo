import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import type { RequestUser } from '../../src/common/types/request-user';
import type { ExecuteDealCommandDto } from '../../src/modules/deals/dto/execute-deal-command.dto';
import type { DealActionId } from '../../src/modules/deals/deal-command.policy';
import type { SettlementOperationType } from '../../src/modules/settlement-engine/settlement-postgresql.repository';
import {
  cleanTenant,
  destroyInstance,
  payloadForAction,
  prepareLaboratoryLifecycle,
  provisionDeal,
  type DealFixture,
} from './harness';
import {
  createSettlementInstance,
  type SettlementServiceInstance,
} from './settlement-harness';

jest.setTimeout(240_000);

const CONTRACT_SEQUENCE: ReadonlyArray<{ actionId: DealActionId; userKey: string }> = [
  { actionId: 'approve_admission', userKey: 'compliance' },
  { actionId: 'publish_auction', userKey: 'farmer' },
  { actionId: 'place_winning_bid', userKey: 'buyer' },
  { actionId: 'seller_sign_contract', userKey: 'farmer' },
  { actionId: 'buyer_sign_contract', userKey: 'buyer' },
];

const DOCUMENT_SEQUENCE: ReadonlyArray<{ actionId: DealActionId; userKey: string }> = [
  { actionId: 'assign_logistics', userKey: 'logistician' },
  { actionId: 'confirm_loading', userKey: 'driver' },
  { actionId: 'start_transit', userKey: 'driver' },
  { actionId: 'confirm_arrival', userKey: 'driver' },
  { actionId: 'confirm_weight', userKey: 'elevator' },
  { actionId: 'confirm_inspection', userKey: 'surveyor' },
  { actionId: 'finalize_lab', userKey: 'lab' },
  { actionId: 'accept_delivery', userKey: 'buyer' },
  { actionId: 'complete_documents', userKey: 'farmer' },
];

function fingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function dealState(instance: SettlementServiceInstance, dealId: string) {
  return instance.prisma.deal.findUniqueOrThrow({
    where: { id: dealId },
    select: { status: true, version: true, updatedAt: true },
  });
}

async function execute(
  instance: SettlementServiceInstance,
  fixture: DealFixture,
  actionId: DealActionId,
  user: RequestUser,
  suffix = '',
) {
  const deal = await dealState(instance, fixture.dealId);
  const dto: ExecuteDealCommandDto = {
    commandId: `settlement-e2e:${fixture.dealId}:${actionId}${suffix}`,
    idempotencyKey: `settlement-e2e:${fixture.dealId}:${actionId}${suffix}`,
    expectedUpdatedAt: deal.updatedAt.toISOString(),
    expectedVersion: deal.version.toString(),
    payload: payloadForAction(fixture, actionId),
  };
  return instance.commands.execute(fixture.dealId, actionId, dto, user) as Promise<Record<string, unknown>>;
}

async function reachContract(instance: SettlementServiceInstance, fixture: DealFixture) {
  for (const step of CONTRACT_SEQUENCE) {
    await execute(instance, fixture, step.actionId, fixture.users[step.userKey]);
  }
}

async function reachDocuments(instance: SettlementServiceInstance, fixture: DealFixture) {
  for (const step of DOCUMENT_SEQUENCE) {
    if (step.actionId === 'finalize_lab') await prepareLaboratoryLifecycle(instance, fixture);
    await execute(instance, fixture, step.actionId, fixture.users[step.userKey]);
  }
}

function callbackInput(
  fixture: DealFixture,
  operationId: string,
  operation: SettlementOperationType,
  eventSuffix: string,
  status: 'SUCCESS' | 'FAILED' = 'SUCCESS',
) {
  const payload = {
    dealId: fixture.dealId,
    operationId,
    operation,
    status,
    eventId: `settlement-event:${fixture.dealId}:${eventSuffix}`,
    bankRef: `BANK:${fixture.dealId}:${eventSuffix}`,
  };
  return {
    ...payload,
    partnerId: 'safe-deals',
    keyId: 'key-v1',
    payloadFingerprint: fingerprint(payload),
    payload,
    errorMessage: status === 'FAILED' ? 'controlled bank rejection' : undefined,
  } as const;
}

async function requestReserve(instance: SettlementServiceInstance, fixture: DealFixture, suffix: string) {
  return instance.settlement.requestReserve(fixture.dealId, fixture.users.buyer, {
    commandId: `reserve:${fixture.dealId}:${suffix}`,
    idempotencyKey: `reserve:${fixture.dealId}:${suffix}`,
    expectedDealVersion: (await dealState(instance, fixture.dealId)).version,
  }) as Promise<Record<string, unknown>>;
}

function acceptableRaceLoss(reason: unknown) {
  if (reason instanceof ConflictException) return true;
  const code = String((reason as { code?: unknown })?.code ?? '');
  const metaCode = String((reason as { meta?: { code?: unknown } })?.meta?.code ?? '');
  const message = String((reason as { message?: unknown })?.message ?? '').toLowerCase();
  return ['P2002', 'P2010', 'P2034', 'P2025'].includes(code)
    || ['23505', '23514', '40001', '40P01'].includes(metaCode)
    || /serialize|concurrent|exact pending settlement operation|callback/.test(message);
}

describe('IR-10.4 Settlement PostgreSQL authority', () => {
  let alpha: SettlementServiceInstance;

  beforeAll(async () => {
    alpha = await createSettlementInstance();
    await cleanTenant(alpha.prisma);
  });

  afterAll(async () => {
    await cleanTenant(alpha.prisma);
    await destroyInstance(alpha);
  });

  it('executes terms, reserve, beneficiaries, partial payouts, holds, refund and reconciliation atomically', async () => {
    const fixture = await provisionDeal(alpha.prisma, 'settle1', 100_000n);
    await reachContract(alpha, fixture);

    const terms = await alpha.settlement.configureTerms({
      commandId: 'terms:settle1',
      idempotencyKey: 'terms:settle1',
      dealId: fixture.dealId,
      reserveAmountKopecks: '100000',
      beneficiaries: [
        { organizationId: fixture.sellerOrgId, role: 'SELLER', allocationKopecks: '60000', priority: 0 },
        { organizationId: fixture.serviceOrgId, role: 'CARRIER', allocationKopecks: '20000', priority: 1 },
        { organizationId: fixture.serviceOrgId, role: 'PLATFORM', allocationKopecks: '20000', priority: 2 },
      ],
      releaseBasis: { documentsComplete: true, qualityAccepted: true },
    }, fixture.users.accounting) as Record<string, any>;
    expect(terms.beneficiaries).toHaveLength(3);

    const reserve = await requestReserve(alpha, fixture, 'one');
    expect(reserve).toMatchObject({ operation: 'RESERVE', status: 'PENDING', duplicate: false });
    const reserveCallback = callbackInput(fixture, String(reserve.operationId), 'RESERVE', 'reserve-success');
    await expect(alpha.settlement.registerBankCallback(reserveCallback))
      .resolves.toMatchObject({ status: 'SUCCESS', duplicate: false });
    await expect(alpha.settlement.registerBankCallback(reserveCallback))
      .resolves.toMatchObject({ status: 'SUCCESS', duplicate: true });
    await expect(alpha.settlement.registerBankCallback({
      ...reserveCallback,
      bankRef: 'FORGED-BANK-REF',
    })).rejects.toMatchObject({ response: expect.objectContaining({ code: 'BANK_EVENT_REPLAY_MISMATCH' }) });

    await reachDocuments(alpha, fixture);
    const worksheet = await alpha.settlement.getWorksheet(fixture.dealId, fixture.users.accounting) as Record<string, any>;
    const beneficiary = (role: string) => worksheet.beneficiaries.find((item: any) => item.role === role).id as string;

    const sellerReleaseInput = {
      commandId: 'release:settle1:seller-1',
      idempotencyKey: 'release:settle1:seller-1',
      amountKopecks: '30000',
      beneficiaryId: beneficiary('SELLER'),
      expectedDealVersion: (await dealState(alpha, fixture.dealId)).version,
    };
    const sellerRelease = await alpha.settlement.requestRelease(
      fixture.dealId,
      fixture.users.accounting,
      sellerReleaseInput,
    ) as Record<string, any>;
    await expect(alpha.settlement.requestRelease(fixture.dealId, fixture.users.accounting, sellerReleaseInput))
      .resolves.toMatchObject({ operationId: sellerRelease.operationId, duplicate: true });
    await expect(alpha.settlement.requestRelease(fixture.dealId, fixture.users.accounting, {
      ...sellerReleaseInput,
      amountKopecks: '30001',
    })).rejects.toMatchObject({ response: expect.objectContaining({ code: 'SETTLEMENT_COMMAND_REPLAY_MISMATCH' }) });
    await alpha.settlement.registerBankCallback(
      callbackInput(fixture, sellerRelease.operationId, 'RELEASE', 'seller-release-1'),
    );

    const paymentAfterSeller = await alpha.settlement.getPayment(
      `settlement-payment:${fixture.dealId}`,
      fixture.users.accounting,
    ) as Record<string, any>;
    const hold = await alpha.settlement.placeHold({
      commandId: 'hold:settle1',
      idempotencyKey: 'hold:settle1',
      dealId: fixture.dealId,
      amountKopecks: '10000',
      basisType: 'DISPUTE',
      basisId: 'DISPUTE-SETTLE1',
      reason: 'Controlled disputed portion',
      expectedPaymentVersion: paymentAfterSeller.version,
    }, fixture.users.accounting) as Record<string, any>;

    await expect(alpha.settlement.requestRelease(fixture.dealId, fixture.users.accounting, {
      commandId: 'release:settle1:over',
      idempotencyKey: 'release:settle1:over',
      amountKopecks: '60001',
      beneficiaryId: beneficiary('SELLER'),
    })).rejects.toMatchObject({ response: expect.objectContaining({ code: 'OVER_RELEASE_DENIED' }) });

    const carrier = await alpha.settlement.requestRelease(fixture.dealId, fixture.users.accounting, {
      commandId: 'release:settle1:carrier',
      idempotencyKey: 'release:settle1:carrier',
      amountKopecks: '20000',
      beneficiaryId: beneficiary('CARRIER'),
    }) as Record<string, any>;
    await alpha.settlement.registerBankCallback(
      callbackInput(fixture, carrier.operationId, 'RELEASE', 'carrier-release'),
    );

    const refund = await alpha.settlement.requestRefund(fixture.dealId, fixture.users.accounting, {
      commandId: 'refund:settle1',
      idempotencyKey: 'refund:settle1',
      amountKopecks: '10000',
    }) as Record<string, any>;
    await alpha.settlement.registerBankCallback(
      callbackInput(fixture, refund.operationId, 'REFUND', 'refund'),
    );

    const beforeHoldRelease = await alpha.settlement.getPayment(
      `settlement-payment:${fixture.dealId}`,
      fixture.users.accounting,
    ) as Record<string, any>;
    await alpha.settlement.releaseHold({
      commandId: 'hold-release:settle1',
      idempotencyKey: 'hold-release:settle1',
      holdId: hold.holdId,
      dealId: fixture.dealId,
      expectedPaymentVersion: beforeHoldRelease.version,
    }, fixture.users.accounting);

    const sellerFinal = await alpha.settlement.requestRelease(fixture.dealId, fixture.users.accounting, {
      commandId: 'release:settle1:seller-2',
      idempotencyKey: 'release:settle1:seller-2',
      amountKopecks: '30000',
      beneficiaryId: beneficiary('SELLER'),
    }) as Record<string, any>;
    await alpha.settlement.registerBankCallback(
      callbackInput(fixture, sellerFinal.operationId, 'RELEASE', 'seller-release-2'),
    );
    const platform = await alpha.settlement.requestRelease(fixture.dealId, fixture.users.accounting, {
      commandId: 'release:settle1:platform',
      idempotencyKey: 'release:settle1:platform',
      amountKopecks: '10000',
      beneficiaryId: beneficiary('PLATFORM'),
    }) as Record<string, any>;
    await alpha.settlement.registerBankCallback(
      callbackInput(fixture, platform.operationId, 'RELEASE', 'platform-release'),
    );

    const matched = await alpha.settlement.reconcileOperation({
      commandId: 'reconcile:settle1:match',
      idempotencyKey: 'reconcile:settle1:match',
      dealId: fixture.dealId,
      operationId: String(reserve.operationId),
      observedAmountKopecks: '100000',
    }, fixture.users.accounting);
    expect(matched).toMatchObject({ verdict: 'MATCH', manualReview: false });

    const beforeMismatch = await alpha.settlement.getPayment(
      `settlement-payment:${fixture.dealId}`,
      fixture.users.accounting,
    ) as Record<string, any>;
    const mismatch = await alpha.settlement.reconcileOperation({
      commandId: 'reconcile:settle1:mismatch',
      idempotencyKey: 'reconcile:settle1:mismatch',
      dealId: fixture.dealId,
      operationId: platform.operationId,
      observedAmountKopecks: '9999',
      reason: 'Statement amount differs by one kopeck',
      expectedPaymentVersion: beforeMismatch.version,
    }, fixture.users.accounting);
    expect(mismatch).toMatchObject({ verdict: 'MISMATCH', manualReview: true });

    const authoritative = await alpha.rls.withTrustedContext(fixture.users.accounting, async (tx) => {
      const [payment, operations, ledger, callbacks, facts, outbox] = await Promise.all([
        tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          SELECT * FROM settlement.payments WHERE deal_id = ${fixture.dealId}
        `),
        tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          SELECT * FROM settlement.bank_operations WHERE deal_id = ${fixture.dealId}
        `),
        tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          SELECT * FROM settlement.ledger_entries WHERE deal_id = ${fixture.dealId} ORDER BY created_at, id
        `),
        tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          SELECT * FROM settlement.bank_callbacks WHERE deal_id = ${fixture.dealId}
        `),
        tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          SELECT * FROM settlement.reconciliation_facts WHERE deal_id = ${fixture.dealId}
        `),
        tx.outboxEntry.findMany({ where: { dealId: fixture.dealId } }),
      ]);
      return { payment, operations, ledger, callbacks, facts, outbox };
    });
    expect(authoritative.payment).toHaveLength(1);
    expect(authoritative.payment[0]).toMatchObject({ status: 'MANUAL_REVIEW' });
    expect(authoritative.operations).toHaveLength(6);
    expect(authoritative.ledger).toHaveLength(6);
    expect(authoritative.callbacks).toHaveLength(6);
    expect(authoritative.facts).toHaveLength(2);
    expect(authoritative.outbox.filter((entry) => entry.type.startsWith('BANK_'))).toHaveLength(6);

    await expect(alpha.prisma.$executeRawUnsafe(
      `UPDATE settlement.ledger_entries SET amount_minor = amount_minor + 1 WHERE deal_id = '${fixture.dealId}'`,
    )).rejects.toThrow(/append-only/);
    await expect(alpha.prisma.$executeRawUnsafe(
      `DELETE FROM settlement.bank_callbacks WHERE deal_id = '${fixture.dealId}'`,
    )).rejects.toThrow(/append-only/);

    const restarted = await createSettlementInstance();
    try {
      await expect(restarted.settlement.getWorksheet(fixture.dealId, fixture.users.accounting))
        .resolves.toMatchObject({ dealId: fixture.dealId });
      await expect(restarted.settlement.registerBankCallback(reserveCallback))
        .resolves.toMatchObject({ duplicate: true });
    } finally {
      await destroyInstance(restarted);
    }
  });

  it('rejects invalid money, outsiders and rollback probes without partial settlement effects', async () => {
    const fixture = await provisionDeal(alpha.prisma, 'settle2', 500_000n);
    await reachContract(alpha, fixture);

    await expect(alpha.settlement.requestReserve(fixture.dealId, fixture.users.buyer, {
      commandId: 'negative-reserve',
      idempotencyKey: 'negative-reserve',
      expectedDealVersion: (await dealState(alpha, fixture.dealId)).version,
    })).resolves.toMatchObject({ status: 'PENDING' });
    const reserveRows = await alpha.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM settlement.bank_operations WHERE deal_id = ${fixture.dealId} AND operation_type = 'RESERVE'
    `);
    const reserveOperationId = reserveRows[0].id;
    await alpha.settlement.registerBankCallback(
      callbackInput(fixture, reserveOperationId, 'RESERVE', 'reserve-settle2'),
    );
    await reachDocuments(alpha, fixture);

    await expect(alpha.settlement.requestRefund(fixture.dealId, fixture.users.accounting, {
      commandId: 'negative-refund',
      idempotencyKey: 'negative-refund',
      amountKopecks: '-1',
    })).rejects.toBeInstanceOf(BadRequestException);
    await expect(alpha.settlement.requestRefund(fixture.dealId, fixture.users.accounting, {
      commandId: 'overflow-refund',
      idempotencyKey: 'overflow-refund',
      amountKopecks: '9223372036854775808',
    })).rejects.toMatchObject({ response: expect.objectContaining({ code: 'MINOR_UNITS_OVERFLOW' }) });
    await expect(alpha.settlement.requestRefund(fixture.dealId, fixture.users.accounting, {
      commandId: 'refund-over-bounds',
      idempotencyKey: 'refund-over-bounds',
      amountKopecks: '500001',
    })).rejects.toMatchObject({ response: expect.objectContaining({ code: 'REFUND_EXCEEDS_AVAILABLE_FUNDS' }) });

    const outsider: RequestUser = {
      ...fixture.users.buyer,
      id: 'same-tenant-outsider',
      sessionId: 'same-tenant-outsider-session',
    };
    await expect(alpha.settlement.getWorksheet(fixture.dealId, outsider))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(alpha.settlement.getWorksheet(fixture.dealId, {
      ...fixture.users.buyer,
      tenantId: 'tenant-cross',
      sessionId: 'cross-tenant-session',
    })).rejects.toBeInstanceOf(ForbiddenException);

    const before = await alpha.rls.withTrustedContext(fixture.users.accounting, async (tx) => ({
      payment: await tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        SELECT * FROM settlement.payments WHERE deal_id = ${fixture.dealId}
      `),
      operations: await tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        SELECT * FROM settlement.bank_operations WHERE deal_id = ${fixture.dealId}
      `),
      ledger: await tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        SELECT * FROM settlement.ledger_entries WHERE deal_id = ${fixture.dealId}
      `),
      audits: await tx.auditEvent.count({ where: { dealId: fixture.dealId } }),
      outbox: await tx.outboxEntry.count({ where: { dealId: fixture.dealId } }),
    }));
    await expect(alpha.settlement.requestRelease(fixture.dealId, fixture.users.accounting, {
      commandId: 'rollback-invalid-beneficiary',
      idempotencyKey: 'rollback-invalid-beneficiary',
      amountKopecks: '1',
      beneficiaryId: 'beneficiary-does-not-exist',
    })).rejects.toMatchObject({ response: expect.objectContaining({ code: 'SETTLEMENT_BENEFICIARY_NOT_FOUND' }) });
    const after = await alpha.rls.withTrustedContext(fixture.users.accounting, async (tx) => ({
      payment: await tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        SELECT * FROM settlement.payments WHERE deal_id = ${fixture.dealId}
      `),
      operations: await tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        SELECT * FROM settlement.bank_operations WHERE deal_id = ${fixture.dealId}
      `),
      ledger: await tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        SELECT * FROM settlement.ledger_entries WHERE deal_id = ${fixture.dealId}
      `),
      audits: await tx.auditEvent.count({ where: { dealId: fixture.dealId } }),
      outbox: await tx.outboxEntry.count({ where: { dealId: fixture.dealId } }),
    }));
    expect(after).toEqual(before);
  });

  it('serializes two-instance command and callback races into one financial effect', async () => {
    const fixture = await provisionDeal(alpha.prisma, 'settle3', 700_000n);
    await reachContract(alpha, fixture);
    const beta = await createSettlementInstance();
    try {
      const deal = await dealState(alpha, fixture.dealId);
      const requests = await Promise.allSettled([
        alpha.settlement.requestReserve(fixture.dealId, fixture.users.buyer, {
          commandId: 'race-reserve-a',
          idempotencyKey: 'race-reserve-a',
          expectedDealVersion: deal.version,
        }),
        beta.settlement.requestReserve(fixture.dealId, fixture.users.buyer, {
          commandId: 'race-reserve-b',
          idempotencyKey: 'race-reserve-b',
          expectedDealVersion: deal.version,
        }),
      ]);
      expect(requests.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
      for (const loss of requests.filter((item): item is PromiseRejectedResult => item.status === 'rejected')) {
        expect(acceptableRaceLoss(loss.reason)).toBe(true);
      }

      const operation = await alpha.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM settlement.bank_operations
        WHERE deal_id = ${fixture.dealId} AND operation_type = 'RESERVE'
      `);
      expect(operation).toHaveLength(1);
      const callback = callbackInput(fixture, operation[0].id, 'RESERVE', 'race-callback');
      const callbacks = await Promise.allSettled([
        alpha.settlement.registerBankCallback(callback),
        beta.settlement.registerBankCallback(callback),
      ]);
      expect(callbacks.filter((item) => item.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
      for (const loss of callbacks.filter((item): item is PromiseRejectedResult => item.status === 'rejected')) {
        expect(acceptableRaceLoss(loss.reason)).toBe(true);
      }

      const facts = await alpha.rls.withTrustedContext(fixture.users.accounting, async (tx) => ({
        callbacks: await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT count(*)::bigint AS count FROM settlement.bank_callbacks WHERE deal_id = ${fixture.dealId}
        `),
        ledger: await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT count(*)::bigint AS count FROM settlement.ledger_entries WHERE deal_id = ${fixture.dealId}
        `),
        payment: await tx.$queryRaw<Array<{ confirmedReserved: bigint }>>(Prisma.sql`
          SELECT confirmed_reserved_minor AS "confirmedReserved"
          FROM settlement.payments WHERE deal_id = ${fixture.dealId}
        `),
      }));
      expect(facts.callbacks[0].count).toBe(1n);
      expect(facts.ledger[0].count).toBe(1n);
      expect(facts.payment[0].confirmedReserved).toBe(700_000n);
    } finally {
      await destroyInstance(beta);
    }
  });
});
