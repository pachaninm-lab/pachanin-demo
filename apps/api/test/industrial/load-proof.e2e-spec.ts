import { ConflictException } from '@nestjs/common';
import type { ExecuteDealCommandDto } from '../../src/modules/deals/dto/execute-deal-command.dto';
import type { DealActionId } from '../../src/modules/deals/deal-command.policy';
import {
  cleanTenant,
  createInstance,
  destroyInstance,
  provisionDeal,
  type DealFixture,
  type ServiceInstance,
} from './harness';

/**
 * Load proof (CI-scale) — correctness of the industrial core under
 * concurrency across two independent service instances on one PostgreSQL.
 *
 * This is NOT the production load acceptance (1000 users / 50k deals — that
 * needs a production-like environment). It proves the invariants that scale
 * cannot be allowed to break, at a scale CI can run on every PR:
 *  - N deals driven through the FULL 19-command cycle concurrently, commands
 *    fanned out across two instances → every deal CLOSED, version == 19,
 *    hash chain intact, exactly 2 ledger entries per deal;
 *  - a duplicate-callback storm during the run → exactly one financial
 *    effect per deal;
 *  - zero lost confirmed commands, zero duplicate money, and a recorded
 *    latency distribution as evidence.
 */

jest.setTimeout(300_000);

const DEALS = Number(process.env.INDUSTRIAL_LOAD_DEALS ?? 12);

const USER_STEPS: ReadonlyArray<{ actionId: DealActionId; userKey: string }> = [
  { actionId: 'approve_admission', userKey: 'compliance' },
  { actionId: 'publish_auction', userKey: 'farmer' },
  { actionId: 'place_winning_bid', userKey: 'buyer' },
  { actionId: 'seller_sign_contract', userKey: 'farmer' },
  { actionId: 'buyer_sign_contract', userKey: 'buyer' },
  { actionId: 'request_reserve', userKey: 'buyer' },
];

const POST_RESERVE_STEPS: ReadonlyArray<{ actionId: DealActionId; userKey: string }> = [
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
let beta: ServiceInstance;
const latenciesMs: number[] = [];

beforeAll(async () => {
  alpha = await createInstance();
  beta = await createInstance();
  await cleanTenant(alpha.prisma);
});

afterAll(async () => {
  await cleanTenant(alpha.prisma);
  await destroyInstance(alpha);
  await destroyInstance(beta);
});

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function isRetryable(error: unknown): boolean {
  return (error as { code?: string })?.code === 'P2034' || error instanceof ConflictException;
}

function backoff(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20 * attempt + Math.random() * 60));
}

async function runStep(
  instance: ServiceInstance,
  fixture: DealFixture,
  actionId: DealActionId,
  userKey: string,
): Promise<void> {
  // Bounded retry over transient serialization conflicts: under Serializable
  // isolation PostgreSQL may abort one of two concurrent transactions; the
  // idempotency key stays stable so a retry can never double-execute.
  const MAX_ATTEMPTS = 12;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const deal = await instance.prisma.deal.findUniqueOrThrow({
      where: { id: fixture.dealId },
      select: { updatedAt: true, version: true },
    });
    const dto: ExecuteDealCommandDto = {
      commandId: `load:${fixture.dealId}:${actionId}`,
      idempotencyKey: `load-idem:${fixture.dealId}:${actionId}`,
      expectedUpdatedAt: deal.updatedAt.toISOString(),
      expectedVersion: deal.version.toString(),
      payload: {},
    };
    const startedAt = Date.now();
    try {
      await instance.commands.execute(fixture.dealId, actionId, dto, fixture.users[userKey]);
      latenciesMs.push(Date.now() - startedAt);
      return;
    } catch (error) {
      if (!isRetryable(error) || attempt === MAX_ATTEMPTS - 1) throw error;
      await backoff(attempt);
    }
  }
}

