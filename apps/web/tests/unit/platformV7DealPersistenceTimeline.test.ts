import { describe, expect, it } from 'vitest';
import { buildDealPersistenceTimeline, summarizeDealPersistenceTimeline } from '@/lib/v7r/deal-persistence-timeline';

describe('v7r deal persistence timeline projection', () => {
  it('projects successful money events for DL-9109', () => {
    const summary = summarizeDealPersistenceTimeline('DL-9109');

    expect(summary.dealId).toBe('DL-9109');
    expect(summary.total).toBe(2);
    expect(summary.success).toBe(2);
    expect(summary.danger).toBe(0);
    expect(summary.events.map((event) => event.actor)).toEqual(['Система сверки', 'Банк']);
  });

  it('projects manual review money events for DL-9102', () => {
    const summary = summarizeDealPersistenceTimeline('DL-9102');

    expect(summary.total).toBe(4);
    expect(summary.success).toBe(2);
    expect(summary.danger).toBe(2);
    expect(summary.events.some((event) => event.action.includes('AMOUNT_MISMATCH'))).toBe(true);
  });

  it('returns an honest empty projection for deals without persistence events', () => {
    expect(buildDealPersistenceTimeline('DL-9999')).toEqual([]);
    expect(summarizeDealPersistenceTimeline('DL-9999')).toEqual({
      dealId: 'DL-9999',
      total: 0,
      danger: 0,
      success: 0,
      events: [],
    });
  });
});
