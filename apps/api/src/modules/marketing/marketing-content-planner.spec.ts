import {
  MARKETING_CADENCE_AUDIENCES,
  MARKETING_CONTENT_ANGLES,
  planNextMarketingContent,
  type MarketingPublishHistoryItem,
} from './marketing-content-planner';

describe('marketing autonomous content planner', () => {
  it('fails closed for malformed requests, implicit local time and unknown channels', () => {
    expect(planNextMarketingContent(null)).toEqual({ allowed: false, reason: 'INVALID_REQUEST' });
    expect(planNextMarketingContent({
      channel: 'TELEGRAM',
      now: '2026-08-24T10:00:00',
      editorialSlot: 0,
      history: [],
    })).toEqual({ allowed: false, reason: 'INVALID_TIME' });
    expect(planNextMarketingContent({
      channel: 'INSTAGRAM',
      now: '2026-08-24T10:00:00.000Z',
      editorialSlot: 0,
      history: [],
    })).toEqual({ allowed: false, reason: 'CHANNEL_NOT_ALLOWLISTED' });
    expect(planNextMarketingContent({
      channel: 'VK',
      now: '2026-08-24T10:00:00.000Z',
      editorialSlot: -1,
      history: [],
    })).toEqual({ allowed: false, reason: 'INVALID_REQUEST' });
  });

  it('rejects invalid and future history instead of silently dropping it', () => {
    expect(planNextMarketingContent({
      channel: 'TELEGRAM',
      now: '2026-08-24T10:00:00.000Z',
      editorialSlot: 0,
      history: [{
        channel: 'TELEGRAM',
        audience: 'FARMER',
        angle: 'PAIN',
        publishedAt: 'not-a-date',
      }],
    })).toEqual({ allowed: false, reason: 'INVALID_HISTORY' });

    expect(planNextMarketingContent({
      channel: 'TELEGRAM',
      now: '2026-08-24T10:00:00.000Z',
      editorialSlot: 0,
      history: [{
        channel: 'TELEGRAM',
        audience: 'FARMER',
        angle: 'PAIN',
        publishedAt: '2026-08-24T10:06:00.000Z',
      }],
    })).toEqual({ allowed: false, reason: 'FUTURE_HISTORY' });
  });

  it('rejects duplicate history even when equivalent instants use different offsets', () => {
    const decision = planNextMarketingContent({
      channel: 'VK',
      now: '2026-08-24T12:00:00.000Z',
      editorialSlot: 0,
      history: [
        { channel: 'VK', audience: 'BUYER', angle: 'TRUST', publishedAt: '2026-08-24T09:00:00.000Z' },
        { channel: 'VK', audience: 'FARMER', angle: 'PROCESS', publishedAt: '2026-08-24T12:00:00.000+03:00' },
      ],
    });
    expect(decision).toEqual({ allowed: false, reason: 'DUPLICATE_HISTORY' });
  });

  it('enforces minimum interval and returns the exact next eligible instant', () => {
    const history: MarketingPublishHistoryItem[] = [{
      channel: 'TELEGRAM',
      audience: 'FARMER',
      angle: 'PROCESS',
      publishedAt: '2026-08-24T10:00:00.000Z',
    }];

    expect(planNextMarketingContent({
      channel: 'TELEGRAM',
      now: '2026-08-24T11:00:00.000Z',
      editorialSlot: 0,
      history,
    })).toEqual({
      allowed: false,
      reason: 'MIN_INTERVAL',
      nextEligibleAt: '2026-08-24T13:00:00.000Z',
    });
  });

  it('uses the Moscow operating day for channel caps', () => {
    const history: MarketingPublishHistoryItem[] = [
      { channel: 'TELEGRAM', audience: 'FARMER', angle: 'PAIN', publishedAt: '2026-08-24T21:10:00.000Z' },
      { channel: 'TELEGRAM', audience: 'BUYER', angle: 'PROCESS', publishedAt: '2026-08-24T21:40:00.000Z' },
      { channel: 'TELEGRAM', audience: 'LOGISTICIAN', angle: 'TRUST', publishedAt: '2026-08-24T22:10:00.000Z' },
      { channel: 'TELEGRAM', audience: 'DRIVER', angle: 'ECONOMICS', publishedAt: '2026-08-24T20:50:00.000Z' },
    ];

    expect(planNextMarketingContent({
      channel: 'TELEGRAM',
      now: '2026-08-24T22:30:00.000Z',
      editorialSlot: 0,
      history,
    })).toEqual({ allowed: false, reason: 'CHANNEL_DAILY_LIMIT' });
  });

  it('does not count another channel against cadence or rotation', () => {
    const history: MarketingPublishHistoryItem[] = [{
      channel: 'VK',
      audience: 'FARMER',
      angle: 'PAIN',
      publishedAt: '2026-08-24T06:00:00.000Z',
    }];

    expect(planNextMarketingContent({
      channel: 'TELEGRAM',
      now: '2026-08-24T10:00:00.000Z',
      editorialSlot: 0,
      history,
    })).toEqual({
      allowed: true,
      reason: 'ALLOW',
      channel: 'TELEGRAM',
      audience: MARKETING_CADENCE_AUDIENCES[0],
      angle: MARKETING_CONTENT_ANGLES[0],
      editorialPillar: 'USEFUL',
      editorialSlot: 0,
      operatingDay: '2026-08-24',
      channelSequence: 1,
    });
  });

  it('rotates toward the least-used audience and angle within the channel', () => {
    const history: MarketingPublishHistoryItem[] = [{
      channel: 'VK',
      audience: 'FARMER',
      angle: 'PAIN',
      publishedAt: '2026-08-23T06:00:00.000Z',
    }];

    const decision = planNextMarketingContent({
      channel: 'VK',
      now: '2026-08-24T10:00:00.000Z',
      editorialSlot: 1,
      history,
    });

    expect(decision).toMatchObject({
      allowed: true,
      audience: MARKETING_CADENCE_AUDIENCES[1],
      angle: MARKETING_CONTENT_ANGLES[1],
      editorialPillar: 'USEFUL',
      channelSequence: 2,
    });
  });

  it('inherits the authoritative 70/20/10 pillar mix from the editorial core', () => {
    const decisions = Array.from({ length: 10 }, (_, editorialSlot) => planNextMarketingContent({
      channel: 'VK',
      now: '2026-08-24T10:00:00.000Z',
      editorialSlot,
      history: [],
    }));
    const pillars = decisions.map((decision) => decision.allowed ? decision.editorialPillar : 'BLOCKED');
    expect(pillars.filter((pillar) => pillar === 'USEFUL')).toHaveLength(7);
    expect(pillars.filter((pillar) => pillar === 'PRODUCT_PROOF')).toHaveLength(2);
    expect(pillars.filter((pillar) => pillar === 'CONVERSION')).toHaveLength(1);
  });

  it('does not use pain-based angles for promotional or conversion slots', () => {
    for (const editorialSlot of [7, 8, 9]) {
      const decision = planNextMarketingContent({
        channel: 'VK',
        now: '2026-08-24T10:00:00.000Z',
        editorialSlot,
        history: [],
      });
      expect(decision.allowed).toBe(true);
      if (decision.allowed) expect(decision.angle).not.toBe('PAIN');
    }
  });

  it('bounds authoritative history input', () => {
    const history = Array.from({ length: 5_001 }, (_, index) => ({
      channel: 'VK' as const,
      audience: 'FARMER' as const,
      angle: 'TRUST' as const,
      publishedAt: `2026-08-01T00:${String(index % 60).padStart(2, '0')}:00.000Z`,
    }));
    expect(planNextMarketingContent({
      channel: 'VK',
      now: '2026-08-24T10:00:00.000Z',
      editorialSlot: 0,
      history,
    })).toEqual({ allowed: false, reason: 'HISTORY_TOO_LARGE' });
  });
});
