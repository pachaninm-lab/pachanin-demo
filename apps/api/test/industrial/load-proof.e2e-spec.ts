import { ConflictException } from '@nestjs/common';
import type { ExecuteDealCommandDto } from '../../src/modules/deals/dto/execute-deal-command.dto';
import type { DealActionId } from '../../src/modules/deals/deal-command.policy';
import {
  cleanTenant,
  createInstance,
  destroyInstance,
  payloadForAction,
  prepareLaboratoryLifecycle,
  provisionDeal,
  type DealFixture,
  type ServiceInstance,
} from './harness';

/**
 * CI-scale correctness proof. Every physical, laboratory and documentary step
 * uses an explicit controlled-test payload backed by PostgreSQL fixtures. Empty
 * payloads are intentionally forbidden by deal-command-no-fake-live.e2e-spec.
 * This is not a production-like load acceptance.
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

type CycleDiagnostic = { fixtureIndex: number; phase: string; attempt: number };

// Only fixed classifications leave the test: never serialize error messages,
// stacks, SQL, payloads, identifiers or arbitrary database/provider metadata.
function safeFailureClasses(error: unknown): ReadonlyArray<{ kind: string; code: string; databaseCode: string }> {
  const classes: Array<{ kind: string; code: string; databaseCode: string }> = [];
  const seen = new Set<unknown>();
  let current = error;
  while (current && typeof current === 'object' && !seen.has(current) && classes.length < 3) {
    seen.add(current);
    const value = current as { name?: unknown; code?: unknown; meta?: { code?: unknown }; cause?: unknown };
    const kind = current instanceof ConflictException ? 'ConflictException'
      : ['Error', 'AggregateError', 'PrismaClientKnownRequestError', 'NotFoundException', 'ForbiddenException', 'BadRequestException'].find((name) => value.name === name) ?? 'unknown';
    const code = ['P2002', 'P2010', 'P2025', 'P2034'].find((code) => value.code === code) ?? 'unknown';
    const databaseCode = ['40001', '40P01', '23505'].find((code) => value.meta?.code === code) ?? 'unknown';
    classes.push({ kind, code, databaseCode });
    current = value.cause;
  }
  return classes.length ? classes : [{ kind: 'unknown', code: 'unknown', databaseCode: 'unknown' }];
}

async function runStep(
  instance: ServiceInstance,
  fixture: DealFixture,
  actionId: DealActionId,
  userKey: string,
  diagnostic: CycleDiagnostic,
): Promise<void> {
  const MAX_ATTEMPTS = 12;
  diagnostic.phase = actionId;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    diagnostic.attempt = attempt + 1;
    const deal = await instance.prisma.deal.findUniqueOrThrow({
      where: { id: fixture.dealId },
      select: { updatedAt: true, version: true },
    });
    const dto: ExecuteDealCommandDto = {
      commandId: `load:${fixture.dealId}:${actionId}`,
      idempotencyKey: `load-idem:${fixture.dealId}:${actionId}`,
      expectedUpdatedAt: deal.updatedAt.toISOString(),
      expectedVersion: deal.version.toString(),
      payload: payloadForAction(fixture, actionId),
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
  diagnostic: CycleDiagnostic,
): Promise<void> {
  diagnostic.phase = operation === 'RESERVE' ? 'bank_reserve' : 'bank_release';
  diagnostic.attempt = 0; // Existing initial three-callback race, before retries.
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
  const outcomes = await Promise.allSettled([
    instance.gateway.executeBankCallback(callback),
    instance.gateway.executeBankCallback(callback),
    instance.gateway.executeBankCallback(callback),
  ]);
  if (outcomes.some((outcome) => outcome.status === 'fulfilled')) return;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    diagnostic.attempt = attempt + 1;
    try {
      await instance.gateway.executeBankCallback(callback);
      return;
    } catch (error) {
      if (!isRetryable(error) || attempt === 11) throw error;
      await backoff(attempt);
    }
  }
}

async function runDealCycle(fixture: DealFixture, index: number): Promise<void> {
  const diagnostic: CycleDiagnostic = { fixtureIndex: index, phase: 'start', attempt: 0 };
  try {
    for (let step = 0; step < USER_STEPS.length; step += 1) {
      const instance = (index + step) % 2 === 0 ? alpha : beta;
      await runStep(instance, fixture, USER_STEPS[step].actionId, USER_STEPS[step].userKey, diagnostic);
    }
    await bankConfirm(index % 2 === 0 ? alpha : beta, fixture, 'RESERVE', diagnostic);
    for (let step = 0; step < POST_RESERVE_STEPS.length; step += 1) {
      const instance = (index + step) % 2 === 0 ? beta : alpha;
      const currentStep = POST_RESERVE_STEPS[step];
      if (currentStep.actionId === 'finalize_lab') {
        diagnostic.phase = 'prepare_laboratory';
        diagnostic.attempt = 1;
        await prepareLaboratoryLifecycle(instance, fixture);
      }
      await runStep(instance, fixture, currentStep.actionId, currentStep.userKey, diagnostic);
    }
    await bankConfirm(index % 2 === 0 ? beta : alpha, fixture, 'RELEASE', diagnostic);
    await runStep(alpha, fixture, 'close_deal', 'operator', diagnostic);
  } catch (error) {
    try {
      console.error(`[industrial-load-failure] ${JSON.stringify({ ...diagnostic, errors: safeFailureClasses(error) })}`);
    } finally {
      // Diagnostic formatting must never replace the original rejected reason.
      throw error;
    }
  }
}

describe('Industrial core load proof on two instances', () => {
  it('reports allowlisted nested failure classifications without private error data', () => {
    const cause = Object.assign(new Error('private SQL and credentials'), { code: 'P2034', meta: { code: '40001', query: 'private' } });
    const error = Object.assign(new ConflictException('private bank reference'), { cause });
    expect(safeFailureClasses(error)).toEqual([
      { kind: 'ConflictException', code: 'unknown', databaseCode: 'unknown' },
      { kind: 'Error', code: 'P2034', databaseCode: '40001' },
    ]);
    expect(JSON.stringify(safeFailureClasses(error))).not.toContain('private');
  });

  it('bounds cyclic causes and rejects arbitrary classifications', () => {
    const error: { name: string; code: string; meta: { code: string }; cause?: unknown } = {
      name: 'private name', code: 'private code', meta: { code: 'private database' },
    };
    error.cause = error;
    expect(safeFailureClasses(error)).toEqual([{ kind: 'unknown', code: 'unknown', databaseCode: 'unknown' }]);
    expect(safeFailureClasses('private thrown value')).toEqual([{ kind: 'unknown', code: 'unknown', databaseCode: 'unknown' }]);
    expect(safeFailureClasses({ cause: { cause: { cause: { code: 'P2034' } } } })).toHaveLength(3);
  });

  it(`drives ${DEALS} deals through full concurrent cycles with zero duplicate money`, async () => {
    latenciesMs.length = 0;
    const fixtures: DealFixture[] = [];
    for (let index = 0; index < DEALS; index += 1) {
      fixtures.push(await provisionDeal(alpha.prisma, `load${String(index).padStart(2, '0')}`, 240_000_000n + BigInt(index)));
    }

    const startedAt = Date.now();
    const outcomes = await Promise.allSettled(
      fixtures.map((fixture, index) => runDealCycle(fixture, index)),
    );
    const failures = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
    if (failures.length > 0) {
      throw new AggregateError(
        failures.map((failure) => failure.reason),
        `${failures.length} of ${fixtures.length} concurrent Deal cycles failed`,
      );
    }
    const wallMs = Date.now() - startedAt;

    for (const fixture of fixtures) {
      const deal = await alpha.prisma.deal.findUniqueOrThrow({ where: { id: fixture.dealId } });
      expect(deal.status).toBe('CLOSED');
      expect(Number(deal.version)).toBe(19);

      const ledger = await alpha.prisma.ledgerEntry.findMany({ where: { dealId: fixture.dealId } });
      expect(ledger).toHaveLength(2);
      expect(new Set(ledger.map((entry) => entry.entryType))).toEqual(new Set(['RESERVE', 'RELEASE']));
      for (const entry of ledger) expect(BigInt(entry.amountKopecks)).toBe(fixture.totalKopecks);

      const events = await alpha.prisma.dealEvent.findMany({
        where: { dealId: fixture.dealId },
        orderBy: { createdAt: 'asc' },
      });
      expect(events).toHaveLength(19);
      for (let i = 1; i < events.length; i += 1) expect(events[i].prevHash).toBe(events[i - 1].hash);
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
      environment: 'GitHub Actions CI-scale correctness proof; not production-like load',
    };
    // eslint-disable-next-line no-console
    console.log(`[industrial-load-proof] ${JSON.stringify(evidence)}`);

    expect(latenciesMs.length).toBe(DEALS * 17);
    expect(evidence.commandP95Ms).toBeLessThanOrEqual(800);
  });
});
