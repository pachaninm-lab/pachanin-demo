import { describe, expect, it } from 'vitest';
import {
  platformV7BankWebhookCanRetry,
  platformV7BankWebhookEventKey,
  platformV7BankWebhookSort,
  platformV7BankWebhookSummary,
  type PlatformV7BankWebhookEvent,
} from '@/lib/platform-v7/bank-webhooks';

const events: PlatformV7BankWebhookEvent[] = [
  { id: 'w1', dealId: 'DL-1', type: 'reserve_confirmed', status: 'applied', externalRef: 'ext-1', amount: 1_000_000, receivedAt: '2026-04-25T10:00:00.000Z', appliedAt: '2026-04-25T10:01:00.000Z', retryCount: 0 },
  { id: 'w2', dealId: 'DL-1', type: 'release_confirmed', status: 'retryable', externalRef: 'ext-2', amount: 900_000, receivedAt: '2026-04-25T11:00:00.000Z', retryCount: 1, error: 'timeout' },
  { id: 'w3', dealId: 'DL-1', type: 'fee_charged', status: 'received', externalRef: 'ext-3', amount: 1000, receivedAt: '2026-04-25T09:00:00.000Z', retryCount: 0 },
];

describe('platform-v7 bank webhooks', () => {
  it('summarizes webhook statuses and reconciliation blockers', () => {
    const summary = platformV7BankWebhookSummary(events);

    expect(summary.total).toBe(3);
    expect(summary.applied).toBe(1);
    expect(summary.retryable).toBe(1);
    expect(summary.pending).toBe(1);
    expect(summary.blocksReconciliation).toBe(true);
  });

  it('allows retry only for retryable events below retry limit', () => {
    expect(platformV7BankWebhookCanRetry(events[1]!)).toBe(true);
    expect(platformV7BankWebhookCanRetry({ ...events[1]!, retryCount: 3 })).toBe(false);
    expect(platformV7BankWebhookCanRetry(events[0]!)).toBe(false);
  });

  it('sorts events newest first and creates stable keys', () => {
    expect(platformV7BankWebhookSort(events).map((event) => event.id)).toEqual(['w2', 'w1', 'w3']);
    expect(platformV7BankWebhookEventKey(events[0]!)).toBe('DL-1:ext-1:applied');
  });
});
