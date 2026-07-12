import { ConflictException } from '@nestjs/common';
import type { ExecuteDealCommandDto } from '../../src/modules/deals/dto/execute-deal-command.dto';
import type { DealActionId } from '../../src/modules/deals/deal-command.policy';
import type { RequestUser } from '../../src/common/types/request-user';
import {
  cleanTenant,
  createInstance,
  destroyInstance,
  provisionDeal,
  type DealFixture,
  type ServiceInstance,
} from './harness';

/**
 * Industrial Transaction Core — PostgreSQL-authoritative proof suite.
 *
 * Runs against a real PostgreSQL (DATABASE_URL) with the industrial migration
 * applied. Proves, for arbitrary (non-canonical) deals:
 *  - the full command path works end-to-end for any provisioned deal;
 *  - optimistic concurrency (version CAS) rejects lost updates with 409;
 *  - duplicate/concurrent bank callbacks produce exactly one financial effect;
 *  - idempotent replay works across independent service instances;
 *  - state survives instance "restart" (fresh connections, no process memory);
 *  - deal_events and ledger_entries are append-only at the database level;
 *  - money survives amounts beyond the 32-bit kopeck ceiling.
 */

jest.setTimeout(180_000);

const USER_SEQUENCE: ReadonlyArray<{ actionId: DealActionId; userKey: string }> = [
  { actionId: 'approve_admission', userKey: 'compliance' },
  { actionId: 'publish_auction', userKey: 'farmer' },
  { actionId: 'place_winning_bid', userKey: 'buyer' },
  { actionId: 'seller_sign_contract', userKey: 'farmer' },
  { actionId: 'buyer_sign_contract', userKey: 'buyer' },
  { actionId: 'request_reserve', userKey: 'buyer' },
];

const POST_RESERVE_SEQUENCE: ReadonlyArray<{ actionId: DealActionId; userKey: string }> = [
  { actionId: 'assign_logistics', userKey: 'logistician' },
  { actionId: 'confirm_loading', userKey: 'driver' },
  { actionId: 'start_transit', userKey: 'driver' },
  { actionId: 'confirm_arrival', userKey: 'driver' },
  { actionId: 'confirm_weight', userKey: 'elevator' },
  { actionId: 'confirm_inspection', userKey: 'surveyor' },
  { actionId: 'finalize_lab', userKey: 'lab' },
  { actionId: 'accept_delivery', userKey: 'buyer' },
  { actionId: 'complete_documents', userKey: 'farmer' },
  { actionId: 'request_release', userKey: 'accounting' },
];

let alpha: ServiceInstance;

beforeAll(async () => {
  alpha = await createInstance();
  await cleanTenant(alpha.prisma);
});

afterAll(async () => {
  await cleanTenant(alpha.prisma);
  await destroyInstance(alpha);
});

async function currentDeal(instance: ServiceInstance, dealId: string) {
  return instance.prisma.deal.findUniqueOrThrow({
    where: { id: dealId },
    select: { id: true, status: true, updatedAt: true, version: true },
  });
}

async function runUserAction(
  instance: ServiceInstance,
  fixture: DealFixture,
  actionId: DealActionId,
  user: RequestUser,
  suffix = '',
) {
  const deal = await currentDeal(instance, fixture.dealId);
  const dto: ExecuteDealCommandDto = {
    commandId: `cmd:${fixture.dealId}:${actionId}${suffix}`,
    idempotencyKey: `idem:${fixture.dealId}:${actionId}${suffix}`,
    expectedUpdatedAt: deal.updatedAt.toISOString(),
    expectedVersion: deal.version.toString(),
    payload: {},
  };
  return instance.commands.execute(fixture.dealId, actionId, dto, user);
}

function bankCallback(fixture: DealFixture, operation: 'RESERVE' | 'RELEASE', eventSuffix = '1') {
  const kind = operation === 'RESERVE' ? 'bank-reserve' : 'bank-release';
  return {
    dealId: fixture.dealId,
    eventId: `bank-event-${fixture.dealId}-${operation}-${eventSuffix}`,
    operation,
    status: 'SUCCESS' as const,
    bankRef: `BANK-${operation}-${fixture.dealId}`,
    operationId: `${kind}:${fixture.dealId}`,
    partnerId: 'safe-deals',
  };
}

function isAcceptableRaceLoss(error: unknown): boolean {
  if (error instanceof ConflictException) return true;
  const code = (error as { code?: string })?.code;
  // P2034 = Serializable write conflict, P2002 = unique constraint, P2025 = row
  // vanished under a concurrent winner: all are safe rejections, never a
  // second financial effect.
  return code === 'P2034' || code === 'P2002' || code === 'P2025';
}

