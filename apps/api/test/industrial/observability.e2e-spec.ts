import { register } from 'prom-client';
import { IndustrialMetricsService } from '../../src/modules/integration-events/industrial-metrics.service';
import type { ExecuteDealCommandDto } from '../../src/modules/deals/dto/execute-deal-command.dto';
import type { DealActionId } from '../../src/modules/deals/deal-command.policy';
import { cleanTenant, createInstance, destroyInstance, provisionDeal, type ServiceInstance } from './harness';

/**
 * Block 3 — Observability on real PostgreSQL.
 *
 * Proves:
 *  - the correlation timeline merges deal events, audit, outbox, bank
 *    operations and matched statement rows into one chronological view,
 *    scoped to deal participants only;
 *  - the /metrics gauges report shared PostgreSQL truth (outbox depth,
 *    dead letters, open reconciliation mismatches, key revocations).
 */

jest.setTimeout(120_000);

let alpha: ServiceInstance;

beforeAll(async () => {
  alpha = await createInstance();
  await cleanTenant(alpha.prisma);
});

afterAll(async () => {
  await cleanTenant(alpha.prisma);
  await destroyInstance(alpha);
});

async function runAction(fixture: Awaited<ReturnType<typeof provisionDeal>>, actionId: DealActionId, userKey: string) {
  const deal = await alpha.prisma.deal.findUniqueOrThrow({
    where: { id: fixture.dealId },
    select: { updatedAt: true, version: true },
  });
  const dto: ExecuteDealCommandDto = {
    commandId: `cmd:${fixture.dealId}:${actionId}`,
    idempotencyKey: `idem:${fixture.dealId}:${actionId}`,
    expectedUpdatedAt: deal.updatedAt.toISOString(),
    expectedVersion: deal.version.toString(),
    payload: {},
  };
  return alpha.commands.execute(fixture.dealId, actionId, dto, fixture.users[userKey]);
}

describe('Correlation timeline', () => {
  it('merges every evidence source in chronological order for participants only', async () => {
    const fixture = await provisionDeal(alpha.prisma, 'tl01', 500_000_000n);

    for (const [actionId, userKey] of [
      ['approve_admission', 'compliance'],
      ['publish_auction', 'farmer'],
      ['place_winning_bid', 'buyer'],
      ['seller_sign_contract', 'farmer'],
      ['buyer_sign_contract', 'buyer'],
      ['request_reserve', 'buyer'],
    ] as Array<[DealActionId, string]>) {
      await runAction(fixture, actionId, userKey);
    }
    await alpha.gateway.executeBankCallback({
      dealId: fixture.dealId,
      eventId: `bank-event-${fixture.dealId}-tl`,
      operation: 'RESERVE',
      status: 'SUCCESS',
      bankRef: 'REF-TL-0001',
      operationId: `bank-reserve:${fixture.dealId}`,
      partnerId: 'safe-deals',
    });

    const timeline = await alpha.gateway.correlationTimeline(fixture.dealId, fixture.users.operator);
    expect(timeline.dealId).toBe(fixture.dealId);
    expect(timeline.count).toBeGreaterThanOrEqual(15);

    const sources = new Set(timeline.items.map((item) => item.source));
    expect(sources).toContain('deal_event');
    expect(sources).toContain('audit');
    expect(sources).toContain('outbox');
    expect(sources).toContain('bank_operation');

    // Chronological order holds across sources.
    const stamps = timeline.items.map((item) => item.at);
    expect([...stamps].sort()).toEqual(stamps);

    // The confirmed reserve is present from both the money and evidence sides.
    expect(timeline.items.some((item) => item.source === 'bank_operation' && item.summary.includes('RESERVE'))).toBe(true);
    expect(timeline.items.some((item) => item.source === 'deal_event' && item.kind === 'CONFIRM_RESERVE')).toBe(true);

    // A non-participant is rejected before any read happens.
    const outsider = { ...fixture.users.operator, id: 'user-tl-outsider', sessionId: 'session-tl-outsider' };
    await expect(alpha.gateway.correlationTimeline(fixture.dealId, outsider)).rejects.toMatchObject({ status: 403 });
  });
});

describe('Industrial /metrics gauges', () => {
  it('reports outbox depth, mismatches and revocations from shared PostgreSQL state', async () => {
    // Seed one of each observable condition.
    await alpha.prisma.outboxEntry.create({
      data: { type: 'industrial.e2e.metrics', status: 'DEAD_LETTER', payload: {}, deadLetterAt: new Date() },
    });
    void new IndustrialMetricsService(alpha.prisma);

    const scrape = await register.metrics();
    expect(scrape).toContain('pc_outbox_entries{status="DEAD_LETTER"}');
    expect(scrape).toContain('pc_outbox_oldest_pending_seconds');
    expect(scrape).toContain('pc_reconciliation_open_mismatches');
    expect(scrape).toContain('pc_bank_key_revocations_total');
    expect(scrape).toContain('pc_bank_callback_key_rejections_24h');

    const deadLetterLine = scrape
      .split('\n')
      .find((line) => line.startsWith('pc_outbox_entries{status="DEAD_LETTER"}'));
    expect(Number(deadLetterLine?.split(' ').at(-1))).toBeGreaterThanOrEqual(1);

    await alpha.prisma.outboxEntry.deleteMany({ where: { type: 'industrial.e2e.metrics' } });
  });
});
