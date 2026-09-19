import { describe, expect, it } from 'vitest';
import {
  filterPlatformV7DealTimeline,
  platformV7DealTimelineEventKey,
  platformV7DealTimelineSummary,
  sortPlatformV7DealTimeline,
  type PlatformV7DealTimelineEvent,
} from '@/lib/platform-v7/deal-workspace-timeline';

const events: PlatformV7DealTimelineEvent[] = [
  { id: 'e1', type: 'document', actor: 'Оператор', action: 'Документы собраны', at: '2026-04-25T10:00:00.000Z', severity: 'success' },
  { id: 'e2', type: 'money', actor: 'Банк', action: 'Запрошен выпуск', at: '2026-04-25T11:00:00.000Z', severity: 'warning' },
  { id: 'e3', type: 'dispute', actor: 'Арбитр', action: 'Спор открыт', at: '2026-04-25T09:00:00.000Z', severity: 'danger' },
];

describe('platform-v7 deal workspace timeline', () => {
  it('sorts events newest first', () => {
    expect(sortPlatformV7DealTimeline(events).map((event) => event.id)).toEqual(['e2', 'e1', 'e3']);
  });

  it('filters events by type and severity', () => {
    expect(filterPlatformV7DealTimeline(events, { type: 'money' }).map((event) => event.id)).toEqual(['e2']);
    expect(filterPlatformV7DealTimeline(events, { severity: 'danger' }).map((event) => event.id)).toEqual(['e3']);
  });

  it('builds stable event keys', () => {
    expect(platformV7DealTimelineEventKey(events[0]!)).toBe('e1:2026-04-25T10:00:00.000Z');
  });

  it('summarizes events by type', () => {
    expect(platformV7DealTimelineSummary(events)).toMatchObject({
      document: 1,
      money: 1,
      dispute: 1,
      logistics: 0,
    });
  });
});
