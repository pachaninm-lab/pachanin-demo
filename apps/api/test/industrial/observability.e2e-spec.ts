import { register } from 'prom-client';
import { IndustrialMetricsService } from '../../src/modules/integration-events/industrial-metrics.service';
import type { ExecuteDealCommandDto } from '../../src/modules/deals/dto/execute-deal-command.dto';
import type { DealActionId } from '../../src/modules/deals/deal-command.policy';
import { cleanTenant, createInstance, destroyInstance, payloadForAction, provisionDeal, type ServiceInstance } from './harness';

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
    payload: payloadForAction(fixture, actionId),
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

    const stamps = timeline.items.map((item) => item.at);
    expect([...stamps].sort()).toEqual(stamps);
    expect(timeline.items.some((item) => item.source === 'bank_operation' && item.summary.includes('RESERVE'))).toBe(true);
    expect(timeline.items.some((item) => item.source === 'deal_event' && item.kind === 'CONFIRM_RESERVE')).toBe(true);

    const outsider = { ...fixture.users.operator, id: 'user-tl-outsider', sessionId: 'session-tl-outsider' };
    await expect(alpha.gateway.correlationTimeline(fixture.dealId, outsider)).rejects.toMatchObject({ status: 403 });
  });
});

describe('Participant-scoped accessible deals list', () => {
  it('returns only deals where the user is an ACTIVE participant, JSON-safe and bounded', async () => {
    const mine = await provisionDeal(alpha.prisma, 'list01', 9_876_543_210_987n);
    const foreign = await provisionDeal(alpha.prisma, 'list02', 100_000n);

    const listing = await alpha.gateway.listAccessibleDeals(mine.users.buyer, 10);
    const ids = listing.items.map((item) => (item as { id: string }).id);
    expect(ids).toContain(mine.dealId);
    expect(ids).not.toContain(foreign.dealId);

    const row = listing.items.find((item) => (item as { id: string }).id === mine.dealId) as Record<string, unknown>;
    expect(() => JSON.stringify(listing)).not.toThrow();
    expect(row.totalKopecks).toBe(9_876_543_210_987);
    expect(typeof row.version).toBe('number');
    expect(row.myRole).toBe('BUYER');

    const outsider = { ...mine.users.buyer, id: 'user-list-outsider', sessionId: 'session-list-outsider' };
    await expect(alpha.gateway.listAccessibleDeals(outsider)).resolves.toMatchObject({ count: 0, items: [] });
  });
});

describe('Industrial /metrics gauges', () => {
  it('reports outbox depth, mismatches and revocations from shared PostgreSQL state', async () => {
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