async function bankConfirm(
  instance: ServiceInstance,
  fixture: DealFixture,
  operation: 'RESERVE' | 'RELEASE',
): Promise<void> {
  const kind = operation === 'RESERVE' ? 'bank-reserve' : 'bank-release';
  const callback = {
    dealId: fixture.dealId,
    eventId: `load-bank-${fixture.dealId}-${operation}`,
    operation,
    status: 'SUCCESS' as const,
    bankRef: `LOAD-${operation}-${fixture.dealId}`,
    operationId: `${kind}:${fixture.dealId}`,
    partnerId: 'safe-deals',
  };
  // Callback storm: three concurrent duplicates per confirmation.
  const outcomes = await Promise.allSettled([
    instance.gateway.executeBankCallback(callback),
    instance.gateway.executeBankCallback(callback),
    instance.gateway.executeBankCallback(callback),
  ]);
  if (outcomes.some((outcome) => outcome.status === 'fulfilled')) return;

  // All three lost the serialization race — the bank retries until accepted.
  // The stable event id makes every retry a safe replay, never a re-execution.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await instance.gateway.executeBankCallback(callback);
      return;
    } catch (error) {
      if (!isRetryable(error) || attempt === 11) throw error;
      await backoff(attempt);
    }
  }
}

describe('Industrial core load proof on two instances', () => {
  it(`drives ${DEALS} deals through full concurrent cycles with zero duplicate money`, async () => {
    const fixtures: DealFixture[] = [];
    for (let index = 0; index < DEALS; index += 1) {
      fixtures.push(await provisionDeal(alpha.prisma, `load${String(index).padStart(2, '0')}`, 240_000_000n + BigInt(index)));
    }

    const startedAt = Date.now();
    await Promise.all(
      fixtures.map(async (fixture, index) => {
        // Deals alternate between the two instances; each deal's commands also
        // alternate, so every cycle exercises cross-instance consistency.
        for (let step = 0; step < USER_STEPS.length; step += 1) {
          const instance = (index + step) % 2 === 0 ? alpha : beta;
          await runStep(instance, fixture, USER_STEPS[step].actionId, USER_STEPS[step].userKey);
        }
        await bankConfirm((index % 2 === 0 ? alpha : beta), fixture, 'RESERVE');
        for (let step = 0; step < POST_RESERVE_STEPS.length; step += 1) {
          const instance = (index + step) % 2 === 0 ? beta : alpha;
          await runStep(instance, fixture, POST_RESERVE_STEPS[step].actionId, POST_RESERVE_STEPS[step].userKey);
        }
        await bankConfirm((index % 2 === 0 ? beta : alpha), fixture, 'RELEASE');
        await runStep(alpha, fixture, 'close_deal', 'operator');
      }),
    );
    const wallMs = Date.now() - startedAt;

    // Invariants: nothing lost, nothing doubled, chains intact.
    for (const fixture of fixtures) {
      const deal = await alpha.prisma.deal.findUniqueOrThrow({ where: { id: fixture.dealId } });
      expect(deal.status).toBe('CLOSED');
      expect(Number(deal.version)).toBe(19);

      const ledger = await alpha.prisma.ledgerEntry.findMany({ where: { dealId: fixture.dealId } });
      expect(ledger).toHaveLength(2); // ровно один RESERVE и один RELEASE
      expect(new Set(ledger.map((entry) => entry.entryType))).toEqual(new Set(['RESERVE', 'RELEASE']));
      for (const entry of ledger) {
        expect(BigInt(entry.amountKopecks)).toBe(fixture.totalKopecks);
      }

      const events = await alpha.prisma.dealEvent.findMany({
        where: { dealId: fixture.dealId },
        orderBy: { createdAt: 'asc' },
      });
      expect(events).toHaveLength(19);
      for (let i = 1; i < events.length; i += 1) {
        expect(events[i].prevHash).toBe(events[i - 1].hash);
      }
    }

    const sorted = [...latenciesMs].sort((a, b) => a - b);
    const evidence = {
      deals: DEALS,
      commands: latenciesMs.length,
      wallMs,
      commandP50Ms: percentile(sorted, 50),
      commandP95Ms: percentile(sorted, 95),
      commandP99Ms: percentile(sorted, 99),
      commandsPerSecond: Math.round((latenciesMs.length / wallMs) * 1000),
    };
    // Evidence for the register/PR — printed so the CI log preserves it.
    // eslint-disable-next-line no-console
    console.log(`[industrial-load-proof] ${JSON.stringify(evidence)}`);

    expect(latenciesMs.length).toBe(DEALS * 17); // 17 user commands per deal
    // Command latency target of the ТЗ (p95 ≤ 800ms) at CI scale.
    expect(evidence.commandP95Ms).toBeLessThanOrEqual(800);
  });
});
