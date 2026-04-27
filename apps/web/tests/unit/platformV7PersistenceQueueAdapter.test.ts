import { describe, expect, it } from 'vitest';
import { buildStableV7rPersistenceState, buildStableV7rPersistenceSummary } from '@/lib/v7r/persistence-queue';

describe('v7r persistence queue adapter', () => {
  it('builds stable append-only persistence state for bank runtime demo data', () => {
    const state = buildStableV7rPersistenceState();

    expect(state.ledger).toHaveLength(3);
    expect(state.queue).toHaveLength(8);
    expect(state.actionLog).toHaveLength(4);
    expect(state.ledger.map((entry) => entry.dealId)).toEqual(['DL-9103', 'DL-9109', 'DL-9102']);
  });

  it('keeps mismatched callback in manual review without creating a false ledger fact', () => {
    const state = buildStableV7rPersistenceState();
    const dl9102LedgerEntries = state.ledger.filter((entry) => entry.dealId === 'DL-9102');
    const dl9102ManualItems = state.queue.filter((item) => item.dealId === 'DL-9102' && item.status === 'manual_review');

    expect(dl9102LedgerEntries).toHaveLength(1);
    expect(dl9102LedgerEntries[0]?.amount).toBe(624_000);
    expect(dl9102ManualItems).toHaveLength(2);
    expect(dl9102ManualItems.map((item) => item.reason)).toEqual(['AMOUNT_MISMATCH', 'AMOUNT_MISMATCH']);
  });

  it('summarizes ledger, queue, manual review and projected timeline counts', () => {
    const summary = buildStableV7rPersistenceSummary();

    expect(summary.totalLedgerEntries).toBe(3);
    expect(summary.totalQueueItems).toBe(8);
    expect(summary.processedItems).toBe(6);
    expect(summary.manualReviewItems).toBe(1);
    expect(summary.duplicateItems).toBe(0);
    expect(summary.rejectedItems).toBe(0);
    expect(summary.timelineEvents).toBe(8);
    expect(summary.manualQueue).toHaveLength(1);
    expect(summary.manualQueue[0]).toMatchObject({
      dealId: 'DL-9102',
      reason: 'AMOUNT_MISMATCH',
      status: 'manual_review',
    });
  });
});
