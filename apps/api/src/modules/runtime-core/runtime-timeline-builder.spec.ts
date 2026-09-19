import { RuntimeTimelineBuilder, TIMELINE_STATUSES } from './runtime-timeline-builder';

const builder = new RuntimeTimelineBuilder();

describe('RuntimeTimelineBuilder — buildTimeline', () => {
  const createdAt = '2026-01-01T00:00:00.000Z';

  it('emits one entry per status up to and including the current one', () => {
    const timeline = builder.buildTimeline({ status: 'SIGNED', createdAt, owner: 'Сделка' });
    expect(timeline.map((e) => e.status)).toEqual(['DRAFT', 'AWAITING_SIGN', 'SIGNED']);
  });

  it('steps timestamps by +2h and marks the current actor as the owner', () => {
    const timeline = builder.buildTimeline({ status: 'AWAITING_SIGN', createdAt, owner: 'Документы' });
    expect(timeline[0].timestamp).toBe('2026-01-01T00:00:00.000Z');
    expect(timeline[1].timestamp).toBe('2026-01-01T02:00:00.000Z');
    expect(timeline[0].actor).toBe('system');
    expect(timeline[1].actor).toBe('Документы'); // current index → owner
  });

  it('falls back to index 0 for an unknown status', () => {
    const timeline = builder.buildTimeline({ status: 'DISPUTE_OPEN', createdAt, owner: 'Контроль' });
    expect(timeline).toHaveLength(1);
    expect(timeline[0].status).toBe('DRAFT');
    expect(timeline[0].actor).toBe('Контроль');
  });

  it('covers the full happy path at CLOSED', () => {
    const timeline = builder.buildTimeline({ status: 'CLOSED', createdAt, owner: 'Сделка' });
    expect(timeline).toHaveLength(TIMELINE_STATUSES.length);
  });
});

describe('RuntimeTimelineBuilder — buildPassport', () => {
  it('projects deal + payment into the passport shape', () => {
    const deal = {
      id: 'DEAL-1',
      status: 'IN_TRANSIT',
      sellerOrgId: 'S1',
      buyerOrgId: 'B1',
      volumeTons: 100,
      pricePerTon: 15000,
      totalRub: 1500000,
      currency: 'RUB',
      lotId: 'LOT-1',
      culture: 'wheat',
      region: 'Краснодар',
      createdAt: '2026-01-01T00:00:00.000Z',
      signedAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
    };
    const payment = {
      status: 'RESERVED',
      amountRub: 1500000,
      disputedAmountRub: 0,
      undisputedAmountRub: 1500000,
      bankEventId: 'BANK-EVT-101',
    };
    expect(builder.buildPassport(deal, payment)).toEqual({
      id: 'DEAL-1',
      status: 'IN_TRANSIT',
      parties: { seller: { orgId: 'S1' }, buyer: { orgId: 'B1' } },
      metrics: { volumeTons: 100, pricePerTon: 15000, totalRub: 1500000, currency: 'RUB' },
      lot: { id: 'LOT-1', culture: 'wheat', region: 'Краснодар' },
      money: {
        status: 'RESERVED',
        amountRub: 1500000,
        disputedAmountRub: 0,
        undisputedAmountRub: 1500000,
        bankEventId: 'BANK-EVT-101',
      },
      dates: {
        createdAt: '2026-01-01T00:00:00.000Z',
        signedAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-03T00:00:00.000Z',
      },
    });
  });

  it('defaults missing signedAt / updatedAt to null', () => {
    const passport = builder.buildPassport(
      { id: 'D', status: 'DRAFT', createdAt: '2026-01-01T00:00:00.000Z' },
      { status: 'PENDING', amountRub: 0 },
    );
    expect(passport.dates.signedAt).toBeNull();
    expect(passport.dates.updatedAt).toBeNull();
  });
});