describe('Industrial transaction core on real PostgreSQL', () => {
  it('drives two arbitrary deals through the full canonical cycle, one of them above the 32-bit kopeck ceiling', async () => {
    const big = await provisionDeal(alpha.prisma, 'big01', 9_876_543_210_987n); // 98.7 млрд ₽ в копейках
    const small = await provisionDeal(alpha.prisma, 'small1', 240_000_000n);

    for (const fixture of [big, small]) {
      for (const step of USER_SEQUENCE) {
        const receipt = await runUserAction(alpha, fixture, step.actionId, fixture.users[step.userKey]);
        expect(receipt).toMatchObject({ ok: true, duplicate: false, actionId: step.actionId });
      }

      const reserved = await alpha.gateway.executeBankCallback(bankCallback(fixture, 'RESERVE'));
      expect(reserved).toMatchObject({ status: 'RESERVED' });

      for (const step of POST_RESERVE_SEQUENCE) {
        await runUserAction(alpha, fixture, step.actionId, fixture.users[step.userKey]);
      }

      const released = await alpha.gateway.executeBankCallback(bankCallback(fixture, 'RELEASE'));
      expect(released).toMatchObject({ status: 'RELEASED' });

      await runUserAction(alpha, fixture, 'close_deal', fixture.users.operator);

      const deal = await currentDeal(alpha, fixture.dealId);
      expect(deal.status).toBe('CLOSED');
      // 19 commands = 19 version increments from 0
      expect(Number(deal.version)).toBe(19);

      const payment = await alpha.prisma.payment.findUniqueOrThrow({
        where: { id: `payment:${fixture.dealId}` },
      });
      expect(payment.status).toBe('RELEASED');
      expect(BigInt(payment.amountKopecks ?? 0)).toBe(fixture.totalKopecks);

      const ledger = await alpha.prisma.ledgerEntry.findMany({ where: { dealId: fixture.dealId } });
      expect(ledger).toHaveLength(2);
      for (const entry of ledger) {
        expect(BigInt(entry.amountKopecks)).toBe(fixture.totalKopecks);
      }

      const events = await alpha.prisma.dealEvent.findMany({
        where: { dealId: fixture.dealId },
        orderBy: { createdAt: 'asc' },
      });
      expect(events).toHaveLength(19);
      // hash chain is continuous
      for (let i = 1; i < events.length; i += 1) {
        expect(events[i].prevHash).toBe(events[i - 1].hash);
      }
    }
  });

  it('rejects a non-participant command and an out-of-role command without any write', async () => {
    const fixture = await provisionDeal(alpha.prisma, 'authz1', 100_000n);
    const outsider: RequestUser = {
      ...fixture.users.farmer,
      id: 'user-e2e-authz1-outsider',
      sessionId: 'session-outsider',
    };

    await expect(
      alpha.gateway.executeUser(fixture.dealId, 'approve_admission', {
        commandId: 'cmd:outsider-attempt',
        idempotencyKey: 'idem:outsider-attempt',
        expectedUpdatedAt: new Date().toISOString(),
      }, outsider),
    ).rejects.toMatchObject({ status: 403 });

    // farmer cannot approve admission (role gate inside the command service)
    await expect(
      runUserAction(alpha, fixture, 'approve_admission', fixture.users.farmer),
    ).rejects.toMatchObject({ status: 403 });

    const deal = await currentDeal(alpha, fixture.dealId);
    expect(deal.status).toBe('DRAFT');
    expect(Number(deal.version)).toBe(0);
  });

  it('returns 409 for a stale version and for a lost concurrent race, committing exactly one transition', async () => {
    const fixture = await provisionDeal(alpha.prisma, 'race01', 100_000n);
    await runUserAction(alpha, fixture, 'approve_admission', fixture.users.compliance);

    // Stale expectedVersion → 409 before any write
    const live = await currentDeal(alpha, fixture.dealId);
    await expect(
      alpha.commands.execute(fixture.dealId, 'publish_auction', {
        commandId: 'cmd:stale-version',
        idempotencyKey: 'idem:stale-version',
        expectedUpdatedAt: live.updatedAt.toISOString(),
        expectedVersion: '0',
      }, fixture.users.farmer),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'STALE_DEAL_VERSION' }) });

    // Two concurrent distinct commands from the same state → exactly one winner
    const outcomes = await Promise.allSettled([
      runUserAction(alpha, fixture, 'publish_auction', fixture.users.farmer, ':racer-a'),
      runUserAction(alpha, fixture, 'publish_auction', fixture.users.operator, ':racer-b'),
    ]);
    const wins = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const losses = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
    );
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    expect(isAcceptableRaceLoss(losses[0].reason)).toBe(true);

    const deal = await currentDeal(alpha, fixture.dealId);
    expect(deal.status).toBe('AUCTION_OPEN');
    expect(Number(deal.version)).toBe(2);
    const events = await alpha.prisma.dealEvent.count({ where: { dealId: fixture.dealId } });
    expect(events).toBe(2);
  });

  it('collapses a burst of duplicate bank callbacks into exactly one financial effect', async () => {
    const fixture = await provisionDeal(alpha.prisma, 'burst1', 500_000_000n);
    for (const step of USER_SEQUENCE) {
      await runUserAction(alpha, fixture, step.actionId, fixture.users[step.userKey]);
    }

    const callback = bankCallback(fixture, 'RESERVE');
    const BURST = 24;
    const outcomes = await Promise.allSettled(
      Array.from({ length: BURST }, () => alpha.gateway.executeBankCallback(callback)),
    );

    const accepted = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const rejected = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
    );
    expect(accepted.length).toBeGreaterThanOrEqual(1);
    for (const loss of rejected) {
      expect(isAcceptableRaceLoss(loss.reason)).toBe(true);
    }

    // Exactly ONE ledger effect, ONE confirmed bank operation, ONE transition.
    const ledger = await alpha.prisma.ledgerEntry.findMany({
      where: { dealId: fixture.dealId, entryType: 'RESERVE' },
    });
    expect(ledger).toHaveLength(1);
    expect(BigInt(ledger[0].amountKopecks)).toBe(fixture.totalKopecks);

    const operation = await alpha.prisma.bankOperation.findUniqueOrThrow({
      where: { id: `bank-reserve:${fixture.dealId}` },
    });
    expect(operation.status).toBe('DONE');

    const deal = await currentDeal(alpha, fixture.dealId);
    expect(deal.status).toBe('RESERVED');
    expect(Number(deal.version)).toBe(USER_SEQUENCE.length + 1);

    const transitions = await alpha.prisma.dealEvent.count({
      where: { dealId: fixture.dealId, eventType: 'CONFIRM_RESERVE' },
    });
    expect(transitions).toBe(1);

    // A later replay of the same event returns the stored receipt.
    const replay = await alpha.gateway.executeBankCallback(callback);
    expect(replay).toMatchObject({ duplicate: true, status: 'RESERVED' });

    // Same event id with different material payload → replay mismatch, no effect.
    await expect(
      alpha.gateway.executeBankCallback({ ...callback, bankRef: 'FORGED-REFERENCE' }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'BANK_EVENT_REPLAY_MISMATCH' }) });
  });

  it('proves multi-instance consistency and restart survival on shared PostgreSQL state', async () => {
    const fixture = await provisionDeal(alpha.prisma, 'multi1', 300_000n);
    const beta = await createInstance();
    try {
      // Instance A executes; instance B replays the same idempotency key.
      const first = await runUserAction(alpha, fixture, 'approve_admission', fixture.users.compliance);
      const dealAfterFirst = await currentDeal(beta, fixture.dealId);
      expect(dealAfterFirst.status).toBe('ADMISSION_APPROVED');

      const replay = await beta.commands.execute(fixture.dealId, 'approve_admission', {
        commandId: `cmd:${fixture.dealId}:approve_admission`,
        idempotencyKey: `idem:${fixture.dealId}:approve_admission`,
        expectedUpdatedAt: new Date(0).toISOString(), // stale on purpose: replay wins before CAS
        payload: {},
      }, fixture.users.compliance);
      expect(replay).toMatchObject({
        duplicate: true,
        eventId: (first as unknown as { eventId: string }).eventId,
      });

      // Instance B continues the flow — one shared canonical state.
      await runUserAction(beta, fixture, 'publish_auction', fixture.users.farmer);

      // "Restart": a brand-new instance sees identical state with zero warm-up.
      const gamma = await createInstance();
      try {
        const deal = await currentDeal(gamma, fixture.dealId);
        expect(deal.status).toBe('AUCTION_OPEN');
        expect(Number(deal.version)).toBe(2);
        const workspace = await gamma.commands.workspace(fixture.dealId, fixture.users.operator);
        expect(workspace.deal).toMatchObject({ id: fixture.dealId, status: 'AUCTION_OPEN', version: 2 });
      } finally {
        await destroyInstance(gamma);
      }
    } finally {
      await destroyInstance(beta);
    }
  });

  it('enforces append-only deal_events and ledger_entries at the database level', async () => {
    const fixture = await provisionDeal(alpha.prisma, 'worm01', 100_000n);
    await runUserAction(alpha, fixture, 'approve_admission', fixture.users.compliance);

    await expect(
      alpha.prisma.$executeRawUnsafe(
        `UPDATE "deal_events" SET "eventType" = 'TAMPERED' WHERE "dealId" = '${fixture.dealId}'`,
      ),
    ).rejects.toThrow(/append-only/);
    await expect(
      alpha.prisma.$executeRawUnsafe(
        `DELETE FROM "deal_events" WHERE "dealId" = '${fixture.dealId}'`,
      ),
    ).rejects.toThrow(/append-only/);

    await alpha.prisma.ledgerEntry.create({
      data: {
        dealId: fixture.dealId,
        entryType: 'RESERVE',
        debitAccount: `buyer:${fixture.buyerOrgId}`,
        creditAccount: `escrow:${fixture.dealId}`,
        amountKopecks: 100_000n,
        idempotencyKey: `worm-test:${fixture.dealId}`,
      },
    });
    await expect(
      alpha.prisma.$executeRawUnsafe(
        `UPDATE "ledger_entries" SET "amountKopecks" = 1 WHERE "dealId" = '${fixture.dealId}'`,
      ),
    ).rejects.toThrow(/append-only/);
    await expect(
      alpha.prisma.$executeRawUnsafe(
        `DELETE FROM "ledger_entries" WHERE "dealId" = '${fixture.dealId}'`,
      ),
    ).rejects.toThrow(/append-only/);
  });
});
