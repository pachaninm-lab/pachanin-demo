import { describe, expect, it } from 'vitest';
import { MARKET_PRICE_RECORDS, MARKET_ROUTE_QUOTES } from '@/lib/platform-v7/market-entry-foundation';
import { buildMarketIntentDraft } from '@/lib/platform-v7/market-entry-intent';
import { canExposeMarketIntentAsDurable, unavailableMarketIntentDurableAdapter } from '@/lib/platform-v7/market-entry-durable';

describe('market intent durable boundary', () => {
  it('fails closed while durable adapter is not wired', async () => {
    const draft = buildMarketIntentDraft('sell', '220', MARKET_PRICE_RECORDS[0], MARKET_ROUTE_QUOTES[0]);
    const result = await unavailableMarketIntentDurableAdapter.saveMarketIntent({ ownerId: 'seller-1', auditEventId: 'audit-1', draft: draft! });

    expect(result.status).toBe('unavailable');
    expect(canExposeMarketIntentAsDurable(result)).toBe(false);
  });
});
