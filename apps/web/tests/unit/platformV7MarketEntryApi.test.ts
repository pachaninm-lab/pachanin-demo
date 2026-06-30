import { describe, expect, it } from 'vitest';
import { MARKET_PRICE_RECORDS, MARKET_ROUTE_QUOTES } from '@/lib/platform-v7/market-entry-foundation';
import { buildMarketIntentApiResult, parseMarketIntentApiInput } from '@/lib/platform-v7/market-entry-api';

describe('market intent api validation', () => {
  it('accepts valid pre-deal intent payload', () => {
    const result = buildMarketIntentApiResult({
      side: 'sell',
      volume: '220',
      sourcePriceId: MARKET_PRICE_RECORDS[0].id,
      routeId: MARKET_ROUTE_QUOTES[0].id,
    });
    expect(result.status).toBe('accepted_preintegration');
    expect(result.draft?.idempotencyKey).toContain('market-intent:sell');
    expect(result.draft?.sourcePriceId).toBe(MARKET_PRICE_RECORDS[0].id);
  });

  it('rejects invalid payloads and missing references', () => {
    expect(parseMarketIntentApiInput({ side: 'other' })).toBeNull();
    expect(buildMarketIntentApiResult({ side: 'buy', volume: '0', sourcePriceId: MARKET_PRICE_RECORDS[0].id, routeId: MARKET_ROUTE_QUOTES[0].id }).status).toBe('rejected');
    expect(buildMarketIntentApiResult({ side: 'buy', volume: '1', sourcePriceId: 'missing', routeId: MARKET_ROUTE_QUOTES[0].id }).status).toBe('rejected');
  });
});
